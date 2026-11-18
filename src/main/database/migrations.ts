import type { SqliteDatabase } from './database'

export interface Migration {
  version: number
  name: string
  up: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_screenshots_schema',
    up: `
      CREATE TABLE IF NOT EXISTS screenshots (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        original_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        suggested_name TEXT DEFAULT '',
        final_name TEXT DEFAULT '',
        category TEXT DEFAULT 'Others',
        description TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        confidence REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        final_path TEXT DEFAULT '',
        error_message TEXT DEFAULT '',
        file_size INTEGER DEFAULT 0,
        width INTEGER DEFAULT 0,
        height INTEGER DEFAULT 0,
        is_duplicate INTEGER DEFAULT 0,
        duplicate_of_id TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_screenshots_status ON screenshots(status);
      CREATE INDEX IF NOT EXISTS idx_screenshots_file_hash ON screenshots(file_hash);
      CREATE INDEX IF NOT EXISTS idx_screenshots_category ON screenshots(category);
      CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_screenshots_original_path ON screenshots(original_path);
    `
  },
  {
    version: 2,
    name: '002_processing_history_table',
    up: `
      CREATE TABLE IF NOT EXISTS processing_history (
        id TEXT PRIMARY KEY,
        screenshot_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        details TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_history_screenshot_id ON processing_history(screenshot_id);
      CREATE INDEX IF NOT EXISTS idx_history_created_at ON processing_history(created_at DESC);
    `
  }
]

/**
 * Runs pending SQLite migrations sequentially inside transactions.
 */
export function runMigrations(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedRows = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
    .all() as Array<{ version: number }>
  const appliedVersions = new Set(appliedRows.map((r) => Number(r.version)))

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      db.transaction(() => {
        db.exec(migration.up)
        db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).run(migration.version, migration.name, new Date().toISOString())
      })
    }
  }
}
