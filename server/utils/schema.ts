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
      contacts_data TEXT,
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
      generated_body TEXT,
      ai_generated INTEGER DEFAULT 0,
      reply_to_message_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE
    )
  `)

  // Email replies table
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

  // Email drafts table
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

  // Branding settings table
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Add sender email columns if they don't exist
  try {
    await db.execute(`ALTER TABLE branding_settings ADD COLUMN sender_email TEXT`)
  } catch (e) {
    // Column might already exist
  }

  try {
    await db.execute(`ALTER TABLE branding_settings ADD COLUMN sender_name TEXT`)
  } catch (e) {
    // Column might already exist
  }

  // Add contacts_data column to businesses table (using ALTER TABLE for existing databases)
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN contacts_data TEXT`)
  } catch (e) {
    // Column might already exist
  }

  // Add social media columns to businesses table (using ALTER TABLE for existing databases)
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN facebook TEXT`)
  } catch (e) {
    // Column might already exist
  }
  
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN instagram TEXT`)
  } catch (e) {
    // Column might already exist
  }
  
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN twitter TEXT`)
  } catch (e) {
    // Column might already exist
  }
  
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN linkedin TEXT`)
  } catch (e) {
    // Column might already exist
  }
  
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN youtube TEXT`)
  } catch (e) {
    // Column might already exist
  }
  
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN tiktok TEXT`)
  } catch (e) {
    // Column might already exist
  }
  
  try {
    await db.execute(`ALTER TABLE businesses ADD COLUMN yelp TEXT`)
  } catch (e) {
    // Column might already exist
  }

  // Create indexes for common queries
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_search ON businesses(search_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_searches_user ON searches(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_outreach_logs_user ON outreach_logs(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_outreach_logs_business ON outreach_logs(business_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_email_replies_outreach ON email_replies(outreach_log_id)`)

  console.log('✅ Database schema initialized')
}





