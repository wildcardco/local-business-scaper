import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { SCHEMA_COLUMNS, columnAlterSql, ensureMissingColumns, ensureRequestSchema } from './schema-columns.ts'

const EXPECTED = [
  'businesses.research_status',
  'businesses.research_requested_at',
  'businesses.research_completed_at',
  'mockups.research_status',
  'mockups.research_requested_at',
  'mockups.research_completed_at',
  'mockups.preview_url',
  'mockups.preview_made_at',
  'digest_leads.lead_group',
  'digest_rerolls.search_category',
  'digest_rerolls.search_location',
  'digest_rerolls.result_count',
  'digest_rerolls.results_json',
  'digest_rerolls.completed_at',
  'digest_rerolls.dismissed_at',
  'digest_rerolls.digest_id'
]

function openDb(name: string) {
  const dir = mkdtempSync(join(tmpdir(), 'schema-columns-'))
  const db = new DatabaseSync(join(dir, name))
  return { dir, db }
}

function execute(db: DatabaseSync) {
  return async (sql: string) => {
    const statement = db.prepare(sql)
    if (/^\s*(select|pragma)/i.test(sql)) return statement.all() as Array<Record<string, unknown>>
    statement.run()
    return []
  }
}

function names(db: DatabaseSync, table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(row => String(row.name))
}

test('the catalog is the columns production was missing', () => {
  assert.deepEqual(
    SCHEMA_COLUMNS.map(column => `${column.table}.${column.column}`),
    EXPECTED
  )
})

test('a production-shaped database gains the columns, and a second pass does not ALTER', async () => {
  const { dir, db } = openDb('app.db')
  try {
    db.exec(`
      CREATE TABLE businesses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        place_id TEXT
      );
      CREATE TABLE mockups (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        business_id TEXT,
        build_mode TEXT DEFAULT 'html',
        build_error TEXT
      );
      CREATE TABLE digest_leads (
        id TEXT PRIMARY KEY,
        digest_id TEXT NOT NULL,
        business_id TEXT NOT NULL,
        place_id TEXT NOT NULL
      );
      CREATE TABLE digest_rerolls (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        digest_date TEXT NOT NULL,
        category TEXT NOT NULL,
        random INTEGER NOT NULL DEFAULT 0,
        created_at TEXT
      );
      INSERT INTO businesses (id, user_id, name) VALUES ('biz', 'user', 'Harbor');
    `)

    const applied = await ensureMissingColumns(execute(db))
    assert.deepEqual(applied, SCHEMA_COLUMNS.map(column => columnAlterSql(column)))

    for (const name of EXPECTED) {
      const [table, column] = name.split('.')
      if (!table || !column) throw new Error(name)
      assert.ok(names(db, table).includes(column), name)
    }

    const again = await ensureMissingColumns(execute(db))
    assert.deepEqual(again, [])

    const selected = db.prepare(
      `SELECT id, research_status, research_requested_at, research_completed_at
       FROM businesses WHERE id = 'biz'`
    ).get() as { id: string, research_status: string | null }
    assert.equal(selected.id, 'biz')
    assert.equal(selected.research_status, null)
  } finally {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('only the missing column is added, and a missing table is left alone', async () => {
  const { dir, db } = openDb('partial.db')
  try {
    db.exec(`CREATE TABLE businesses (id TEXT PRIMARY KEY, research_status TEXT)`)
    const applied = await ensureMissingColumns(execute(db))
    assert.deepEqual(applied, [
      'ALTER TABLE businesses ADD COLUMN research_requested_at TEXT',
      'ALTER TABLE businesses ADD COLUMN research_completed_at TEXT'
    ])
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all()
    assert.deepEqual(tables.map(row => String(row.name)).sort(), ['businesses'])
  } finally {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the request path creates digest_rerolls and fills columns the old table is missing', async () => {
  const created = openDb('created.db')
  try {
    const applied = await ensureRequestSchema(execute(created.db))
    assert.deepEqual(applied, [])
    assert.ok(names(created.db, 'digest_rerolls').includes('results_json'))
    assert.ok(names(created.db, 'digest_rerolls').includes('result_count'))
  } finally {
    created.db.close()
    rmSync(created.dir, { recursive: true, force: true })
  }

  const older = openDb('older.db')
  try {
    older.db.exec(`
      CREATE TABLE digest_rerolls (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        digest_date TEXT NOT NULL,
        category TEXT NOT NULL,
        random INTEGER NOT NULL DEFAULT 0
      );
    `)
    const applied = await ensureRequestSchema(execute(older.db))
    assert.ok(applied.includes('ALTER TABLE digest_rerolls ADD COLUMN results_json TEXT'))
    assert.ok(applied.includes('ALTER TABLE digest_rerolls ADD COLUMN result_count INTEGER'))
    assert.ok(names(older.db, 'digest_rerolls').includes('dismissed_at'))
    const again = await ensureRequestSchema(execute(older.db))
    assert.deepEqual(again.filter(sql => sql.includes('digest_rerolls')), [])
  } finally {
    older.db.close()
    rmSync(older.dir, { recursive: true, force: true })
  }
})

test('an ALTER failure that is not a duplicate column is not swallowed', async () => {
  await assert.rejects(
    () => ensureMissingColumns(async (sql) => {
      if (sql.startsWith('SELECT name FROM sqlite_master')) {
        return sql.includes('name = \'businesses\'') ? [{ name: 'businesses' }] : []
      }
      if (sql.startsWith('PRAGMA table_info(businesses)')) return [{ name: 'id' }]
      if (sql.startsWith('ALTER TABLE businesses')) throw new Error('SQLITE_UNKNOWN: database is locked')
      return []
    }),
    /database is locked/
  )
})
