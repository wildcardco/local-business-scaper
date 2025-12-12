/**
 * Migration script to push local database to Turso
 * 
 * This script:
 * 1. Reads all data from local dev.db
 * 2. Pushes it to Turso cloud database
 * 3. Preserves all relationships and data integrity
 * 
 * Usage:
 *   npm run migrate-to-turso
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Validate required environment variables
if (!process.env.TURSO_DB_URL || !process.env.TURSO_KEY) {
  console.error('❌ Error: TURSO_DB_URL and TURSO_KEY must be set in .env')
  console.error('Run: turso db show your-db --url')
  console.error('Run: turso db tokens create your-db')
  process.exit(1)
}

// Create connections
const localDb = createClient({
  url: 'file:dev.db'
})

const tursoDb = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_KEY
})

// Tables to migrate (in order due to foreign keys)
const tables = [
  'users',
  'searches',
  'businesses',
  'audits',
  'email_templates',
  'outreach_logs',
  'email_replies',
  'email_drafts',
  'branding_settings'
]

async function migrateTable(tableName: string) {
  console.log(`\n📋 Migrating table: ${tableName}`)
  
  try {
    // Get all rows from local database
    const result = await localDb.execute(`SELECT * FROM ${tableName}`)
    const rows = result.rows
    
    if (rows.length === 0) {
      console.log(`   ⏭️  No data in ${tableName}, skipping...`)
      return
    }
    
    console.log(`   Found ${rows.length} rows`)
    
    // Get column names from first row
    const columns = Object.keys(rows[0])
    const placeholders = columns.map(() => '?').join(', ')
    const columnNames = columns.join(', ')
    
    // Insert each row into Turso
    let successCount = 0
    let skipCount = 0
    
    for (const row of rows) {
      try {
        const values = columns.map(col => row[col])
        await tursoDb.execute({
          sql: `INSERT OR REPLACE INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
          args: values
        })
        successCount++
      } catch (error: any) {
        // Skip if row already exists or has conflicts
        if (error.message?.includes('UNIQUE constraint')) {
          skipCount++
        } else {
          console.error(`   ⚠️  Error inserting row:`, error.message)
        }
      }
    }
    
    console.log(`   ✅ Migrated ${successCount} rows (${skipCount} skipped as duplicates)`)
    
  } catch (error: any) {
    if (error.message?.includes('no such table')) {
      console.log(`   ⏭️  Table ${tableName} doesn't exist in local db, skipping...`)
    } else {
      console.error(`   ❌ Error migrating ${tableName}:`, error.message)
      throw error
    }
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...\n')
  
  for (const table of tables) {
    try {
      const localResult = await localDb.execute(`SELECT COUNT(*) as count FROM ${table}`)
      const tursoResult = await tursoDb.execute(`SELECT COUNT(*) as count FROM ${table}`)
      
      const localCount = localResult.rows[0].count
      const tursoCount = tursoResult.rows[0].count
      
      if (localCount === tursoCount) {
        console.log(`✅ ${table}: ${localCount} rows (matching)`)
      } else {
        console.log(`⚠️  ${table}: Local=${localCount}, Turso=${tursoCount} (different)`)
      }
    } catch (error) {
      // Table might not exist, skip
    }
  }
}

async function main() {
  console.log('🚀 Starting migration from local database to Turso...')
  console.log(`📍 Local: file:dev.db`)
  console.log(`📍 Turso: ${process.env.TURSO_DB_URL}\n`)
  
  try {
    // Test connections
    await localDb.execute('SELECT 1')
    console.log('✅ Local database connected')
    
    await tursoDb.execute('SELECT 1')
    console.log('✅ Turso database connected')
    
    // Migrate each table
    for (const table of tables) {
      await migrateTable(table)
    }
    
    // Verify migration
    await verifyMigration()
    
    console.log('\n✨ Migration completed successfully!')
    console.log('\n💡 Next steps:')
    console.log('   1. Verify data in Turso dashboard')
    console.log('   2. Test your app locally with: NODE_ENV=production npm run dev')
    console.log('   3. Deploy to Vercel when ready')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
main()

