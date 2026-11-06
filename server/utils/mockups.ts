import { db, generateId } from '~~/server/utils/db'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { isPlaceId, locationLabel, parseUsCityState } from '~~/shared/studio-location'
import { githubRepoForMockup, mockupDeleteRepo, mockupGithubUrl } from '~~/shared/mockup-repo'
import { costTotalCents, formatUsdFromCents, parseCostLedger } from '~~/shared/mockup-cost'
import { checkUserMockupLinks, ensureMockupLinkColumns } from '~~/server/utils/mockup-links'
import { factoryFeedback } from '~~/shared/photo-slots'
import { studioSiteResearch } from '~~/shared/studio-site-payload'
import { outboundLeadPayload } from '~~/shared/website-intake'
import { gbpPhotosFrom, gbpWebhookFields, photoCountFrom, preferredPlaceId } from '~~/shared/gbp-listing'
import { siteContract } from '~~/shared/site-discovery'
import {
  callbackUrlFromEvent,
  fireStudioAction,
  fireWebStackAction,
  getStudioAiSettings,
  studioPlaceId,
  applyN8nLeadToMockup,
  findRunningFactoryJob,
  writeN8nLeadFeedback,
  type StudioAction
} from '~~/server/utils/n8n'
import {
  BUILD_MODE_WEB_STACK,
  cursorAgentUrl,
  httpsUrl,
  parseBuildMode,
  WEB_STACK_AGENT_MODEL,
  type BuildMode
} from '~~/shared/web-stack'

export interface MockupRow {
  id: string
  user_id: string
  business_id: string | null
  place_id: string | null
  owner: string | null
  source: string | null
  status: string | null
  mockup_url: string | null
  mockup_version: number | null
  pitch_draft: string | null
  pitch_subject: string | null
  pitch_version: number | null
  last_feedback: string | null
  photo_urls: string | null
  ai_model: string | null
  github_repo: string | null
  n8n_synced_at: string | null
  created_at: string | null
  updated_at: string | null
}

function mapMockupCosts(raw: unknown) {
  const ledger = parseCostLedger(raw)
  if (!ledger.entries.length) return null
  return {
    total: formatUsdFromCents(costTotalCents(ledger)),
    entries: ledger.entries.map(entry => ({
      action: entry.action,
      raw: entry.raw,
      amount: entry.amountText
    }))
  }
}

function storedGbpPhotos(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    return gbpPhotosFrom(JSON.parse(value))
  } catch {
    return []
  }
}

export function mapMockup(row: Record<string, unknown>, business?: Record<string, unknown> | null) {
  let photoUrls: string[] = []
  if (typeof row.photo_urls === 'string' && row.photo_urls) {
    try {
      const parsed = JSON.parse(row.photo_urls)
      if (Array.isArray(parsed)) photoUrls = parsed.filter(item => typeof item === 'string')
    } catch {
      photoUrls = []
    }
  }

  const businessName = business ? String(business.name || '') : ''
  const rawCity = business && !isPlaceId(business.city) ? (business.city as string) || null : null
  const rawState = business && !isPlaceId(business.state) ? (business.state as string) || null : null
  const address = (business?.address as string) || null
  const parsed = parseUsCityState(address)
  const city = rawCity || parsed.city
  const state = rawState || parsed.state
  const placeId = (row.place_id as string) || (business?.place_id as string) || null
  const storedPhotos = storedGbpPhotos(business?.gbp_photos)
  const mockupUrl = (row.mockup_url as string) || null
  const deploymentMissing = Number(row.deployment_missing || 0) === 1
  const githubMissing = Number(row.github_missing || 0) === 1
  const vercelUrl = !deploymentMissing && mockupUrl && /^https?:\/\//i.test(mockupUrl) ? mockupUrl : null
  const githubRepo = deploymentMissing || githubMissing
    ? null
    : githubRepoForMockup({
        owner: (row.owner as string) || null,
        businessName,
        placeId,
        stored: (row.github_repo as string) || null,
        vercelUrl
      })

  return {
    id: String(row.id),
    userId: String(row.user_id),
    businessId: (row.business_id as string) || null,
    placeId,
    owner: (row.owner as string) || null,
    source: (row.source as string) || 'studio',
    status: (row.status as string) || 'draft',
    mockupUrl,
    vercelUrl,
    deploymentMissing,
    githubRepo,
    githubUrl: mockupGithubUrl(githubRepo),
    deleteRepo: mockupDeleteRepo({
      owner: (row.owner as string) || null,
      businessName,
      placeId,
      stored: (row.github_repo as string) || null
    }),
    locationLabel: locationLabel({
      city,
      state,
      address,
      category: (business?.category as string) || null
    }),
    mockupVersion: Number(row.mockup_version || 0),
    pitchDraft: (row.pitch_draft as string) || null,
    pitchSubject: (row.pitch_subject as string) || null,
    pitchVersion: Number(row.pitch_version || 0),
    lastFeedback: (row.last_feedback as string) || null,
    photoUrls,
    costs: mapMockupCosts(row.mockup_cost_ledger),
    aiModel: (row.ai_model as string) || null,
    buildMode: row.build_mode === BUILD_MODE_WEB_STACK ? BUILD_MODE_WEB_STACK : 'html' as BuildMode,
    agentId: cursorAgentUrl(row.agent_id) ? String(row.agent_id) : null,
    agentUrl: cursorAgentUrl(row.agent_id),
    previewUrl: httpsUrl(row.preview_url),
    buildStatus: typeof row.build_status === 'string' && row.build_status ? row.build_status : null,
    buildError: typeof row.build_error === 'string' && row.build_error ? row.build_error : null,
    n8nSyncedAt: (row.n8n_synced_at as string) || null,
    madeAt: (row.made_at as string) || null,
    n8nCreatedAt: (row.n8n_created_at as string) || null,
    n8nUpdatedAt: (row.n8n_updated_at as string) || null,
    createdAt: (row.created_at as string) || null,
    updatedAt: (row.updated_at as string) || null,
    business: business
      ? {
          id: String(business.id),
          name: String(business.name || ''),
          website: (business.website as string) || null,
          phone: business.phone != null ? String(business.phone) : null,
          email: (business.email as string) || null,
          address: (business.address as string) || null,
          city,
          state,
          category: (business.category as string) || null,
          rating: business.rating != null ? Number(business.rating) : null,
          reviewCount: business.review_count != null ? Number(business.review_count) : null,
          placeId: (business.place_id as string) || null,
          zipCode: (business.zip_code as string) || null,
          googleBusinessId: (business.google_business_id as string) || null,
          gbpPhotos: storedPhotos,
          photoCount: photoCountFrom(business.photo_count, storedPhotos),
          siteDiscovery: (business.site_discovery as string) || null
        }
      : null
  }
}

/** Rows Studio should list: a Vercel deployment, a hand-made Studio draft, or a job still running. */
export function visibleMockupSql(alias: string) {
  const url = `lower(trim(COALESCE(${alias}.mockup_url, '')))`
  const vercel = `(${url} LIKE 'https://%.vercel.app%' OR ${url} LIKE 'http://%.vercel.app%')`
  return `(
    (
      ${vercel}
      OR COALESCE(${alias}.source, 'studio') != 'digest'
      OR ${alias}.status IN ('generating', 'writing_pitch', 'enhancing', 'revising')
      OR COALESCE(${alias}.build_mode, 'html') = 'web_stack'
    )
    AND COALESCE(${alias}.deployment_missing, 0) = 0
  )`
}

export async function removeDigestLeadsWithoutMockups(userId: string) {
  await ensureMockupLinkColumns()
  await db.execute({
    sql: `DELETE FROM mockups
          WHERE user_id = ?
            AND COALESCE(source, 'studio') = 'digest'
            AND COALESCE(build_mode, 'html') != 'web_stack'
            AND status NOT IN ('generating', 'writing_pitch', 'enhancing', 'revising')
            AND NOT (
              lower(trim(COALESCE(mockup_url, ''))) LIKE 'https://%.vercel.app%'
              OR lower(trim(COALESCE(mockup_url, ''))) LIKE 'http://%.vercel.app%'
            )`,
    args: [userId]
  })
  await db.execute({
    sql: `UPDATE mockups
          SET github_repo = NULL
          WHERE user_id = ?
            AND github_repo IS NOT NULL
            AND NOT (
              lower(trim(COALESCE(mockup_url, ''))) LIKE 'https://%.vercel.app%'
              OR lower(trim(COALESCE(mockup_url, ''))) LIKE 'http://%.vercel.app%'
            )`,
    args: [userId]
  })
}

const STALE_MINUTES = 12

export async function expireStaleMockups(userId: string, mockupId?: string) {
  await ensureMockupLinkColumns()
  await db.execute({
    sql: `UPDATE mockups
          SET status = 'failed', updated_at = datetime('now')
          WHERE user_id = ?
            AND status IN ('generating', 'writing_pitch', 'enhancing', 'revising')
            AND COALESCE(build_mode, 'html') != 'web_stack'
            AND updated_at < datetime('now', '-${STALE_MINUTES} minutes')
            ${mockupId ? 'AND id = ?' : ''}`,
    args: mockupId ? [userId, mockupId] : [userId]
  })
}

export async function markMockupFailed(id: string, userId: string, message: string) {
  await db.execute({
    sql: `UPDATE mockups
          SET status = 'failed', last_feedback = ?, updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
    args: [message.slice(0, 500), id, userId]
  })
}

export async function getMockupForUser(id: string, userId: string) {
  await ensureMockupLinkColumns()
  const existing = await db.execute({
    sql: 'SELECT place_id, build_mode FROM mockups WHERE id = ? AND user_id = ?',
    args: [id, userId]
  })
  if (!existing.rows[0]) return null

  const placeId = (existing.rows[0].place_id as string) || ''
  const buildMode = String(existing.rows[0].build_mode || '')
  if (placeId && buildMode !== BUILD_MODE_WEB_STACK) {
    await applyN8nLeadToMockup(userId, id, placeId)
  }
  await expireStaleMockups(userId, id)
  if (buildMode !== BUILD_MODE_WEB_STACK) {
    await checkUserMockupLinks(userId, id)
  }

  const result = await db.execute({
    sql: `
      SELECT m.*, b.name as b_name, b.website as b_website, b.phone as b_phone, b.email as b_email,
        b.address as b_address, b.city as b_city, b.state as b_state, b.zip_code as b_zip,
        b.category as b_category,
        b.rating as b_rating, b.review_count as b_review_count, b.place_id as b_place_id, b.id as b_id,
        b.google_business_id as b_google_business_id, b.gbp_photos as b_gbp_photos,
        b.photo_count as b_photo_count, b.site_discovery as b_site_discovery
      FROM mockups m
      LEFT JOIN businesses b ON m.business_id = b.id
      WHERE m.id = ? AND m.user_id = ?
    `,
    args: [id, userId]
  })

  if (!result.rows[0]) return null
  const row = result.rows[0]
  const business = row.b_id
    ? {
        id: row.b_id,
        name: row.b_name,
        website: row.b_website,
        phone: row.b_phone,
        email: row.b_email,
        address: row.b_address,
        city: row.b_city,
        state: row.b_state,
        zip_code: row.b_zip,
        category: row.b_category,
        rating: row.b_rating,
        review_count: row.b_review_count,
        place_id: row.b_place_id,
        google_business_id: row.b_google_business_id,
        gbp_photos: row.b_gbp_photos,
        photo_count: row.b_photo_count,
        site_discovery: row.b_site_discovery
      }
    : null

  return mapMockup(row, business)
}

export async function findOrCreateMockupForBusiness(userId: string, email: string, business: {
  id: string
  place_id?: string | null
}) {
  const existing = await db.execute({
    sql: 'SELECT * FROM mockups WHERE user_id = ? AND business_id = ? ORDER BY updated_at DESC LIMIT 1',
    args: [userId, business.id]
  })

  if (existing.rows[0]) {
    return existing.rows[0]
  }

  const id = generateId()
  const owner = ownerSlugFromEmail(email)
  const placeId = studioPlaceId({
    placeId: business.place_id,
    mockupId: id,
    userId
  })

  await db.execute({
    sql: `INSERT INTO mockups (id, user_id, business_id, place_id, owner, source, status)
          VALUES (?, ?, ?, ?, ?, 'studio', 'draft')`,
    args: [id, userId, business.id, placeId, owner]
  })

  const created = await db.execute({
    sql: 'SELECT * FROM mockups WHERE id = ?',
    args: [id]
  })

  return created.rows[0]
}

export async function fireMockupAction(opts: {
  event: Parameters<typeof callbackUrlFromEvent>[0]
  user: { id: string, email: string }
  mockupId: string
  action: StudioAction
  feedback?: string
  extraPrompt?: string
  photoUrls?: string[]
  photoSlots?: { slot: string, label: string, url: string }[]
  model?: string
  maxTokens?: number
  force?: boolean
  /** Drop stored revision notes so WF-2 builds a new page instead of editing the current one. */
  clearFeedback?: boolean
  /** `web_stack` sends the same lead to the web stack webhook. Anything else stays plain HTML. */
  buildMode?: unknown
  /** `one_page` is sent on the HTML webhook only. Web stack does not receive it. */
  pageIntent?: unknown
}) {
  const mockup = await getMockupForUser(opts.mockupId, opts.user.id)
  if (!mockup) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  const buildMode = opts.action === 'generate_mockup' ? parseBuildMode(opts.buildMode) : 'html'
  const busyLocal = ['generating', 'writing_pitch', 'enhancing', 'revising'].includes(mockup.status)

  if (buildMode === BUILD_MODE_WEB_STACK) {
    if (!opts.force && busyLocal && mockup.buildMode === BUILD_MODE_WEB_STACK) {
      throw createError({
        statusCode: 409,
        message: 'A web stack build is already running for this listing. Wait for it to finish, or confirm to start another.'
      })
    }
  } else if (!opts.force && (opts.action === 'generate_mockup' || opts.action === 'revise_mockup')) {
    const running = await findRunningFactoryJob({
      placeId: mockup.placeId || mockup.business?.placeId,
      mockupId: mockup.id
    })
    if (running.matched) {
      throw createError({
        statusCode: 409,
        message: 'A mockup factory job is already running for this listing. Wait for it to finish, or confirm to start another.'
      })
    }
    if (busyLocal && running.count > 0) {
      throw createError({
        statusCode: 409,
        message: `n8n already has ${running.count} mockup factory job${running.count === 1 ? '' : 's'} running. Starting another can spam the factory. Wait, or confirm to start anyway.`
      })
    }
  }

  const ai = await getStudioAiSettings(opts.user.id)
  const model = opts.model || ai.model
  const maxTokens = opts.maxTokens || ai.maxTokens
  const feedbackText = factoryFeedback({
    clearFeedback: opts.clearFeedback,
    extraPrompt: opts.extraPrompt || opts.feedback,
    stored: mockup.lastFeedback
  })
  const extraPrompt = opts.clearFeedback ? null : (feedbackText || null)
  const business = mockup.business
  const placeId = studioPlaceId({
    placeId: preferredPlaceId(mockup.placeId, business?.placeId),
    mockupId: mockup.id,
    userId: opts.user.id
  })

  const nextStatus = opts.action === 'write_pitch'
    ? 'writing_pitch'
    : opts.action === 'add_photos'
      ? 'enhancing'
      : opts.action === 'revise_mockup'
        ? 'revising'
        : 'generating'
  const owner = ownerSlugFromEmail(opts.user.email)
  if (buildMode !== BUILD_MODE_WEB_STACK && opts.clearFeedback && placeId) {
    await writeN8nLeadFeedback(placeId, owner, '')
  }
  const stampActivity = opts.action === 'generate_mockup' || opts.action === 'revise_mockup'
  const webStack = buildMode === BUILD_MODE_WEB_STACK
  await ensureMockupLinkColumns()

  await db.execute({
    sql: `UPDATE mockups SET
      place_id = ?, owner = ?, status = ?, last_feedback = COALESCE(?, last_feedback),
      photo_urls = COALESCE(?, photo_urls), ai_model = ?,
      build_mode = CASE WHEN ? = 1 THEN ? ELSE build_mode END,
      agent_id = CASE WHEN ? = 1 THEN NULL ELSE agent_id END,
      preview_url = CASE WHEN ? = 1 THEN NULL ELSE preview_url END,
      build_status = CASE WHEN ? = 1 THEN NULL ELSE build_status END,
      build_error = CASE WHEN ? = 1 THEN NULL ELSE build_error END,
      deployment_missing = CASE WHEN ? = 1 THEN 0 ELSE deployment_missing END,
      made_at = CASE WHEN ? = 1 THEN datetime('now') ELSE made_at END,
      updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [
      placeId,
      owner,
      nextStatus,
      extraPrompt,
      opts.photoUrls ? JSON.stringify(opts.photoUrls) : null,
      webStack ? WEB_STACK_AGENT_MODEL : model,
      opts.action === 'generate_mockup' ? 1 : 0,
      buildMode,
      webStack ? 1 : 0,
      webStack ? 1 : 0,
      webStack ? 1 : 0,
      webStack ? 1 : 0,
      webStack ? 1 : 0,
      stampActivity ? 1 : 0,
      mockup.id,
      opts.user.id
    ]
  })

  const site = studioSiteResearch({
    website: business?.website,
    phone: business?.phone,
    address: business?.address,
    city: business?.city,
    state: business?.state,
    zip: business?.zipCode,
    category: business?.category,
    rating: business?.rating,
    reviewCount: business?.reviewCount
  })

  const contract = siteContract({
    website: site.website,
    stored: business?.siteDiscovery
  })

  const leadPayload = {
    action: opts.action,
    place_id: placeId,
    owner,
    business_name: business?.name || 'Untitled business',
    website: contract.website || site.website,
    site_discovery: contract.site_discovery,
    phone: site.phone,
    address: site.address,
    category: site.category,
    rating: site.rating,
    review_count: site.review_count,
    last_feedback: opts.clearFeedback ? '' : (feedbackText || mockup.lastFeedback),
    extra_prompt: opts.clearFeedback ? (opts.extraPrompt || opts.feedback || null) : extraPrompt,
    photo_urls: opts.photoUrls || mockup.photoUrls,
    ...(opts.photoSlots?.length ? { photo_slots: opts.photoSlots } : {}),
    model,
    max_tokens: maxTokens,
    pitch_max_tokens: ai.pitchMaxTokens,
    research_model: model.includes('haiku') ? model : ai.researchModel,
    callback_url: callbackUrlFromEvent(opts.event),
    user_email: opts.user.email,
    mockup_id: mockup.id,
    business_id: mockup.businessId,
    mockup_version: mockup.mockupVersion
  }

  const gbp = gbpWebhookFields({
    appBusinessId: mockup.businessId,
    googleBusinessId: business?.googleBusinessId,
    photos: business?.gbpPhotos,
    photoCount: business?.photoCount
  })
  leadPayload.business_id = gbp.business_id
  if (gbp.gbp_photos) {
    leadPayload.photo_count = gbp.photo_count
    leadPayload.gbp_photos = gbp.gbp_photos
  }

  const outbound = outboundLeadPayload(leadPayload, {
    pageIntent: opts.pageIntent,
    buildMode
  })

  try {
    if (webStack) {
      const result = await fireWebStackAction(outbound)
      await db.execute({
        sql: `UPDATE mockups SET
          status = ?, agent_id = ?, preview_url = ?, build_status = ?, build_error = ?,
          updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
        args: [
          result.status,
          result.agentId,
          result.previewUrl,
          result.rawStatus,
          result.error,
          mockup.id,
          opts.user.id
        ]
      })
    } else {
      await fireStudioAction(outbound)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'n8n did not accept the Studio job'
    if (webStack) {
      await db.execute({
        sql: `UPDATE mockups SET status = 'failed', build_status = 'failed', build_error = ?, updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
        args: [message.slice(0, 500), mockup.id, opts.user.id]
      })
    } else {
      await markMockupFailed(mockup.id, opts.user.id, message)
    }
    throw error
  }

  return getMockupForUser(mockup.id, opts.user.id)
}
