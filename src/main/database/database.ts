import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { runMigrations } from './migrations'

const requireModule = createRequire(import.meta.url)

export interface SqliteStatement {
  run: (...params: unknown[]) => { changes: number | bigint; lastInsertRowid: number | bigint }
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
}

export interface SqliteDatabase {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  transaction: <T>(fn: () => T) => T
  close: () => void
}

let dbInstance: SqliteDatabase | null = null

/**
 * Creates a unified SQLite database wrapper.
 * Supports `better-sqlite3` and seamlessly falls back to Node's built-in `node:sqlite` (DatabaseSync)
 * if native addon bindings mismatch across Node/Electron ABIs during tests or runtime.
 */
export function createSqliteConnection(dbFilePath: string): SqliteDatabase {
  if (dbFilePath !== ':memory:') {
    const dir = path.dirname(dbFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  let rawDb: {
    exec: (sql: string) => void
    prepare: (sql: string) => SqliteStatement
    close: () => void
  } | null = null

  // 1. Try better-sqlite3 first
  try {
    const BetterSqlite3 = requireModule('better-sqlite3')
    const instance = new BetterSqlite3(dbFilePath)
    // Test a simple query to verify ABI compatibility
    instance.exec('PRAGMA journal_mode = WAL;')
    rawDb = instance
  } catch {
    // 2. Fallback to built-in node:sqlite (DatabaseSync in Node 22.5+ / 24+ / modern Electron)
    try {
      const nodeSqlite = requireModule('node:sqlite')
      const instance = new nodeSqlite.DatabaseSync(dbFilePath)
      instance.exec('PRAGMA journal_mode = WAL;')
      rawDb = instance
    } catch (fallbackErr) {
      throw new Error(
        `Failed to initialize SQLite database at ${dbFilePath}: ${(fallbackErr as Error).message}`
      )
    }
  }

  if (!rawDb) {
    throw new Error('Could not initialize SQLite driver')
  }

  rawDb.exec('PRAGMA foreign_keys = ON;')
  rawDb.exec('PRAGMA busy_timeout = 5000;')

  const wrapper: SqliteDatabase = {
    exec: (sql: string) => rawDb!.exec(sql),
    prepare: (sql: string) => {
      const stmt = rawDb!.prepare(sql)
      return {
        run: (...params: unknown[]) => stmt.run(...params),
        get: (...params: unknown[]) => stmt.get(...params),
        all: (...params: unknown[]) => stmt.all(...params)
      }
    },
    transaction: <T>(fn: () => T): T => {
      rawDb!.exec('BEGIN IMMEDIATE;')
      try {
        const result = fn()
        rawDb!.exec('COMMIT;')
        return result
      } catch (err) {
        try {
          rawDb!.exec('ROLLBACK;')
        } catch {
          // Ignore rollback error
        }
        throw err
      }
    },
    close: () => {
      rawDb!.close()
    }
  }

  runMigrations(wrapper)
  return wrapper
}

/**
 * Initializes or returns the singleton application SQLite database.
 */
export function initDatabase(dbFilePath: string): SqliteDatabase {
  if (dbInstance) {
    return dbInstance
  }
  dbInstance = createSqliteConnection(dbFilePath)
  return dbInstance
}

export function getDatabase(): SqliteDatabase {
  if (!dbInstance) {
    throw new Error('SQLite database has not been initialized yet.')
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close()
    } catch (err) {
      console.error('Error closing SQLite database:', err)
    } finally {
      dbInstance = null
    }
  }
}
