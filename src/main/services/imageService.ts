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
