import assert from 'node:assert/strict'
import test from 'node:test'
import {
  costTotalCents,
  emptyCostLedger,
  foldMockupCost,
  formatUsdFromCents,
  parseCostCents
} from './mockup-cost.ts'

test('first reported cost starts the total', () => {
  const next = foldMockupCost(emptyCostLedger(), {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  })
  assert.equal(next.changed, true)
  assert.equal(next.ledger.entries.length, 1)
  assert.equal(costTotalCents(next.ledger), 42)
  assert.equal(formatUsdFromCents(costTotalCents(next.ledger)), '$0.42')
})

test('a later call adds onto the same total', () => {
  const first = foldMockupCost(emptyCostLedger(), {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  }).ledger
  const second = foldMockupCost(first, {
    raw: 'This mockup cost $0.15',
    version: 2,
    pitchVersion: 0,
    busy: false,
    action: 'Revise'
  })
  assert.equal(costTotalCents(second.ledger), 57)
  assert.equal(formatUsdFromCents(costTotalCents(second.ledger)), '$0.57')
  assert.deepEqual(second.ledger.entries.map(entry => entry.action), ['Generate', 'Revise'])
})

test('polling the same report does not add again', () => {
  const first = foldMockupCost(emptyCostLedger(), {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  }).ledger
  const again = foldMockupCost(first, {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  })
  assert.equal(again.changed, false)
  assert.equal(costTotalCents(again.ledger), 42)
})

test('each later call adds onto the first amount', () => {
  let ledger = foldMockupCost(emptyCostLedger(), {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  }).ledger
  ledger = foldMockupCost(ledger, {
    raw: 'This mockup cost $0.15',
    version: 2,
    pitchVersion: 0,
    busy: false,
    action: 'Revise'
  }).ledger
  ledger = foldMockupCost(ledger, {
    raw: 'This mockup cost $0.08',
    version: 2,
    pitchVersion: 1,
    busy: false,
    action: 'Pitch'
  }).ledger
  assert.equal(ledger.entries.length, 3)
  assert.equal(costTotalCents(ledger), 65)
  assert.equal(formatUsdFromCents(costTotalCents(ledger)), '$0.65')
})

test('the same amount on a later settled action still adds', () => {
  const first = foldMockupCost(emptyCostLedger(), {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  }).ledger
  const second = foldMockupCost(first, {
    raw: 'This mockup cost $0.42',
    version: 2,
    pitchVersion: 0,
    busy: false,
    action: 'Revise'
  })
  assert.equal(second.ledger.entries.length, 2)
  assert.equal(costTotalCents(second.ledger), 84)
})

test('a cost seen before the version bump is not added twice when the version lands', () => {
  const early = foldMockupCost(emptyCostLedger(), {
    raw: 'This mockup cost $0.42',
    version: 0,
    pitchVersion: 0,
    busy: true,
    action: 'Generate'
  }).ledger
  const finished = foldMockupCost(early, {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  })
  assert.equal(finished.ledger.entries.length, 1)
  assert.equal(finished.ledger.entries[0]?.settled, true)
  assert.equal(costTotalCents(finished.ledger), 42)
})

test('an empty or unparsed field does not invent an amount', () => {
  const started = foldMockupCost(emptyCostLedger(), {
    raw: 'This mockup cost $0.42',
    version: 1,
    pitchVersion: 0,
    busy: false,
    action: 'Generate'
  }).ledger
  assert.equal(parseCostCents(''), null)
  assert.equal(parseCostCents('no dollar amount'), null)
  const blank = foldMockupCost(started, {
    raw: '',
    version: 2,
    pitchVersion: 0,
    busy: false,
    action: 'Revise'
  })
  const prose = foldMockupCost(started, {
    raw: 'cost pending',
    version: 2,
    pitchVersion: 0,
    busy: false,
    action: 'Revise'
  })
  assert.equal(blank.changed, false)
  assert.equal(prose.changed, false)
  assert.equal(costTotalCents(blank.ledger), 42)
})
