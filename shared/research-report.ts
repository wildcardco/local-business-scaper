import { googlePlaceIdFrom } from './gbp-listing.ts'
import { STUDIO_OWNERS, type StudioOwnerSlug } from './studio-owners.ts'

export const RESEARCH_ACTION = 'research_report' as const
export const RESEARCH_STUDIO_WEBHOOK_PATH = '/webhook/studio'
export const RESEARCH_WEB_STACK_WEBHOOK_PATH = '/webhook/web-stack-v2'
export const RESEARCH_NOTES_MAX = 2000

export const RESEARCH_NEEDS_LISTING = 'This lead has no Google place id. Match the Google listing first. That search does not start a mockup or a research report.'
export const RESEARCH_PENDING_MESSAGE = 'A research report is already requested for this lead. The button stays off until that report is marked complete.'
export const RESEARCH_CONFIRM_COPY = 'This run costs money. n8n emails the report to the lead\'s owner a few minutes later. It does not build a one-page mockup or a Web Stack site.'

export interface ResearchReportBody {
  action: typeof RESEARCH_ACTION
  owner: StudioOwnerSlug
  place_id: string
  callback_url?: string
  notes?: string
}

export type ResearchStatus = 'requested' | 'complete'

export function researchStatusFrom(value: unknown): ResearchStatus | null {
  return value === 'requested' || value === 'complete' ? value : null
}

export function researchOwnerSlug(value: unknown): StudioOwnerSlug | null {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  if (!text) return null
  const match = STUDIO_OWNERS.find(owner => owner.slug === text || owner.email === text)
  return match ? match.slug : null
}

export function researchRequestBlock(status: unknown) {
  return researchStatusFrom(status) === 'requested' ? RESEARCH_PENDING_MESSAGE : null
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
