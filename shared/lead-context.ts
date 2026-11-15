import {
  normalizeDigestEmail,
  normalizeDigestEmails,
  normalizeGbpPhotos,
  normalizePhotoCount
} from './digest-ingest.ts'

const HTTP_URL_RE = /^https?:\/\/\S+$/i

export interface LeadScoreBadgeModel {
  label: string
  tone: 'hot' | 'warm' | 'cold' | 'skip' | 'unknown'
  color: 'error' | 'warning' | 'info' | 'neutral'
  icon: string
}

const SCORE_BADGES: Record<string, LeadScoreBadgeModel> = {
  hot: { label: 'Hot', tone: 'hot', color: 'error', icon: 'i-lucide-flame' },
  call_first: { label: 'Call First', tone: 'hot', color: 'error', icon: 'i-lucide-phone' },
  warm: { label: 'Warm', tone: 'warm', color: 'warning', icon: 'i-lucide-sun' },
  good: { label: 'Good', tone: 'warm', color: 'warning', icon: 'i-lucide-star' },
  cold: { label: 'Cold', tone: 'cold', color: 'info', icon: 'i-lucide-snowflake' },
  worth_a_look: { label: 'Worth a look', tone: 'cold', color: 'info', icon: 'i-lucide-eye' },
  long_shot: { label: 'Long shot', tone: 'skip', color: 'neutral', icon: 'i-lucide-minus-circle' },
  skip: { label: 'Skip', tone: 'skip', color: 'neutral', icon: 'i-lucide-minus-circle' }
}

export function leadCategoryKey(category: unknown): string {
  if (typeof category !== 'string') return ''
  return category.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/** Audit categories stay Hot/Warm/Cold/Skip. Digest tier slugs get their own labels. */
export function leadScoreBadge(category: unknown): LeadScoreBadgeModel {
  return SCORE_BADGES[leadCategoryKey(category)] || {
    label: 'Unknown',
    tone: 'unknown',
    color: 'neutral',
    icon: 'i-lucide-help-circle'
  }
}

/** Replaces the audit blurb when the stored category is a digest tier. */
export function leadScoreBlurb(category: unknown): string | null {
  const key = leadCategoryKey(category)
  if (key === 'call_first') return 'Call this one first'
  if (key === 'good') return 'Solid lead worth a conversation'
  if (key === 'worth_a_look') return 'Worth a closer look'
  if (key === 'long_shot') return 'Long shot'
  return null
}

export function scoreOutOf100(score: unknown): string {
  if (typeof score === 'number' && Number.isFinite(score)) return `${Math.round(score)}/100`
  if (typeof score === 'bigint') return `${Number(score)}/100`
  if (typeof score === 'string' && /^-?\d+$/.test(score.trim())) return `${Number(score.trim())}/100`
  return ''
}

export function leadGroupLabel(value: unknown): string {
  if (typeof value !== 'string') return ''
  const slug = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (slug === 'industrial') return 'Industrial'
  if (slug === 'nonprofit') return 'Nonprofit'
  if (slug === 'random') return 'Random'
  if (!slug) return ''
  return slug.replace(/_+/g, ' ').replace(/\b[a-z]/g, char => char.toUpperCase())
}

export function leadTypeLine(category: unknown, leadGroup: unknown): string {
  const name = typeof category === 'string' ? category.trim() : ''
  const group = leadGroupLabel(leadGroup)
  if (name && group) return `${name} · ${group}`
  return name || group
}

/** "+19185551234" and "19185551234" print as "(918) 555-1234". */
export function formatLeadPhone(value: unknown): string {
  const raw = typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
  if (!raw) return ''
  let digits = raw.replace(/\D/g, '')
  if (!digits || /^0+$/.test(digits)) return ''
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

export function phoneTelHref(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  return `tel:${raw.replace(/\s/g, '')}`
}

export function websiteHref(website: unknown): string | null {
  if (typeof website !== 'string') return null
  const trimmed = website.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function websiteLabel(website: unknown): string {
  const href = websiteHref(website)
  if (!href) return ''
  const match = href.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)
  return match?.[1] || href
}

export function leadAddressLine(address: unknown, city: unknown, state: unknown): string {
  const full = typeof address === 'string' ? address.trim() : ''
  const cityText = typeof city === 'string' ? city.trim() : ''
  const stateText = typeof state === 'string' ? state.trim() : ''
  const cityState = [cityText, stateText].filter(Boolean).join(', ')
  if (!full) return cityState
  if (!cityText || full.toLowerCase().includes(cityText.toLowerCase())) return full
  return cityState ? `${full}, ${cityState}` : full
}

export function siteCheckText(signals: unknown): string {
  if (!signals || typeof signals !== 'object') return ''
  const value = (signals as { site_check?: unknown }).site_check
  return typeof value === 'string' ? value.trim() : ''
}

function photoUrl(item: unknown): string {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object' || Array.isArray(item)) return ''
  const url = (item as { url?: unknown }).url
  return typeof url === 'string' ? url.trim() : ''
}

/** http(s) urls only. Missing or empty urls are skipped and never become an image src. */
export function gbpPhotoUrls(photos: unknown): string[] {
  const list = normalizeGbpPhotos(photos) || []
  const urls: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const url = photoUrl(item)
    if (!HTTP_URL_RE.test(url) || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}

export function displayPhotoCount(count: unknown, photos?: unknown): number {
  const stored = normalizePhotoCount(count) ?? 0
  return Math.max(stored, gbpPhotoUrls(photos).length)
}

export function googlePhotosNote(count: unknown, photos?: unknown): string {
  const stored = normalizePhotoCount(count)
  const urls = gbpPhotoUrls(photos)
  const total = urls.length === 0 ? (stored ?? 0) : Math.max(stored ?? 0, urls.length)
  if (total <= 0) return ''
  const noun = total === 1 ? 'photo' : 'photos'
  return `${total} Google ${noun} we can use in the mockup`
}

function emailsOnContacts(contacts: unknown): unknown {
  if (typeof contacts === 'string') {
    if (!contacts.trim()) return null
    try {
      return emailsOnContacts(JSON.parse(contacts))
    } catch {
      return null
    }
  }
  if (!contacts || typeof contacts !== 'object' || Array.isArray(contacts)) return null
  return (contacts as { emails?: unknown }).emails
}

/** Primary businesses.email first, then contacts_data.emails, without duplicates. */
export function leadEmails(email: unknown, contacts: unknown): string[] {
  const raw = emailsOnContacts(contacts)
  const list = normalizeDigestEmails(Array.isArray(raw) ? raw : []) || []
  const primary = normalizeDigestEmail(email)
  if (!primary) return list
  const rest = list.filter(item => item.toLowerCase() !== primary.toLowerCase())
  return [primary, ...rest]
}
