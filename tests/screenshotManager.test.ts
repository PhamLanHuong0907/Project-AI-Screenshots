import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSqliteConnection, SqliteDatabase } from '../src/main/database/database'
import { ScreenshotRepository } from '../src/main/database/screenshotRepository'
import { FileOrganizer } from '../src/main/services/fileOrganizer'
import { AIService } from '../src/main/services/aiService'
import { ImageService } from '../src/main/services/imageService'
import { MetadataService } from '../src/main/services/metadataService'
import { ScreenshotWatcher } from '../src/main/services/screenshotWatcher'
import { SettingsService } from '../src/main/services/settingsService'
import {
  generateUniqueFilePath,
  removeVietnameseDiacritics,
  resolveSafeCategoryFolder,
  safeMoveFile,
  sanitizeCategoryPath,
  sanitizeFilename
} from '../src/main/utils/fileUtils'
import { computeBufferSha256, computeFileSha256 } from '../src/main/utils/hashUtils'
import {
  AIAnalysisResponseSchema,
  ConfirmScreenshotSchema,
  IpcIdSchema,
  SearchScreenshotsQuerySchema,
  UpdateScreenshotSchema,
  UpdateSettingsSchema
} from '../src/main/utils/validation'

// Minimal valid 1x1 PNG buffer for file tests
const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('AI Screenshot Manager - Critical Test Suite', () => {
  let tempDir: string
  let db: SqliteDatabase
  let repository: ScreenshotRepository

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-screenshot-test-'))
    db = createSqliteConnection(':memory:')
    repository = new ScreenshotRepository(db)
  })

  afterEach(() => {
    try {
      db.close()
    } catch {
      // Ignore
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  })

  // 1. Filename sanitization
  describe('1. Filename Sanitization (REQ03)', () => {
    it('strips Vietnamese diacritics and converts spaces/invalid chars to underscores', () => {
      expect(removeVietnameseDiacritics('Thiết lập màu sắc KPI Đẹp')).toBe(
        'Thiet lap mau sac KPI Dep'
      )
      const sanitized = sanitizeFilename('Excel: Thiết lập màu sắc KPI / Conditional*?Formatting.png')
      expect(sanitized).toBe('Excel_Thiet_lap_mau_sac_KPI_Conditional_Formatting')
    })

    it('rejects generic names like Screenshot_1 or Image_001 and enforces max 60 chars', () => {
      expect(sanitizeFilename('Screenshot_1', 'Programming')).toBe(
        'Programming_Screenshot_Capture'
      )
      expect(sanitizeFilename('Image_001', 'Database')).toBe('Database_Screenshot_Capture')

      const longName = 'A'.repeat(90)
      const truncated = sanitizeFilename(longName)
      expect(truncated.length).toBeLessThanOrEqual(60)
    })

    it('guards against Windows reserved device filenames', () => {
      expect(sanitizeFilename('CON')).toBe('CON_File')
      expect(sanitizeFilename('NUL')).toBe('NUL_File')
    })
  })

  // 2. Category path validation & path traversal prevention
  describe('2. Category Path Validation & Path Traversal Security (REQ04 & Section 4.5)', () => {
    it('normalizes valid hierarchical categories', () => {
      expect(sanitizeCategoryPath('Data-Analytics\\Excel')).toBe('Data-Analytics/Excel')
      expect(sanitizeCategoryPath('Programming/React')).toBe('Programming/React')
    })

    it('strips parent directory traversal segments ("..") and invalid characters', () => {
      expect(sanitizeCategoryPath('../../Windows/System32')).toBe('Windows/System32')
      expect(sanitizeCategoryPath('../../../')).toBe('Others')
    })

    it('resolves safe destination folder strictly inside destination root', () => {
      const baseDest = path.join(tempDir, 'AI-Screenshots')
      const resolved = resolveSafeCategoryFolder(baseDest, '../../Data-Analytics/PowerBI')
      expect(resolved.startsWith(path.resolve(baseDest))).toBe(true)
      expect(resolved).toBe(path.join(path.resolve(baseDest), 'Data-Analytics', 'PowerBI'))
    })
  })

  // 3. Duplicate image detection via SHA-256
  describe('3. SHA-256 Duplicate Detection (REQ02 & Section 10)', () => {
    it('computes identical SHA-256 hashes for identical image files and detects duplicates in SQLite', async () => {
      const fileA = path.join(tempDir, 'shotA.png')
      const fileB = path.join(tempDir, 'shotB.png')
      fs.writeFileSync(fileA, SAMPLE_PNG_BUFFER)
      fs.writeFileSync(fileB, SAMPLE_PNG_BUFFER)

      const hashA = await computeFileSha256(fileA)
      const hashB = await computeFileSha256(fileB)
      expect(hashA).toBe(hashB)
      expect(hashA).toBe(computeBufferSha256(SAMPLE_PNG_BUFFER))

      const first = repository.create({
        original_name: 'shotA.png',
        original_path: fileA,
        file_hash: hashA,
        suggested_name: 'Excel_Sales_Report',
        category: 'Data-Analytics/Excel',
        description: 'Báo cáo doanh thu Excel',
        tags: ['Excel', 'Sales'],
        confidence: 0.92,
        status: 'review'
      })

      const foundDup = repository.findAnalyzedByHash(hashB)
      expect(foundDup).not.toBeNull()
      expect(foundDup?.id).toBe(first.id)
      expect(foundDup?.suggested_name).toBe('Excel_Sales_Report')
    })
  })

  // 4. Unique filename generation
  describe('4. Unique Filename Generation (REQ05 & REQ06)', () => {
    it('appends incremental suffixes (_1, _2) instead of overwriting existing files', () => {
      const targetDir = path.join(tempDir, 'Programming', 'React')
      fs.mkdirSync(targetDir, { recursive: true })

      const firstPath = generateUniqueFilePath(targetDir, 'React_API_Error_Response', '.png')
      expect(path.basename(firstPath)).toBe('React_API_Error_Response.png')
      fs.writeFileSync(firstPath, SAMPLE_PNG_BUFFER)

      const secondPath = generateUniqueFilePath(targetDir, 'React_API_Error_Response', '.png')
      expect(path.basename(secondPath)).toBe('React_API_Error_Response_1.png')
      fs.writeFileSync(secondPath, SAMPLE_PNG_BUFFER)

      const thirdPath = generateUniqueFilePath(targetDir, 'React_API_Error_Response', '.png')
      expect(path.basename(thirdPath)).toBe('React_API_Error_Response_2.png')
    })
  })

  // 5 & 6. Safe file movement & Cross-drive fallback
  describe('5 & 6. Safe File Movement & Cross-Drive Fallback (REQ06)', () => {
    it('moves files safely using copy + SHA-256 verification + unlink when cross-drive fallback is triggered', async () => {
      const srcFile = path.join(tempDir, 'source_capture.png')
      const destFile = path.join(tempDir, 'dest', 'Data-Analytics', 'Excel', 'Excel_KPI.png')
      fs.writeFileSync(srcFile, SAMPLE_PNG_BUFFER)

      // Force cross-drive copy/verify/unlink fallback path
      await safeMoveFile(srcFile, destFile, true)

      expect(fs.existsSync(srcFile)).toBe(false)
      expect(fs.existsSync(destFile)).toBe(true)
      const movedHash = await computeFileSha256(destFile)
      expect(movedHash).toBe(computeBufferSha256(SAMPLE_PNG_BUFFER))
    })

    it('never overwrites an existing destination file', async () => {
      const srcFile = path.join(tempDir, 'src.png')
      const destFile = path.join(tempDir, 'existing.png')
      fs.writeFileSync(srcFile, SAMPLE_PNG_BUFFER)
      fs.writeFileSync(destFile, SAMPLE_PNG_BUFFER)

      await expect(safeMoveFile(srcFile, destFile)).rejects.toThrow(/already exists/i)
      // Original file is preserved
      expect(fs.existsSync(srcFile)).toBe(true)
    })
  })

  // 7. Zod AI response validation
  describe('7. Zod AI Response Validation (REQ02 & REQ03)', () => {
    it('validates and sanitizes valid structured AI output', () => {
      const rawOutput = {
        suggestedName: 'Excel_KPI_Conditional_Formatting',
        category: 'Data-Analytics/Excel',
        description: 'Thiết lập màu sắc KPI theo giá trị âm và dương',
        tags: ['Excel', 'KPI', 'Conditional Formatting'],
        confidence: 0.95
      }

      const parsed = AIAnalysisResponseSchema.parse(rawOutput)
      expect(parsed.suggestedName).toBe('Excel_KPI_Conditional_Formatting')
      expect(parsed.category).toBe('Data-Analytics/Excel')
      expect(parsed.confidence).toBe(0.95)
    })

    it('rejects malformed AI output (e.g., confidence out of range or empty tags)', () => {
      const invalidOutput = {
        suggestedName: 'Test_Name',
        category: 'Others',
        description: 'Desc',
        tags: [],
        confidence: 1.5
      }
      const res = AIAnalysisResponseSchema.safeParse(invalidOutput)
      expect(res.success).toBe(false)
    })
  })

  // 8. Database CRUD & Search operations
  describe('8. SQLite Database CRUD & Search Operations (REQ07 & REQ10)', () => {
    it('creates, updates, searches by filename/category/tag, and computes dashboard stats', () => {
      const rec1 = repository.create({
        original_name: 'Screenshot 2026-11-18.png',
        original_path: path.join(tempDir, 's1.png'),
        file_hash: 'hash_1',
        suggested_name: 'Database_University_ERD',
        final_name: 'Database_University_ERD.png',
        category: 'Database/ERD',
        description: 'Sơ đồ thực thể liên kết quản lý sinh viên đại học',
        tags: ['Database', 'ERD', 'SQL'],
        confidence: 0.96,
        status: 'saved'
      })

      repository.create({
        original_name: 'Screenshot 2026-11-19.png',
        original_path: path.join(tempDir, 's2.png'),
        file_hash: 'hash_2',
        suggested_name: 'Hadoop_Sqoop_Connection_Error',
        category: 'Big-Data/Sqoop',
        description: 'Lỗi kết nối JDBC trong Apache Sqoop',
        tags: ['Hadoop', 'Sqoop', 'Error'],
        confidence: 0.89,
        status: 'review'
      })

      // Search by keyword
      const erdResults = repository.search({ search: 'University' })
      expect(erdResults).toHaveLength(1)
      expect(erdResults[0].id).toBe(rec1.id)

      // Search by category prefix
      const bigDataResults = repository.search({ category: 'Big-Data' })
      expect(bigDataResults).toHaveLength(1)
      expect(bigDataResults[0].suggested_name).toBe('Hadoop_Sqoop_Connection_Error')

      // Search by tag
      const tagResults = repository.search({ tag: 'ERD' })
      expect(tagResults).toHaveLength(1)

      // Dashboard stats
      const stats = repository.getDashboardStats()
      expect(stats.total).toBe(2)
      expect(stats.saved).toBe(1)
      expect(stats.pendingReview).toBe(1)
      expect(stats.categoryDistribution).toHaveLength(2)
    })
  })

  // 9. IPC Input Validation
  describe('9. IPC Input Payload Validation (Section 4.5 & Section 9)', () => {
    it('validates ConfirmScreenshot, UpdateScreenshot, SearchQuery, and UpdateSettings payloads', () => {
      expect(() => IpcIdSchema.parse('')).toThrow()

      const confirmValid = ConfirmScreenshotSchema.parse({
        id: 'uuid-123',
        finalName: 'PowerBI Sales Dashboard.png',
        category: '../Data-Analytics/PowerBI',
        description: 'Biểu đồ doanh số Power BI',
        tags: ['PowerBI', 'Sales', 'PowerBI']
      })
      expect(confirmValid.finalName).toBe('PowerBI_Sales_Dashboard')
      expect(confirmValid.category).toBe('Data-Analytics/PowerBI')
      expect(confirmValid.tags).toEqual(['PowerBI', 'Sales']) // deduplicated

      const updateValid = UpdateScreenshotSchema.parse({
        id: 'uuid-123',
        suggestedName: 'Tableau Revenue Analysis'
      })
      expect(updateValid.suggestedName).toBe('Tableau_Revenue_Analysis')

      const searchValid = SearchScreenshotsQuerySchema.parse({
        status: 'saved',
        search: 'KPI'
      })
      expect(searchValid.status).toBe('saved')

      const settingsValid = UpdateSettingsSchema.parse({
        maxImageSizeMB: 25,
        maxConcurrency: 3,
        theme: 'dark'
      })
      expect(settingsValid.maxConcurrency).toBe(3)
    })
  })

  // 10. End-to-End Review & Confirmation Workflow with Mock AI
  describe('10. End-to-End Detection -> Mock AI Analysis -> Review -> Confirm & Organize Workflow (REQ05)', () => {
    it('detects new image, populates review queue via AI, preserves original before confirm, and organizes on confirm', async () => {
      const sourceDir = path.join(tempDir, 'Screenshots')
      const destDir = path.join(tempDir, 'AI-Screenshots')
      const configDir = path.join(tempDir, 'config')
      fs.mkdirSync(sourceDir, { recursive: true })

      const settingsService = new SettingsService(configDir)
      settingsService.updateSettings({
        sourceFolder: sourceDir,
        destinationFolder: destDir,
        organizeMode: 'category_folders',
        autoApplyRename: false
      })

      // Mock MetadataService & AIService so no paid API call is needed
      const mockMetadataService = {
        extractMetadata: vi.fn().mockImplementation(async (filePath: string) => ({
          originalName: path.basename(filePath),
          originalPath: filePath,
          fileHash: await computeFileSha256(filePath),
          width: 1920,
          height: 1080,
          format: 'png',
          sizeBytes: SAMPLE_PNG_BUFFER.length,
          mimeType: 'image/png'
        }))
      }

      const mockAiService = {
        analyzeScreenshot: vi.fn().mockResolvedValue({
          suggestedName: 'Excel_KPI_Conditional_Formatting',
          category: 'Data-Analytics/Excel',
          description: 'Thiết lập màu sắc KPI theo giá trị âm và dương',
          tags: ['Excel', 'KPI', 'Conditional Formatting'],
          confidence: 0.95
        })
      }

      const watcher = new ScreenshotWatcher(
        repository,
        settingsService,
        mockMetadataService as never,
        mockAiService as never
      )
      const fileOrganizer = new FileOrganizer(repository, settingsService)

      // Step 1: Create a new screenshot in monitored source folder
      const rawScreenshotPath = path.join(sourceDir, 'Screenshot 2026-11-18 142000.png')
      fs.writeFileSync(rawScreenshotPath, SAMPLE_PNG_BUFFER)

      // Step 2: Watcher ingests and analyzes the screenshot
      const created = await watcher.handleNewFileDetected(rawScreenshotPath)
      expect(created).not.toBeNull()

      // Wait briefly for the async queue worker to finish mock AI analysis
      await new Promise((r) => setTimeout(r, 80))

      const reviewed = repository.findById(created!.id)!
      expect(reviewed.status).toBe('review')
      expect(reviewed.suggested_name).toBe('Excel_KPI_Conditional_Formatting')
      expect(reviewed.category).toBe('Data-Analytics/Excel')

      // Verify Review-Before-Save rule: original file has NOT been moved or renamed yet!
      expect(fs.existsSync(rawScreenshotPath)).toBe(true)

      // Step 3: User edits proposed filename in Review Queue and clicks Confirm
      const confirmed = await fileOrganizer.confirmAndOrganize({
        id: reviewed.id,
        finalName: 'Excel_KPI_Q4_Dashboard',
        category: 'Data-Analytics/Excel',
        description: reviewed.description,
        tags: [...reviewed.tags, 'Q4']
      })

      // Step 4: Verify file was moved to destination subfolder with sanitized filename and SQLite updated
      expect(confirmed.status).toBe('saved')
      expect(confirmed.final_name).toBe('Excel_KPI_Q4_Dashboard.png')
      const expectedFinalPath = path.join(
        destDir,
        'Data-Analytics',
        'Excel',
        'Excel_KPI_Q4_Dashboard.png'
      )
      expect(confirmed.final_path).toBe(expectedFinalPath)
      expect(fs.existsSync(expectedFinalPath)).toBe(true)
      expect(fs.existsSync(rawScreenshotPath)).toBe(false)
    })

    it('validates real PNG metadata with Sharp and handles missing API key gracefully in AIService', async () => {
      const configDir = path.join(tempDir, 'config-ai')
      const settingsService = new SettingsService(configDir)
      const imageService = new ImageService()
      const metadataService = new MetadataService(imageService)
      const aiService = new AIService(settingsService, imageService)

      const imgPath = path.join(tempDir, 'real_sample.png')
      fs.writeFileSync(imgPath, SAMPLE_PNG_BUFFER)

      const meta = await metadataService.extractMetadata(imgPath, 20)
      expect(meta.width).toBe(1)
      expect(meta.height).toBe(1)
      expect(meta.format).toBe('png')
      expect(meta.fileHash).toBe(computeBufferSha256(SAMPLE_PNG_BUFFER))

      const dataUrl = await imageService.prepareImageForAI(imgPath)
      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)

      // Without an API key set, AIService.analyzeScreenshot should reject with a clear message
      const prevEnvKey = process.env.OPENAI_API_KEY
      const prevGemKey = process.env.GEMINI_API_KEY
      delete process.env.OPENAI_API_KEY
      delete process.env.GEMINI_API_KEY
      try {
        await expect(aiService.analyzeScreenshot(imgPath)).rejects.toThrow(/API key is not configured/i)
        const validation = await aiService.validateConfiguration()
        expect(validation.valid).toBe(false)
      } finally {
        if (prevEnvKey) process.env.OPENAI_API_KEY = prevEnvKey
        if (prevGemKey) process.env.GEMINI_API_KEY = prevGemKey
      }
    })

    it('supports Auto-Rename in Place and Gemini / Claude Code provider selection', async () => {
      const sourceDir = path.join(tempDir, 'LiveScreenshots')
      const configDir = path.join(tempDir, 'config-live')
      fs.mkdirSync(sourceDir, { recursive: true })

      const settingsService = new SettingsService(configDir)
      const updated = settingsService.updateSettings({
        sourceFolder: sourceDir,
        aiProvider: 'claude',
        aiModel: 'sonnet',
        autoApplyRename: true,
        organizeMode: 'rename_in_place'
      })
      expect(updated.aiProvider).toBe('claude')
      expect(updated.aiModel).toBe('sonnet')
      expect(updated.autoApplyRename).toBe(true)
      expect(updated.organizeMode).toBe('rename_in_place')

      const mockMetadataService = {
        extractMetadata: vi.fn().mockImplementation(async (filePath: string) => ({
          originalName: path.basename(filePath),
          originalPath: filePath,
          fileHash: await computeFileSha256(filePath),
          width: 1920,
          height: 1080,
          format: 'png',
          sizeBytes: SAMPLE_PNG_BUFFER.length,
          mimeType: 'image/png'
        }))
      }

      const mockAiService = {
        analyzeScreenshot: vi.fn().mockResolvedValue({
          suggestedName: 'React_TypeScript_Component_Code',
          category: 'Programming/React',
          description: 'Đoạn code component React viết bằng TypeScript',
          tags: ['React', 'TypeScript'],
          confidence: 0.97
        })
      }

      const fileOrganizer = new FileOrganizer(repository, settingsService)
      const watcher = new ScreenshotWatcher(
        repository,
        settingsService,
        mockMetadataService as never,
        mockAiService as never,
        fileOrganizer
      )

      const rawPath = path.join(sourceDir, 'Screenshot 2026-11-18_150500.png')
      fs.writeFileSync(rawPath, SAMPLE_PNG_BUFFER)

      const created = await watcher.handleNewFileDetected(rawPath)
      expect(created).not.toBeNull()

      await new Promise((r) => setTimeout(r, 80))

      const finalRecord = repository.findById(created!.id)!
      expect(finalRecord.status).toBe('saved')
      expect(finalRecord.final_name).toBe('React_TypeScript_Component_Code.png')
      const expectedRenamedInPlace = path.join(sourceDir, 'React_TypeScript_Component_Code.png')
      expect(finalRecord.final_path).toBe(expectedRenamedInPlace)
      expect(fs.existsSync(expectedRenamedInPlace)).toBe(true)
      expect(fs.existsSync(rawPath)).toBe(false)
    })

    it('improves Tesseract OCR preprocessing and generates meaningful filenames without UI chrome', async () => {
      const imageService = new ImageService()
      const darkImgPath = path.join(tempDir, 'dark_sample.png')
      fs.writeFileSync(darkImgPath, SAMPLE_PNG_BUFFER)

      const ocrPrepared = await imageService.prepareImageForOCR(darkImgPath)
      expect(Buffer.isBuffer(ocrPrepared.buffer)).toBe(true)
      expect(ocrPrepared.buffer.length).toBeGreaterThan(0)

      // 1. VS Code TypeScript error screenshot with noisy UI menu bar
      const tsOcrText = [
        'File Edit Selection View Go Run Terminal Help',
        'Explorer Outline Timeline',
        'TS2339: Property settings does not exist on type Watcher',
        'src/main/services/screenshotWatcher.ts'
      ].join('\n')

      const tsResult = AIService.buildOcrAnalysisFromText(tsOcrText, 85)
      expect(tsResult.category).toBe('Programming/TypeScript')
      expect(tsResult.suggestedName).toContain('TS2339')
      expect(tsResult.suggestedName).not.toMatch(/File|Edit|Selection/i)

      // 2. Vietnamese Excel/Business report screenshot — name reflects content, not forced folder prefix
      const vnReportText = [
        'Home Insert Page Layout Formulas Data Review View',
        'Báo cáo doanh thu quý 4 năm 2026',
        'Excel VLOOKUP Tổng doanh thu lợi nhuận'
      ].join('\n')

      const vnResult = AIService.buildOcrAnalysisFromText(vnReportText, 90)
      expect(vnResult.category).toBe('Data-Analytics/Excel')
      expect(vnResult.suggestedName).toMatch(/^Bao_Cao_Doanh_Thu/)

      // 3. Diverse non-coding/non-office content: Vietcombank transfer receipt
      const bankText = [
        'Vietcombank',
        'Chuyển khoản thành công',
        'Số tài khoản thụ hưởng 0123456789'
      ].join('\n')

      const bankResult = AIService.buildOcrAnalysisFromText(bankText, 92)
      expect(bankResult.category).toBe('Finance/Banking')
      expect(bankResult.suggestedName).toMatch(/Chuyen_Khoan_Thanh_Cong|Vietcombank/)
    })
  })
})
