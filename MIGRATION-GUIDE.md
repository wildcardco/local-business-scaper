# Database Migration Guide

## Migrating Local Data to Turso

This guide helps you migrate your existing local database (`dev.db`) to Turso cloud database.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Make sure your .env has Turso credentials
# TURSO_DB_URL=libsql://your-db.turso.io
# TURSO_KEY=your-auth-token

# 3. Run migration
npm run migrate-to-turso

# 4. Verify data was migrated
# Check Turso dashboard or run the script again (it will show counts)
```

## Environment Setup

### Development vs Production

The app now automatically uses the right database:

**Development** (npm run dev):
- Uses `file:dev.db` (local SQLite)
- All your existing data
- Fast, no network latency
- Perfect for testing

**Production** (Vercel):
- Uses Turso cloud database
- Requires `TURSO_DB_URL` and `TURSO_KEY`
- Edge-hosted, globally distributed
- Automatic backups

### Environment Variables

Your `.env` file should look like this:

```bash
# Local development (uses this)
DATABASE_URL=file:dev.db

# Production (Vercel uses these)
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_KEY=your-turso-auth-token

# Other API keys...
```

## Migration Process

### Step 1: Verify Local Data

Make sure your local database has the data you want to migrate:

```bash
# Check your local database
sqlite3 dev.db

# In SQLite prompt:
.tables
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM businesses;
SELECT COUNT(*) FROM audits;
.quit
```

### Step 2: Ensure Turso is Set Up

```bash
# Login to Turso
turso auth login

# Check if your database exists
turso db show local-business-scraper

# If not, create it
turso db create local-business-scraper

# Get credentials
turso db show local-business-scraper --url
turso db tokens create local-business-scraper
```

Add these to your `.env` file.

### Step 3: Run Migration Script

```bash
npm run migrate-to-turso
```

The script will:
1. ✅ Connect to both databases
2. 📋 Read all data from local database
3. 📤 Push data to Turso
4. 🔍 Verify row counts match
5. ✨ Report success

**Expected Output:**
```
🚀 Starting migration from local database to Turso...
📍 Local: file:dev.db
📍 Turso: libsql://your-db.turso.io

✅ Local database connected
✅ Turso database connected

📋 Migrating table: users
   Found 2 rows
   ✅ Migrated 2 rows (0 skipped as duplicates)

📋 Migrating table: businesses
   Found 150 rows
   ✅ Migrated 150 rows (0 skipped as duplicates)

...

🔍 Verifying migration...

✅ users: 2 rows (matching)
✅ businesses: 150 rows (matching)
✅ audits: 75 rows (matching)

✨ Migration completed successfully!
```

### Step 4: Verify in Turso

Check your data in Turso:

```bash
# Open Turso shell
turso db shell local-business-scraper

# Check data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM businesses;
SELECT * FROM users LIMIT 5;

# Exit
.quit
```

Or use the Turso web dashboard at https://turso.tech/app

### Step 5: Test Production Mode Locally

Test connecting to Turso from your local machine:

```bash
# Run in production mode (uses Turso)
NODE_ENV=production npm run dev

# Open http://localhost:3000
# Login with your existing credentials
# Verify all data appears correctly
```

## What Gets Migrated

All tables and their data:

- ✅ **users** - Your user accounts
- ✅ **searches** - Search history
- ✅ **businesses** - All scraped businesses
- ✅ **audits** - Website audit results
- ✅ **email_templates** - Email templates
- ✅ **outreach_logs** - Email sending history
- ✅ **email_replies** - Email replies
- ✅ **email_drafts** - Saved drafts
- ✅ **branding_settings** - Company branding

## Troubleshooting

### Error: "TURSO_DB_URL not set"

Make sure your `.env` has:
```bash
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_KEY=your-auth-token
```

### Error: "Connection failed"

Check your Turso credentials:
```bash
# Verify database exists
turso db show local-business-scraper

# Test connection
turso db shell local-business-scraper "SELECT 1"

# If that works but migration fails, regenerate token
turso db tokens create local-business-scraper
```

### Error: "Table doesn't exist"

The Turso database needs the schema first:

```bash
# The migration script will handle this, but if needed:
# Deploy to Vercel once (it will initialize schema)
# Or manually run schema in Turso shell
```

### Different Row Counts

If verification shows different counts:

**More in Turso than Local:**
- Previous migration ran successfully
- Turso has the latest data
- ✅ This is fine

**More in Local than Turso:**
- Migration may have failed partway
- Run migration again (it uses INSERT OR REPLACE)
- Check for error messages

**Neither Database Has Data:**
- Your local database might be empty
- Check: `sqlite3 dev.db ".tables"`
- Make sure you're using the right dev.db file

### Migration Keeps Skipping Rows

If you see "X skipped as duplicates":
- ✅ This is normal on re-runs
- Data already exists in Turso
- Uses INSERT OR REPLACE to avoid conflicts

## Re-running Migration

Safe to run multiple times:
```bash
npm run migrate-to-turso
```

The script uses `INSERT OR REPLACE`, so:
- ✅ Won't create duplicates
- ✅ Updates existing rows with latest data
- ✅ Adds new rows that don't exist

## Manual Migration (Advanced)

If the script doesn't work, you can manually export/import:

### Export from Local

```bash
sqlite3 dev.db .dump > backup.sql
```

### Import to Turso

```bash
turso db shell local-business-scraper < backup.sql
```

### Selective Migration

Migrate only specific tables:

```typescript
// Edit scripts/migrate-to-turso.ts
const tables = [
  'users',
  'businesses'  // Only these two
]
```

## Post-Migration

### Testing

After migration:

1. **Test Locally with Turso**
   ```bash
   NODE_ENV=production npm run dev
   ```
   Verify all features work

2. **Deploy to Vercel**
   ```bash
   git push origin main
   ```
   Vercel will use Turso automatically

3. **Verify Production**
   - Open your Vercel URL
   - Login with existing credentials
   - Check all data appears
   - Test all features

### Keeping Local and Turso in Sync

**Option 1: Use Turso for Everything**
Update your local `.env`:
```bash
# Use Turso even in development
NODE_ENV=production
```

**Option 2: Periodic Migrations**
Keep using local dev.db, migrate occasionally:
```bash
# Work locally all week
npm run dev

# At end of week, push changes to Turso
npm run migrate-to-turso
```

**Option 3: Turso Replica**
Use Turso's embedded replica (best of both worlds):
```typescript
// In server/utils/db.ts
export const db = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_KEY,
  syncUrl: 'file:dev.db',  // Local cache
  syncInterval: 60  // Sync every 60 seconds
})
```

## Backup Strategy

Before migrating:

```bash
# Backup local database
cp dev.db dev.db.backup

# Export as SQL
sqlite3 dev.db .dump > backup-$(date +%Y%m%d).sql
```

After migrating:

```bash
# Backup Turso
turso db shell local-business-scraper ".backup turso-backup.db"
```

## Rollback

If something goes wrong:

### Restore Local Backup
```bash
cp dev.db.backup dev.db
```

### Clear Turso and Re-migrate
```bash
# Clear Turso (careful!)
turso db shell local-business-scraper

# In shell:
DROP TABLE users;
DROP TABLE businesses;
-- etc.

# Restart app to reinitialize schema
# Then re-run migration
npm run migrate-to-turso
```

## Best Practices

1. **Always backup first**
   - `cp dev.db dev.db.backup`
   
2. **Test in production mode locally**
   - `NODE_ENV=production npm run dev`
   
3. **Verify data after migration**
   - Check Turso dashboard
   - Login and browse your data
   
4. **Monitor Turso usage**
   - Free tier: 500 MB storage
   - Check: `turso db show local-business-scraper`

5. **Keep backups**
   - Export data regularly
   - Store backups securely

## Support

Need help?

- **Check logs**: Migration script shows detailed errors
- **Turso Discord**: https://discord.gg/turso
- **Turso Docs**: https://docs.turso.tech
- **GitHub Issues**: Create an issue in your repo

---

**Ready to migrate?** Run `npm run migrate-to-turso` and follow the prompts!

