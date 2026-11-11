import { db } from '~~/server/utils/db'
import { verifyStudioSecret } from '~~/server/utils/n8n'
import { parseResearchCallback } from '~~/shared/research-report'

export default defineEventHandler(async (event) => {
  // WF-19 does not send X-Studio-Secret yet. Keep rejecting those calls.
  // A later callback that includes the secret still marks a requested lead complete,
  // including one that Studio already shows as "Sent - check email".
  verifyStudioSecret(event)
  const body = await readBody(event).catch(() => null)
  const parsed = parseResearchCallback(body)
  if (!parsed.ok) {
    throw createError({ statusCode: 400, message: parsed.message })
  }

  const businesses = await db.execute({
    sql: `UPDATE businesses SET
      research_status = 'complete',
      research_completed_at = datetime('now'),
      updated_at = datetime('now')
      WHERE place_id = ? AND research_status = 'requested'`,
    args: [parsed.placeId]
  })
  const mockups = await db.execute({
    sql: `UPDATE mockups SET
      research_status = 'complete',
      research_completed_at = datetime('now'),
      updated_at = datetime('now')
      WHERE place_id = ? AND research_status = 'requested'`,
    args: [parsed.placeId]
  })
  const count = Number(businesses.rowsAffected || 0) + Number(mockups.rowsAffected || 0)
  if (count > 0) {
    return {
      ok: true,
      action: 'research_report',
      place_id: parsed.placeId,
      research_status: 'complete',
      updated: count
    }
  }

  const existing = await db.execute({
    sql: `SELECT id FROM businesses WHERE place_id = ? AND research_status = 'complete' LIMIT 1`,
    args: [parsed.placeId]
  })
  const existingMockup = existing.rows[0]
    ? existing
    : await db.execute({
        sql: `SELECT id FROM mockups WHERE place_id = ? AND research_status = 'complete' LIMIT 1`,
        args: [parsed.placeId]
      })
  if (existingMockup.rows[0]) {
    return {
      ok: true,
      action: 'research_report',
      place_id: parsed.placeId,
      research_status: 'complete',
      updated: 0
    }
  }

  throw createError({
    statusCode: 404,
    message: 'No requested research report matches this place id.'
  })
})
