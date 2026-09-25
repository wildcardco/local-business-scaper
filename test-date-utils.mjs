/**
 * Proves Central Time "today" does not roll forward in the evening,
 * and that prev/next day math is calendar arithmetic (UTC), not local-zone Date.
 *
 * Run: node --experimental-strip-types test-date-utils.mjs
 */
import { getTodayCentralTime, addDays } from './shared/date-utils.ts'

function withNow(iso, fn) {
  const fixed = new Date(iso).getTime()
  const Original = globalThis.Date
  globalThis.Date = class extends Original {
    constructor(...args) {
      if (args.length === 0) super(fixed)
      else super(...args)
    }

    static now() {
      return fixed
    }
  }
  try {
    return fn()
  } finally {
    globalThis.Date = Original
  }
}

let failed = 0
function assert(label, actual, expected) {
  const ok = actual === expected
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`)
  if (!ok) failed++
}

// 8:00 PM America/Chicago on 2026-09-25 is 01:00 UTC on 2026-09-26.
// A UTC slice of "now" would be tomorrow; CT today must stay 2026-09-25.
assert(
  '8 PM CT stays on that calendar day',
  withNow('2026-09-25T20:00:00-05:00', () => getTodayCentralTime()),
  '2026-09-25'
)

assert(
  '11:30 PM CDT stays on that calendar day',
  withNow('2026-09-25T23:30:00-05:00', () => getTodayCentralTime()),
  '2026-09-25'
)

assert(
  'just after CT midnight is the new day',
  withNow('2026-09-26T00:30:00-05:00', () => getTodayCentralTime()),
  '2026-09-26'
)

assert('addDays +1', addDays('2026-09-25', 1), '2026-09-26')
assert('addDays -1', addDays('2026-09-25', -1), '2026-09-24')
assert('addDays month rollover', addDays('2026-09-30', 1), '2026-10-01')
assert('addDays year rollover', addDays('2026-12-31', 1), '2027-01-01')

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll date checks passed')
