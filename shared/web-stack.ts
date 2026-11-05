import type { JobPhase } from './studio-job'

/** Plain HTML Studio page. This is the default and keeps the current n8n workflow. */
export const BUILD_MODE_HTML = 'html' as const

/** React + Vite + Tailwind, built by a Cursor Cloud Agent. */
export const BUILD_MODE_WEB_STACK = 'web_stack' as const

export type BuildMode = typeof BUILD_MODE_HTML | typeof BUILD_MODE_WEB_STACK

export const WEB_STACK_AGENT_MODEL = 'grok-4.7'
export const WEB_STACK_STACK = 'react-vite-tailwind'

/** Sent only when N8N_WEB_STACK_SECRET is set. Never log the value. */
export const WEB_STACK_SECRET_HEADER = 'X-Web-Stack-Secret'

const CURSOR_AGENTS_ORIGIN = 'https://cursor.com/agents/'
const AGENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/

const FAILED_STATUS = new Set(['failed', 'error', 'errored', 'canceled', 'cancelled', 'crashed', 'failure'])
const READY_STATUS = new Set(['ready', 'success', 'succeeded', 'completed', 'complete', 'done', 'finished', 'mockup_ready'])
const RUNNING_STATUS = new Set(['building', 'running', 'queued', 'pending', 'started', 'in_progress', 'generating', 'accepted', 'working', 'created'])

export interface WebStackLeadFields {
  build_mode: typeof BUILD_MODE_WEB_STACK
  stack: typeof WEB_STACK_STACK
  agent_model: typeof WEB_STACK_AGENT_MODEL
  on_demand_fallback: false
}

export interface WebStackWebhookFields {
  agentId: string | null
  agentUrl: string | null
  previewUrl: string | null
  rawStatus: string | null
  status: 'generating' | 'mockup_ready' | 'failed'
  error: string | null
}

export function parseBuildMode(value: unknown): BuildMode {
  if (typeof value === 'string' && value.trim() === BUILD_MODE_WEB_STACK) return BUILD_MODE_WEB_STACK
  return BUILD_MODE_HTML
}

export function webStackLeadFields(): WebStackLeadFields {
  return {
    build_mode: BUILD_MODE_WEB_STACK,
    stack: WEB_STACK_STACK,
    agent_model: WEB_STACK_AGENT_MODEL,
    on_demand_fallback: false
  }
}

/** Plain HTML returns the same object. Web stack adds the build contract and keeps every lead field. */
export function leadPayloadForBuild<T extends object>(payload: T, mode: unknown): T | (T & WebStackLeadFields) {
  if (parseBuildMode(mode) !== BUILD_MODE_WEB_STACK) return payload
  return { ...payload, ...webStackLeadFields() }
}

export function webStackSecretHeader(secret: unknown): string | null {
  const value = typeof secret === 'string' ? secret.trim() : ''
  return value || null
}

export function webStackWebhookUrl(raw: unknown): { ok: true, url: string } | { ok: false, message: string } {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) {
    return {
      ok: false,
      message: 'N8N_WEB_STACK_WEBHOOK_URL is not configured. Web stack posts the same lead payload with build_mode set to web_stack. It does not use the plain HTML studio webhook and does not fall back to another model.'
    }
  }

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, message: 'N8N_WEB_STACK_WEBHOOK_URL is not a valid URL.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, message: 'N8N_WEB_STACK_WEBHOOK_URL must be an http or https URL.' }
  }
  if (url.username || url.password) {
    return { ok: false, message: 'N8N_WEB_STACK_WEBHOOK_URL must not include a username or password.' }
  }
  return { ok: true, url: url.toString() }
}

export function cursorAgentUrl(agentId: unknown): string | null {
  const id = sanitizeAgentId(agentId)
  if (!id) return null
  return `${CURSOR_AGENTS_ORIGIN}${id}`
}

export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > 2000) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function isWebStackCallback(body: unknown): boolean {
  const record = webhookRecord(body)
  if (record.build_mode === BUILD_MODE_WEB_STACK) return true
  if (present(record.agent_id) || present(record.agent_url) || present(record.preview_url)) return true
  return false
}

export function readWebStackWebhook(body: unknown): WebStackWebhookFields {
  const record = webhookRecord(body)
  const agentFromId = sanitizeAgentId(record.agent_id)
  const agentFromUrl = agentIdFromCursorUrl(record.agent_url)
  const agentId = agentFromId || agentFromUrl
  const error = readErrorField(record.error)
  const rawStatus = typeof record.status === 'string' && record.status.trim()
    ? record.status.trim().slice(0, 80)
    : null

  return {
    agentId,
    agentUrl: cursorAgentUrl(agentId),
    previewUrl: httpsUrl(record.preview_url),
    rawStatus,
    status: normalizeWebStackStatus(rawStatus, error),
    error
  }
}

export function normalizeWebStackStatus(raw: string | null, error: string | null): 'generating' | 'mockup_ready' | 'failed' {
  const key = (raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (FAILED_STATUS.has(key)) return 'failed'
  if (READY_STATUS.has(key)) return 'mockup_ready'
  if (error && !RUNNING_STATUS.has(key)) return 'failed'
  return 'generating'
}

export function webStackStatusLabel(status: string, raw?: string | null): string {
  const source = (raw || '').trim()
  if (status === 'generating' && source) {
    const words = source.replace(/[_-]+/g, ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
  }
  if (status === 'generating' || status === 'revising' || status === 'enhancing') return 'Building'
  if (status === 'mockup_ready') return 'Ready'
  if (status === 'failed') return 'Failed'
  const words = status.replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Building'
}

export function webStackJobView(input: {
  posting: boolean
  status: string
  error?: string | null
}): { phase: JobPhase, label: string, detail: string } {
  if (input.posting) {
    return {
      phase: 'sending',
      label: 'Sending to n8n',
      detail: 'The lead is going to the web stack webhook.'
    }
  }
  if (input.status === 'generating' || input.status === 'revising' || input.status === 'enhancing') {
    return {
      phase: 'building',
      label: 'Building web stack',
      detail: 'A Cursor Cloud Agent is building React, Vite, and Tailwind on grok-4.7. There is no on-demand fallback.'
    }
  }
  if (input.status === 'failed') {
    return {
      phase: 'failed',
      label: 'Failed',
      detail: (input.error || '').trim() || 'The web stack build did not finish.'
    }
  }
  if (input.status === 'mockup_ready') {
    return {
      phase: 'ready',
      label: 'Ready',
      detail: 'The web stack preview is ready.'
    }
  }
  return { phase: 'idle', label: '', detail: '' }
}

function present(value: unknown) {
  return typeof value === 'string' ? value.trim() !== '' : value != null && value !== ''
}

function sanitizeAgentId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  if (!AGENT_ID.test(id)) return null
  return id
}

function agentIdFromCursorUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'cursor.com') return null
    const match = url.pathname.match(/^\/agents\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/?$/)
    return match?.[1] || null
  } catch {
    return null
  }
}

function readErrorField(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim()
    return text ? text.slice(0, 500) : null
  }
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    const text = value.message.trim()
    return text ? text.slice(0, 500) : null
  }
  return null
}

function hasWebhookFields(record: Record<string, unknown>) {
  return 'agent_id' in record
    || 'agent_url' in record
    || 'preview_url' in record
    || 'build_mode' in record
    || typeof record.status === 'string'
    || 'error' in record
}

function webhookRecord(body: unknown): Record<string, unknown> {
  if (Array.isArray(body)) return webhookRecord(body[0])
  if (!body || typeof body !== 'object') return {}
  const record = body as Record<string, unknown>
  if (hasWebhookFields(record)) return record
  const nested = record.json ?? record.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return webhookRecord(nested)
  return record
}
