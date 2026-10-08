import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRerollCategory, rerollNeedsCostWarning, rerollWebhookChoice } from './digest-reroll.ts'

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
