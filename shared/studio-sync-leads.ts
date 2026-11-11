import { isVercelMockupUrl } from './mockup-repo'
import { mockupCreatedTime, mockupUpdatedTime } from './mockup-time'
import { mergeLeadSite } from './site-discovery'

export interface LeadDeployment {
  url: string | null
  webStack: boolean
}

function text(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function httpUrl(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return raw
  } catch {
    return null
  }
}

/**
 * Vercel link for a lead, including a web-stack row whose page lives on
 * `web_stack_url` instead of `mockup_url`. A web-stack row with no URL yet
 * still counts so Studio can show the build.
 */
export function leadDeployment(row: Record<string, unknown>): LeadDeployment {
  const mockupUrl = text(row.mockup_url)
  const webStackUrl = text(row.web_stack_url)
  const fullSiteUrl = text(row.full_site_url)
  if (isVercelMockupUrl(mockupUrl)) return { url: mockupUrl, webStack: false }
  if (isVercelMockupUrl(webStackUrl)) return { url: webStackUrl, webStack: true }
  if (isVercelMockupUrl(fullSiteUrl)) return { url: fullSiteUrl, webStack: false }
  const webStack = Boolean(text(row.web_stack_status) || text(row.web_stack_agent_id) || webStackUrl)
  if (webStack) return { url: httpUrl(webStackUrl), webStack: true }
  return { url: null, webStack: false }
}

export function leadHasDeployment(row: Record<string, unknown>) {
  const deployment = leadDeployment(row)
  return Boolean(deployment.url) || deployment.webStack
}

/**
 * Keep the one-page Vercel link and the Web Stack link apart.
 * Sync used to store only leadDeployment(), which returns mockup_url
 * whenever that field is already a Vercel link and drops web_stack_url.
 */
export function leadSiteBuilds(row: Record<string, unknown>) {
  const mockupUrl = httpUrl(row.mockup_url)
  const webStackUrl = httpUrl(row.web_stack_url)
  const fullSiteUrl = httpUrl(row.full_site_url)
  const onePageUrl = mockupUrl && mockupUrl !== webStackUrl
    ? mockupUrl
    : (fullSiteUrl && fullSiteUrl !== webStackUrl ? fullSiteUrl : null)
  const started = text(row.web_stack_started_at)
  return {
    onePageUrl: onePageUrl && isVercelMockupUrl(onePageUrl) ? onePageUrl : null,
    webStackUrl: webStackUrl && (isVercelMockupUrl(webStackUrl) || text(row.web_stack_status) || text(row.web_stack_agent_id))
      ? webStackUrl
      : null,
    webStackAt: started || null
  }
}

/** Newer updated time, then created time. Empty when the row has neither. */
export function leadStamp(row: Record<string, unknown>) {
  return mockupUpdatedTime(row) || mockupCreatedTime(row) || ''
}

function leadRowId(row: Record<string, unknown>) {
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  return Number.isFinite(id) ? id : 0
}

/**
 * Keep the row that actually has a mockup. When both do, or neither does,
 * the later stamp wins, then the higher n8n id.
 */
export function preferLeadRow(current: Record<string, unknown>, incoming: Record<string, unknown>) {
  const currentLive = leadHasDeployment(current)
  const incomingLive = leadHasDeployment(incoming)
  if (currentLive !== incomingLive) return incomingLive ? incoming : current
  const currentStamp = leadStamp(current)
  const incomingStamp = leadStamp(incoming)
  if (currentStamp !== incomingStamp) return incomingStamp > currentStamp ? incoming : current
  return leadRowId(incoming) >= leadRowId(current) ? incoming : current
}

export function dedupeLeadsByPlace(rows: Record<string, unknown>[]) {
  const byPlace = new Map<string, Record<string, unknown>>()
  let duplicatePlace = 0
  for (const row of rows) {
    const placeId = text(row.place_id)
    if (!placeId) continue
    const existing = byPlace.get(placeId)
    if (!existing) {
      byPlace.set(placeId, row)
      continue
    }
    duplicatePlace++
    const winner = preferLeadRow(existing, row)
    const other = winner === existing ? row : existing
    byPlace.set(placeId, mergeLeadSite(winner, other))
  }
  return { rows: [...byPlace.values()], duplicatePlace }
}

/** True when this page is an older copy of a lead Studio already saved. */
export function incomingLeadIsOlder(storedStamp: string | null | undefined, incoming: Record<string, unknown>) {
  const stored = (storedStamp || '').trim()
  const stamp = leadStamp(incoming)
  if (!stored || !stamp) return false
  return stamp < stored
}

/**
 * First page of a newest-first read timed out or the server rejected the sort.
 * Read the table without that sort on the next step. A later page keeps its cursor.
 */
export function leadSyncAfterError(input: {
  cursor: string | null
  unsorted: boolean
  message: string
}) {
  const firstPage = !input.cursor && !input.unsorted
  if (!firstPage) return 'fail' as const
  if (/did not answer|timeout|timed out/i.test(input.message)) return 'unsorted' as const
  if (/sort/i.test(input.message)) return 'unsorted' as const
  return 'fail' as const
}

/** n8n's next cursor, or null when this page is the end or the cursor did not move. */
export function takeLeadCursor(input: {
  rowCount: number
  nextCursor: string | null
  requestCursor: string | null
}) {
  const next = input.nextCursor
  if (!next || input.rowCount <= 0 || next === input.requestCursor) return null
  return next
}

export function syncPageIsLast(input: {
  pageNumber: number
  nextCursor: string | null
  pageCap: number
}) {
  return !input.nextCursor || input.pageNumber >= input.pageCap
}

/**
 * Pages in the order Studio Sync walks them. A full page still continues, and
 * the first row of the next page (the boundary row) is kept. A short last page
 * is kept too.
 */
export function collectLeadRows<T>(pages: Array<{ rows: T[], nextCursor: string | null }>, pageCap: number) {
  const kept: T[] = []
  let requestCursor: string | null = null
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!
    const pageNumber = index + 1
    kept.push(...page.rows)
    const nextCursor = takeLeadCursor({
      rowCount: page.rows.length,
      nextCursor: page.nextCursor,
      requestCursor
    })
    if (syncPageIsLast({ pageNumber, nextCursor, pageCap })) break
    requestCursor = nextCursor
  }
  return kept
}
