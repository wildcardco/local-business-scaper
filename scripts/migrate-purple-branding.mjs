// One-off: replace old purple branding defaults with official red/burgundy.
// Only touches rows still holding the old defaults; custom colors are preserved.
//
// Local:      node scripts/migrate-purple-branding.mjs
// Production: TURSO_DB_URL=libsql://... TURSO_KEY=... node scripts/migrate-purple-branding.mjs
//             (or set them in .env — this script loads it)
import { createClient } from '@libsql/client'
import 'dotenv/config'

const url = process.env.TURSO_DB_URL || 'file:dev.db'
const authToken = process.env.TURSO_KEY || undefined

const db = createClient({ url, authToken })
console.log(`target: ${url.startsWith('libsql') ? 'Turso (production)' : url}`)

const before = await db.execute('SELECT user_id, primary_color, secondary_color FROM branding_settings')
console.log('before:', JSON.stringify(before.rows))

const r1 = await db.execute("UPDATE branding_settings SET primary_color = '#D6293E' WHERE lower(primary_color) = '#8b5cf6'")
const r2 = await db.execute("UPDATE branding_settings SET secondary_color = '#2d1818' WHERE lower(secondary_color) = '#3b1f5c'")
console.log(`updated primary: ${r1.rowsAffected}, secondary: ${r2.rowsAffected}`)

const after = await db.execute('SELECT user_id, primary_color, secondary_color FROM branding_settings')
console.log('after:', JSON.stringify(after.rows))
