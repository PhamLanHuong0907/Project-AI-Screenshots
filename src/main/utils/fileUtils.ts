import fs from 'fs'
import path from 'path'
import { computeFileSha256 } from './hashUtils'

export const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

const GENERIC_FILENAME_PATTERNS = [
  /^screenshot([_-]?\d+)?$/i,
  /^image([_-]?\d+)?$/i,
  /^img([_-]?\d+)?$/i,
  /^untitled([_-]?\d+)?$/i,
  /^capture([_-]?\d+)?$/i,
  /^snip([_-]?\d+)?$/i
]

/**
 * Strips Vietnamese diacritics and accents, converting characters to plain ASCII equivalents.
 */
export function removeVietnameseDiacritics(input: string): string {
  if (!input) return ''
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/**
 * Checks whether a file path has a supported screenshot extension (.png, .jpg, .jpeg, .webp).
 */
export function isSupportedImageFile(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  const ext = path.extname(filePath).toLowerCase()
  return SUPPORTED_IMAGE_EXTENSIONS.has(ext)
}

/**
 * Checks whether a filename is overly generic (e.g., Screenshot_1, Image_001).
 */
export function isGenericFilename(nameWithoutExt: string): boolean {
  const cleaned = nameWithoutExt.trim()
  if (!cleaned) return true
  return GENERIC_FILENAME_PATTERNS.some((pattern) => pattern.test(cleaned))
}

/**
 * Sanitizes a proposed filename according to REQ03:
 * - English ASCII characters only
 * - Use underscores between words
 * - No Vietnamese diacritics
 * - No invalid Windows filename characters
 * - Maximum 60 characters excluding extension
 * - Avoid generic names such as Screenshot_1 or Image_001
 */
export function sanitizeFilename(rawName: string, fallbackCategory = 'General'): string {
  // Remove extension if accidentally included by AI or user
  let base = rawName.trim()
  const extMatch = base.match(/\.(png|jpe?g|webp)$/i)
  if (extMatch) {
    base = base.slice(0, -extMatch[0].length)
  }

  // Strip Vietnamese diacritics and non-ASCII characters
  base = removeVietnameseDiacritics(base)

  // Replace any non-ASCII or invalid Windows characters with underscores
  // eslint-disable-next-line no-control-regex
  base = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')

  // Reject generic names or empty strings
  if (!base || isGenericFilename(base) || base.length < 3) {
    const cleanCat = removeVietnameseDiacritics(fallbackCategory)
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    base = `${cleanCat || 'Categorized'}_Screenshot_Capture`
  }

  // Avoid Windows reserved device names
  if (WINDOWS_RESERVED_NAMES.has(base.toUpperCase())) {
    base = `${base}_File`
  }

  // Enforce maximum 60 characters excluding extension
  if (base.length > 60) {
    base = base.slice(0, 60).replace(/_+$/g, '')
  }

  return base || 'Categorized_Screenshot_Capture'
}

/**
 * Sanitizes and validates a category hierarchy path (e.g. "Tuần 1", "Data-Analytics/Excel").
 * Preserves unicode characters and spaces in folder names so existing folders like "Tuần 1"
 * are NOT altered into "Tuan-1".
 * Prevents path traversal (".."), absolute paths, drive letters, and invalid Windows folder characters.
 */
export function sanitizeCategoryPath(rawCategory: string): string {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return 'Others'
  }

  const normalized = rawCategory.trim().replace(/\\/g, '/')
  const rawSegments = normalized.split('/').filter((seg) => seg.trim().length > 0)

  const validSegments: string[] = []
  for (const segment of rawSegments) {
    if (segment === '.' || segment === '..') {
      continue
    }
    // eslint-disable-next-line no-control-regex
    const cleaned = segment
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .trim()
      .slice(0, 60)

    if (cleaned && !WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) {
      validSegments.push(cleaned)
    }
    if (validSegments.length >= 5) {
      break
    }
  }

  if (validSegments.length === 0) {
    return 'Others'
  }

  return validSegments.join('/')
}

/**
 * Resolves the target folder path inside the destination root.
 * STRICT USER CHOICE RULE:
 * Matches existing physical folders on disk exactly (e.g., "Tuần 1", "Tuan 1", "Documents").
 * Never replaces spaces with dashes and never strips Vietnamese diacritics.
 * If the user selected an existing folder, it resolves directly to it without creating any new/altered folder.
 * Prevents path traversal outside baseDestDir.
 */
export function resolveSafeCategoryFolder(baseDestDir: string, category: string): string {
  const resolvedBase = path.resolve(baseDestDir)
  const trimmed = (category || '').trim().replace(/\\/g, '/')
  const segments = trimmed.split('/').filter((s) => s.length > 0 && s !== '.' && s !== '..')

  if (segments.length === 0) {
    return resolvedBase
  }

  // Check step-by-step down the directory tree to match existing folders on disk exactly
  let currentPath = resolvedBase
  const resolvedSegments: string[] = []

  for (const seg of segments) {
    let matchedChild: string | null = null
    try {
      if (fs.existsSync(currentPath)) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        // 1. Try exact match first (e.g. "Tuần 1" === "Tuần 1")
        const exact = entries.find((e) => e.isDirectory() && e.name === seg)
        if (exact) {
          matchedChild = exact.name
        } else {
          // 2. Try case-insensitive match
          const caseInsensitive = entries.find(
            (e) => e.isDirectory() && e.name.toLowerCase() === seg.toLowerCase()
          )
          if (caseInsensitive) {
            matchedChild = caseInsensitive.name
          }
        }
      }
    } catch {
      // If reading directory fails
    }

    if (matchedChild) {
      currentPath = path.join(currentPath, matchedChild)
      resolvedSegments.push(matchedChild)
    } else {
      // Keep exact user segment name
      const cleanSeg = sanitizeFolderSegment(seg)
      currentPath = path.join(currentPath, cleanSeg)
      resolvedSegments.push(cleanSeg)
    }
  }

  const finalTarget = path.resolve(resolvedBase, ...resolvedSegments)
  const relative = path.relative(resolvedBase, finalTarget)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Security error: Invalid category path traversal detected (${category})`)
  }

  return finalTarget
}

function sanitizeFolderSegment(segment: string): string {
  // eslint-disable-next-line no-control-regex
  let cleaned = segment.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()
  if (WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) {
    cleaned = `${cleaned}_Folder`
  }
  return cleaned || 'Others'
}

/**
 * Generates a unique file path in the target directory without overwriting existing files.
 * Preserves the original extension and keeps the base filename within reasonable limits.
 */
export function generateUniqueFilePath(
  destDir: string,
  sanitizedBaseName: string,
  originalExt: string
): string {
  const ext = originalExt.startsWith('.') ? originalExt.toLowerCase() : `.${originalExt.toLowerCase()}`
  const cleanBase = sanitizeFilename(sanitizedBaseName)

  let candidatePath = path.join(destDir, `${cleanBase}${ext}`)
  let counter = 1

  while (fs.existsSync(candidatePath)) {
    const suffix = `_${counter}`
    const maxBaseLen = Math.max(10, 60 - suffix.length)
    const truncatedBase = cleanBase.slice(0, maxBaseLen).replace(/_+$/g, '')
    candidatePath = path.join(destDir, `${truncatedBase}${suffix}${ext}`)
    counter++
  }

  return candidatePath
}

/**
 * Safely moves a file from sourcePath to destPath.
 * - Handles same-drive atomic rename.
 * - Handles cross-drive (EXDEV) fallback by copying, verifying file size and SHA-256 hash,
 *   and only deleting the source file after integrity verification passes.
 */
export async function safeMoveFile(
  sourcePath: string,
  destPath: string,
  forceCopyFallback = false
): Promise<void> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file no longer exists: ${sourcePath}`)
  }

  if (fs.existsSync(destPath)) {
    throw new Error(`Destination file already exists and will not be overwritten: ${destPath}`)
  }

  const destDir = path.dirname(destPath)
  await fs.promises.mkdir(destDir, { recursive: true })

  if (!forceCopyFallback) {
    try {
      await fs.promises.rename(sourcePath, destPath)
      return
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code !== 'EXDEV') {
        throw new Error(`Failed to move file: ${(err as Error).message}`)
      }
      // If EXDEV (cross-drive move), fall through to verified copy + delete
    }
  }

  // Cross-drive move fallback: copy -> verify hash & size -> delete original
  const sourceStats = await fs.promises.stat(sourcePath)
  const sourceHash = await computeFileSha256(sourcePath)

  await fs.promises.copyFile(sourcePath, destPath, fs.constants.COPYFILE_EXCL)

  try {
    const destStats = await fs.promises.stat(destPath)
    if (destStats.size !== sourceStats.size) {
      throw new Error(
        `Copied file size mismatch (expected ${sourceStats.size}, got ${destStats.size})`
      )
    }

    const destHash = await computeFileSha256(destPath)
    if (destHash !== sourceHash) {
      throw new Error('Copied file SHA-256 checksum mismatch')
    }
  } catch (verifyError) {
    // Clean up corrupted destination copy and preserve original file
    try {
      if (fs.existsSync(destPath)) {
        await fs.promises.unlink(destPath)
      }
    } catch {
      // Ignore cleanup error
    }
    throw verifyError
  }

  // Verification succeeded; now safe to remove original
  await fs.promises.unlink(sourcePath)
}
