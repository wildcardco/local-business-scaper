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

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }

  const body = await readBody(event).catch(() => ({}))
  const result = await db.execute({
    sql: `SELECT m.id, m.user_id, m.place_id, m.owner, m.research_status,
            m.research_requested_at, m.research_completed_at, b.place_id AS b_place_id
          FROM mockups m
          LEFT JOIN businesses b ON b.id = m.business_id
          WHERE m.id = ?`,
    args: [id]
  })
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  const pending = researchRequestBlock(row.research_status, row.research_requested_at)
  if (pending) {
    throw createError({ statusCode: 409, message: pending })
  }

  const owner = researchOwnerSlug(row.owner) || researchOwnerSlug(ownerSlugFromEmail(user.email))
  const placeId = googlePlaceIdFrom(preferredPlaceId(row.place_id, row.b_place_id))
  const payload = researchReportPayload({
    owner,
    placeId,
    callbackUrl: researchCallbackUrlFromEvent(event),
    notes: text(body?.notes)
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
  const googlePlaceId = payload.body.place_id
  const replacePlaceId = mockupPlaceNeedsGoogleId(row.place_id)

  const claimed = await db.execute({
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
    args: [replacePlaceId ? 1 : 0, googlePlaceId, id, `-${RESEARCH_CALLBACK_WAIT_MINUTES} minutes`]
  })
  if (Number(claimed.rowsAffected || 0) < 1) {
    throw createError({ statusCode: 409, message: researchRequestBlock('requested') || 'A research report is already requested for this lead.' })
  }

  try {
    await fireResearchReport(payload.body)
  } catch (error) {
    await db.execute({
      sql: `UPDATE mockups SET
        research_status = ?,
        research_requested_at = ?,
        research_completed_at = ?,
        updated_at = datetime('now')
        WHERE id = ?`,
      args: [previousStatus, previousRequested, previousCompleted, id]
    })
    throw error
  }

  return {
    success: true,
    researchStatus: 'requested' as const,
    placeId
  }
})
