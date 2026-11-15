import { ensureMissingColumns } from '~~/shared/schema-columns'
import { db } from './db'

let ready: Promise<void> | null = null

/**
 * Memoized per server instance. A failed attempt is cleared so the next request retries.
 * A pass that ran before `businesses` or `mockups` existed is not cached, so startup
 * can create the tables and then add the columns.
 */
export function ensureSchemaColumns() {
  if (!ready) {
    ready = (async () => {
      await ensureMissingColumns(async (sql) => {
        const result = await db.execute(sql)
        return result.rows as Array<Record<string, unknown>>
      })
      const found = await db.execute(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('businesses', 'mockups')`
      )
      if (found.rows.length < 2) ready = null
    })().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}
