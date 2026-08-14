import { db, generateId } from '~~/server/utils/db'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import {
  callbackUrlFromEvent,
  fireStudioAction,
  getStudioAiSettings,
  studioPlaceId,
  applyN8nLeadToMockup,
  findRunningFactoryJob,
  type StudioAction
} from '~~/server/utils/n8n'

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
  n8n_synced_at: string | null
  created_at: string | null
  updated_at: string | null
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

  return {
    id: String(row.id),
    userId: String(row.user_id),
    businessId: (row.business_id as string) || null,
    placeId: (row.place_id as string) || null,
    owner: (row.owner as string) || null,
    source: (row.source as string) || 'studio',
    status: (row.status as string) || 'draft',
    mockupUrl: (row.mockup_url as string) || null,
    mockupVersion: Number(row.mockup_version || 0),
    pitchDraft: (row.pitch_draft as string) || null,
    pitchSubject: (row.pitch_subject as string) || null,
    pitchVersion: Number(row.pitch_version || 0),
    lastFeedback: (row.last_feedback as string) || null,
    photoUrls,
    aiModel: (row.ai_model as string) || null,
    n8nSyncedAt: (row.n8n_synced_at as string) || null,
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
          city: (business.city as string) || null,
          state: (business.state as string) || null,
          category: (business.category as string) || null,
          rating: business.rating != null ? Number(business.rating) : null,
          reviewCount: business.review_count != null ? Number(business.review_count) : null,
          placeId: (business.place_id as string) || null
        }
      : null
  }
}

const STALE_MINUTES = 12
const STALE_MESSAGE = 'n8n did not finish. The factory stopped before a mockup URL came back. Try Generate mockup again.'

export async function expireStaleMockups(userId: string, mockupId?: string) {
  await db.execute({
    sql: `UPDATE mockups
          SET status = 'failed', last_feedback = ?, updated_at = datetime('now')
          WHERE user_id = ?
            AND status IN ('generating', 'writing_pitch', 'enhancing', 'revising')
            AND updated_at < datetime('now', '-${STALE_MINUTES} minutes')
            ${mockupId ? 'AND id = ?' : ''}`,
    args: mockupId ? [STALE_MESSAGE, userId, mockupId] : [STALE_MESSAGE, userId]
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
  const existing = await db.execute({
    sql: 'SELECT place_id FROM mockups WHERE id = ? AND user_id = ?',
    args: [id, userId]
  })
  if (!existing.rows[0]) return null

  const placeId = (existing.rows[0].place_id as string) || ''
  if (placeId) {
    await applyN8nLeadToMockup(userId, id, placeId)
  }
  await expireStaleMockups(userId, id)

  const result = await db.execute({
    sql: `
      SELECT m.*, b.name as b_name, b.website as b_website, b.phone as b_phone, b.email as b_email,
        b.address as b_address, b.city as b_city, b.state as b_state, b.category as b_category,
        b.rating as b_rating, b.review_count as b_review_count, b.place_id as b_place_id, b.id as b_id
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
        category: row.b_category,
        rating: row.b_rating,
        review_count: row.b_review_count,
        place_id: row.b_place_id
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
  model?: string
  maxTokens?: number
  force?: boolean
}) {
  const mockup = await getMockupForUser(opts.mockupId, opts.user.id)
  if (!mockup) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  if (!opts.force && (opts.action === 'generate_mockup' || opts.action === 'revise_mockup')) {
    const running = await findRunningFactoryJob({
      placeId: mockup.placeId || mockup.business?.placeId,
      mockupId: mockup.id
    })
    const busyLocal = ['generating', 'writing_pitch', 'enhancing', 'revising'].includes(mockup.status)
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
  const extraPrompt = opts.extraPrompt || opts.feedback || null
  const business = mockup.business
  const placeId = studioPlaceId({
    placeId: mockup.placeId || business?.placeId,
    mockupId: mockup.id,
    userId: opts.user.id
  })

  const nextStatus = opts.action === 'write_pitch'
    ? 'writing_pitch'
    : opts.action === 'add_photos'
      ? 'enhancing'
      : 'generating'

  await db.execute({
    sql: `UPDATE mockups SET
      place_id = ?, owner = ?, status = ?, last_feedback = COALESCE(?, last_feedback),
      photo_urls = COALESCE(?, photo_urls), ai_model = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [
      placeId,
      ownerSlugFromEmail(opts.user.email),
      nextStatus,
      extraPrompt,
      opts.photoUrls ? JSON.stringify(opts.photoUrls) : null,
      model,
      mockup.id,
      opts.user.id
    ]
  })

  try {
    await fireStudioAction({
      action: opts.action,
      place_id: placeId,
      owner: ownerSlugFromEmail(opts.user.email),
      business_name: business?.name || 'Untitled business',
      website: business?.website,
      phone: business?.phone,
      address: [business?.address, business?.city, business?.state].filter(Boolean).join(', ') || null,
      category: business?.category,
      rating: business?.rating,
      review_count: business?.reviewCount,
      last_feedback: extraPrompt || mockup.lastFeedback,
      extra_prompt: extraPrompt,
      photo_urls: opts.photoUrls || mockup.photoUrls,
      model,
      max_tokens: maxTokens,
      pitch_max_tokens: ai.pitchMaxTokens,
      research_model: model.includes('haiku') ? model : ai.researchModel,
      callback_url: callbackUrlFromEvent(opts.event),
      user_email: opts.user.email,
      mockup_id: mockup.id,
      business_id: mockup.businessId
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'n8n did not accept the Studio job'
    await markMockupFailed(mockup.id, opts.user.id, message)
    throw error
  }

  return getMockupForUser(mockup.id, opts.user.id)
}
