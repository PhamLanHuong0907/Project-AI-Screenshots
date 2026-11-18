import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { isSupportedImageFile } from '../utils/fileUtils'

export interface ImageMetadataInfo {
  width: number
  height: number
  format: string
  sizeBytes: number
  mimeType: string
}

export interface VisualContextInfo {
  width: number
  height: number
  orientation: 'landscape' | 'portrait' | 'square'
  isDarkMode: boolean
  isColorfulGraphic: boolean
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

export class ImageService {
  /**
   * Validates that a file exists, has a supported extension, is non-empty,
   * does not exceed maxImageSizeMB, and contains valid image data.
   */
  public async validateAndInspectImage(
    filePath: string,
    maxImageSizeMB = 20
  ): Promise<ImageMetadataInfo> {
    if (!isSupportedImageFile(filePath)) {
      throw new Error(`Unsupported file extension: ${path.extname(filePath)}`)
    }

    let stats: fs.Stats
    try {
      stats = await fs.promises.stat(filePath)
    } catch {
      throw new Error(`Image file cannot be accessed or does not exist: ${filePath}`)
    }

    if (!stats.isFile() || stats.size === 0) {
      throw new Error('Image file is empty or not a regular file')
    }

    const maxBytes = maxImageSizeMB * 1024 * 1024
    if (stats.size > maxBytes) {
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
      throw new Error(
        `Image size (${sizeMB} MB) exceeds maximum allowed limit of ${maxImageSizeMB} MB`
      )
    }

    const ext = path.extname(filePath).toLowerCase()
    const mimeType = MIME_BY_EXT[ext] || 'image/png'

    try {
      const metadata = await sharp(filePath).metadata()
      return {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        format: metadata.format ?? ext.replace('.', ''),
        sizeBytes: stats.size,
        mimeType
      }
    } catch (err) {
      throw new Error(`Invalid or corrupted image file: ${(err as Error).message}`)
    }
  }

  /**
   * Prepares an optimized Base64 Data URL (`data:image/...;base64,...`) suitable for OpenAI Vision input.
   * Downscales images larger than 2048px on their longest edge while keeping text sharp.
   */
  public async prepareImageForAI(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase()
    const defaultMime = MIME_BY_EXT[ext] || 'image/png'

    try {
      const pipeline = sharp(filePath)
      const meta = await pipeline.metadata()

      if ((meta.width && meta.width > 2048) || (meta.height && meta.height > 2048)) {
        const resizedBuffer = await pipeline
          .resize({
            width: 2048,
            height: 2048,
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({ quality: 90 })
          .toBuffer()

        return `data:image/png;base64,${resizedBuffer.toString('base64')}`
      }
    } catch {
      // Fallback to raw file buffer if resize fails
    }

    const rawBuffer = await fs.promises.readFile(filePath)
    return `data:${defaultMime};base64,${rawBuffer.toString('base64')}`
  }

  /**
   * Preprocesses a screenshot image specifically for high-accuracy Tesseract OCR:
   * - Detects dark-mode screenshots (mean luminance < 120) and inverts them to black-on-white
   * - Converts to grayscale, normalizes contrast, and sharpens text edges
   * - Upscales smaller screenshots (up to 1.5x) so small UI fonts are legible to OCR
   */
  public async prepareImageForOCR(
    filePath: string
  ): Promise<{ buffer: Buffer; isDarkMode: boolean; visualContext: VisualContextInfo }> {
    try {
      const basePipeline = sharp(filePath)
      const [meta, stats] = await Promise.all([basePipeline.metadata(), basePipeline.stats()])

      const rgbChannels = stats.channels.slice(0, 3)
      const avgBrightness =
        rgbChannels.length > 0
          ? rgbChannels.reduce((sum, ch) => sum + ch.mean, 0) / rgbChannels.length
          : 255
      const isDarkMode = avgBrightness < 120

      const channelMeans = rgbChannels.map((c) => c.mean)
      const channelSpread =
        channelMeans.length >= 3 ? Math.max(...channelMeans) - Math.min(...channelMeans) : 0
      const avgStdev =
        rgbChannels.length > 0
          ? rgbChannels.reduce((sum, ch) => sum + ch.stdev, 0) / rgbChannels.length
          : 0
      const isColorfulGraphic = channelSpread > 18 || avgStdev > 62

      const width = meta.width || 0
      const height = meta.height || 0
      const orientation: VisualContextInfo['orientation'] =
        width > height * 1.15 ? 'landscape' : height > width * 1.15 ? 'portrait' : 'square'

      const visualContext: VisualContextInfo = {
        width,
        height,
        orientation,
        isDarkMode,
        isColorfulGraphic
      }

      let pipeline = sharp(filePath)
        .flatten({ background: isDarkMode ? '#0f172a' : '#ffffff' })
        .grayscale()

      if (isDarkMode) {
        pipeline = pipeline.negate({ alpha: false })
      }

      if (width > 0 && width < 1800) {
        const targetWidth = Math.min(2600, Math.round(width * 1.5))
        pipeline = pipeline.resize({
          width: targetWidth,
          kernel: sharp.kernel.lanczos3
        })
      }

      const buffer = await pipeline
        .normalize()
        .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 })
        .png()
        .toBuffer()

      return { buffer, isDarkMode, visualContext }
    } catch {
      const rawBuffer = await fs.promises.readFile(filePath)
      return {
        buffer: rawBuffer,
        isDarkMode: false,
        visualContext: {
          width: 0,
          height: 0,
          orientation: 'landscape',
          isDarkMode: false,
          isColorfulGraphic: false
        }
      }
    }
  }

  /**
   * Reads a screenshot from disk and returns a Data URL for safe rendering in the UI.
   */
  public async getImageDataUrl(filePath: string): Promise<string | null> {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return null
      }
      const ext = path.extname(filePath).toLowerCase()
      const mimeType = MIME_BY_EXT[ext] || 'image/png'
      const buffer = await fs.promises.readFile(filePath)
      return `data:${mimeType};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  }
}
