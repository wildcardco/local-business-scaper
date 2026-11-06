import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@libsql/client'
import { MOCKUP_CREATED_ORDER_SQL } from './mockup-list-order.ts'
import { mockupCreatedTime } from './mockup-time.ts'
import {
  collectLeadRows,
  dedupeLeadsByPlace,
  incomingLeadIsOlder,
  leadDeployment,
  leadSyncAfterError
} from './studio-sync-leads.ts'

const TODAY_URL = 'https://wildcard-mockup-ryan-datagraphic-printing-6klfc0.vercel.app'
const PAGE_SIZE = 100

const todayHtml = {
  id: 4989,
  place_id: 'ChIJlyMchiWjEYgRaD7CAYYYOoc',
  business_name: 'Datagraphic Printing',
  owner: 'ryan',
  mockup_url: TODAY_URL,
  createdAt: '2026-11-06T11:01:18.089Z',
  created_at: '2026-11-06T11:00:41.791Z',
  updatedAt: '2026-11-06T18:29:29.785Z'
}

const olderDuplicate = {
  id: 1200,
  place_id: todayHtml.place_id,
  business_name: 'Datagraphic Printing',
  owner: 'ryan',
  mockup_url: 'https://wildcard-mockup-ryan-datagraphic-old.vercel.app',
  createdAt: '2026-10-09T10:00:16.000Z',
  updatedAt: '2026-10-15T00:28:14.000Z'
}

test('a current-day HTML lead keeps its Vercel URL over an older duplicate', () => {
  const merged = dedupeLeadsByPlace([todayHtml, olderDuplicate])
  assert.equal(merged.duplicatePlace, 1)
  assert.equal(merged.rows.length, 1)
  assert.equal(merged.rows[0]?.mockup_url, TODAY_URL)
  assert.equal(mockupCreatedTime(merged.rows[0]), '2026-11-06 11:01:18')
})

test('a web-stack row uses web_stack_url and its start time when the lead is older', () => {
  const row = {
    id: 4990,
    place_id: 'ChIJwebstack',
    business_name: 'Datagraphic Printing',
    owner: 'ryan',
    mockup_url: '',
    web_stack_url: 'https://wildcard-mockup-ryan-datagraphic.vercel.app',
    web_stack_status: 'ready',
    web_stack_repo: 'wildcardco/wildcard-mockup-ryan-datagraphic',
    web_stack_started_at: '2026-11-06T18:25:26.587Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-11-06T18:29:29.785Z'
  }
  const deployment = leadDeployment(row)
  assert.equal(deployment.webStack, true)
  assert.equal(deployment.url, row.web_stack_url)
  assert.equal(mockupCreatedTime(row), '2026-11-06 18:25:26')
  assert.equal(mockupCreatedTime({ createdAt: Date.parse('2026-11-06T11:01:18.089Z') }), '2026-11-06 11:01:18')
})

test('the first-page timeout falls through to an unsorted read', () => {
  const message = 'n8n did not answer within 12 seconds. Sync stopped so the phone is not left waiting.'
  assert.equal(/sort/i.test(message), false)
  assert.equal(leadSyncAfterError({ cursor: null, unsorted: false, message }), 'unsorted')
  assert.equal(leadSyncAfterError({ cursor: 'page-2', unsorted: false, message }), 'fail')
  assert.equal(leadSyncAfterError({ cursor: null, unsorted: true, message }), 'fail')
  assert.equal(leadSyncAfterError({
    cursor: null,
    unsorted: false,
    message: 'Invalid sort columnName'
  }), 'unsorted')
})

test('an older page cannot replace a current-day lead already saved', () => {
  assert.equal(incomingLeadIsOlder('2026-11-06 18:29:29', olderDuplicate), true)
  assert.equal(incomingLeadIsOlder('2026-10-15 00:28:14', todayHtml), false)
})

test('the row on the next page boundary is kept, including a short last page', () => {
  const pageCap = 40
  const firstPage: Record<string, unknown>[] = Array.from({ length: PAGE_SIZE - 1 }, (_, index) => ({
    id: index + 1,
    place_id: `old-${index}`,
    mockup_url: ''
  }))
  firstPage.push(olderDuplicate)
  const lastPage: Record<string, unknown>[] = [
    todayHtml,
    ...Array.from({ length: 37 }, (_, index) => ({
      id: 4900 + index,
      place_id: `tail-${index}`,
      mockup_url: ''
    }))
  ]
  const kept = collectLeadRows([
    { rows: firstPage, nextCursor: 'cursor-page-2' },
    { rows: lastPage, nextCursor: null }
  ], pageCap)

  assert.equal(kept.length, firstPage.length + lastPage.length)
  assert.equal(kept[PAGE_SIZE - 1]?.place_id, olderDuplicate.place_id)
  assert.equal(kept[PAGE_SIZE]?.place_id, todayHtml.place_id)
  assert.equal(kept.at(-1)?.place_id, 'tail-36')

  const picked = dedupeLeadsByPlace(kept)
  const winner = picked.rows.find(row => row.place_id === todayHtml.place_id)
  assert.equal(winner?.mockup_url, TODAY_URL)
  assert.equal(winner?.id, todayHtml.id)
})

test('Last created puts a current-day mockup first across the page boundary', async () => {
  const db = createClient({ url: ':memory:' })
  await db.execute(`
    CREATE TABLE mockups (
      id TEXT PRIMARY KEY,
      name TEXT,
      n8n_created_at TEXT
    )
  `)
  const inserts = []
  for (let index = 0; index < PAGE_SIZE; index++) {
    const created = new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString().slice(0, 19).replace('T', ' ')
    inserts.push({
      sql: 'INSERT INTO mockups (id, name, n8n_created_at) VALUES (?, ?, ?)',
      args: [`old-${index}`, `Older ${index}`, created]
    })
  }
  inserts.push({
    sql: 'INSERT INTO mockups (id, name, n8n_created_at) VALUES (?, ?, ?)',
    args: ['today', 'Datagraphic Printing', '2026-11-06 11:01:18']
  })
  inserts.push({
    sql: 'INSERT INTO mockups (id, name, n8n_created_at) VALUES (?, ?, ?)',
    args: ['blank', 'No stamp', null]
  })
  await db.batch(inserts, 'write')

  const order = MOCKUP_CREATED_ORDER_SQL
  const page1 = await db.execute({
    sql: `SELECT id, name FROM mockups ORDER BY ${order} LIMIT ? OFFSET ?`,
    args: [PAGE_SIZE, 0]
  })
  const page2 = await db.execute({
    sql: `SELECT id, name FROM mockups ORDER BY ${order} LIMIT ? OFFSET ?`,
    args: [PAGE_SIZE, PAGE_SIZE]
  })
  const counted = await db.execute('SELECT COUNT(*) AS count FROM mockups')

  assert.equal(page1.rows[0]?.id, 'today')
  assert.equal(page1.rows[0]?.name, 'Datagraphic Printing')
  assert.equal(page1.rows.length, PAGE_SIZE)
  assert.equal(page2.rows.length, 2)
  assert.equal(page2.rows.at(-1)?.id, 'blank')
  const seen = new Set([...page1.rows, ...page2.rows].map(row => String(row.id)))
  assert.equal(seen.size, Number(counted.rows[0]?.count))
  assert.equal(seen.has('today'), true)
  db.close()
})
