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

  const response = await fetch(studioWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(studioSecret ? { 'X-Studio-Secret': studioSecret } : {})
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw createError({
      statusCode: 502,
      message: `Studio webhook failed (${response.status}): ${errorText.slice(0, 300)}`
    })
  }

  try {
    return await response.json()
  } catch {
    return { ok: true }
  }
}

function dataTableFilter(columnName: string, value: string) {
  return encodeURIComponent(JSON.stringify({
    type: 'and',
    filters: [{ columnName, condition: 'eq', value }]
  }))
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

export async function listN8nLeadsByOwner(email: string) {
  const owner = ownerSlugFromEmail(email)
  const { leadsTableId, projectId, apiKey } = n8nConfig()
  if (!apiKey) return []

  const filter = dataTableFilter('owner', owner)
  const paths = [
    `/api/v1/data-tables/${leadsTableId}/rows?filter=${filter}&limit=100`,
    `/api/v1/projects/${projectId}/data-tables/${leadsTableId}/rows?filter=${filter}&limit=100`
  ]

  for (const path of paths) {
    try {
      return extractTableRows(await n8nFetch(path))
    } catch {
      // try next
    }
  }

  return []
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
  const { leadsTableId, projectId, apiKey } = n8nConfig()
  if (!apiKey) return null

  const filter = dataTableFilter('place_id', placeId)
  const paths = [
    `/api/v1/data-tables/${leadsTableId}/rows?filter=${filter}&limit=20`,
    `/api/v1/projects/${projectId}/data-tables/${leadsTableId}/rows?filter=${filter}&limit=20`,
    `/api/v1/data-tables/${leadsTableId}/rows?search=${encodeURIComponent(placeId)}&limit=20`
  ]

  for (const path of paths) {
    try {
      const match = pickMatchingLead(extractTableRows(await n8nFetch(path)), placeId)
      if (match) return match
    } catch {
      // try next
    }
  }

  return null
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
      sql: 'SELECT status, mockup_url, mockup_version FROM mockups WHERE id = ? AND user_id = ?',
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

    if (!mockupUrl && n8nStatus !== 'failed') return false

    const busyLocal = ['generating', 'writing_pitch', 'enhancing', 'revising'].includes(localStatus)
    if (busyLocal && mockupUrl && localUrl === mockupUrl && n8nVersion <= localVersion) {
      const job = await findRunningFactoryJob({ placeId, mockupId })
      if (job.matched || (job.count > 0 && !job.inspected)) {
        return false
      }
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
