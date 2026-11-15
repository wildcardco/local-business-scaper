import { cursorAgentUrl, httpsUrl } from '~~/shared/web-stack'
import {
  leadsForRerollList,
  parseStoredRerollLeads,
  pickRerollForIngest,
  selectVisibleReroll,
  type RerollLeadView,
  type RerollSummary,
  type StoredRerollLead
} from '~~/shared/digest-reroll'
import { db } from './db'

type RerollRow = {
  id: string
  createdAt: string
  completedAt: string | null
  dismissedAt: string | null
  resultsJson: string | null
  category: string
  searchCategory: string | null
  searchLocation: string | null
  resultCount: number | null
  digestId: string | null
}

function text(value: unknown): string | null {
  if (value == null) return null
  const raw = String(value).trim()
  return raw || null
}

function researchStatus(value: unknown): 'requested' | 'complete' | null {
  return value === 'requested' || value === 'complete' ? value : null
}

function mapRow(row: Record<string, unknown>): RerollRow {
  return {
    id: String(row.id),
    createdAt: text(row.created_at) || '',
    completedAt: text(row.completed_at),
    dismissedAt: text(row.dismissed_at),
    resultsJson: typeof row.results_json === 'string' ? row.results_json : null,
    category: text(row.category) || '',
    searchCategory: text(row.search_category),
    searchLocation: text(row.search_location),
    resultCount: row.result_count == null ? null : Number(row.result_count),
    digestId: text(row.digest_id)
  }
}

async function listRerolls(userId: string, date: string): Promise<RerollRow[]> {
  const result = await db.execute({
    sql: `SELECT id, category, search_category, search_location, result_count, results_json,
            created_at, completed_at, dismissed_at, digest_id
          FROM digest_rerolls
          WHERE user_id = ? AND digest_date = ?
          ORDER BY created_at DESC
          LIMIT 10`,
    args: [userId, date]
  })
  return result.rows.map(row => mapRow(row as Record<string, unknown>))
}

type LiveBusiness = {
  status: string
  leadCategory: string | null
  researchStatus: 'requested' | 'complete' | null
  researchRequestedAt: string | null
  mockup: RerollLeadView['mockup']
}

async function loadLiveBusinesses(userId: string, ids: string[]): Promise<Map<string, LiveBusiness>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const found = new Map<string, LiveBusiness>()
  if (!unique.length) return found
  const placeholders = unique.map(() => '?').join(', ')
  const result = await db.execute({
    sql: `SELECT
        b.id as business_id,
        b.lead_category,
        b.status,
        b.research_status,
        b.research_requested_at,
        m.id as mockup_id,
        m.status as mockup_status,
        m.mockup_url,
        m.build_mode,
        m.agent_id,
        m.preview_url,
        m.build_status,
        m.build_error
      FROM businesses b
      LEFT JOIN (
        SELECT id, business_id, status, mockup_url, build_mode, agent_id, preview_url, build_status, build_error,
               ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY updated_at DESC) as rn
        FROM mockups
        WHERE user_id = ?
      ) m ON b.id = m.business_id AND m.rn = 1
      WHERE b.user_id = ? AND b.id IN (${placeholders})`,
    args: [userId, userId, ...unique]
  })
  for (const row of result.rows) {
    const id = String(row.business_id)
    found.set(id, {
      status: text(row.status) || 'new',
      leadCategory: text(row.lead_category),
      researchStatus: researchStatus(row.research_status),
      researchRequestedAt: text(row.research_requested_at),
      mockup: row.mockup_id
        ? {
            id: String(row.mockup_id),
            status: text(row.mockup_status),
            url: text(row.mockup_url),
            buildMode: row.build_mode === 'web_stack' ? 'web_stack' : 'html',
            previewUrl: httpsUrl(row.preview_url),
            agentUrl: cursorAgentUrl(row.agent_id),
            buildStatus: text(row.build_status),
            buildError: text(row.build_error)
          }
        : null
    })
  }
  return found
}

function cardFromStored(rerollId: string, index: number, lead: StoredRerollLead, live: LiveBusiness | undefined): RerollLeadView {
  return {
    id: `${rerollId}:${index}`,
    place_id: lead.placeId,
    rank: lead.rank,
    score: lead.score,
    tier: { slug: lead.tierSlug, label: lead.tierLabel },
    angle: lead.angle,
    note: lead.note,
    signals: lead.signals,
    business: {
      id: lead.businessId,
      name: lead.name,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      phone: lead.phone,
      website: lead.website,
      placeId: lead.placeId,
      researchStatus: live?.researchStatus ?? null,
      researchRequestedAt: live?.researchRequestedAt ?? null,
      category: lead.category,
      rating: lead.rating,
      review_count: lead.reviewCount,
      lead_category: live?.leadCategory ?? lead.tierSlug,
      status: live?.status ?? 'new'
    },
    mockup: live?.mockup ?? null
  }
}

function byRank(leads: RerollLeadView[]): RerollLeadView[] {
  return leadsForRerollList(leads).sort((a, b) => {
    const left = a.rank == null ? 999999 : Number(a.rank)
    const right = b.rank == null ? 999999 : Number(b.rank)
    return left - right
  })
}

export async function saveRerollResults(input: {
  userId: string
  date: string
  requestedId: string
  rerollFlag: boolean
  digestId: string
  category: string
  location: string
  leads: StoredRerollLead[]
}): Promise<string | null> {
  const existing = await db.execute({
    sql: `SELECT id, created_at, completed_at
          FROM digest_rerolls
          WHERE user_id = ? AND digest_date = ?
          ORDER BY created_at DESC
          LIMIT 10`,
    args: [input.userId, input.date]
  })
  const rerollId = pickRerollForIngest({
    requestedId: input.requestedId,
    rerollFlag: input.rerollFlag,
    rows: existing.rows.map(row => ({
      id: String(row.id),
      createdAt: text(row.created_at) || '',
      completedAt: text(row.completed_at)
    })),
    nowMs: Date.now()
  })
  if (!rerollId) return null
  await db.execute({
    sql: `UPDATE digest_rerolls SET
            search_category = ?,
            search_location = ?,
            result_count = ?,
            results_json = ?,
            completed_at = datetime('now'),
            digest_id = ?,
            dismissed_at = NULL
          WHERE id = ? AND user_id = ?`,
    args: [
      input.category,
      input.location,
      input.leads.length,
      JSON.stringify(input.leads),
      input.digestId,
      rerollId,
      input.userId
    ]
  })
  return rerollId
}

export type { RerollLeadView, RerollSummary }

export async function loadRerollForDate(input: {
  userId: string
  date: string
  digestUpdatedAt: string | null
  digestLeads: RerollLeadView[]
}): Promise<{ reroll: RerollSummary | null, rerollLeads: RerollLeadView[], pending: boolean }> {
  const rows = await listRerolls(input.userId, input.date)
  const selected = selectVisibleReroll(rows, Date.now(), input.digestUpdatedAt)
  const visible = selected.visible
  if (!visible) {
    return { reroll: null, rerollLeads: [], pending: selected.pending }
  }
  const stored = parseStoredRerollLeads(visible.resultsJson)
  let rerollLeads: RerollLeadView[]
  if (stored.length || (visible.resultsJson && visible.resultsJson.trim())) {
    const live = await loadLiveBusinesses(input.userId, stored.map(lead => lead.businessId))
    rerollLeads = stored.map((lead, index) => cardFromStored(visible.id, index, lead, live.get(lead.businessId)))
  } else {
    rerollLeads = byRank(input.digestLeads)
  }
  return {
    pending: selected.pending,
    rerollLeads,
    reroll: {
      id: visible.id,
      createdAt: visible.createdAt || null,
      completedAt: visible.completedAt,
      category: visible.searchCategory || visible.category,
      location: visible.searchLocation || '',
      resultCount: rerollLeads.length,
      pending: selected.pending
    }
  }
}

export async function loadRerollNavigation(userId: string, rerollId: string): Promise<{
  id: string
  date: string
  category: string
  location: string
  createdAt: string | null
  leads: { businessId: string, name: string }[]
} | null> {
  const result = await db.execute({
    sql: `SELECT id, digest_date, category, search_category, search_location, results_json,
            created_at, digest_id
          FROM digest_rerolls
          WHERE id = ? AND user_id = ?
          LIMIT 1`,
    args: [rerollId, userId]
  })
  const row = result.rows[0]
  if (!row) return null
  const stored = parseStoredRerollLeads(row.results_json)
  let leads: { businessId: string, name: string }[]
  if (stored.length || (typeof row.results_json === 'string' && row.results_json.trim())) {
    leads = stored.map(lead => ({ businessId: lead.businessId, name: lead.name }))
  } else {
    const digestId = text(row.digest_id)
    const digest = digestId
      ? { rows: [{ id: digestId }] }
      : await db.execute({
          sql: `SELECT id FROM digests WHERE user_id = ? AND digest_date = ? LIMIT 1`,
          args: [userId, String(row.digest_date)]
        })
    const id = text(digest.rows[0]?.id)
    if (!id) {
      leads = []
    } else {
      const joined = await db.execute({
        sql: `SELECT b.id as business_id, b.name, dl.rank
              FROM digest_leads dl
              INNER JOIN businesses b ON b.id = dl.business_id
              WHERE dl.digest_id = ?
              ORDER BY COALESCE(dl.rank, 999999), dl.score DESC`,
        args: [id]
      })
      leads = joined.rows.map(item => ({
        businessId: String(item.business_id),
        name: text(item.name) || 'Lead'
      }))
    }
  }
  return {
    id: String(row.id),
    date: String(row.digest_date),
    category: text(row.search_category) || text(row.category) || '',
    location: text(row.search_location) || '',
    createdAt: text(row.created_at),
    leads
  }
}

export async function dismissReroll(userId: string, rerollId: string): Promise<boolean> {
  const existing = await db.execute({
    sql: `SELECT id FROM digest_rerolls WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [rerollId, userId]
  })
  if (!existing.rows[0]) return false
  await db.execute({
    sql: `UPDATE digest_rerolls SET dismissed_at = datetime('now') WHERE id = ? AND user_id = ?`,
    args: [rerollId, userId]
  })
  return true
}
