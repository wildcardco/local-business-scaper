import { db } from './db'

/** Shared with initializeSchema so startup and request paths create the same tables. */
export const DIGEST_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS digests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      digest_date TEXT NOT NULL,
      search_category TEXT NOT NULL,
      search_location TEXT NOT NULL,
      lead_count INTEGER DEFAULT 0,
      received_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_digests_user_date ON digests(user_id, digest_date)`,
  `CREATE TABLE IF NOT EXISTS digest_leads (
      id TEXT PRIMARY KEY,
      digest_id TEXT NOT NULL,
      business_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      rank INTEGER,
      score INTEGER,
      tier_slug TEXT,
      tier_label TEXT,
      angle TEXT,
      note TEXT,
      signals TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (digest_id) REFERENCES digests(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )`,
  `CREATE INDEX IF NOT EXISTS idx_digest_leads_digest ON digest_leads(digest_id)`,
  `CREATE INDEX IF NOT EXISTS idx_digest_leads_business ON digest_leads(business_id)`
]

let digestTablesReady: Promise<void> | null = null

async function createDigestTables() {
  for (const sql of DIGEST_SCHEMA_SQL) {
    await db.execute(sql)
  }
}

/** Memoized per server instance. A failed attempt is cleared so the next request retries. */
export function ensureDigestTables(): Promise<void> {
  if (!digestTablesReady) {
    digestTablesReady = createDigestTables().catch((error) => {
      digestTablesReady = null
      throw error
    })
  }
  return digestTablesReady
}
