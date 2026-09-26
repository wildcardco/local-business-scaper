import { db, generateId } from '~~/server/utils/db'
import { listN8nLeadPage } from '~~/server/utils/n8n'
import { isPlaceId, parseUsCityState } from '~~/shared/studio-location'
import { isVercelMockupUrl, storedGithubRepo } from '~~/shared/mockup-repo'
import { removeDigestLeadsWithoutMockups } from '~~/server/utils/mockups'

type SqlArg = string | number | bigint | null

interface Statement {
  sql: string
  args: SqlArg[]
}

const PAGE_CAP = 40

export interface StudioSyncJobView {
  id: string
  status: 'running' | 'done' | 'failed'
  imported: number
  refreshed: number
  synced: number
  pages: number
  error: string | null
  partial: boolean
}

function asString(value: unknown) {
  if (value == null || value === '') return null
  return String(value)
}

function asNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function locationPatch(current: {
  city?: unknown
  state?: unknown
  address?: unknown
  email?: unknown
  category?: unknown
}, input: {
  address: string | null
  city: string | null
  state: string | null
  row: Record<string, unknown>
}) {
  const city = asString(current.city)
  const state = asString(current.state)
  const address = asString(current.address)
  const email = asString(current.email)
  const category = asString(current.category)
  const nextCity = !city || isPlaceId(city) ? input.city : city
  const nextState = !state || isPlaceId(state) ? input.state : state
  const nextAddress = address || input.address
  const nextEmail = email || asString(input.row.email)
  const nextCategory = category || asString(input.row.category)
  const unchanged = nextCity === city
    && nextState === state
    && nextAddress === address
    && nextEmail === email
    && nextCategory === category
  if (unchanged) return null
  return { nextCity, nextState, nextAddress, nextEmail, nextCategory }
}

function businessUpdate(businessId: string, userId: string, patch: NonNullable<ReturnType<typeof locationPatch>>): Statement {
  return {
    sql: `UPDATE businesses SET
      city = ?, state = ?, address = ?, email = ?, category = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [patch.nextCity, patch.nextState, patch.nextAddress, patch.nextEmail, patch.nextCategory, businessId, userId]
  }
}

let tableReady: Promise<void> | null = null

export function ensureMockupSyncTable() {
  if (!tableReady) {
    tableReady = db.execute(`
      CREATE TABLE IF NOT EXISTS mockup_sync_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        cursor TEXT,
        unsorted INTEGER DEFAULT 0,
        imported INTEGER DEFAULT 0,
        refreshed INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        pages INTEGER DEFAULT 0,
        error TEXT,
        locked_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).then(() => db.execute(`CREATE INDEX IF NOT EXISTS idx_mockup_sync_jobs_user ON mockup_sync_jobs(user_id, created_at)`)).then(() => undefined).catch((error: unknown) => {
      tableReady = null
      throw error
    })
  }
  return tableReady
}

function viewOf(row: Record<string, unknown> | null | undefined): StudioSyncJobView | null {
  if (!row) return null
  const status = String(row.status || 'running')
  const normalized = status === 'done' || status === 'failed' ? status : 'running'
  return {
    id: String(row.id),
    status: normalized,
    imported: Number(row.imported || 0),
    refreshed: Number(row.refreshed || 0),
    synced: Number(row.synced || 0),
    pages: Number(row.pages || 0),
    error: asString(row.error),
    partial: normalized === 'done' && Boolean(asString(row.cursor))
  }
}

async function latestJob(userId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM mockup_sync_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    args: [userId]
  })
  return result.rows[0] || null
}

export async function getSyncJob(userId: string) {
  await ensureMockupSyncTable()
  return viewOf(await latestJob(userId))
}

function explicitGithubRepo(row: Record<string, unknown>) {
  const stored = storedGithubRepo(asString(row.github_repo) || asString(row.repo_full_name))
  if (stored) return stored
  const html = asString(row.repo_html_url)
  const match = html?.match(/github\.com\/([\w.-]+\/[\w.-]+)/i)
  return match?.[1] || null
}

export async function startSyncJob(userId: string) {
  await ensureMockupSyncTable()
  await removeDigestLeadsWithoutMockups(userId)
  const current = await latestJob(userId)
  if (current && String(current.status) === 'running') {
    return viewOf(current)
  }
  if (current && String(current.status) === 'done' && asString(current.cursor)) {
    await db.execute({
      sql: `UPDATE mockup_sync_jobs
            SET status = 'running', error = NULL, locked_at = NULL, updated_at = datetime('now')
            WHERE id = ? AND user_id = ?`,
      args: [current.id, userId]
    })
    return viewOf(await latestJob(userId))
  }

  const id = generateId()
  await db.execute({
    sql: `INSERT INTO mockup_sync_jobs (id, user_id, status) VALUES (?, ?, 'running')`,
    args: [id, userId]
  })
  return viewOf(await latestJob(userId))
}

export async function saveLeadPage(userId: string, owner: string, rows: Record<string, unknown>[]) {
  const byPlace = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const placeId = asString(row.place_id)
    const mockupUrl = asString(row.mockup_url)
    if (placeId && isVercelMockupUrl(mockupUrl)) byPlace.set(placeId, row)
  }

  let imported = 0
  let refreshed = 0
  const writes: Statement[] = []
  const placeIds = [...byPlace.keys()]
  if (placeIds.length === 0) return { imported, refreshed }

  const marks = placeIds.map(() => '?').join(', ')
  const [mockupResult, businessResult] = await db.batch([
    {
      sql: `SELECT m.id, m.place_id, m.business_id, b.city as b_city, b.state as b_state,
          b.address as b_address, b.email as b_email, b.category as b_category
        FROM mockups m
        LEFT JOIN businesses b ON b.id = m.business_id
        WHERE m.user_id = ? AND m.place_id IN (${marks})`,
      args: [userId, ...placeIds]
    },
    {
      sql: `SELECT id, place_id, city, state, address, email, category
        FROM businesses
        WHERE user_id = ? AND place_id IN (${marks})`,
      args: [userId, ...placeIds]
    }
  ], 'read')

  const mockupsByPlace = new Map(mockupResult.rows.map(row => [String(row.place_id || ''), row]))
  const businessesByPlace = new Map(businessResult.rows.map(row => [String(row.place_id || ''), row]))

  for (const [placeId, row] of byPlace) {
    const businessName = asString(row.business_name) || 'Imported lead'
    const address = asString(row.address)
    const parsedLocation = parseUsCityState(address)
    const city = parsedLocation.city
    const state = parsedLocation.state
    const githubRepo = explicitGithubRepo(row)
    const mockupUrl = asString(row.mockup_url)
    const pitchDraft = asString(row.pitch_draft)
    const status = asString(row.status) || (mockupUrl ? 'mockup_ready' : 'draft')
    const mockupVersion = Number(row.mockup_version || 0)
    const pitchVersion = Number(row.pitch_version || 0)
    const lastFeedback = asString(row.last_feedback)
    const photoUrls = typeof row.photo_urls === 'string'
      ? row.photo_urls
      : Array.isArray(row.photo_urls)
        ? JSON.stringify(row.photo_urls)
        : null
    const phone = row.phone != null ? String(row.phone) : null
    const existing = mockupsByPlace.get(placeId)

    if (existing?.id) {
      writes.push({
        sql: `UPDATE mockups SET
          owner = ?, status = ?, mockup_url = COALESCE(?, mockup_url),
          mockup_version = ?, pitch_draft = COALESCE(?, pitch_draft),
          pitch_version = ?, last_feedback = COALESCE(?, last_feedback),
          photo_urls = COALESCE(?, photo_urls),
          github_repo = COALESCE(github_repo, ?),
          n8n_synced_at = datetime('now'),
          updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
        args: [
          owner, status, mockupUrl, mockupVersion, pitchDraft,
          pitchVersion, lastFeedback, photoUrls, githubRepo,
          String(existing.id), userId
        ]
      })
      refreshed++
      if (existing.business_id) {
        const patch = locationPatch({
          city: existing.b_city,
          state: existing.b_state,
          address: existing.b_address,
          email: existing.b_email,
          category: existing.b_category
        }, { address, city, state, row })
        if (patch) writes.push(businessUpdate(String(existing.business_id), userId, patch))
      }
      continue
    }

    const matched = businessesByPlace.get(placeId)
    let businessId = matched?.id ? String(matched.id) : ''
    if (businessId) {
      const patch = locationPatch(matched, { address, city, state, row })
      if (patch) writes.push(businessUpdate(businessId, userId, patch))
    } else {
      businessId = generateId()
      writes.push({
        sql: `INSERT INTO businesses (
          id, user_id, search_id, name, address, city, state, phone, website, email, place_id, category, rating, review_count, status
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
        args: [
          businessId,
          userId,
          businessName,
          address,
          city,
          state,
          phone,
          asString(row.website),
          asString(row.email),
          placeId,
          asString(row.category),
          asNumber(row.rating),
          asNumber(row.review_count)
        ]
      })
    }

    writes.push({
      sql: `INSERT INTO mockups (
        id, user_id, business_id, place_id, owner, source, status, mockup_url, mockup_version,
        pitch_draft, pitch_version, last_feedback, photo_urls, github_repo, n8n_synced_at
      ) VALUES (?, ?, ?, ?, ?, 'digest', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        generateId(), userId, businessId, placeId, owner, status, mockupUrl,
        mockupVersion, pitchDraft, pitchVersion, lastFeedback, photoUrls, githubRepo
      ]
    })
    imported++
  }

  if (writes.length > 0) await db.batch(writes, 'write')
  return { imported, refreshed }
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'n8n sync failed'
  const record = error as { data?: { message?: string }, message?: string, statusMessage?: string }
  return record.data?.message || record.message || record.statusMessage || 'n8n sync failed'
}

export async function stepSyncJob(userId: string, email: string, owner: string) {
  await ensureMockupSyncTable()
  const current = await latestJob(userId)
  if (!current || String(current.status) !== 'running') {
    return { job: viewOf(current), busy: false }
  }

  const lock = await db.execute({
    sql: `UPDATE mockup_sync_jobs
          SET locked_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND user_id = ? AND status = 'running'
            AND (locked_at IS NULL OR locked_at < datetime('now', '-30 seconds'))`,
    args: [current.id, userId]
  })
  if (!lock.rowsAffected) {
    return { job: viewOf(current), busy: true }
  }

  try {
    const page = await listN8nLeadPage(email, {
      cursor: asString(current.cursor),
      unsorted: Number(current.unsorted || 0) === 1
    })
    const saved = await saveLeadPage(userId, owner, page.rows)
    const pages = Number(current.pages || 0) + 1
    const finished = !page.nextCursor || pages >= PAGE_CAP
    const cursor = finished ? (page.nextCursor && pages >= PAGE_CAP ? page.nextCursor : null) : page.nextCursor
    await db.execute({
      sql: `UPDATE mockup_sync_jobs SET
          status = ?, cursor = ?, unsorted = ?,
          imported = imported + ?, refreshed = refreshed + ?, synced = synced + ?,
          pages = ?, error = NULL, locked_at = NULL, updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
      args: [
        finished ? 'done' : 'running',
        cursor,
        page.unsorted ? 1 : Number(current.unsorted || 0),
        saved.imported,
        saved.refreshed,
        page.rows.length,
        pages,
        current.id,
        userId
      ]
    })
  } catch (error: unknown) {
    await db.execute({
      sql: `UPDATE mockup_sync_jobs
            SET status = 'failed', error = ?, locked_at = NULL, updated_at = datetime('now')
            WHERE id = ? AND user_id = ?`,
      args: [errorMessage(error).slice(0, 500), current.id, userId]
    })
  }

  return { job: viewOf(await latestJob(userId)), busy: false }
}
