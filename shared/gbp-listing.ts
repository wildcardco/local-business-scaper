/**
 * Google listing fields the existing mockup workflow uses for photos.
 * RapidAPI business-details and business-photos supply these. The studio
 * webhook does not. A hex business id is what the photo fetch expects.
 * `photo_urls` stays the uploaded slots and is not filled from these photos.
 */

const HEX_BUSINESS_ID = /^0x[0-9a-f]+:0x[0-9a-f]+$/i
const GOOGLE_PLACE_ID = /^ChIJ[A-Za-z0-9_-]{8,}$/

export interface GbpPhoto {
  id: string
  url: string
  type: string | null
  ts: string | null
}

export function googleBusinessIdFrom(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return HEX_BUSINESS_ID.test(trimmed) ? trimmed : null
}

export function googlePlaceIdFrom(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return GOOGLE_PLACE_ID.test(trimmed) ? trimmed : null
}

function text(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return ''
  return value.trim()
}

function httpUrl(value: unknown) {
  const raw = text(value)
  return /^https?:\/\//i.test(raw) ? raw : ''
}

export function gbpPhotosFrom(value: unknown, limit = 12): GbpPhoto[] {
  if (!Array.isArray(value)) return []
  const photos: GbpPhoto[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const url = httpUrl(row.photo_url_large) || httpUrl(row.photo_url) || httpUrl(row.url)
    const id = text(row.photo_id) || text(row.id)
    if (!url || !id || seen.has(id)) continue
    seen.add(id)
    photos.push({
      id,
      url,
      type: text(row.type) || null,
      ts: text(row.ts) || text(row.photo_timestamp) || text(row.timestamp) || null
    })
    if (photos.length >= limit) break
  }
  return photos
}

export function photoCountFrom(count: unknown, photos: GbpPhoto[]): number | null {
  if (typeof count === 'number' && Number.isFinite(count) && count >= 0) return Math.trunc(count)
  if (typeof count === 'string' && /^\d+$/.test(count.trim())) return Number(count.trim())
  if (!photos.length) return null
  return photos.length
}

export interface GbpWebhookSource {
  appBusinessId?: string | null
  googleBusinessId?: string | null
  photos?: unknown
  photoCount?: number | null
}

export interface GbpWebhookFields {
  business_id: string | null
  photo_count?: number
  gbp_photos?: GbpPhoto[]
}

/** Hex id replaces the app id. Without one, the app id stays so older leads are unchanged. */
export function gbpWebhookFields(source: GbpWebhookSource): GbpWebhookFields {
  const googleBusinessId = googleBusinessIdFrom(source.googleBusinessId)
  const photos = gbpPhotosFrom(source.photos)
  const photoCount = photoCountFrom(source.photoCount, photos)
  const fields: GbpWebhookFields = {
    business_id: googleBusinessId || text(source.appBusinessId) || null
  }
  if (photoCount == null && !photos.length) return fields
  fields.photo_count = photoCount ?? photos.length
  fields.gbp_photos = photos
  return fields
}

export type SiteExtractionStatus = 'no-website' | 'identity-missing' | 'unverified'

export function siteExtractionStatus(input: {
  website?: string | null
  phone?: string | null
  address?: string | null
}): { status: SiteExtractionStatus, title: string, message: string } {
  const website = text(input.website)
  if (!website) {
    return {
      status: 'no-website',
      title: 'No website to read',
      message: 'There is no website on this request, so the one-page workflow is not asked to read a current site.'
    }
  }
  const phoneOk = text(input.phone).replace(/\D/g, '').length >= 10
  const address = text(input.address)
  const zipOk = /\b\d{5}(?:-\d{4})?\b/.test(address)
  const streetOk = /\d/.test(address)
  if (!phoneOk && !zipOk && !streetOk) {
    return {
      status: 'identity-missing',
      title: 'Site images will be discarded',
      message: 'The one-page workflow keeps a logo or photo only when the phone, street, or ZIP appears on the homepage. This request has none of those. This screen did not open the live page, and it does not claim those assets were used.'
    }
  }
  return {
    status: 'unverified',
    title: 'Live page was not opened here',
    message: 'The one-page workflow will look for this phone, street, or ZIP on the homepage. This app did not fetch the page. A Cloudflare "Just a moment" check can still block the navigation and images. This screen does not claim those assets were used.'
  }
}

export function gbpPhotoMessage(input: { failed: boolean, count: number | null }): string {
  if (input.failed && (input.count == null || input.count === 0)) {
    return 'Google photos did not load. Generation can still run. Uploaded photo slots stay empty.'
  }
  if (input.failed) {
    return 'The photo endpoint did not answer. Using the photos included on the listing. Uploaded photo slots stay empty.'
  }
  if (!input.count) {
    return 'The Google listing returned no photos. Generation can still run. Uploaded photo slots stay empty.'
  }
  const label = input.count === 1 ? 'photo' : 'photos'
  return `Loaded ${input.count} Google ${label}. They are sent as gbp_photos. Uploaded photo slots stay empty.`
}
