import fs from 'fs'
import path from 'path'
import { ScreenshotRepository } from '../database/screenshotRepository'
import {
  generateUniqueFilePath,
  resolveSafeCategoryFolder,
  safeMoveFile,
  sanitizeCategoryPath,
  sanitizeFilename
} from '../utils/fileUtils'
import { ConfirmScreenshotSchema } from '../utils/validation'
import type {
  ConfirmScreenshotPayload,
  OrganizeMode,
  ScreenshotRecord
} from '../../renderer/src/types/screenshot'
import { SettingsService } from './settingsService'

export class FileOrganizer {
  private repository: ScreenshotRepository
  private settingsService: SettingsService
  private watcher?: { markPathInFlight?: (p: string) => void }

  constructor(
    repository: ScreenshotRepository,
    settingsService: SettingsService,
    watcher?: { markPathInFlight?: (p: string) => void }
  ) {
    this.repository = repository
    this.settingsService = settingsService
    this.watcher = watcher
  }

  public setWatcher(watcher: { markPathInFlight?: (p: string) => void }): void {
    this.watcher = watcher
  }

  /**
   * Executes the screenshot renaming & organization workflow:
   * - If `organizeMode === 'rename_in_place'`, renames the screenshot directly in its current folder
   *   (e.g. inside `%USERPROFILE%\Pictures\Screenshots`).
   * - If `organizeMode === 'category_folders'`, moves and renames the screenshot into the category
   *   subfolder inside `%USERPROFILE%\Pictures\AI-Screenshots\<Category>`.
   */
  public async confirmAndOrganize(
    payload: ConfirmScreenshotPayload,
    modeOverride?: OrganizeMode
  ): Promise<ScreenshotRecord> {
    const validated = ConfirmScreenshotSchema.parse(payload)
    const record = this.repository.findById(validated.id)

    if (!record) {
      throw new Error(`Screenshot record not found (${validated.id})`)
    }

    if (record.status === 'saved' && record.final_path && fs.existsSync(record.final_path)) {
      return record
    }

    const sourcePath = record.original_path
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      this.repository.update(record.id, {
        status: 'failed',
        error_message: 'Source screenshot file was moved or deleted externally before confirmation.'
      })
      throw new Error(
        `Source screenshot no longer exists at "${sourcePath}". It may have been moved or deleted externally.`
      )
    }

    const settings = this.settingsService.getPublicSettings()
    const mode: OrganizeMode = modeOverride || settings.organizeMode || 'category_folders'
    const deleteSource = settings.deleteSourceOnConfirm !== false && modeOverride !== 'rename_in_place'

    let targetDir: string
    let finalCategoryName = validated.category.trim()
    if (!deleteSource && mode === 'rename_in_place') {
      targetDir = path.dirname(path.resolve(sourcePath))
      finalCategoryName = path.basename(targetDir)
    } else {
      const baseDestDir = settings.destinationFolder
      targetDir = resolveSafeCategoryFolder(baseDestDir, validated.category)
      // Get the relative path from baseDestDir to targetDir to keep the exact folder name
      const rel = path.relative(path.resolve(baseDestDir), targetDir)
      if (rel && !rel.startsWith('..')) {
        finalCategoryName = rel.replace(/\\/g, '/')
      }
    }

    const cleanBaseName = sanitizeFilename(validated.finalName, finalCategoryName.split('/')[0])
    const originalExt = path.extname(sourcePath) || '.png'

    await fs.promises.mkdir(targetDir, { recursive: true })

    // If source file already has the exact desired name in targetDir, no move needed
    const desiredDirectPath = path.join(targetDir, `${cleanBaseName}${originalExt.toLowerCase()}`)
    let uniqueDestPath: string
    if (path.resolve(sourcePath).toLowerCase() === path.resolve(desiredDirectPath).toLowerCase()) {
      uniqueDestPath = path.resolve(sourcePath)
    } else {
      uniqueDestPath = generateUniqueFilePath(targetDir, cleanBaseName, originalExt)
      this.watcher?.markPathInFlight?.(uniqueDestPath)
      if (deleteSource || mode === 'rename_in_place') {
        await safeMoveFile(sourcePath, uniqueDestPath)
      } else {
        await fs.promises.copyFile(sourcePath, uniqueDestPath, fs.constants.COPYFILE_EXCL)
      }
    }

    const finalFileName = path.basename(uniqueDestPath)

    const updatedRecord = this.repository.update(record.id, {
      final_name: finalFileName,
      suggested_name: cleanBaseName,
      category: finalCategoryName,
      description: validated.description,
      tags: validated.tags,
      status: 'saved',
      final_path: uniqueDestPath,
      error_message: ''
    })

    this.repository.logHistory(
      record.id,
      'confirmed_and_saved',
      `Organized (${mode}) from "${sourcePath}" to "${uniqueDestPath}"`
    )

    return updatedRecord
  }
}
