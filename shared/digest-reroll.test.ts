import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampRerollPage,
  digestStampChanged,
  digestStampFrom,
  leadsForRerollList,
  nextRerollPollDelay,
  normalizeRerollCategory,
  parseRerollScroll,
  parseStoredRerollLeads,
  pickRerollForIngest,
  REROLL_CREDIT_NOTE,
  REROLL_PAGE_SIZE,
  REROLL_POLL_INTERVAL_MS,
  REROLL_POLL_TIMEOUT_MS,
  REROLL_SECRET_HEADER,
  rerollAgeLabel,
  rerollBackPath,
  rerollCompletedAt,
  rerollConfirmMessage,
  rerollLeadPath,
  rerollNeedsCostWarning,
  rerollNeighbor,
  rerollPageStartIndex,
  rerollSecretHeader,
  rerollWebhookChoice,
  rerollWebhookResult,
  selectVisibleReroll,
  storedRerollLead
} from './digest-reroll.ts'

test('the first re-roll of the day does not warn', () => {
  assert.equal(rerollNeedsCostWarning(0), false)
  assert.equal(rerollNeedsCostWarning(1), true)
  assert.equal(rerollNeedsCostWarning(4), true)
})

test('random replaces a typed category', () => {
  assert.deepEqual(rerollWebhookChoice({ random: true, category: 'plumber' }), {
    random: true,
    category: 'random'
  })
  assert.deepEqual(rerollWebhookChoice({ category: 'Random' }), {
    random: true,
    category: 'random'
  })
})

test('a blank choice is rejected and a typed category is kept', () => {
  assert.deepEqual(rerollWebhookChoice({ category: '   ' }), { error: 'Pick a category or Random.' })
  assert.deepEqual(rerollWebhookChoice({ category: '  plumber  ' }), {
    random: false,
    category: 'plumber'
  })
  assert.equal(normalizeRerollCategory(` ${'x'.repeat(100)} `).length, 80)
})

test('the secret header is omitted when the env var is empty', () => {
  assert.equal(REROLL_SECRET_HEADER, 'X-Reroll-Secret')
  assert.equal(rerollSecretHeader(''), null)
  assert.equal(rerollSecretHeader('   '), null)
  assert.equal(rerollSecretHeader(undefined), null)
  assert.equal(rerollSecretHeader('  abc  '), 'abc')
})

test('a 400 from n8n surfaces its error text and a 200 accept does not', () => {
  assert.deepEqual(rerollWebhookResult(400, { ok: false, error: 'owner is required' }), {
    accepted: false,
    statusCode: 400,
    message: 'owner is required'
  })
  assert.deepEqual(rerollWebhookResult(200, { ok: true, accepted: true, owner: 'ryan', date: '2026-10-08', category: 'random', random: true }), {
    accepted: true
  })
  assert.equal(rerollWebhookResult(502, 'upstream').accepted, false)
})

test('every re-roll confirm says it spends RapidAPI credits', () => {
  assert.match(rerollConfirmMessage(0), new RegExp(REROLL_CREDIT_NOTE))
  assert.match(rerollConfirmMessage(2), /already re-rolled/)
  assert.equal(rerollConfirmMessage(0).includes('already re-rolled'), false)
})

test('age labels count minutes from a sqlite UTC timestamp', () => {
  const at = '2026-11-15 18:00:00'
  const start = Date.parse('2026-11-15T18:00:00Z')
  assert.equal(rerollAgeLabel(at, start + 30_000), 'Re-rolled just now')
  assert.equal(rerollAgeLabel(at, start + 12 * 60_000), 'Re-rolled 12 min ago')
  assert.equal(rerollAgeLabel(at, start + 2 * 60 * 60_000), 'Re-rolled 2 hr ago')
  assert.equal(rerollAgeLabel('not-a-date', start), 'Re-rolled')
})

test('stored re-roll leads keep skip and rejected rows and drop blanks', () => {
  const leads = leadsForRerollList([
    { tierSlug: 'skip', status: 'rejected', placeId: 'p1' },
    { tierSlug: 'good', status: 'new', placeId: 'p2' }
  ])
  assert.equal(leads.length, 2)
  assert.equal(leads[0]?.tierSlug, 'skip')
  const stored = parseStoredRerollLeads(JSON.stringify([
    { placeId: 'p1', businessId: 'b1', name: 'Alpha', tierSlug: 'skip', score: 10 },
    { placeId: 'p1', businessId: 'b1', name: 'Alpha again' },
    { name: 'No place' },
    { placeId: 'p2', name: '  Beta  ', tierSlug: 'good' }
  ]))
  assert.equal(stored.length, 2)
  assert.equal(stored[0]?.name, 'Alpha')
  assert.equal(stored[1]?.businessId, '')
  assert.equal(stored[1]?.name, 'Beta')
  assert.equal(storedRerollLead({ placeId: '  ' }), null)
  assert.deepEqual(parseStoredRerollLeads('{'), [])
})

test('ingest attaches to the open re-roll and not to a finished morning list', () => {
  const now = Date.parse('2026-11-15T18:30:00Z')
  const rows = [
    { id: 'new', createdAt: '2026-11-15 18:20:00', completedAt: null },
    { id: 'old', createdAt: '2026-11-15 12:00:00', completedAt: '2026-11-15 12:02:00' }
  ]
  assert.equal(pickRerollForIngest({ rows, nowMs: now }), 'new')
  assert.equal(pickRerollForIngest({
    rows: [{ id: 'done', createdAt: '2026-11-15 18:20:00', completedAt: '2026-11-15 18:21:00' }],
    nowMs: now
  }), null)
  assert.equal(pickRerollForIngest({
    requestedId: 'done',
    rows: [{ id: 'done', createdAt: '2026-11-15 18:20:00', completedAt: '2026-11-15 18:21:00' }],
    nowMs: now
  }), 'done')
  assert.equal(pickRerollForIngest({
    rerollFlag: true,
    rows: [{ id: 'retry', createdAt: '2026-11-15 18:20:00', completedAt: '2026-11-15 18:21:00' }],
    nowMs: now
  }), 'retry')
  assert.equal(pickRerollForIngest({
    rows: [{ id: 'stale', createdAt: '2026-11-15 10:00:00', completedAt: null }],
    nowMs: now
  }), null)
})

test('a new re-roll keeps the previous results until it finishes, and dismiss hides them', () => {
  const now = Date.parse('2026-11-15T18:30:00Z')
  const digestUpdated = '2026-11-15 12:05:00'
  const previous = {
    id: 'prev',
    createdAt: '2026-11-15 12:00:00',
    completedAt: null,
    dismissedAt: null,
    resultsJson: null
  }
  const running = {
    id: 'run',
    createdAt: '2026-11-15 18:25:00',
    completedAt: null,
    dismissedAt: null,
    resultsJson: null
  }
  const shown = selectVisibleReroll([running, previous], now, digestUpdated)
  assert.equal(shown.pending, true)
  assert.equal(shown.visible?.id, 'prev')
  assert.equal(rerollCompletedAt(previous, digestUpdated), digestUpdated)
  assert.equal(rerollCompletedAt(running, digestUpdated), null)

  const dismissed = selectVisibleReroll([
    { ...previous, dismissedAt: '2026-11-15 13:00:00', completedAt: digestUpdated }
  ], now, digestUpdated)
  assert.equal(dismissed.visible, null)
  assert.equal(dismissed.pending, false)

  const stale = selectVisibleReroll([
    { id: 'stuck', createdAt: '2026-11-15 10:00:00', completedAt: null, dismissedAt: null, resultsJson: null }
  ], now, '2026-11-15 09:00:00')
  assert.equal(stale.visible, null)
  assert.equal(stale.pending, false)
})

test('paging, neighbors, scroll, and back links stay inside the saved set', () => {
  assert.equal(REROLL_PAGE_SIZE, 10)
  assert.equal(clampRerollPage('2', 20), 2)
  assert.equal(clampRerollPage(0, 20), 1)
  assert.equal(clampRerollPage(9, 20), 2)
  assert.equal(rerollPageStartIndex(2, 20), 10)
  assert.deepEqual(rerollNeighbor(0, 20), { prev: null, next: 1 })
  assert.deepEqual(rerollNeighbor(19, 20), { prev: 18, next: null })
  assert.deepEqual(rerollNeighbor(4, 0), { prev: null, next: null })
  assert.deepEqual(parseRerollScroll('{"y":120,"page":2}'), { y: 120, page: 2 })
  assert.equal(parseRerollScroll('{"y":-1,"page":2}'), null)
  assert.equal(
    rerollLeadPath({ businessId: 'biz 1', rerollId: 'rr', index: 3, date: '2026-11-15', page: 1, from: 'today' }),
    '/businesses/biz%201?reroll=rr&i=3&date=2026-11-15&page=1&from=today'
  )
  assert.equal(
    rerollBackPath({ from: 'home', date: '2026-11-15', page: 2, rerollId: 'rr' }),
    '/?page=2&reroll=rr#reroll-results'
  )
  assert.equal(
    rerollBackPath({ from: 'today', date: '2026-11-15', page: 2, rerollId: 'rr' }),
    '/leads/today?date=2026-11-15&page=2&reroll=rr#reroll-results'
  )
})

test('polling watches digest id and updated time for about two and a half minutes', () => {
  const before = digestStampFrom({ id: 'd1', updated_at: '2026-10-08 12:00:00' })
  assert.equal(digestStampChanged(before, digestStampFrom({ id: 'd1', updated_at: '2026-10-08 12:00:00' })), false)
  assert.equal(digestStampChanged(before, digestStampFrom({ id: 'd1', updated_at: '2026-10-08 12:01:00' })), true)
  assert.equal(digestStampChanged(digestStampFrom(null), digestStampFrom({ id: 'd2', updated_at: '2026-10-08 12:01:00' })), true)
  assert.equal(nextRerollPollDelay(0), REROLL_POLL_INTERVAL_MS)
  assert.equal(nextRerollPollDelay(REROLL_POLL_TIMEOUT_MS - 4000), 4000)
  assert.equal(nextRerollPollDelay(REROLL_POLL_TIMEOUT_MS), null)
})
