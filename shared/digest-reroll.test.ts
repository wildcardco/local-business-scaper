import assert from 'node:assert/strict'
import test from 'node:test'
import {
  digestStampChanged,
  digestStampFrom,
  nextRerollPollDelay,
  normalizeRerollCategory,
  REROLL_POLL_INTERVAL_MS,
  REROLL_POLL_TIMEOUT_MS,
  REROLL_SECRET_HEADER,
  rerollNeedsCostWarning,
  rerollSecretHeader,
  rerollWebhookChoice,
  rerollWebhookResult
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

test('polling watches digest id and updated time for about two and a half minutes', () => {
  const before = digestStampFrom({ id: 'd1', updated_at: '2026-10-08 12:00:00' })
  assert.equal(digestStampChanged(before, digestStampFrom({ id: 'd1', updated_at: '2026-10-08 12:00:00' })), false)
  assert.equal(digestStampChanged(before, digestStampFrom({ id: 'd1', updated_at: '2026-10-08 12:01:00' })), true)
  assert.equal(digestStampChanged(digestStampFrom(null), digestStampFrom({ id: 'd2', updated_at: '2026-10-08 12:01:00' })), true)
  assert.equal(nextRerollPollDelay(0), REROLL_POLL_INTERVAL_MS)
  assert.equal(nextRerollPollDelay(REROLL_POLL_TIMEOUT_MS - 4000), 4000)
  assert.equal(nextRerollPollDelay(REROLL_POLL_TIMEOUT_MS), null)
})
