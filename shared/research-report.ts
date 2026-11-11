import { googlePlaceIdFrom } from './gbp-listing.ts'
import { STUDIO_OWNERS, type StudioOwnerSlug } from './studio-owners.ts'

export const RESEARCH_ACTION = 'research_report' as const
export const RESEARCH_STUDIO_WEBHOOK_PATH = '/webhook/studio'
export const RESEARCH_WEB_STACK_WEBHOOK_PATH = '/webhook/web-stack-v2'
export const RESEARCH_NOTES_MAX = 2000

export const RESEARCH_NEEDS_LISTING = 'This lead has no Google place id. Match the Google listing first. That search does not start a mockup or a research report.'
export const RESEARCH_PENDING_MESSAGE = 'A research report was just requested for this lead. The button stays off for about 15 minutes.'
export const RESEARCH_SENT_LABEL = 'Sent - check email'
export const RESEARCH_CALLBACK_WAIT_MS = 15 * 60 * 1000
export const RESEARCH_CALLBACK_WAIT_MINUTES = 15
export const RESEARCH_CONFIRM_COPY = 'This run costs money. The report is emailed a few minutes later. Right now every report is emailed to Ryan. If Studio never hears back, the lead shows Sent - check email after about 15 minutes and you can request another. It does not build a one-page mockup or a Web Stack site.'

export interface ResearchReportBody {
  action: typeof RESEARCH_ACTION
  owner: StudioOwnerSlug
  place_id: string
  callback_url?: string
  notes?: string
}

export type ResearchStatus = 'requested' | 'complete'
export type ResearchView = 'idle' | 'requested' | 'sent' | 'complete'

export function researchStatusFrom(value: unknown): ResearchStatus | null {
  return value === 'requested' || value === 'complete' ? value : null
}

/** SQLite `datetime('now')` is UTC with no zone. Treat that form as UTC. */
export function researchRequestedAtMs(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)
  const normalized = hasZone ? trimmed : `${trimmed.replace(' ', 'T')}Z`
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** The lead row is the source of truth once it has a status. A mockup row is only the fallback. */
export function preferredResearch(input: {
  businessStatus?: unknown
  businessRequestedAt?: unknown
  mockupStatus?: unknown
  mockupRequestedAt?: unknown
}) {
  const business = researchStatusFrom(input.businessStatus)
  if (business) {
    return {
      status: business,
      requestedAt: typeof input.businessRequestedAt === 'string' ? input.businessRequestedAt : null
    }
  }
  const mockup = researchStatusFrom(input.mockupStatus)
  return {
    status: mockup,
    requestedAt: mockup && typeof input.mockupRequestedAt === 'string' ? input.mockupRequestedAt : null
  }
}

export function researchView(status: unknown, requestedAt: unknown, now = Date.now()): ResearchView {
  const parsed = researchStatusFrom(status)
  if (parsed === 'complete') return 'complete'
  if (parsed !== 'requested') return 'idle'
  const at = researchRequestedAtMs(requestedAt)
  if (at == null) return 'requested'
  return now - at >= RESEARCH_CALLBACK_WAIT_MS ? 'sent' : 'requested'
}

export function researchOwnerSlug(value: unknown): StudioOwnerSlug | null {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  if (!text) return null
  const match = STUDIO_OWNERS.find(owner => owner.slug === text || owner.email === text)
  return match ? match.slug : null
}

export function researchRequestBlock(status: unknown, requestedAt?: unknown, now = Date.now()) {
  return researchView(status, requestedAt, now) === 'requested' ? RESEARCH_PENDING_MESSAGE : null
}

export function researchReportPayload(input: {
  owner: unknown
  placeId: unknown
  callbackUrl?: unknown
  notes?: unknown
}): { ok: true, body: ResearchReportBody, target: { method: 'POST', path: typeof RESEARCH_STUDIO_WEBHOOK_PATH, header: 'X-Studio-Secret' } }
  | { ok: false, reason: 'place' | 'owner' | 'notes', message: string } {
  const owner = researchOwnerSlug(input.owner)
  if (!owner) {
    return {
      ok: false,
      reason: 'owner',
      message: 'This lead has no Studio owner (ryan, chase, or aaron), so the report cannot be emailed.'
    }
  }

  const placeId = googlePlaceIdFrom(input.placeId)
  if (!placeId) {
    return { ok: false, reason: 'place', message: RESEARCH_NEEDS_LISTING }
  }

  const notes = typeof input.notes === 'string' ? input.notes.trim() : ''
  if (notes.length > RESEARCH_NOTES_MAX) {
    return {
      ok: false,
      reason: 'notes',
      message: `Notes must be ${RESEARCH_NOTES_MAX} characters or fewer.`
    }
  }

  const callback = typeof input.callbackUrl === 'string' ? input.callbackUrl.trim() : ''
  const body: ResearchReportBody = {
    action: RESEARCH_ACTION,
    owner,
    place_id: placeId
  }
  if (callback) body.callback_url = callback
  if (notes) body.notes = notes

  return {
    ok: true,
    body,
    target: {
      method: 'POST',
      path: RESEARCH_STUDIO_WEBHOOK_PATH,
      header: 'X-Studio-Secret'
    }
  }
}

export function parseResearchCallback(body: unknown): { ok: true, placeId: string }
  | { ok: false, message: string } {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null
  if (!record) return { ok: false, message: 'Research callback body is empty.' }
  if (record.ok === false) return { ok: false, message: 'Research callback reported ok:false.' }
  if (record.action !== RESEARCH_ACTION) {
    return { ok: false, message: 'Research callback action must be research_report.' }
  }
  const placeId = googlePlaceIdFrom(record.place_id)
  if (!placeId) return { ok: false, message: 'Research callback needs a Google place id.' }
  if (record.research_status !== 'complete') {
    return { ok: false, message: 'Research callback research_status must be complete.' }
  }
  return { ok: true, placeId }
}
