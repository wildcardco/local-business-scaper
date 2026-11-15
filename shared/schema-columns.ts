/**
 * Columns added after the tables already existed in production.
 * Startup `tryAlter` can stop before these statements, so request paths
 * add them only when `PRAGMA table_info` says they are missing.
 *
 * `web_stack_url` is an n8n lead field. Studio stores that URL in
 * `mockups.preview_url`. It is not a SQLite column.
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
  { table: 'digest_leads', column: 'lead_group', type: 'TEXT' }
] as const

export type SchemaColumn = (typeof SCHEMA_COLUMNS)[number]

const IDENTIFIER = /^[a-z_]+$/

function assertIdentifier(value: string) {
  if (!IDENTIFIER.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`)
}

export function columnAlterSql(column: SchemaColumn) {
  assertIdentifier(column.table)
  assertIdentifier(column.column)
  if (column.type !== 'TEXT') throw new Error(`Unsupported column type: ${column.type}`)
  return `ALTER TABLE ${column.table} ADD COLUMN ${column.column} ${column.type}`
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
