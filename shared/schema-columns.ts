/**
 * Columns added after the tables already existed in production.
 * Startup `tryAlter` can stop before these statements, so request paths
 * add them only when `PRAGMA table_info` says they are missing.
 *
 * `web_stack_url` is an n8n lead field. Studio stores that URL in
 * `mockups.preview_url`. It is not a SQLite column.
 *
 * `digest_rerolls` already exists in production without the snapshot columns.
 * The request-path ensure creates the table when it is missing, then adds
 * any catalog column `PRAGMA table_info` does not already list.
 */
export const SCHEMA_COLUMNS = [
  { table: 'businesses', column: 'research_status', type: 'TEXT' },
  { table: 'businesses', column: 'research_requested_at', type: 'TEXT' },
  { table: 'businesses', column: 'research_completed_at', type: 'TEXT' },
  { table: 'mockups', column: 'research_status', type: 'TEXT' },
  { table: 'mockups', column: 'research_requested_at', type: 'TEXT' },
  { table: 'mockups', column: 'research_completed_at', type: 'TEXT' },
  { table: 'mockups', column: 'preview_url', type: 'TEXT' },
  { table: 'mockups', column: 'preview_made_at', type: 'TEXT' },
  { table: 'digest_leads', column: 'lead_group', type: 'TEXT' },
  { table: 'digest_rerolls', column: 'search_category', type: 'TEXT' },
  { table: 'digest_rerolls', column: 'search_location', type: 'TEXT' },
  { table: 'digest_rerolls', column: 'result_count', type: 'INTEGER' },
  { table: 'digest_rerolls', column: 'results_json', type: 'TEXT' },
  { table: 'digest_rerolls', column: 'completed_at', type: 'TEXT' },
  { table: 'digest_rerolls', column: 'dismissed_at', type: 'TEXT' },
  { table: 'digest_rerolls', column: 'digest_id', type: 'TEXT' }
] as const

/** Current re-roll table. `IF NOT EXISTS` leaves an older table in place so the column catalog can ALTER it. */
export const DIGEST_REROLLS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS digest_rerolls (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      digest_date TEXT NOT NULL,
      category TEXT NOT NULL,
      random INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      search_category TEXT,
      search_location TEXT,
      result_count INTEGER,
      results_json TEXT,
      completed_at TEXT,
      dismissed_at TEXT,
      digest_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`

export const DIGEST_REROLLS_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_digest_rerolls_user_date ON digest_rerolls(user_id, digest_date)`

export type SchemaColumn = (typeof SCHEMA_COLUMNS)[number]

const IDENTIFIER = /^[a-z_]+$/

function assertIdentifier(value: string) {
  if (!IDENTIFIER.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`)
}

export function columnAlterSql(column: SchemaColumn) {
  assertIdentifier(column.table)
  assertIdentifier(column.column)
  const type: string = column.type
  if (type !== 'TEXT' && type !== 'INTEGER') {
    throw new Error(`Unsupported column type: ${type}`)
  }
  return `ALTER TABLE ${column.table} ADD COLUMN ${column.column} ${type}`
}

type QueryRows = Array<Record<string, unknown>>

/**
 * Add any catalog column that is not already on the table.
 * A missing table is skipped so a fresh database can create tables first.
 * A duplicate-column race is ignored. Every other ALTER failure is thrown.
 */
export async function ensureMissingColumns(execute: (sql: string) => Promise<QueryRows>) {
  const applied: string[] = []
  const tables = [...new Set(SCHEMA_COLUMNS.map(column => column.table))]
  const present = new Map<string, Set<string>>()

  for (const table of tables) {
    assertIdentifier(table)
    const exists = await execute(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`
    )
    if (!exists.length) continue
    const info = await execute(`PRAGMA table_info(${table})`)
    present.set(table, new Set(info.map(row => String(row.name || ''))))
  }

  for (const column of SCHEMA_COLUMNS) {
    const names = present.get(column.table)
    if (!names || names.has(column.column)) continue
    const sql = columnAlterSql(column)
    try {
      await execute(sql)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/duplicate column/i.test(message)) throw error
    }
    names.add(column.column)
    applied.push(sql)
  }

  return applied
}

/**
 * Request-path schema. Creates `digest_rerolls` when production does not have
 * it yet, then adds every catalog column that is still missing. Startup init
 * is not required.
 */
export async function ensureRequestSchema(execute: (sql: string) => Promise<QueryRows>) {
  await execute(DIGEST_REROLLS_TABLE_SQL)
  await execute(DIGEST_REROLLS_INDEX_SQL)
  return ensureMissingColumns(execute)
}
