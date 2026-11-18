import path from 'path'
import { computeFileSha256 } from '../utils/hashUtils'
import { ImageMetadataInfo, ImageService } from './imageService'

export interface ExtractedFileMetadata extends ImageMetadataInfo {
  originalName: string
  originalPath: string
  fileHash: string
}

export class MetadataService {
  private imageService: ImageService

  constructor(imageService?: ImageService) {
    this.imageService = imageService || new ImageService()
  }

  /**
   * Validates the screenshot file, computes its SHA-256 hash, and extracts image dimensions and size.
   */
  public async extractMetadata(
    filePath: string,
    maxImageSizeMB = 20
  ): Promise<ExtractedFileMetadata> {
    const resolvedPath = path.resolve(filePath)
    const imageInfo = await this.imageService.validateAndInspectImage(resolvedPath, maxImageSizeMB)
    const fileHash = await computeFileSha256(resolvedPath)

    return {
      originalName: path.basename(resolvedPath),
      originalPath: resolvedPath,
      fileHash,
      ...imageInfo
    }
  }
}
