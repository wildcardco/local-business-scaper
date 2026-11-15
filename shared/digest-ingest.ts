/**
 * Optional WF-0 lead fields. Absent or invalid values are dropped.
 * They never reject the rest of the lead or the batch.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LEAD_GROUP_RE = /^[a-z][a-z0-9_-]{0,31}$/
const HTTP_URL_RE = /^https?:\/\/\S+$/i

/** Live lead_details returns at most 10 Google photos. */
export const GBP_PHOTO_LIMIT = 10

export function normalizeDigestEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null
  return trimmed
}

/**
 * Null when `emails` is absent or not an array.
 * An array (possibly empty) when the field was an array; invalid items are removed.
 */
export function normalizeDigestEmails(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const emails: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const email = normalizeDigestEmail(item)
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    emails.push(email)
  }
  return emails
}

/** Non-negative integer, or a string of digits. Floats and other types are dropped. */
export function normalizePhotoCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000) {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const count = Number(value.trim())
    if (count <= 1_000_000) return count
  }
  return null
}

/**
 * Array of http(s) URL strings and plain objects, or a JSON string of that array.
 * Objects are stored as sent (`{ id, url, type, ts }` from lead_details).
 * Null when the value is missing, not an array, or every item was invalid.
 * An empty array is kept so an explicit `[]` can clear stored photos.
 */
export function normalizeGbpPhotos(value: unknown): unknown[] | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.startsWith('[')) return null
    try {
      return normalizeGbpPhotos(JSON.parse(trimmed))
    } catch {
      return null
    }
  }
  if (!Array.isArray(value)) return null
  const photos: unknown[] = []
  for (const item of value) {
    if (photos.length >= GBP_PHOTO_LIMIT) break
    if (typeof item === 'string') {
      const url = item.trim()
      if (HTTP_URL_RE.test(url)) photos.push(url)
      continue
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) photos.push(item)
  }
  if (value.length > 0 && photos.length === 0) return null
  return photos
}

/** Short slug. `Industrial` and `industrial` both become `industrial`. */
export function normalizeLeadGroup(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const slug = value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!LEAD_GROUP_RE.test(slug)) return null
  return slug
}

function contactsObject(existingRaw: unknown): Record<string, unknown> {
  if (typeof existingRaw === 'string' && existingRaw.trim()) {
    try {
      const parsed = JSON.parse(existingRaw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...parsed as Record<string, unknown> }
      }
    } catch {
      return {}
    }
  }
  if (existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)) {
    return { ...existingRaw as Record<string, unknown> }
  }
  return {}
}

/** Union `emails` into contacts_data and leave every other key in place. */
export function mergeContactEmails(existingRaw: unknown, incoming: string[]): string {
  const contacts = contactsObject(existingRaw)
  const current = Array.isArray(contacts.emails) ? contacts.emails : []
  const merged: string[] = []
  const seen = new Set<string>()
  for (const item of [...current, ...incoming]) {
    const email = normalizeDigestEmail(item)
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(email)
  }
  contacts.emails = merged
  return JSON.stringify(contacts)
}

export interface DigestBusinessSnapshot {
  email?: unknown
  contacts_data?: unknown
}

export interface DigestLeadFields {
  /** Value to store. A saved non-empty email is returned when the payload has none. */
  email: string | null
  /** Null means leave contacts_data unchanged. */
  contactsData: string | null
  /** Null means leave photo_count unchanged. */
  photoCount: number | null
  /** JSON text to store, or null to leave gbp_photos unchanged. */
  gbpPhotos: string | null
  leadGroup: string | null
}

export function digestLeadFields(
  lead: Record<string, unknown>,
  existing?: DigestBusinessSnapshot
): DigestLeadFields {
  const explicitEmail = normalizeDigestEmail(lead.email)
  const emails = normalizeDigestEmails(lead.emails)
  const candidate = explicitEmail || emails?.[0] || null
  const savedEmail = typeof existing?.email === 'string' ? existing.email.trim() : ''
  const photos = normalizeGbpPhotos(lead.gbp_photos)

  return {
    email: candidate || savedEmail || null,
    contactsData: emails ? mergeContactEmails(existing?.contacts_data, emails) : null,
    photoCount: normalizePhotoCount(lead.photo_count),
    gbpPhotos: photos === null ? null : JSON.stringify(photos),
    leadGroup: normalizeLeadGroup(lead.lead_group)
  }
}
