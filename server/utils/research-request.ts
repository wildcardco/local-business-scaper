import type { H3Event } from 'h3'
import { db } from '~~/server/utils/db'
import { googlePlaceIdFrom, preferredPlaceId } from '~~/shared/gbp-listing'
import { mockupPlaceNeedsGoogleId } from '~~/shared/intake-lookup'
import {
  RESEARCH_CALLBACK_WAIT_MINUTES,
  RESEARCH_NEEDS_LISTING,
  researchOwnerSlug,
  researchReportPayload,
  researchRequestBlock,
  researchStatusFrom
} from '~~/shared/research-report'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { fireResearchReport, researchCallbackUrlFromEvent } from '~~/server/utils/n8n'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

const waitArg = `-${RESEARCH_CALLBACK_WAIT_MINUTES} minutes`

async function claimBusiness(id: string) {
  return db.execute({
    sql: `UPDATE businesses SET
      research_status = 'requested',
      research_requested_at = datetime('now'),
      research_completed_at = NULL,
      updated_at = datetime('now')
      WHERE id = ?
        AND (
          COALESCE(research_status, '') != 'requested'
          OR datetime(research_requested_at) <= datetime('now', ?)
        )`,
    args: [id, waitArg]
  })
}

async function claimMockup(id: string, replacePlaceId: boolean, placeId: string) {
  return db.execute({
    sql: `UPDATE mockups SET
      research_status = 'requested',
      research_requested_at = datetime('now'),
      research_completed_at = NULL,
      place_id = CASE WHEN ? = 1 THEN ? ELSE place_id END,
      updated_at = datetime('now')
      WHERE id = ?
        AND (
          COALESCE(research_status, '') != 'requested'
          OR datetime(research_requested_at) <= datetime('now', ?)
        )`,
    args: [replacePlaceId ? 1 : 0, placeId, id, waitArg]
  })
}

async function restoreResearch(table: 'businesses' | 'mockups', id: string, status: string | null, requested: string | null, completed: string | null) {
  await db.execute({
    sql: `UPDATE ${table} SET
      research_status = ?,
      research_requested_at = ?,
      research_completed_at = ?,
      updated_at = datetime('now')
      WHERE id = ?`,
    args: [status, requested, completed, id]
  })
}

export async function requestBusinessResearch(event: H3Event, user: { id: string, email: string }, businessId: string, notes: unknown) {
  const result = await db.execute({
    sql: `SELECT id, user_id, place_id, research_status, research_requested_at, research_completed_at
          FROM businesses WHERE id = ? AND user_id = ?`,
    args: [businessId, user.id]
  })
  const row = result.rows[0]
  if (!row) throw createError({ statusCode: 404, message: 'Business not found' })

  const pending = researchRequestBlock(row.research_status, row.research_requested_at)
  if (pending) throw createError({ statusCode: 409, message: pending })

  const owner = researchOwnerSlug(ownerSlugFromEmail(user.email))
  const payload = researchReportPayload({
    owner,
    placeId: row.place_id,
    callbackUrl: researchCallbackUrlFromEvent(event),
    notes: text(notes)
  })
  if (!payload.ok) {
    throw createError({
      statusCode: 400,
      message: payload.reason === 'place' ? RESEARCH_NEEDS_LISTING : payload.message,
      data: { code: payload.reason === 'place' ? 'needs_listing' : payload.reason }
    })
  }

  const previousStatus = researchStatusFrom(row.research_status)
  const previousRequested = text(row.research_requested_at) || null
  const previousCompleted = text(row.research_completed_at) || null
  const claimed = await claimBusiness(businessId)
  if (Number(claimed.rowsAffected || 0) < 1) {
    throw createError({ statusCode: 409, message: researchRequestBlock('requested') || 'A research report is already requested for this lead.' })
  }

  try {
    await fireResearchReport(payload.body)
  } catch (error) {
    await restoreResearch('businesses', businessId, previousStatus, previousRequested, previousCompleted)
    throw error
  }

  await db.execute({
    sql: `UPDATE mockups SET
      research_status = 'requested',
      research_requested_at = datetime('now'),
      research_completed_at = NULL,
      updated_at = datetime('now')
      WHERE business_id = ? AND user_id = ?`,
    args: [businessId, user.id]
  })

  return { success: true, researchStatus: 'requested' as const, placeId: payload.body.place_id }
}

export async function requestMockupResearch(event: H3Event, user: { id: string, email: string }, mockupId: string, notes: unknown) {
  const result = await db.execute({
    sql: `SELECT m.id, m.user_id, m.business_id, m.place_id, m.owner, m.research_status,
            m.research_requested_at, m.research_completed_at,
            b.place_id AS b_place_id, b.research_status AS b_research_status,
            b.research_requested_at AS b_research_requested_at,
            b.research_completed_at AS b_research_completed_at
          FROM mockups m
          LEFT JOIN businesses b ON b.id = m.business_id
          WHERE m.id = ?`,
    args: [mockupId]
  })
  const row = result.rows[0]
  if (!row) throw createError({ statusCode: 404, message: 'Mockup not found' })

  const pending = researchRequestBlock(row.b_research_status, row.b_research_requested_at)
    || researchRequestBlock(row.research_status, row.research_requested_at)
  if (pending) throw createError({ statusCode: 409, message: pending })

  const owner = researchOwnerSlug(row.owner) || researchOwnerSlug(ownerSlugFromEmail(user.email))
  const placeId = googlePlaceIdFrom(preferredPlaceId(row.place_id, row.b_place_id))
  const payload = researchReportPayload({
    owner,
    placeId,
    callbackUrl: researchCallbackUrlFromEvent(event),
    notes: text(notes)
  })
  if (!payload.ok) {
    throw createError({
      statusCode: 400,
      message: payload.reason === 'place' ? RESEARCH_NEEDS_LISTING : payload.message,
      data: { code: payload.reason === 'place' ? 'needs_listing' : payload.reason }
    })
  }

  const businessId = text(row.business_id)
  const previousStatus = researchStatusFrom(row.research_status)
  const previousRequested = text(row.research_requested_at) || null
  const previousCompleted = text(row.research_completed_at) || null
  const previousBusinessStatus = researchStatusFrom(row.b_research_status)
  const previousBusinessRequested = text(row.b_research_requested_at) || null
  const previousBusinessCompleted = text(row.b_research_completed_at) || null
  const replacePlaceId = mockupPlaceNeedsGoogleId(row.place_id)
  const claimed = await claimMockup(mockupId, replacePlaceId, payload.body.place_id)
  if (Number(claimed.rowsAffected || 0) < 1) {
    throw createError({ statusCode: 409, message: researchRequestBlock('requested') || 'A research report is already requested for this lead.' })
  }
  if (businessId) {
    const businessClaim = await claimBusiness(businessId)
    if (Number(businessClaim.rowsAffected || 0) < 1 && researchRequestBlock(row.b_research_status, row.b_research_requested_at)) {
      await restoreResearch('mockups', mockupId, previousStatus, previousRequested, previousCompleted)
      throw createError({ statusCode: 409, message: researchRequestBlock('requested') || 'A research report is already requested for this lead.' })
    }
  }

  try {
    await fireResearchReport(payload.body)
  } catch (error) {
    await restoreResearch('mockups', mockupId, previousStatus, previousRequested, previousCompleted)
    if (businessId) {
      await restoreResearch('businesses', businessId, previousBusinessStatus, previousBusinessRequested, previousBusinessCompleted)
    }
    throw error
  }

  return { success: true, researchStatus: 'requested' as const, placeId: payload.body.place_id }
}
