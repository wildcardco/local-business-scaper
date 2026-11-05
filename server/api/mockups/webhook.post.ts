import { db } from '~~/server/utils/db'
import { ensureMockupLinkColumns } from '~~/server/utils/mockup-links'
import { verifyStudioSecret } from '~~/server/utils/n8n'
import { MOCKUP_GITHUB_OWNER } from '~~/shared/mockup-repo'
import { isWebStackCallback, readWebStackWebhook } from '~~/shared/web-stack'

function githubRepoFromCallback(body: Record<string, unknown>) {
  const direct = typeof body.github_repo === 'string'
    ? body.github_repo
    : (typeof body.repo_full_name === 'string' ? body.repo_full_name : '')
  if (/^[\w.-]+\/[\w.-]+$/.test(direct)) return direct

  const html = typeof body.repo_html_url === 'string' ? body.repo_html_url : ''
  const match = html.match(/github\.com\/([\w.-]+\/[\w.-]+)/i)
  if (match && match[1].startsWith(`${MOCKUP_GITHUB_OWNER}/`)) return match[1]
  return null
}

export default defineEventHandler(async (event) => {
  verifyStudioSecret(event)
  await ensureMockupLinkColumns()
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
  const webStack = isWebStackCallback(body)
  const parsed = webStack ? readWebStackWebhook(body) : null
  const keepWebStack = String(row.build_mode || '') === 'web_stack' && !webStack
  const errorMessage = typeof body.error === 'string'
    ? body.error
    : (typeof body.message === 'string' ? body.message : null)
  const status = keepWebStack
    ? row.status
    : (parsed ? parsed.status : (typeof body.status === 'string' ? body.status : row.status))
  const mockupUrl = keepWebStack
    ? row.mockup_url
    : (body.mockup_url != null ? String(body.mockup_url) : row.mockup_url)
  const mockupVersion = body.mockup_version != null ? Number(body.mockup_version) : row.mockup_version
  const pitchDraft = body.pitch_draft != null ? String(body.pitch_draft) : row.pitch_draft
  const pitchSubject = body.pitch_subject != null ? String(body.pitch_subject) : row.pitch_subject
  const pitchVersion = body.pitch_version != null ? Number(body.pitch_version) : row.pitch_version
  const lastFeedback = body.last_feedback != null
    ? String(body.last_feedback)
    : (webStack || keepWebStack
        ? row.last_feedback
        : (status === 'failed' && errorMessage ? errorMessage : row.last_feedback))
  const photoUrls = Array.isArray(body.photo_urls)
    ? JSON.stringify(body.photo_urls)
    : (typeof body.photo_urls === 'string' ? body.photo_urls : row.photo_urls)
  const githubRepo = githubRepoFromCallback(body) || row.github_repo

  await db.execute({
    sql: `UPDATE mockups SET
      status = ?, mockup_url = ?, mockup_version = ?, pitch_draft = ?, pitch_subject = ?,
      pitch_version = ?, last_feedback = ?, photo_urls = ?, github_repo = COALESCE(?, github_repo),
      build_mode = CASE WHEN ? = 1 THEN 'web_stack' ELSE build_mode END,
      agent_id = CASE WHEN ? = 1 THEN COALESCE(?, agent_id) ELSE agent_id END,
      preview_url = CASE WHEN ? = 1 THEN COALESCE(?, preview_url) ELSE preview_url END,
      build_status = CASE WHEN ? = 1 THEN COALESCE(?, build_status) ELSE build_status END,
      build_error = CASE WHEN ? = 1 THEN ? ELSE build_error END,
      n8n_synced_at = datetime('now'),
      updated_at = datetime('now')
      WHERE id = ?`,
    args: [
      status, mockupUrl, mockupVersion, pitchDraft, pitchSubject,
      pitchVersion, lastFeedback, photoUrls, githubRepo,
      webStack ? 1 : 0,
      webStack ? 1 : 0, parsed?.agentId || null,
      webStack ? 1 : 0, parsed?.previewUrl || null,
      webStack ? 1 : 0, parsed?.rawStatus || null,
      webStack ? 1 : 0, parsed?.error || null,
      row.id
    ]
  })

  return { success: true, id: row.id }
})
