import { db, generateId } from '~~/server/utils/db'
import { listN8nLeadPage } from '~~/server/utils/n8n'
import { isPlaceId, parseUsCityState } from '~~/shared/studio-location'
import { mockupGithubRepo, mockupGithubUrl, storedGithubRepo } from '~~/shared/mockup-repo'
import { mockupActivityTime, mockupCreatedTime, mockupUpdatedTime } from '~~/shared/mockup-time'
import {
  dedupeLeadsByPlace,
  incomingLeadIsOlder,
  leadDeployment,
  leadSiteBuilds,
  leadSyncAfterError,
  syncPageIsLast
} from '~~/shared/studio-sync-leads'
import { leadWebsiteValue, nextBusinessSite } from '~~/shared/site-discovery'
import { removeDigestLeadsWithoutMockups } from '~~/server/utils/mockups'
import { ensureMockupLinkColumns, inspectMockupTarget } from '~~/server/utils/mockup-links'

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
  website?: unknown
  siteDiscovery?: unknown
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
  const site = nextBusinessSite(current, input.row)
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
    && !site.changed
  if (unchanged) return null
  return {
    nextCity,
    nextState,
    nextAddress,
    nextEmail,
    nextCategory,
    nextWebsite: site.nextWebsite,
    nextDiscovery: site.nextDiscovery
  }
}

function businessUpdate(businessId: string, userId: string, patch: NonNullable<ReturnType<typeof locationPatch>>): Statement {
  return {
    sql: `UPDATE businesses SET
      city = ?, state = ?, address = ?, email = ?, category = ?,
      website = COALESCE(NULLIF(?, ''), website),
      site_discovery = ?,
      updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [
      patch.nextCity,
      patch.nextState,
      patch.nextAddress,
      patch.nextEmail,
      patch.nextCategory,
      patch.nextWebsite,
      patch.nextDiscovery,
      businessId,
      userId
    ]
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

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      await worker(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
}

function explicitGithubRepo(row: Record<string, unknown>) {
  const stored = storedGithubRepo(
    asString(row.github_repo)
    || asString(row.repo_full_name)
    || asString(row.web_stack_repo)
    || asString(row.full_site_repo)
  )
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

  // A stored cursor is an older offset. Resuming it skips a mockup that was
  // created after the last page, which is the row Last created should show.
  const id = generateId()
  await db.execute({
    sql: `INSERT INTO mockup_sync_jobs (id, user_id, status) VALUES (?, ?, 'running')`,
    args: [id, userId]
  })
  return viewOf(await latestJob(userId))
}

export interface LeadPageSave {
  imported: number
  refreshed: number
  kept: number
  hidden: number
  unknown: number
  duplicatePlace: number
  skipped: { no_place_id: number, not_vercel: number }
}

function emptyLeadSave(partial: Partial<LeadPageSave> = {}): LeadPageSave {
  return {
    imported: 0,
    refreshed: 0,
    kept: 0,
    hidden: 0,
    unknown: 0,
    duplicatePlace: 0,
    skipped: { no_place_id: 0, not_vercel: 0 },
    ...partial
  }
}

export async function saveLeadPage(userId: string, owner: string, rows: Record<string, unknown>[]) {
  await ensureMockupLinkColumns()
  const skipped = { no_place_id: 0, not_vercel: 0 }
  const candidates: Record<string, unknown>[] = []
  for (const row of rows) {
    if (!asString(row.place_id)) {
      skipped.no_place_id++
      continue
    }
    candidates.push(row)
  }
  const deduped = dedupeLeadsByPlace(candidates)
  const duplicatePlace = deduped.duplicatePlace
  const byPlace = new Map<string, Record<string, unknown>>()
  for (const row of deduped.rows) {
    const deployment = leadDeployment(row)
    if (!deployment.url && !deployment.webStack) {
      skipped.not_vercel++
      continue
    }
    byPlace.set(String(row.place_id), row)
  }

  let imported = 0
  let refreshed = 0
  let hidden = 0
  let unknown = 0
  const writes: Statement[] = []
  const placeIds = [...byPlace.keys()]
  const kept = placeIds.length
  if (placeIds.length === 0) {
    return emptyLeadSave({ kept, duplicatePlace, skipped })
  }

  const marks = placeIds.map(() => '?').join(', ')
  const [mockupResult, businessResult] = await db.batch([
    {
      sql: `SELECT m.id, m.place_id, m.business_id, m.status, m.mockup_url, m.mockup_version, m.made_at,
          m.n8n_created_at, m.n8n_updated_at,
          b.city as b_city, b.state as b_state,
          b.address as b_address, b.email as b_email, b.category as b_category,
          b.website as b_website, b.site_discovery as b_site_discovery
        FROM mockups m
        LEFT JOIN businesses b ON b.id = m.business_id
        WHERE m.user_id = ? AND m.place_id IN (${marks})`,
      args: [userId, ...placeIds]
    },
    {
      sql: `SELECT id, place_id, city, state, address, email, category, website, site_discovery
        FROM businesses
        WHERE user_id = ? AND place_id IN (${marks})`,
      args: [userId, ...placeIds]
    }
  ], 'read')

  const mockupsByPlace = new Map(mockupResult.rows.map(row => [String(row.place_id || ''), row]))
  const businessesByPlace = new Map(businessResult.rows.map(row => [String(row.place_id || ''), row]))

  const linkByPlace = new Map<string, { deployment: 'live' | 'missing' | 'unknown', githubMissing: boolean, githubRepo: string | null }>()
  await mapPool([...byPlace.entries()], 8, async ([placeId, row]) => {
    const mockupUrl = leadDeployment(row).url || ''
    if (!mockupUrl) {
      linkByPlace.set(placeId, { deployment: 'unknown', githubMissing: false, githubRepo: null })
      return
    }
    const businessName = asString(row.business_name) || 'Imported lead'
    const explicitRepo = explicitGithubRepo(row)
    const repo = mockupGithubRepo({
      owner,
      businessName,
      placeId,
      stored: explicitRepo
    })
    const inspected = await inspectMockupTarget({
      vercelUrl: mockupUrl,
      githubUrl: mockupGithubUrl(repo),
      githubRepo: explicitRepo || repo
    })
    linkByPlace.set(placeId, inspected)
  })

  for (const [placeId, row] of byPlace) {
    const businessName = asString(row.business_name) || 'Imported lead'
    const address = asString(row.address)
    const parsedLocation = parseUsCityState(address)
    const city = parsedLocation.city
    const state = parsedLocation.state
    const githubRepo = explicitGithubRepo(row)
    const sites = leadSiteBuilds(row)
    const deployment = leadDeployment(row)
    const mockupUrl = sites.onePageUrl || sites.webStackUrl || deployment.url
    const previewUrl = sites.webStackUrl
    const onlyStack = Boolean(sites.webStackUrl && !sites.onePageUrl)
    const webStack = onlyStack || deployment.webStack
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
    const link = linkByPlace.get(placeId)
    const busy = ['generating', 'writing_pitch', 'enhancing', 'revising'].includes(String(existing?.status || ''))
    const storedStamp = asString(existing?.n8n_updated_at) || asString(existing?.n8n_created_at)
    if (existing?.id && incomingLeadIsOlder(storedStamp, row)) continue

    if (link?.deployment === 'missing' && !busy && !webStack) {
      hidden++
      if (existing?.id) {
        writes.push({
          sql: `UPDATE mockups
                SET deployment_missing = 1, links_checked_at = datetime('now')
                WHERE id = ? AND user_id = ?`,
          args: [String(existing.id), userId]
        })
      }
      continue
    }

    if (link?.deployment === 'unknown') unknown++

    const githubMissing = link?.deployment === 'live' && link.githubMissing ? 1 : 0
    const confirmedRepo = link?.deployment === 'live' ? link.githubRepo : githubRepo
    const live = link?.deployment === 'live'
    const createdTime = mockupCreatedTime(row)
    const updatedTime = mockupUpdatedTime(row)
    const n8nMade = mockupActivityTime(row)
    const previousUrl = asString(existing?.mockup_url)
    const previousVersion = Number(existing?.mockup_version || 0)
    const changed = !existing?.id || mockupUrl !== previousUrl || mockupVersion !== previousVersion
    const madeAt = changed || !asString(existing?.made_at) ? n8nMade : null

    if (existing?.id) {
      writes.push(live
        ? {
            sql: `UPDATE mockups SET
              owner = ?, status = ?, mockup_url = COALESCE(?, mockup_url),
              mockup_version = ?, pitch_draft = COALESCE(?, pitch_draft),
              pitch_version = ?, last_feedback = COALESCE(?, last_feedback),
              photo_urls = COALESCE(?, photo_urls),
              github_repo = ?, github_missing = ?, deployment_missing = 0,
              links_checked_at = datetime('now'),
              build_mode = CASE WHEN ? = 1 THEN 'web_stack' WHEN ? = 1 THEN 'html' ELSE build_mode END,
              preview_url = COALESCE(?, preview_url),
              preview_made_at = COALESCE(?, preview_made_at),
              made_at = COALESCE(?, made_at),
              n8n_created_at = CASE
                WHEN ? > COALESCE(n8n_created_at, '') THEN ?
                ELSE COALESCE(n8n_created_at, ?)
              END,
              n8n_updated_at = COALESCE(?, n8n_updated_at),
              n8n_synced_at = datetime('now'),
              updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
            args: [
              owner, status, mockupUrl, mockupVersion, pitchDraft,
              pitchVersion, lastFeedback, photoUrls, confirmedRepo, githubMissing,
              onlyStack ? 1 : 0, sites.onePageUrl ? 1 : 0, previewUrl, sites.webStackAt, madeAt,
              createdTime, createdTime, createdTime, updatedTime,
              String(existing.id), userId
            ]
          }
        : {
            sql: `UPDATE mockups SET
              owner = ?, status = ?, mockup_url = COALESCE(?, mockup_url),
              mockup_version = ?, pitch_draft = COALESCE(?, pitch_draft),
              pitch_version = ?, last_feedback = COALESCE(?, last_feedback),
              photo_urls = COALESCE(?, photo_urls),
              github_repo = COALESCE(github_repo, ?),
              build_mode = CASE WHEN ? = 1 THEN 'web_stack' WHEN ? = 1 THEN 'html' ELSE build_mode END,
              preview_url = COALESCE(?, preview_url),
              preview_made_at = COALESCE(?, preview_made_at),
              made_at = COALESCE(?, made_at),
              n8n_created_at = CASE
                WHEN ? > COALESCE(n8n_created_at, '') THEN ?
                ELSE COALESCE(n8n_created_at, ?)
              END,
              n8n_updated_at = COALESCE(?, n8n_updated_at),
              n8n_synced_at = datetime('now'),
              updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
            args: [
              owner, status, mockupUrl, mockupVersion, pitchDraft,
              pitchVersion, lastFeedback, photoUrls, githubRepo,
              onlyStack ? 1 : 0, sites.onePageUrl ? 1 : 0, previewUrl, sites.webStackAt, madeAt,
              createdTime, createdTime, createdTime, updatedTime,
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
          category: existing.b_category,
          website: existing.b_website,
          siteDiscovery: existing.b_site_discovery
        }, { address, city, state, row })
        if (patch) writes.push(businessUpdate(String(existing.business_id), userId, patch))
      }
      continue
    }

    const matched = businessesByPlace.get(placeId)
    let businessId = matched?.id ? String(matched.id) : ''
    if (businessId) {
      const patch = locationPatch({
        city: matched.city,
        state: matched.state,
        address: matched.address,
        email: matched.email,
        category: matched.category,
        website: matched.website,
        siteDiscovery: matched.site_discovery
      }, { address, city, state, row })
      if (patch) writes.push(businessUpdate(businessId, userId, patch))
    } else {
      businessId = generateId()
      writes.push({
        sql: `INSERT INTO businesses (
          id, user_id, search_id, name, address, city, state, phone, website, email, place_id, category, rating, review_count, status, site_discovery
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
        args: [
          businessId,
          userId,
          businessName,
          address,
          city,
          state,
          phone,
          leadWebsiteValue(row),
          asString(row.email),
          placeId,
          asString(row.category),
          asNumber(row.rating),
          asNumber(row.review_count),
          nextBusinessSite({}, row).nextDiscovery
        ]
      })
    }

    writes.push({
      sql: `INSERT INTO mockups (
        id, user_id, business_id, place_id, owner, source, status, mockup_url, mockup_version,
        pitch_draft, pitch_version, last_feedback, photo_urls, github_repo, github_missing,
        deployment_missing, build_mode, preview_url, preview_made_at, made_at, n8n_created_at, n8n_updated_at, links_checked_at, n8n_synced_at
      ) VALUES (?, ?, ?, ?, ?, 'digest', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ${live ? `datetime('now')` : 'NULL'}, datetime('now'))`,
      args: [
        generateId(), userId, businessId, placeId, owner, status, mockupUrl,
        mockupVersion, pitchDraft, pitchVersion, lastFeedback, photoUrls,
        live ? confirmedRepo : githubRepo, githubMissing,
        onlyStack ? 'web_stack' : 'html', previewUrl, sites.webStackAt, madeAt, createdTime, updatedTime
      ]
    })
    imported++
  }

  if (writes.length > 0) await db.batch(writes, 'write')
  return { imported, refreshed, kept, hidden, unknown, duplicatePlace, skipped }
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'n8n sync failed'
  const record = error as { data?: { message?: string }, message?: string, statusMessage?: string }
  return record.data?.message || record.message || record.statusMessage || 'n8n sync failed'
}

function n8nStatusOf(error: unknown): number | 'not_called' | 'none' {
  if (/N8N_API_KEY is not configured/i.test(errorMessage(error))) return 'not_called'
  if (!error || typeof error !== 'object') return 'none'
  const status = (error as { statusCode?: number }).statusCode
  return typeof status === 'number' && status >= 100 && status < 600 ? status : 'none'
}

function configuredSecrets() {
  const config = useRuntimeConfig()
  return [config.n8nApiKey, config.n8nStudioSecret].map(value => String(value || '')).filter(value => value.length >= 8)
}

/** One line of sync detail. Never includes the API key or row bodies. */
export function redactSyncLog(value: string, secrets: string[] = []) {
  let text = value
  for (const secret of secrets) {
    if (secret.length >= 8) text = text.split(secret).join('[redacted]')
  }
  return text
    .replace(/(X-N8N-API-KEY|N8N_API_KEY|X-Studio-Secret|Authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 180)
}

function skippedText(saved: LeadPageSave) {
  const parts: string[] = []
  if (saved.skipped.no_place_id) parts.push(`no_place_id:${saved.skipped.no_place_id}`)
  if (saved.skipped.not_vercel) parts.push(`not_vercel:${saved.skipped.not_vercel}`)
  if (saved.duplicatePlace) parts.push(`duplicate_place:${saved.duplicatePlace}`)
  return parts.length ? parts.join(',') : 'none'
}

export interface SyncStepResult {
  job: StudioSyncJobView | null
  busy: boolean
  line: string
}

function stepLine(input: {
  jobId: string
  n8n: number | 'not_called' | 'none'
  page?: number
  fetched?: number
  kept?: number
  skipped?: string
  hidden?: number
  written?: number
  updated?: number
  unknown?: number
  reason?: string
  status?: string
  error?: string
  secrets?: string[]
}) {
  const bits = [`[studio-sync] step job=${input.jobId}`, `n8n=${input.n8n}`]
  if (input.reason) bits.push(`reason=${input.reason}`)
  if (input.status) bits.push(`status=${input.status}`)
  if (input.page != null) bits.push(`page=${input.page}`)
  if (input.fetched != null) {
    bits.push(
      `fetched=${input.fetched}`,
      `kept=${input.kept ?? 0}`,
      `skipped=${input.skipped || 'none'}`,
      `hidden=${input.hidden ?? 0}`,
      `written=${input.written ?? 0}`,
      `updated=${input.updated ?? 0}`
    )
    if (input.unknown) bits.push(`unknown=${input.unknown}`)
  }
  if (input.error) bits.push(`error=${redactSyncLog(input.error, input.secrets)}`)
  return bits.join(' ')
}

export async function stepSyncJob(userId: string, email: string, owner: string): Promise<SyncStepResult> {
  await ensureMockupSyncTable()
  const current = await latestJob(userId)
  if (!current || String(current.status) !== 'running') {
    const job = viewOf(current)
    return {
      job,
      busy: false,
      line: stepLine({
        jobId: job?.id || 'none',
        n8n: 'not_called',
        reason: 'no_running_job',
        status: job?.status || 'none'
      })
    }
  }

  const lock = await db.execute({
    sql: `UPDATE mockup_sync_jobs
          SET locked_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND user_id = ? AND status = 'running'
            AND (locked_at IS NULL OR locked_at < datetime('now', '-30 seconds'))`,
    args: [current.id, userId]
  })
  if (!lock.rowsAffected) {
    return {
      job: viewOf(current),
      busy: true,
      line: stepLine({
        jobId: String(current.id),
        n8n: 'not_called',
        reason: 'locked'
      })
    }
  }

  const pageNumber = Number(current.pages || 0) + 1
  try {
    const page = await listN8nLeadPage(email, {
      cursor: asString(current.cursor),
      unsorted: Number(current.unsorted || 0) === 1
    })
    const saved = await saveLeadPage(userId, owner, page.rows)
    const finished = syncPageIsLast({
      pageNumber,
      nextCursor: page.nextCursor,
      pageCap: PAGE_CAP
    })
    const cursor = finished ? (page.nextCursor && pageNumber >= PAGE_CAP ? page.nextCursor : null) : page.nextCursor
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
        pageNumber,
        current.id,
        userId
      ]
    })
    return {
      job: viewOf(await latestJob(userId)),
      busy: false,
      line: stepLine({
        jobId: String(current.id),
        n8n: page.status,
        page: pageNumber,
        fetched: page.rows.length,
        kept: saved.kept,
        skipped: skippedText(saved),
        hidden: saved.hidden,
        written: saved.imported,
        updated: saved.refreshed,
        unknown: saved.unknown
      })
    }
  } catch (error: unknown) {
    const message = errorMessage(error).slice(0, 500)
    if (leadSyncAfterError({
      cursor: asString(current.cursor),
      unsorted: Number(current.unsorted || 0) === 1,
      message
    }) === 'unsorted') {
      await db.execute({
        sql: `UPDATE mockup_sync_jobs
              SET unsorted = 1, error = NULL, locked_at = NULL, updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
        args: [current.id, userId]
      })
      return {
        job: viewOf(await latestJob(userId)),
        busy: false,
        line: stepLine({
          jobId: String(current.id),
          n8n: n8nStatusOf(error),
          page: pageNumber,
          reason: 'fallback_unsorted',
          error: message,
          secrets: configuredSecrets()
        })
      }
    }
    await db.execute({
      sql: `UPDATE mockup_sync_jobs
            SET status = 'failed', error = ?, locked_at = NULL, updated_at = datetime('now')
            WHERE id = ? AND user_id = ?`,
      args: [message, current.id, userId]
    })
    return {
      job: viewOf(await latestJob(userId)),
      busy: false,
      line: stepLine({
        jobId: String(current.id),
        n8n: n8nStatusOf(error),
        page: pageNumber,
        error: message,
        secrets: configuredSecrets()
      })
    }
  }
}
