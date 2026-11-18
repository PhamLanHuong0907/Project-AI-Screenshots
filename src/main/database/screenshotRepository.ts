import crypto from 'crypto'
import type { SqliteDatabase } from './database'
import { getDatabase } from './database'
import type {
  DashboardStats,
  ScreenshotRecord,
  ScreenshotStatus,
  SearchScreenshotsQuery
} from '../../renderer/src/types/screenshot'

interface RawScreenshotRow {
  id: string
  original_name: string
  original_path: string
  file_hash: string
  suggested_name: string
  final_name: string
  category: string
  description: string
  tags: string
  confidence: number
  status: ScreenshotStatus
  final_path: string
  error_message: string
  file_size: number
  width: number
  height: number
  is_duplicate: number
  duplicate_of_id: string | null
  created_at: string
  updated_at: string
}

function mapRowToRecord(row: RawScreenshotRow): ScreenshotRecord {
  let parsedTags: string[] = []
  try {
    const parsed = JSON.parse(row.tags || '[]')
    if (Array.isArray(parsed)) {
      parsedTags = parsed.map((t) => String(t))
    }
  } catch {
    parsedTags = []
  }

  return {
    id: row.id,
    original_name: row.original_name,
    original_path: row.original_path,
    file_hash: row.file_hash,
    suggested_name: row.suggested_name || '',
    final_name: row.final_name || '',
    category: row.category || 'Others',
    description: row.description || '',
    tags: parsedTags,
    confidence: Number(row.confidence ?? 0),
    status: row.status,
    final_path: row.final_path || '',
    error_message: row.error_message || undefined,
    file_size: Number(row.file_size ?? 0),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    is_duplicate: Boolean(row.is_duplicate),
    duplicate_of_id: row.duplicate_of_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export class ScreenshotRepository {
  private dbGetter: () => SqliteDatabase

  constructor(customDb?: SqliteDatabase) {
    this.dbGetter = customDb ? () => customDb : () => getDatabase()
  }

  private get db(): SqliteDatabase {
    return this.dbGetter()
  }

  public create(input: {
    id?: string
    original_name: string
    original_path: string
    file_hash: string
    suggested_name?: string
    final_name?: string
    category?: string
    description?: string
    tags?: string[]
    confidence?: number
    status?: ScreenshotStatus
    final_path?: string
    error_message?: string
    file_size?: number
    width?: number
    height?: number
    is_duplicate?: boolean
    duplicate_of_id?: string | null
  }): ScreenshotRecord {
    const id = input.id || crypto.randomUUID()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO screenshots (
          id, original_name, original_path, file_hash,
          suggested_name, final_name, category, description,
          tags, confidence, status, final_path, error_message,
          file_size, width, height, is_duplicate, duplicate_of_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.original_name,
        input.original_path,
        input.file_hash,
        input.suggested_name ?? '',
        input.final_name ?? '',
        input.category ?? 'Others',
        input.description ?? '',
        JSON.stringify(input.tags ?? []),
        input.confidence ?? 0,
        input.status ?? 'pending',
        input.final_path ?? '',
        input.error_message ?? '',
        input.file_size ?? 0,
        input.width ?? 0,
        input.height ?? 0,
        input.is_duplicate ? 1 : 0,
        input.duplicate_of_id ?? null,
        now,
        now
      )

    this.logHistory(id, 'created', `Created screenshot record with status: ${input.status ?? 'pending'}`)
    const created = this.findById(id)
    if (!created) {
      throw new Error(`Failed to retrieve newly created screenshot record (${id})`)
    }
    return created
  }

  public findById(id: string): ScreenshotRecord | null {
    const row = this.db
      .prepare('SELECT * FROM screenshots WHERE id = ?')
      .get(id) as RawScreenshotRow | undefined
    return row ? mapRowToRecord(row) : null
  }

  public findByOriginalPath(originalPath: string): ScreenshotRecord | null {
    const row = this.db
      .prepare(
        "SELECT * FROM screenshots WHERE (original_path = ? OR final_path = ?) AND status NOT IN ('rejected') ORDER BY created_at DESC LIMIT 1"
      )
      .get(originalPath, originalPath) as RawScreenshotRow | undefined
    return row ? mapRowToRecord(row) : null
  }

  public findByHash(fileHash: string): ScreenshotRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM screenshots WHERE file_hash = ? ORDER BY created_at DESC')
      .all(fileHash) as RawScreenshotRow[]
    return rows.map(mapRowToRecord)
  }

  /**
   * Finds an existing screenshot with the identical SHA-256 hash that already has valid AI analysis.
   * Used to prevent duplicate OpenAI Vision API calls (REQ02 & Section 10).
   */
  public findAnalyzedByHash(fileHash: string, excludeId?: string): ScreenshotRecord | null {
    const sql = excludeId
      ? `SELECT * FROM screenshots
         WHERE file_hash = ? AND id != ?
           AND status IN ('review', 'approved', 'saved')
           AND suggested_name != ''
         ORDER BY created_at DESC LIMIT 1`
      : `SELECT * FROM screenshots
         WHERE file_hash = ?
           AND status IN ('review', 'approved', 'saved')
           AND suggested_name != ''
         ORDER BY created_at DESC LIMIT 1`

    const row = (
      excludeId
        ? this.db.prepare(sql).get(fileHash, excludeId)
        : this.db.prepare(sql).get(fileHash)
    ) as RawScreenshotRow | undefined

    return row ? mapRowToRecord(row) : null
  }

  public findAll(): ScreenshotRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM screenshots ORDER BY created_at DESC')
      .all() as RawScreenshotRow[]
    return rows.map(mapRowToRecord)
  }

  public findPendingQueue(): ScreenshotRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM screenshots
         WHERE status IN ('pending', 'analyzing', 'review', 'failed')
         ORDER BY
           CASE status
             WHEN 'review' THEN 1
             WHEN 'analyzing' THEN 2
             WHEN 'pending' THEN 3
             WHEN 'failed' THEN 4
             ELSE 5
           END ASC,
           created_at DESC`
      )
      .all() as RawScreenshotRow[]
    return rows.map(mapRowToRecord)
  }

  public update(
    id: string,
    updates: Partial<{
      original_name: string
      original_path: string
      file_hash: string
      suggested_name: string
      final_name: string
      category: string
      description: string
      tags: string[]
      confidence: number
      status: ScreenshotStatus
      final_path: string
      error_message: string
      file_size: number
      width: number
      height: number
      is_duplicate: boolean
      duplicate_of_id: string | null
    }>
  ): ScreenshotRecord {
    const existing = this.findById(id)
    if (!existing) {
      throw new Error(`Screenshot not found: ${id}`)
    }

    const now = new Date().toISOString()
    const nextStatus = updates.status ?? existing.status

    this.db
      .prepare(
        `UPDATE screenshots SET
          original_name = ?,
          original_path = ?,
          file_hash = ?,
          suggested_name = ?,
          final_name = ?,
          category = ?,
          description = ?,
          tags = ?,
          confidence = ?,
          status = ?,
          final_path = ?,
          error_message = ?,
          file_size = ?,
          width = ?,
          height = ?,
          is_duplicate = ?,
          duplicate_of_id = ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        updates.original_name ?? existing.original_name,
        updates.original_path ?? existing.original_path,
        updates.file_hash ?? existing.file_hash,
        updates.suggested_name ?? existing.suggested_name,
        updates.final_name ?? existing.final_name,
        updates.category ?? existing.category,
        updates.description ?? existing.description,
        JSON.stringify(updates.tags ?? existing.tags),
        updates.confidence ?? existing.confidence,
        nextStatus,
        updates.final_path ?? existing.final_path,
        updates.error_message !== undefined ? updates.error_message : (existing.error_message ?? ''),
        updates.file_size ?? existing.file_size ?? 0,
        updates.width ?? existing.width ?? 0,
        updates.height ?? existing.height ?? 0,
        (updates.is_duplicate ?? existing.is_duplicate) ? 1 : 0,
        updates.duplicate_of_id !== undefined ? updates.duplicate_of_id : (existing.duplicate_of_id ?? null),
        now,
        id
      )

    if (updates.status && updates.status !== existing.status) {
      this.logHistory(id, `status:${updates.status}`, updates.error_message || '')
    }

    const updated = this.findById(id)
    if (!updated) {
      throw new Error(`Failed to reload updated screenshot: ${id}`)
    }
    return updated
  }

  public delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM screenshots WHERE id = ?').run(id)
    return Number(res.changes) > 0
  }

  public search(query: SearchScreenshotsQuery): ScreenshotRecord[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (query.status && query.status !== 'all') {
      conditions.push('status = ?')
      params.push(query.status)
    }

    if (query.search && query.search.trim()) {
      const pattern = `%${query.search.trim()}%`
      conditions.push(
        '(original_name LIKE ? OR suggested_name LIKE ? OR final_name LIKE ? OR description LIKE ? OR tags LIKE ?)'
      )
      params.push(pattern, pattern, pattern, pattern, pattern)
    }

    if (query.category && query.category.trim() && query.category !== 'all') {
      const cat = query.category.trim()
      conditions.push('(category = ? OR category LIKE ?)')
      params.push(cat, `${cat}/%`)
    }

    if (query.tag && query.tag.trim()) {
      const tagPattern = `%"${query.tag.trim()}"%`
      conditions.push('tags LIKE ?')
      params.push(tagPattern)
    }

    if (query.dateFrom && query.dateFrom.trim()) {
      conditions.push('created_at >= ?')
      params.push(query.dateFrom.trim())
    }

    if (query.dateTo && query.dateTo.trim()) {
      // Include entire end day if only YYYY-MM-DD is provided
      const dateToVal = query.dateTo.trim().includes('T')
        ? query.dateTo.trim()
        : `${query.dateTo.trim()}T23:59:59.999Z`
      conditions.push('created_at <= ?')
      params.push(dateToVal)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT * FROM screenshots ${whereClause} ORDER BY created_at DESC`

    const rows = this.db.prepare(sql).all(...params) as RawScreenshotRow[]
    return rows.map(mapRowToRecord)
  }

  public getDashboardStats(): DashboardStats {
    const counts = this.db
      .prepare(
        `SELECT status, COUNT(*) as count
         FROM screenshots
         GROUP BY status`
      )
      .all() as Array<{ status: ScreenshotStatus; count: number }>

    let total = 0
    let pendingReview = 0
    let analyzing = 0
    let saved = 0
    let failed = 0
    let rejected = 0

    for (const row of counts) {
      const c = Number(row.count)
      total += c
      if (row.status === 'review') pendingReview += c
      else if (row.status === 'pending' || row.status === 'analyzing') analyzing += c
      else if (row.status === 'saved' || row.status === 'approved') saved += c
      else if (row.status === 'failed') failed += c
      else if (row.status === 'rejected') rejected += c
    }

    const recentRows = this.db
      .prepare('SELECT * FROM screenshots ORDER BY updated_at DESC LIMIT 8')
      .all() as RawScreenshotRow[]

    const categoryRows = this.db
      .prepare(
        `SELECT category, COUNT(*) as count
         FROM screenshots
         WHERE status IN ('saved', 'review', 'approved')
         GROUP BY category
         ORDER BY count DESC`
      )
      .all() as Array<{ category: string; count: number }>

    return {
      total,
      pendingReview,
      analyzing,
      saved,
      failed,
      rejected,
      recentScreenshots: recentRows.map(mapRowToRecord),
      categoryDistribution: categoryRows.map((r) => ({
        category: r.category || 'Others',
        count: Number(r.count)
      }))
    }
  }

  public logHistory(screenshotId: string, eventType: string, details = ''): void {
    try {
      this.db
        .prepare(
          `INSERT INTO processing_history (id, screenshot_id, event_type, details, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(crypto.randomUUID(), screenshotId, eventType, details, new Date().toISOString())
    } catch {
      // Non-fatal if history insert fails
    }
  }
}
