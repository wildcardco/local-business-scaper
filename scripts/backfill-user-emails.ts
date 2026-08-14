/**
 * Backfill users.email from known usernames.
 * Run: npx tsx scripts/backfill-user-emails.ts
 */
import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'

dotenv.config()

const USERNAME_EMAIL: Record<string, string> = {
  ryan: 'ryan@wildcardcreativeco.com',
  aaron: 'aaron@wildcardcreativeco.com',
  chase: 'chase@wildcardcreativeco.com'
}

const isDev = !process.env.TURSO_DB_URL || process.env.USE_TURSO !== '1'
const db = createClient(
  isDev
    ? { url: process.env.DATABASE_URL || 'file:dev.db' }
    : { url: process.env.TURSO_DB_URL!, authToken: process.env.TURSO_KEY }
)

async function main() {
  console.log(isDev ? 'Using local database' : 'Using Turso')

  for (const [username, email] of Object.entries(USERNAME_EMAIL)) {
    const result = await db.execute({
      sql: 'UPDATE users SET email = ?, updated_at = datetime(\'now\') WHERE username = ? AND (email IS NULL OR email = \'\')',
      args: [email, username]
    })
    console.log(`${username} → ${email} (${result.rowsAffected} row(s))`)
  }

  const users = await db.execute('SELECT username, email FROM users')
  for (const row of users.rows) {
    console.log(`  ${row.username}: ${row.email || '(no email)'}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
