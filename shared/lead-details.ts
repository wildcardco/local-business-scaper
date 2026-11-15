import { googlePlaceIdFrom } from './gbp-listing.ts'
import {
  digestLeadFields,
  normalizeDigestTier,
  normalizePhotoCount,
  type DigestBusinessSnapshot
} from './digest-ingest.ts'
import { gbpPhotoUrls } from './lead-context.ts'
import { researchOwnerSlug } from './research-report.ts'
import type { StudioOwnerSlug } from './studio-owners.ts'

export const LEAD_DETAILS_ACTION = 'lead_details' as const
export const LEAD_DETAILS_TIMEOUT_MS = 15_000
export const LEAD_DETAILS_UNAVAILABLE = 'Lookup not available yet'
export const LEAD_DETAILS_NOT_FOUND = 'No saved details found for this lead'
export const LEAD_DETAILS_SECRET = 'Studio rejected the webhook secret. Check N8N_STUDIO_SECRET.'
export const LEAD_DETAILS_NO_PLACE = 'No Google place ID'
export const LEAD_DETAILS_TIMEOUT = 'The lookup did not answer in time. Try again.'
export const LEAD_DETAILS_UPDATED = 'Details updated'

export interface LeadDetailsRequest {
  action: typeof LEAD_DETAILS_ACTION
  place_id: string
  owner?: StudioOwnerSlug
}

export interface LeadDetailsMerge {
  /** Null means leave businesses.email unchanged. */
  email: string | null
  /** Null means leave contacts_data unchanged. */
  contactsData: string | null
  /** Null means leave photo_count unchanged. */
  photoCount: number | null
  /** JSON text, or null to leave gbp_photos unchanged. An empty lookup never clears stored photos. */
  gbpPhotos: string | null
  /** Set only when the business has no phone yet. */
  phone: string | null
  leadGroup: string | null
  angle: string | null
  score: number | null
  tier: { slug: string, label: string } | null
  /** JSON text for digest signals, or null to leave them unchanged. */
  signals: string | null
}

export interface StoredLeadSnapshot extends DigestBusinessSnapshot {
  phone?: unknown
  photo_count?: unknown
  gbp_photos?: unknown
  signals?: unknown
}

export type LeadDetailsOutcome
  = { kind: 'found', details: Record<string, unknown> }
    | { kind: 'missing' }
    | { kind: 'unavailable' }
    | { kind: 'secret' }
    | { kind: 'error', message: string }

export function leadDetailsRequest(input: {
  owner?: unknown
  placeId: unknown
}): { ok: true, body: LeadDetailsRequest } | { ok: false, message: typeof LEAD_DETAILS_NO_PLACE } {
  const placeId = googlePlaceIdFrom(input.placeId)
  if (!placeId) return { ok: false, message: LEAD_DETAILS_NO_PLACE }
  const owner = researchOwnerSlug(input.owner)
  const body: LeadDetailsRequest = {
    action: LEAD_DETAILS_ACTION,
    place_id: placeId
  }
  if (owner) body.owner = owner
  return { ok: true, body }
}

export function leadDetailsTransportError(name: unknown): string | null {
  if (name === 'TimeoutError' || name === 'AbortError') return LEAD_DETAILS_TIMEOUT
  return null
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function unknownAction(status: number, body: Record<string, unknown> | null): boolean {
  if (status === 404) return true
  if (!body) return false
  const blob = [body.message, body.error, body.hint]
    .filter((item): item is string => typeof item === 'string')
    .join(' ')
  if (/unknown action|unrecognized action|action not (?:found|supported|registered)|not implemented/i.test(blob)) {
    return true
  }
  return body.ok === false && typeof body.action === 'string' && body.action !== LEAD_DETAILS_ACTION
}

/** Map an n8n HTTP result. Does not throw and does not include the response body in messages. */
export function interpretLeadDetailsHttp(status: number, body: unknown): LeadDetailsOutcome {
  if (status === 401 || status === 403) return { kind: 'secret' }
  const record = recordOf(body)
  if (unknownAction(status, record)) return { kind: 'unavailable' }
  if (status >= 400) return { kind: 'error', message: `Lookup failed (${status}).` }
  if (!record || record.ok !== true) return { kind: 'error', message: 'Lookup returned an unexpected response.' }
  if (record.found === false) return { kind: 'missing' }
  if (record.found === true) return { kind: 'found', details: record }
  return { kind: 'error', message: 'Lookup returned an unexpected response.' }
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function existingPhone(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** Keep the E.164 string n8n sent. Drop blanks and values that are not a phone. */
function incomingPhone(value: unknown): string | null {
  const raw = text(value)
  if (!raw || raw.length > 32) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return raw
}

function scoreOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

function parsedPhotos(value: unknown): unknown[] {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? value : []
}

function signalsObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string' && value.trim()) {
    try {
      return signalsObject(JSON.parse(value))
    } catch {
      return {}
    }
  }
  const record = recordOf(value)
  return record ? { ...record } : {}
}

/**
 * Apply a lead_details body on top of a saved lead.
 * A missing or empty incoming value never clears a saved email, phone, photo count, photo list, or digest field.
 */
export function mergeLeadDetails(existing: StoredLeadSnapshot, incoming: Record<string, unknown>): LeadDetailsMerge {
  const fields = digestLeadFields(incoming, existing)
  const savedCount = normalizePhotoCount(existing.photo_count)
  let photoCount = fields.photoCount
  if (photoCount === 0 && savedCount && savedCount > 0) photoCount = null

  let gbpPhotos = fields.gbpPhotos
  if (gbpPhotos) {
    const next = parsedPhotos(gbpPhotos)
    const nextUrls = gbpPhotoUrls(next)
    const savedUrls = gbpPhotoUrls(parsedPhotos(existing.gbp_photos))
    if (next.length === 0) gbpPhotos = null
    else if (nextUrls.length === 0 && savedUrls.length > 0) gbpPhotos = null
  }

  const savedPhone = existingPhone(existing.phone)
  const phone = savedPhone ? null : incomingPhone(incoming.phone)

  const siteCheck = text(incoming.site_check)
  let signals: string | null = null
  if (siteCheck) {
    const merged = signalsObject(existing.signals)
    merged.site_check = siteCheck
    signals = JSON.stringify(merged)
  }

  return {
    email: fields.email,
    contactsData: fields.contactsData,
    photoCount,
    gbpPhotos,
    phone,
    leadGroup: fields.leadGroup,
    angle: text(incoming.angle),
    score: scoreOf(incoming.score),
    tier: normalizeDigestTier(incoming.tier),
    signals
  }
}
