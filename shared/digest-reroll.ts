/** One re-roll per owner per Central Time day is unmarked. Later ones must acknowledge API cost. */
export function rerollNeedsCostWarning(count: number): boolean {
  return count >= 1
}

/** Header WF-10 expects. Sent only when N8N_REROLL_SECRET is set. */
export const REROLL_SECRET_HEADER = 'X-Reroll-Secret'

/** Background search takes about a minute. Poll until the digest row changes, then stop. */
export const REROLL_POLL_INTERVAL_MS = 10_000
export const REROLL_POLL_TIMEOUT_MS = 150_000

export function rerollSecretHeader(secret: unknown): string | null {
  const value = typeof secret === 'string' ? secret.trim() : ''
  return value || null
}

/** Delay until the next digest check. Null means the wait is over. */
export function nextRerollPollDelay(
  elapsedMs: number,
  intervalMs = REROLL_POLL_INTERVAL_MS,
  timeoutMs = REROLL_POLL_TIMEOUT_MS
): number | null {
  if (elapsedMs >= timeoutMs) return null
  return Math.min(intervalMs, timeoutMs - elapsedMs)
}

export type DigestStamp = {
  id: string | null
  updatedAt: string | null
}

export function digestStampFrom(digest: { id?: unknown, updated_at?: unknown } | null | undefined): DigestStamp {
  const id = digest?.id == null ? '' : String(digest.id).trim()
  const updatedAt = digest?.updated_at == null ? '' : String(digest.updated_at).trim()
  return {
    id: id || null,
    updatedAt: updatedAt || null
  }
}

/** A new digest id or a newer updated_at means ingest replaced today's list. */
export function digestStampChanged(before: DigestStamp, after: DigestStamp): boolean {
  return before.id !== after.id || before.updatedAt !== after.updatedAt
}

/**
 * WF-10 answers immediately. 200 {ok:true, accepted:true} means the search is running.
 * 400 {ok:false, error} is the caller's message. Anything else is a transport failure.
 */
export function rerollWebhookResult(status: number, body: unknown): { accepted: true } | { accepted: false, statusCode: number, message: string } {
  const errorText = webhookErrorText(body)
  if (status === 400) {
    return {
      accepted: false,
      statusCode: 400,
      message: errorText || 'The re-roll was rejected.'
    }
  }
  if (status >= 200 && status < 300) {
    if (body && typeof body === 'object' && 'ok' in body && body.ok === false) {
      return {
        accepted: false,
        statusCode: 400,
        message: errorText || 'The re-roll was rejected.'
      }
    }
    return { accepted: true }
  }
  return {
    accepted: false,
    statusCode: 502,
    message: errorText
      ? `The re-roll webhook returned ${status}: ${errorText}`
      : `The re-roll webhook returned ${status}.`
  }
}

function webhookErrorText(body: unknown): string {
  if (typeof body === 'string') return body.trim().slice(0, 300)
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error.trim().slice(0, 300)
  }
  return ''
}

export function normalizeRerollCategory(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/\s+/g, ' ').slice(0, 80)
}

/** How long an unfinished re-roll can still claim the ingest that follows it. */
export const REROLL_ATTACH_WINDOW_MS = 30 * 60 * 1000

/** Local paging through a saved set. Changing page does not call RapidAPI. */
export const REROLL_PAGE_SIZE = 10

export const REROLL_CREDIT_NOTE = 'This search uses RapidAPI credits.'

export function rerollConfirmMessage(count: number): string {
  const base = `This replaces today's list with a new search. ${REROLL_CREDIT_NOTE} It does not send the morning digest email.`
  if (rerollNeedsCostWarning(count)) {
    return `${base} You've already re-rolled today, so this spends more credits.`
  }
  return base
}

/** SQLite `datetime('now')` is UTC `YYYY-MM-DD HH:MM:SS`. */
export function sqliteUtcMs(value: unknown): number {
  if (typeof value !== 'string') return Number.NaN
  const trimmed = value.trim()
  if (!trimmed) return Number.NaN
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)
  const iso = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  return Date.parse(hasZone ? iso : `${iso}Z`)
}

export function rerollAgeLabel(from: unknown, nowMs: number): string {
  const at = sqliteUtcMs(from)
  if (!Number.isFinite(at)) return 'Re-rolled'
  const mins = Math.max(0, Math.floor((nowMs - at) / 60_000))
  if (mins < 1) return 'Re-rolled just now'
  if (mins < 60) return `Re-rolled ${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `Re-rolled ${hours} hr ago`
  const days = Math.round(hours / 24)
  return `Re-rolled ${days} days ago`
}

export type RerollSummary = {
  id: string
  createdAt: string | null
  completedAt: string | null
  category: string
  location: string
  resultCount: number
  pending: boolean
}

export type RerollLeadView = {
  id: string
  place_id: string | null
  rank: number | null
  score: number | null
  tier: { slug: string | null, label: string | null }
  angle: string | null
  note: string | null
  signals: Record<string, unknown> | null
  lead_group: string | null
  business: {
    id: string
    name: string
    address: string | null
    city: string | null
    state: string | null
    phone: string | null
    website: string | null
    placeId: string | null
    researchStatus: 'requested' | 'complete' | null
    researchRequestedAt: string | null
    category: string | null
    rating: number | null
    review_count: number | null
    email: string | null
    emails: string[]
    photo_count: number | null
    gbp_photos: unknown[] | null
    lead_category: string | null
    status: string
  }
  mockup: {
    id: string
    status: string | null
    url: string | null
    buildMode: 'html' | 'web_stack'
    previewUrl: string | null
    agentUrl: string | null
    buildStatus: string | null
    buildError: string | null
  } | null
}

export type StoredRerollLead = {
  businessId: string
  placeId: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  website: string | null
  category: string | null
  rating: number | null
  reviewCount: number | null
  score: number
  tierSlug: string | null
  tierLabel: string | null
  rank: number | null
  angle: string | null
  note: string | null
  signals: Record<string, unknown> | null
  leadGroup: string | null
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanOptional(value: unknown): string | null {
  const text = cleanText(value)
  return text || null
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : null
}

export function storedRerollLead(input: Partial<StoredRerollLead> | null | undefined): StoredRerollLead | null {
  if (!input) return null
  const placeId = cleanText(input.placeId)
  if (!placeId) return null
  const signals = input.signals && typeof input.signals === 'object' && !Array.isArray(input.signals)
    ? input.signals
    : null
  return {
    businessId: cleanText(input.businessId),
    placeId,
    name: cleanText(input.name) || '(name unavailable)',
    address: cleanOptional(input.address),
    city: cleanOptional(input.city),
    state: cleanOptional(input.state),
    phone: cleanOptional(input.phone),
    website: cleanOptional(input.website),
    category: cleanOptional(input.category),
    rating: finiteNumber(input.rating),
    reviewCount: finiteNumber(input.reviewCount),
    score: finiteNumber(input.score) ?? 0,
    tierSlug: cleanOptional(input.tierSlug),
    tierLabel: cleanOptional(input.tierLabel),
    rank: finiteNumber(input.rank),
    angle: cleanOptional(input.angle),
    note: cleanOptional(input.note),
    signals,
    leadGroup: cleanOptional(input.leadGroup)
  }
}

/** Every lead the re-roll stored, including Skip and already-rejected businesses. */
export function leadsForRerollList<T>(leads: readonly T[]): T[] {
  return [...leads]
}

export function parseStoredRerollLeads(raw: unknown): StoredRerollLead[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return []
    try {
      parsed = JSON.parse(text)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  const leads: StoredRerollLead[] = []
  const seen = new Set<string>()
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const lead = storedRerollLead(item as Partial<StoredRerollLead>)
    if (!lead || seen.has(lead.placeId)) continue
    seen.add(lead.placeId)
    leads.push(lead)
  }
  return leads
}

export type RerollAttachRow = {
  id: string
  createdAt: string
  completedAt: string | null
}

/**
 * Bind an ingest to the re-roll that asked for it.
 * A morning digest (no flag, no open re-roll) must not overwrite a finished set.
 */
export function pickRerollForIngest(input: {
  requestedId?: unknown
  rerollFlag?: unknown
  rows: RerollAttachRow[]
  nowMs: number
  windowMs?: number
}): string | null {
  const windowMs = input.windowMs ?? REROLL_ATTACH_WINDOW_MS
  const requested = cleanText(input.requestedId)
  if (requested && input.rows.some(row => row.id === requested)) return requested
  const fresh = input.rows.filter((row) => {
    const age = input.nowMs - sqliteUtcMs(row.createdAt)
    return Number.isFinite(age) && age >= -60_000 && age <= windowMs
  })
  const pending = fresh.find(row => !row.completedAt)
  if (pending) return pending.id
  if (input.rerollFlag === true) return fresh[0]?.id ?? null
  return null
}

export type RerollVisibilityRow = {
  createdAt: string
  completedAt: string | null
  dismissedAt: string | null
  resultsJson?: string | null
}

/**
 * Legacy rows predate `completed_at`. If the digest was updated after the request,
 * that search already finished and the row should stay visible.
 */
export function rerollCompletedAt(
  row: RerollVisibilityRow,
  digestUpdatedAt: string | null
): string | null {
  if (row.completedAt) return row.completedAt
  if (typeof row.resultsJson === 'string' && row.resultsJson.trim()) return row.createdAt
  const created = sqliteUtcMs(row.createdAt)
  const updated = sqliteUtcMs(digestUpdatedAt)
  if (Number.isFinite(created) && Number.isFinite(updated) && updated + 5000 >= created) {
    return digestUpdatedAt
  }
  return null
}

/**
 * Newest finished, undismissed set stays on screen.
 * A re-roll that has not finished yet keeps the previous set visible.
 * A dismissed latest set stays hidden. A stale unfinished row is ignored.
 */
export function selectVisibleReroll<T extends RerollVisibilityRow>(
  rowsNewestFirst: readonly T[],
  nowMs: number,
  digestUpdatedAt: string | null,
  windowMs = REROLL_ATTACH_WINDOW_MS
): { visible: T | null, pending: boolean } {
  const rows = rowsNewestFirst.flatMap((row) => {
    const completedAt = rerollCompletedAt(row, digestUpdatedAt)
    if (completedAt || row.dismissedAt) return [{ ...row, completedAt }]
    const age = nowMs - sqliteUtcMs(row.createdAt)
    if (!Number.isFinite(age) || age < -60_000 || age > windowMs) return []
    return [{ ...row, completedAt: null }]
  })
  const newest = rows[0]
  if (!newest || newest.dismissedAt) return { visible: null, pending: false }
  if (newest.completedAt) return { visible: newest, pending: false }
  const previous = rows.slice(1).find(row => row.completedAt && !row.dismissedAt) ?? null
  return { visible: previous, pending: true }
}

export function rerollPageCount(total: number, pageSize = REROLL_PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

export function clampRerollPage(page: unknown, total: number, pageSize = REROLL_PAGE_SIZE): number {
  const parsed = typeof page === 'number' ? page : typeof page === 'string' ? Number(page) : Number.NaN
  const max = rerollPageCount(total, pageSize)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(max, Math.floor(parsed))
}

export function rerollPageStartIndex(page: unknown, total: number, pageSize = REROLL_PAGE_SIZE): number {
  return (clampRerollPage(page, total, pageSize) - 1) * pageSize
}

export function rerollNeighbor(index: number, total: number): { prev: number | null, next: number | null } {
  if (!Number.isInteger(index) || !Number.isInteger(total) || total <= 0 || index < 0 || index >= total) {
    return { prev: null, next: null }
  }
  return {
    prev: index > 0 ? index - 1 : null,
    next: index < total - 1 ? index + 1 : null
  }
}

export function rerollScrollKey(id: string, surface: 'home' | 'today'): string {
  return `wc-reroll-scroll:${surface}:${id}`
}

export function parseRerollScroll(raw: unknown): { y: number, page: number } | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const value = JSON.parse(raw) as { y?: unknown, page?: unknown }
    const y = typeof value.y === 'number' ? value.y : Number(value.y)
    if (!Number.isFinite(y) || y < 0) return null
    const page = typeof value.page === 'number' ? value.page : Number(value.page)
    return { y, page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1 }
  } catch {
    return null
  }
}

export function rerollBackPath(input: { from?: unknown, date: string, page: number, rerollId: string }): string {
  const page = String(Math.max(1, Math.floor(input.page) || 1))
  if (input.from === 'home') {
    return `/?${new URLSearchParams({ page, reroll: input.rerollId }).toString()}#reroll-results`
  }
  return `/leads/today?${new URLSearchParams({ date: input.date, page, reroll: input.rerollId }).toString()}#reroll-results`
}

export function rerollLeadPath(input: {
  businessId: string
  rerollId: string
  index: number
  date: string
  page: number
  from: 'home' | 'today'
}): string {
  const query = new URLSearchParams({
    reroll: input.rerollId,
    i: String(input.index),
    date: input.date,
    page: String(Math.max(1, Math.floor(input.page) || 1)),
    from: input.from
  })
  return `/businesses/${encodeURIComponent(input.businessId)}?${query.toString()}`
}

/**
 * Random wins over a typed category. The word "random" is not a business type.
 * Returns the payload fields n8n should read.
 */
export function rerollWebhookChoice(input: { random?: unknown, category?: unknown }): {
  random: boolean
  category: string
} | { error: string } {
  const category = normalizeRerollCategory(input.category)
  const random = input.random === true || category.toLowerCase() === 'random'
  if (random) return { random: true, category: 'random' }
  if (!category) return { error: 'Pick a category or Random.' }
  return { random: false, category }
}
