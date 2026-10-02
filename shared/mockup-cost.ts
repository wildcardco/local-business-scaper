export interface CostEntry {
  action: string
  raw: string
  amountText: string
  cents: number
  version: number
  pitchVersion: number
  /** False while the call that reported this cost has not finished bumping version. */
  settled: boolean
}

export interface CostLedger {
  entries: CostEntry[]
}

export function emptyCostLedger(): CostLedger {
  return { entries: [] }
}

export function parseCostCents(raw: string): { cents: number, amountText: string } | null {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const dollar = text.match(/\$\s*(\d{1,7}(?:,\d{3})*(?:\.\d{1,4})?)/)
  const usd = text.match(/(\d{1,7}(?:,\d{3})*(?:\.\d{1,4})?)\s*(?:usd|dollars)\b/i)
  const match = dollar || usd
  if (!match?.[1]) return null
  const numeric = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(numeric) || numeric < 0) return null
  const cents = Math.round(numeric * 100)
  return { cents, amountText: formatUsdFromCents(cents) }
}

export function formatUsdFromCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  const dollars = Math.floor(abs / 100)
  const remainder = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars}.${remainder}`
}

export function costTotalCents(ledger: CostLedger): number {
  return ledger.entries.reduce((sum, entry) => sum + entry.cents, 0)
}

export function parseCostLedger(raw: unknown): CostLedger {
  if (typeof raw !== 'string' || !raw.trim()) return emptyCostLedger()
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown }
    if (!parsed || !Array.isArray(parsed.entries)) return emptyCostLedger()
    const entries: CostEntry[] = []
    for (const item of parsed.entries) {
      if (!item || typeof item !== 'object') continue
      const row = item as Partial<CostEntry>
      if (typeof row.raw !== 'string' || !row.raw.trim()) continue
      if (typeof row.cents !== 'number' || !Number.isFinite(row.cents) || row.cents < 0) continue
      entries.push({
        action: typeof row.action === 'string' && row.action.trim() ? row.action.trim() : 'Studio call',
        raw: row.raw.trim(),
        amountText: typeof row.amountText === 'string' && row.amountText.trim()
          ? row.amountText.trim()
          : formatUsdFromCents(row.cents),
        cents: Math.round(row.cents),
        version: Number(row.version || 0),
        pitchVersion: Number(row.pitchVersion || 0),
        settled: row.settled !== false
      })
    }
    return { entries }
  } catch {
    return emptyCostLedger()
  }
}

function makeEntry(input: {
  action: string
  raw: string
  cents: number
  amountText: string
  version: number
  pitchVersion: number
  settled: boolean
}): CostEntry {
  return {
    action: input.action,
    raw: input.raw,
    amountText: input.amountText,
    cents: input.cents,
    version: input.version,
    pitchVersion: input.pitchVersion,
    settled: input.settled
  }
}

/**
 * The lead field is the latest call's cost, not a lifetime total.
 * The first parsed amount starts the total. Each later call adds its own amount.
 * The same report seen again on poll does not add a second time.
 */
export function foldMockupCost(ledger: CostLedger, input: {
  raw: string | null | undefined
  version: number
  pitchVersion: number
  busy: boolean
  action: string
}): { ledger: CostLedger, changed: boolean } {
  const raw = (input.raw || '').replace(/\s+/g, ' ').trim()
  if (!raw) return { ledger, changed: false }
  const parsed = parseCostCents(raw)
  if (!parsed) return { ledger, changed: false }

  const entries = ledger.entries
  const last = entries[entries.length - 1]
  const entry = makeEntry({
    action: input.action,
    raw,
    cents: parsed.cents,
    amountText: parsed.amountText,
    version: input.version,
    pitchVersion: input.pitchVersion,
    settled: !input.busy
  })

  if (!last) return { ledger: { entries: [entry] }, changed: true }

  if (last.raw === raw) {
    const moved = input.version > last.version || input.pitchVersion > last.pitchVersion
    if (!moved) return { ledger, changed: false }
    if (!last.settled) {
      const next = entries.slice()
      next[next.length - 1] = {
        ...last,
        version: input.version,
        pitchVersion: input.pitchVersion,
        settled: true
      }
      return { ledger: { entries: next }, changed: true }
    }
    return { ledger: { entries: [...entries, entry] }, changed: true }
  }

  return { ledger: { entries: [...entries, entry] }, changed: true }
}

export function costActionLabel(input: {
  localStatus: string
  version: number
  pitchVersion: number
  last: CostEntry | undefined
}): string {
  if (input.localStatus === 'writing_pitch') return 'Pitch'
  if (input.localStatus === 'enhancing') return 'Add photos'
  if (input.localStatus === 'revising') return 'Revise'
  if (input.localStatus === 'generating') return 'Generate'
  if (input.last && input.pitchVersion > input.last.pitchVersion) return 'Pitch'
  if (input.last && input.version > input.last.version) return 'Revise'
  if (!input.last) return 'Generate'
  return 'Studio call'
}
