import { db } from './db'

// Initialize database schema
// Run once on startup or via API endpoint
export async function initializeSchema() {
  // Users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Searches table
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

  // Businesses table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      search_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      phone TEXT,
      website TEXT,
      email TEXT,
      google_maps_url TEXT,
      place_id TEXT UNIQUE,
      category TEXT,
      rating REAL,
      review_count INTEGER,
      price_level TEXT,
      lead_score INTEGER DEFAULT 0,
      lead_category TEXT,
      status TEXT DEFAULT 'new',
      approved_at TEXT,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE
    )
  `)

  // Audits table
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

  // Email templates table
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

  // Outreach logs table
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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for common queries
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_search ON businesses(search_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_searches_user ON searches(user_id)`)

  console.log('✅ Database schema initialized')
}





