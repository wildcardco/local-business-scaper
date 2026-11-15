import type { H3Event } from 'h3'
import { db } from '~~/server/utils/db'
import { ensureMockupLinkColumns } from '~~/server/utils/mockup-links'
import { readStudioSecret } from '~~/server/utils/n8n'
import { MOCKUP_GITHUB_OWNER } from '~~/shared/mockup-repo'
import { isWebStackCallback, readWebStackWebhook } from '~~/shared/web-stack'

function stored(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return null
}

function githubRepoFromCallback(body: Record<string, unknown>) {
  const direct = typeof body.github_repo === 'string'
    ? body.github_repo
    : (typeof body.repo_full_name === 'string' ? body.repo_full_name : '')
  if (/^[\w.-]+\/[\w.-]+$/.test(direct)) return direct

  const html = typeof body.repo_html_url === 'string' ? body.repo_html_url : ''
  const match = html.match(/github\.com\/([\w.-]+\/[\w.-]+)/i)
  const repo = match?.[1]
  if (repo && repo.startsWith(`${MOCKUP_GITHUB_OWNER}/`)) return repo
  return null
}

function sendJson(event: H3Event, statusCode: number, body: Record<string, unknown>) {
  setResponseStatus(event, statusCode)
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  return body
}

function reject(
  event: H3Event,
  statusCode: number,
  message: string,
  detail: { reason: string, mockupId?: string, placeId?: string }
) {
  console.warn(`[mockups/webhook] rejected ${statusCode} ${detail.reason} method=${event.method} mockup_id=${detail.mockupId || '-'} place_id=${detail.placeId || '-'}`)
  return sendJson(event, statusCode, { ok: false, error: message, message })
}

export default defineEventHandler(async (event) => {
  const secret = readStudioSecret(event)
  if (!secret.ok) {
    return reject(event, secret.statusCode, secret.message, { reason: secret.reason })
  }

  if (event.method !== 'POST') {
    setResponseHeader(event, 'allow', 'POST')
    return reject(event, 405, 'POST is required', { reason: `method ${event.method || 'unknown'}` })
  }

  try {
    await ensureMockupLinkColumns()
    const body = await readBody(event)

    const mockupId = body && typeof body === 'object' && typeof body.mockup_id === 'string' ? body.mockup_id : ''
    const placeId = body && typeof body === 'object' && typeof body.place_id === 'string' ? body.place_id : ''
    const owner = body && typeof body === 'object' && typeof body.owner === 'string' ? body.owner : ''

    if (!mockupId && !placeId) {
      return reject(event, 400, 'mockup_id or place_id is required', {
        reason: 'missing mockup_id and place_id',
        mockupId,
        placeId
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
      return reject(event, 404, 'Mockup not found', {
        reason: 'mockup not found',
        mockupId,
        placeId
      })
    }

    const row = existing.rows[0]
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const webStack = isWebStackCallback(body)
    const parsed = webStack ? readWebStackWebhook(body) : null
    const keepWebStack = String(row.build_mode || '') === 'web_stack' && !webStack
    const errorMessage = typeof record.error === 'string'
      ? record.error
      : (typeof record.message === 'string' ? record.message : null)
    const status = keepWebStack
      ? row.status
      : (parsed ? parsed.status : (typeof record.status === 'string' ? record.status : row.status))
    const mockupUrl = keepWebStack
      ? row.mockup_url
      : (record.mockup_url != null ? String(record.mockup_url) : row.mockup_url)
    const mockupVersion = record.mockup_version != null ? Number(record.mockup_version) : row.mockup_version
    const pitchDraft = record.pitch_draft != null ? String(record.pitch_draft) : row.pitch_draft
    const pitchSubject = record.pitch_subject != null ? String(record.pitch_subject) : row.pitch_subject
    const pitchVersion = record.pitch_version != null ? Number(record.pitch_version) : row.pitch_version
    const lastFeedback = record.last_feedback != null
      ? String(record.last_feedback)
      : (webStack || keepWebStack
          ? row.last_feedback
          : (status === 'failed' && errorMessage ? errorMessage : row.last_feedback))
    const photoUrls = Array.isArray(record.photo_urls)
      ? JSON.stringify(record.photo_urls)
      : (typeof record.photo_urls === 'string' ? record.photo_urls : row.photo_urls)
    const githubRepo = githubRepoFromCallback(record) || row.github_repo
    const stampPreview = Boolean(webStack && parsed?.previewUrl && status === 'mockup_ready')

    await db.execute({
      sql: `UPDATE mockups SET
        status = ?, mockup_url = ?, mockup_version = ?, pitch_draft = ?, pitch_subject = ?,
        pitch_version = ?, last_feedback = ?, photo_urls = ?, github_repo = COALESCE(?, github_repo),
        build_mode = CASE WHEN ? = 1 THEN 'web_stack' ELSE build_mode END,
        agent_id = CASE WHEN ? = 1 THEN COALESCE(?, agent_id) ELSE agent_id END,
        preview_url = CASE WHEN ? = 1 THEN COALESCE(?, preview_url) ELSE preview_url END,
        preview_made_at = CASE WHEN ? = 1 THEN COALESCE(preview_made_at, datetime('now')) ELSE preview_made_at END,
        build_status = CASE WHEN ? = 1 THEN COALESCE(?, build_status) ELSE build_status END,
        build_error = CASE WHEN ? = 1 THEN ? ELSE build_error END,
        n8n_synced_at = datetime('now'),
        updated_at = datetime('now')
        WHERE id = ?`,
      args: [
        stored(status), stored(mockupUrl), stored(mockupVersion), stored(pitchDraft), stored(pitchSubject),
        stored(pitchVersion), stored(lastFeedback), stored(photoUrls), stored(githubRepo),
        webStack ? 1 : 0,
        webStack ? 1 : 0, parsed?.agentId || null,
        webStack ? 1 : 0, parsed?.previewUrl || null,
        stampPreview ? 1 : 0,
        webStack ? 1 : 0, parsed?.rawStatus || null,
        webStack ? 1 : 0, parsed?.error || null,
        stored(row.id)
      ]
    })

    console.info(`[mockups/webhook] updated id=${row.id} status=${status} web_stack=${webStack ? 1 : 0} preview=${parsed?.previewUrl ? 1 : 0}`)
    return sendJson(event, 200, { ok: true, success: true, id: row.id, status })
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Webhook failed'
    if (/invalid json body/i.test(detail)) {
      return reject(event, 400, 'Invalid JSON body', { reason: 'invalid JSON body' })
    }
    console.error(`[mockups/webhook] failed ${detail}`)
    return sendJson(event, 500, { ok: false, error: 'Webhook failed', message: 'Webhook failed' })
  }
})
