import { db } from './db'
import { ensureDigestTables } from './digest-schema'

async function tryAlter(sql: string) {
  try {
    await db.execute(sql)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[schema] statement failed: ${message}\n${sql.trim()}`)
  }
}

async function migrateBusinessesTable() {
  const master = await db.execute(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'businesses'`
  )
  const createSql = String(master.rows[0]?.sql || '')
  if (!createSql) return

  const hasGlobalPlaceUnique = /place_id TEXT UNIQUE/i.test(createSql)
  const searchNotNull = /search_id TEXT NOT NULL/i.test(createSql)

  if (!hasGlobalPlaceUnique && !searchNotNull) {
    await tryAlter(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_user_place ON businesses(user_id, place_id) WHERE place_id IS NOT NULL`
    )
    return
  }

  try {
    await db.execute('PRAGMA foreign_keys = OFF')
    await db.execute(`
      CREATE TABLE IF NOT EXISTS businesses_migrating (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        search_id TEXT,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        phone TEXT,
        website TEXT,
        email TEXT,
        google_maps_url TEXT,
        place_id TEXT,
        category TEXT,
        rating REAL,
        review_count INTEGER,
        price_level TEXT,
        lead_score INTEGER DEFAULT 0,
        lead_category TEXT,
        status TEXT DEFAULT 'new',
        approved_at TEXT,
        sent_at TEXT,
        contacts_data TEXT,
        facebook TEXT,
        instagram TEXT,
        twitter TEXT,
        linkedin TEXT,
        youtube TEXT,
        tiktok TEXT,
        yelp TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE SET NULL
      )
    `)

    const info = await db.execute('PRAGMA table_info(businesses)')
    const existingCols = new Set(info.rows.map(row => String(row.name)))
    const targetCols = [
      'id', 'user_id', 'search_id', 'name', 'address', 'city', 'state', 'zip_code',
      'phone', 'website', 'email', 'google_maps_url', 'place_id', 'category', 'rating',
      'review_count', 'price_level', 'lead_score', 'lead_category', 'status',
      'approved_at', 'sent_at', 'contacts_data', 'facebook', 'instagram', 'twitter',
      'linkedin', 'youtube', 'tiktok', 'yelp', 'created_at', 'updated_at'
    ]
    const copyCols = targetCols.filter(col => existingCols.has(col))
    const colList = copyCols.join(', ')

    await db.execute(`INSERT INTO businesses_migrating (${colList}) SELECT ${colList} FROM businesses`)
    await db.execute('DROP TABLE businesses')
    await db.execute('ALTER TABLE businesses_migrating RENAME TO businesses')
    await db.execute('PRAGMA foreign_keys = ON')
  } catch (error) {
    console.warn('Could not rebuild businesses table (place_id / search_id). Continuing with additive indexes.', error)
    try {
      await db.execute('PRAGMA foreign_keys = ON')
    } catch {
      // ignore
    }
  }

  await tryAlter(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_user_place ON businesses(user_id, place_id) WHERE place_id IS NOT NULL`
  )
}

export async function initializeSchema() {
  try {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  await tryAlter(`ALTER TABLE users ADD COLUMN email TEXT`)
  await tryAlter(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS login_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email)`)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      location TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      search_id TEXT,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      phone TEXT,
      website TEXT,
      email TEXT,
      google_maps_url TEXT,
      place_id TEXT,
      category TEXT,
      rating REAL,
      review_count INTEGER,
      price_level TEXT,
      lead_score INTEGER DEFAULT 0,
      lead_category TEXT,
      status TEXT DEFAULT 'new',
      approved_at TEXT,
      sent_at TEXT,
      contacts_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE SET NULL
    )
  `)

  await migrateBusinessesTable()

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      business_id TEXT UNIQUE NOT NULL,
      performance_score INTEGER,
      accessibility_score INTEGER,
      best_practices_score INTEGER,
      seo_score INTEGER,
      first_contentful_paint TEXT,
      largest_contentful_paint TEXT,
      total_blocking_time TEXT,
      cumulative_layout_shift TEXT,
      speed_index TEXT,
      is_mobile_responsive INTEGER,
      has_ssl INTEGER,
      has_missing_meta_tags INTEGER,
      detected_platform TEXT,
      raw_lighthouse_json TEXT,
      audited_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS outreach_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      email_to TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      message_id TEXT,
      generated_body TEXT,
      ai_generated INTEGER DEFAULT 0,
      reply_to_message_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_replies (
      id TEXT PRIMARY KEY,
      outreach_log_id TEXT NOT NULL,
      from_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT,
      body_html TEXT,
      received_at TEXT DEFAULT (datetime('now')),
      resend_event_id TEXT,
      FOREIGN KEY (outreach_log_id) REFERENCES outreach_logs(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_id TEXT,
      email_to TEXT,
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      body_html TEXT,
      ai_generated INTEGER DEFAULT 0,
      custom_prompt TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS branding_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company_name TEXT,
      tagline TEXT,
      logo_url TEXT,
      sender_email TEXT,
      sender_name TEXT,
      primary_color TEXT DEFAULT '#D6293E',
      secondary_color TEXT DEFAULT '#2d1818',
      font_family TEXT DEFAULT 'system-ui',
      ai_model TEXT DEFAULT 'claude-fable-5',
      ai_max_tokens INTEGER DEFAULT 16000,
      pitch_max_tokens INTEGER DEFAULT 1500,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await tryAlter(`ALTER TABLE branding_settings ADD COLUMN sender_email TEXT`)
  await tryAlter(`ALTER TABLE branding_settings ADD COLUMN sender_name TEXT`)
  await tryAlter(`ALTER TABLE branding_settings ADD COLUMN ai_model TEXT DEFAULT 'claude-fable-5'`)
  await tryAlter(`ALTER TABLE branding_settings ADD COLUMN ai_max_tokens INTEGER DEFAULT 16000`)
  await tryAlter(`ALTER TABLE branding_settings ADD COLUMN pitch_max_tokens INTEGER DEFAULT 1500`)

  await tryAlter(`ALTER TABLE businesses ADD COLUMN contacts_data TEXT`)
  await tryAlter(`ALTER TABLE businesses ADD COLUMN facebook TEXT`)
  await tryAlter(`ALTER TABLE businesses ADD COLUMN instagram TEXT`)
  await tryAlter(`ALTER TABLE businesses ADD COLUMN twitter TEXT`)
  await tryAlter(`ALTER TABLE businesses ADD COLUMN linkedin TEXT`)
  await tryAlter(`ALTER TABLE businesses ADD COLUMN youtube TEXT`)
  await tryAlter(`ALTER TABLE businesses ADD COLUMN tiktok TEXT`)
  await tryAlter(`ALTER TABLE businesses ADD COLUMN yelp TEXT`)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS mockups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_id TEXT,
      place_id TEXT,
      owner TEXT,
      source TEXT DEFAULT 'studio',
      status TEXT DEFAULT 'draft',
      mockup_url TEXT,
      mockup_version INTEGER DEFAULT 0,
      pitch_draft TEXT,
      pitch_subject TEXT,
      pitch_version INTEGER DEFAULT 0,
      last_feedback TEXT,
      photo_urls TEXT,
      ai_model TEXT,
      n8n_synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
    )
  `)

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_search ON businesses(search_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_searches_user ON searches(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_outreach_logs_user ON outreach_logs(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_outreach_logs_business ON outreach_logs(business_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_email_replies_outreach ON email_replies(outreach_log_id)`)
  await tryAlter(`ALTER TABLE mockups ADD COLUMN github_repo TEXT`)

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_mockups_user ON mockups(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_mockups_business ON mockups(business_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_mockups_place ON mockups(place_id)`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[schema] initializeSchema stopped early (${message}). Digest tables are created separately.`)
  }

  await ensureDigestTables()

  console.log('Database schema initialized')
}
