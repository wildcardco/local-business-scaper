import { db } from '~~/server/utils/db'
import { verifyStudioSecret } from '~~/server/utils/n8n'

export default defineEventHandler(async (event) => {
  verifyStudioSecret(event)
  const body = await readBody(event)

  const mockupId = typeof body.mockup_id === 'string' ? body.mockup_id : ''
  const placeId = typeof body.place_id === 'string' ? body.place_id : ''
  const owner = typeof body.owner === 'string' ? body.owner : ''

  if (!mockupId && !placeId) {
    throw createError({
      statusCode: 400,
      message: 'mockup_id or place_id is required'
    })
  }

  let existing
  if (mockupId) {
    existing = await db.execute({
      sql: 'SELECT * FROM mockups WHERE id = ? LIMIT 1',
      args: [mockupId]
    })
  } else {
    existing = await db.execute({
      sql: 'SELECT * FROM mockups WHERE place_id = ? AND (? = \'\' OR owner = ?) ORDER BY updated_at DESC LIMIT 1',
      args: [placeId, owner, owner]
    })
  }

  if (!existing.rows[0]) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  const row = existing.rows[0]
  const status = typeof body.status === 'string' ? body.status : row.status
  const errorMessage = typeof body.error === 'string' ? body.error : (typeof body.message === 'string' ? body.message : null)
  const mockupUrl = body.mockup_url != null ? String(body.mockup_url) : row.mockup_url
  const mockupVersion = body.mockup_version != null ? Number(body.mockup_version) : row.mockup_version
  const pitchDraft = body.pitch_draft != null ? String(body.pitch_draft) : row.pitch_draft
  const pitchSubject = body.pitch_subject != null ? String(body.pitch_subject) : row.pitch_subject
  const pitchVersion = body.pitch_version != null ? Number(body.pitch_version) : row.pitch_version
  const lastFeedback = body.last_feedback != null
    ? String(body.last_feedback)
    : (status === 'failed' && errorMessage ? errorMessage : row.last_feedback)
  const photoUrls = Array.isArray(body.photo_urls)
    ? JSON.stringify(body.photo_urls)
    : (typeof body.photo_urls === 'string' ? body.photo_urls : row.photo_urls)

  await db.execute({
    sql: `UPDATE mockups SET
      status = ?, mockup_url = ?, mockup_version = ?, pitch_draft = ?, pitch_subject = ?,
      pitch_version = ?, last_feedback = ?, photo_urls = ?, n8n_synced_at = datetime('now'),
      updated_at = datetime('now')
      WHERE id = ?`,
    args: [
      status, mockupUrl, mockupVersion, pitchDraft, pitchSubject,
      pitchVersion, lastFeedback, photoUrls, row.id
    ]
  })

  return { success: true, id: row.id }
})
