/**
 * Formats byte count into human-readable file size (KB, MB).
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

/**
 * Formats ISO date string into concise local date/time.
 */
export function formatDateTime(isoString?: string): string {
  if (!isoString) return '—'
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return isoString
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch {
    return isoString
  }
}

/**
 * Formats a 0..1 confidence score as a percentage string.
 */
export function formatConfidence(confidence?: number): string {
  if (confidence === undefined || confidence === null || Number.isNaN(confidence)) {
    return '0%'
  }
  const clamped = Math.max(0, Math.min(1, confidence))
  return `${Math.round(clamped * 100)}%`
}

/**
 * Extracts file extension from filename or path.
 */
export function getFileExtension(nameOrPath: string): string {
  if (!nameOrPath) return '.png'
  const lastDot = nameOrPath.lastIndexOf('.')
  if (lastDot === -1) return '.png'
  return nameOrPath.slice(lastDot).toLowerCase()
}
