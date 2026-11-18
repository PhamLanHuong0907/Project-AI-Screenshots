import crypto from 'crypto'
import fs from 'fs'

/**
 * Computes the SHA-256 hash of a file asynchronously using streams
 * to avoid blocking the Electron Main Process event loop on large images.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('error', (err) => {
      reject(new Error(`Failed to read file for hashing (${filePath}): ${err.message}`))
    })

    stream.on('data', (chunk) => {
      hash.update(chunk)
    })

    stream.on('end', () => {
      resolve(hash.digest('hex'))
    })
  })
}

/**
 * Computes the SHA-256 hash of an in-memory Buffer.
 */
export function computeBufferSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
