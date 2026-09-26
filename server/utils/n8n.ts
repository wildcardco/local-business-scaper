import { db } from '~~/server/utils/db'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import {
  clampTokens,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_MODEL,
  DEFAULT_PITCH_MAX_TOKENS,
  DEFAULT_RESEARCH_MODEL,
  isStudioAiModel
} from '~~/shared/studio-ai'
import { leadAdvancedWhileBusy } from '~~/shared/studio-progress'

export const N8N_WF_FACTORY = 'jslUBLzcV27vdLIA'
export const N8N_WF_PITCH = 'wkqEVHfuCV1CsS2a'
export const N8N_WF_ENHANCER = '7aofECe7KpM13rbH'

export type StudioAction = 'generate_mockup' | 'revise_mockup' | 'write_pitch' | 'add_photos'

export interface StudioAiSettings {
  model: string
  maxTokens: number
  pitchMaxTokens: number
  researchModel: string
}

export interface StudioLeadPayload {
  action: StudioAction
  place_id: string
  owner: string
  business_name: string
  website?: string | null
  phone?: string | null
  address?: string | null
  category?: string | null
  rating?: number | null
  review_count?: number | null
  last_feedback?: string | null
  extra_prompt?: string | null
  photo_urls?: string[]
  model: string
  max_tokens: number
  pitch_max_tokens: number
  research_model: string
  callback_url: string
  user_email: string
  mockup_id: string
  business_id?: string | null
  mockup_version?: number
}

export async function getStudioAiSettings(userId: string): Promise<StudioAiSettings> {
  const result = await db.execute({
    sql: 'SELECT ai_model, ai_max_tokens, pitch_max_tokens FROM branding_settings WHERE user_id = ? LIMIT 1',
    args: [userId]
  })

  const row = result.rows[0]
  const model = isStudioAiModel(row?.ai_model) ? String(row.ai_model) : DEFAULT_AI_MODEL
  const maxTokens = clampTokens(row?.ai_max_tokens, DEFAULT_AI_MAX_TOKENS)
  const pitchMaxTokens = clampTokens(row?.pitch_max_tokens, DEFAULT_PITCH_MAX_TOKENS, 256, 8000)

  return {
    model,
    maxTokens,
    pitchMaxTokens,
    researchModel: model.includes('haiku') ? model : DEFAULT_RESEARCH_MODEL
  }
}

function n8nConfig() {
  const config = useRuntimeConfig()
  return {
    apiKey: String(config.n8nApiKey || ''),
    baseUrl: String(config.n8nBaseUrl || 'https://n8n.wildcardcreative.cloud').replace(/\/$/, ''),
    studioWebhookUrl: String(config.n8nStudioWebhookUrl || ''),
    studioSecret: String(config.n8nStudioSecret || ''),
    leadsTableId: String(config.n8nLeadsTableId || 'HnKWbJiHsPeWOtMk'),
    projectId: String(config.n8nProjectId || 'zjqtNDk0RAupaxDa')
  }
}

async function n8nFetch(path: string, init: RequestInit = {}) {
  const { apiKey, baseUrl } = n8nConfig()
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'N8N_API_KEY is not configured'
    })
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
      ...(init.headers || {})
    }
  })

  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      message: `n8n API ${response.status}: ${text.slice(0, 300)}`
    })
  }

  return json
}

export function studioPlaceId(input: { placeId?: string | null, mockupId: string, userId: string }) {
  if (input.placeId) return input.placeId
  return `studio_${input.userId}_${input.mockupId}`
}

export async function fireStudioAction(payload: StudioLeadPayload) {
  const { studioWebhookUrl, studioSecret } = n8nConfig()

  if (!studioWebhookUrl) {
    throw createError({
      statusCode: 500,
      message: 'N8N_STUDIO_WEBHOOK_URL is not configured. Studio needs POST /webhook/studio (WF-7).'
    })
  }

  if (!studioSecret) {
    throw createError({
      statusCode: 500,
      message: 'N8N_STUDIO_SECRET is not configured, so Studio did not call the webhook. Since 2026-09-25 WF-7 requires header X-Studio-Secret. A missing or wrong secret is rejected with 403 and no execution is logged. Set the Vercel value to n8n credential Studio secret (bYKoHkwycoKjqI1A).'
    })
  }

  const response = await fetch(studioWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Studio-Secret': studioSecret
    },
    body: JSON.stringify(payload)
  })

  const errorText = await response.text()
  if (!response.ok) {
    const detail = errorText.slice(0, 300) || response.statusText
    const secretHint = response.status === 401 || response.status === 403
      ? ' WF-7 (HPHWqFUK7DXBynWo) checks X-Studio-Secret against the Studio secret credential. A mismatch is rejected before an execution is created. Vercel N8N_STUDIO_SECRET must equal that credential.'
      : ''
    throw createError({
      statusCode: 502,
      message: `Studio webhook failed (${response.status}): ${detail}.${secretHint}`
    })
  }

  if (!errorText) return { ok: true }
  try {
    const body = JSON.parse(errorText) as { ok?: unknown }
    if (body.ok === false) {
      throw createError({
        statusCode: 502,
        message: 'Studio webhook returned 200 with ok:false. No mockup job was started.'
      })
    }
    return body
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    return { ok: true }
  }
}

function unwrapLeadRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {}
  const record = row as Record<string, unknown>
  if (record.json && typeof record.json === 'object' && !Array.isArray(record.json)) {
    return record.json as Record<string, unknown>
  }
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    return record.data as Record<string, unknown>
  }
  return record
}

function extractTableRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.map(unwrapLeadRow)
  if (!json || typeof json !== 'object') return []
  const record = json as Record<string, unknown>
  const nested = record.data
  if (Array.isArray(nested)) return nested.map(unwrapLeadRow)
  if (nested && typeof nested === 'object' && Array.isArray((nested as { data?: unknown }).data)) {
    return ((nested as { data: unknown[] }).data).map(unwrapLeadRow)
  }
  if (Array.isArray(record.rows)) return record.rows.map(unwrapLeadRow)
  return []
}

function extractExecutionRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[]
  if (!json || typeof json !== 'object') return []
  const record = json as Record<string, unknown>
  if (Array.isArray(record.data)) return record.data as Record<string, unknown>[]
  if (Array.isArray(record.results)) return record.results as Record<string, unknown>[]
  return []
}

function nextCursorOf(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const cursor = (json as { nextCursor?: unknown }).nextCursor
  return typeof cursor === 'string' && cursor ? cursor : null
}

function errorText(error: unknown) {
  if (!error || typeof error !== 'object') return 'n8n request failed'
  const record = error as { message?: string, statusMessage?: string, data?: { message?: string } }
  return record.data?.message || record.message || record.statusMessage || 'n8n request failed'
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return 0
  const status = (error as { statusCode?: number }).statusCode
  return typeof status === 'number' ? status : 0
}

const LEAD_PAGE_LIMIT = 100
const LEAD_PAGE_CAP = 40

async function listLeadRows(columnName: string, value: string, sortBy: string) {
  const { leadsTableId } = n8nConfig()
  const rows: Record<string, unknown>[] = []
  let cursor: string | null = null
  const seenCursors = new Set<string>()

  for (let page = 0; page < LEAD_PAGE_CAP; page++) {
    const params = new URLSearchParams()
    params.set('limit', String(LEAD_PAGE_LIMIT))
    params.set('filter', JSON.stringify({
      type: 'and',
      filters: [{ columnName, condition: 'eq', value }]
    }))
    if (sortBy) params.set('sortBy', sortBy)
    if (cursor) params.set('cursor', cursor)

    const json = await n8nFetch(`/api/v1/data-tables/${leadsTableId}/rows?${params}`)
    const batch = extractTableRows(json)
    rows.push(...batch)
    const next = nextCursorOf(json)
    if (!next || batch.length === 0 || seenCursors.has(next)) break
    seenCursors.add(next)
    cursor = next
  }

  return rows
}

export async function listN8nLeadsByOwner(email: string) {
  const owner = ownerSlugFromEmail(email)
  const { apiKey } = n8nConfig()
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'N8N_API_KEY is not configured, so Sync from n8n cannot read the leads table. This button does not use N8N_STUDIO_SECRET.'
    })
  }

  try {
    return await listLeadRows('owner', owner, 'updatedAt:desc')
  } catch (error: unknown) {
    const message = errorText(error)
    if (/sort/i.test(message)) {
      return await listLeadRows('owner', owner, '')
    }
    const status = errorStatus(error)
    const scopeHint = status === 401 || status === 403
      ? ' The key needs the dataTableRow:read scope. Sync does not use N8N_STUDIO_SECRET.'
      : ''
    throw createError({
      statusCode: status >= 400 && status < 600 ? status : 502,
      message: `${message}${scopeHint}`
    })
  }
}

export async function writeN8nLeadFeedback(placeId: string, owner: string, feedback: string) {
  const { leadsTableId, apiKey } = n8nConfig()
  if (!apiKey) {
    return {
      ok: false,
      warning: 'N8N_API_KEY is not configured, so feedback was not written to the leads table before n8n started. WF-7 must save last_feedback before WF-2 loads the lead.'
    }
  }

  try {
    await n8nFetch(`/api/v1/data-tables/${leadsTableId}/rows/update`, {
      method: 'PATCH',
      body: JSON.stringify({
        filter: {
          type: 'and',
          filters: [
            { columnName: 'place_id', condition: 'eq', value: placeId },
            { columnName: 'owner', condition: 'eq', value: owner }
          ]
        },
        data: { last_feedback: feedback },
        returnData: false
      })
    })
    return { ok: true, warning: null as string | null }
  } catch (error: unknown) {
    const status = errorStatus(error)
    const scopeHint = status === 401 || status === 403
      ? ' The key needs dataTableRow:update as well as dataTableRow:read.'
      : ''
    return {
      ok: false,
      warning: `Could not write feedback onto the n8n lead before the revision started (${errorText(error)}).${scopeHint} WF-7 must upsert last_feedback and finish before it calls WF-2.`
    }
  }
}

export function verifyStudioSecret(event: Parameters<typeof getHeader>[0]) {
  const config = n8nConfig()
  if (!config.studioSecret) {
    throw createError({
      statusCode: 500,
      message: 'N8N_STUDIO_SECRET is not configured'
    })
  }

  const header = getHeader(event, 'x-studio-secret') || getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
  if (!header || header !== config.studioSecret) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }
}

export function callbackUrlFromEvent(event: Parameters<typeof getRequestURL>[0]) {
  const config = useRuntimeConfig()
  if (config.n8nCallbackUrl) {
    return `${String(config.n8nCallbackUrl).replace(/\/$/, '')}/api/mockups/webhook`
  }
  const origin = getRequestURL(event).origin
  return `${origin}/api/mockups/webhook`
}

function asLeadString(value: unknown) {
  if (value == null || value === '') return null
  return String(value)
}

function pickMatchingLead(rows: Record<string, unknown>[], placeId: string) {
  return rows.find(row => String(row.place_id || '') === placeId)
    || (rows.length === 1 ? rows[0] : null)
}

export async function getN8nLeadByPlaceId(placeId: string) {
  if (!placeId) return null
  const { apiKey } = n8nConfig()
  if (!apiKey) return null

  try {
    const rows = await listLeadRows('place_id', placeId, '')
    return pickMatchingLead(rows, placeId)
  } catch {
    return null
  }
}

export async function findRunningFactoryJob(opts: {
  placeId?: string | null
  mockupId?: string | null
}) {
  const empty = { count: 0, matched: false, inspected: false }
  const { apiKey } = n8nConfig()
  if (!apiKey) return empty

  let json: unknown
  try {
    json = await n8nFetch(`/api/v1/executions?workflowId=${N8N_WF_FACTORY}&status=running&limit=20`)
  } catch {
    try {
      json = await n8nFetch(`/api/v1/executions?workflowId=${N8N_WF_FACTORY}&limit=20`)
    } catch {
      return empty
    }
  }

  const rows = extractExecutionRows(json).filter((row) => {
    const status = String(row.status || '')
    return status === 'running' || status === 'waiting' || status === 'new'
  })

  if (!rows.length) return { count: 0, matched: false, inspected: true }

  const needles = [opts.placeId, opts.mockupId].filter(Boolean) as string[]
  if (!needles.length) {
    return { count: rows.length, matched: false, inspected: false }
  }

  let inspected = 0
  for (const row of rows.slice(0, 5)) {
    const executionId = row.id
    if (executionId == null) continue
    try {
      const detail = await n8nFetch(`/api/v1/executions/${executionId}?includeData=true`)
      inspected++
      const blob = JSON.stringify(detail)
      if (needles.some(needle => blob.includes(needle))) {
        return { count: rows.length, matched: true, inspected: true }
      }
    } catch {
      // keep checking other executions
    }
  }

  return {
    count: rows.length,
    matched: false,
    inspected: inspected > 0
  }
}

export async function applyN8nLeadToMockup(userId: string, mockupId: string, placeId: string) {
  try {
    const lead = await getN8nLeadByPlaceId(placeId)
    if (!lead) return false

    const local = await db.execute({
      sql: 'SELECT status, mockup_url, mockup_version, pitch_version, pitch_draft FROM mockups WHERE id = ? AND user_id = ?',
      args: [mockupId, userId]
    })
    const current = local.rows[0]
    if (!current) return false

    const mockupUrl = asLeadString(lead.mockup_url)
    const n8nStatus = asLeadString(lead.status)
    const n8nVersion = Number(lead.mockup_version || 0)
    const localVersion = Number(current.mockup_version || 0)
    const localUrl = asLeadString(current.mockup_url)
    const localStatus = String(current.status || '')
    const busyLocal = ['generating', 'writing_pitch', 'enhancing', 'revising'].includes(localStatus)

    // WF-7 answers 200 {ok:true} immediately and never calls callback_url.
    // The lead row stays on the previous URL and version until the factory finishes,
    // so an unchanged mockup_ready row is still in progress.
    if (busyLocal) {
      const advanced = leadAdvancedWhileBusy({
        localStatus,
        localUrl,
        localVersion,
        localPitchVersion: Number(current.pitch_version || 0),
        localPitchDraft: asLeadString(current.pitch_draft),
        n8nStatus,
        n8nUrl: mockupUrl,
        n8nVersion,
        n8nPitchVersion: Number(lead.pitch_version || 0),
        n8nPitchDraft: asLeadString(lead.pitch_draft)
      })
      if (advanced === 'wait') return false
      if (advanced === 'failed') {
        await db.execute({
          sql: `UPDATE mockups SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
          args: [mockupId, userId]
        })
        return true
      }
    } else if (!mockupUrl && n8nStatus !== 'failed') {
      return false
    }

    const status = mockupUrl
      ? (n8nStatus === 'pitch_ready' ? 'pitch_ready' : 'mockup_ready')
      : 'failed'

    await db.execute({
      sql: `UPDATE mockups SET
        status = ?, mockup_url = COALESCE(?, mockup_url),
        mockup_version = COALESCE(?, mockup_version),
        pitch_draft = COALESCE(?, pitch_draft),
        pitch_version = COALESCE(?, pitch_version),
        n8n_synced_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`,
      args: [
        status,
        mockupUrl,
        lead.mockup_version != null ? Number(lead.mockup_version) : null,
        asLeadString(lead.pitch_draft),
        lead.pitch_version != null ? Number(lead.pitch_version) : null,
        mockupId,
        userId
      ]
    })

    return true
  } catch {
    return false
  }
}
