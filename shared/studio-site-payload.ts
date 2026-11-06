/**
 * Fields the existing mockup workflow uses to read the business's current
 * website. The site check keeps navigation and images when the payload's
 * website is set and the address or phone can be found on that site.
 * Manual generation and the email/digest generation send this same shape.
 */

export interface StudioSiteSource {
  website?: string | null
  phone?: string | number | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  category?: string | null
  rating?: number | null
  reviewCount?: number | null
}

export interface StudioSiteResearch {
  website: string | null
  phone: string | null
  address: string | null
  category: string | null
  rating: number | null
  review_count: number | null
}

function clean(value: unknown) {
  if (value == null) return ''
  return String(value).trim()
}

export function studioLeadWebsite(value: unknown): string | null {
  const raw = clean(value)
  if (!raw) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

function hasZip(value: string) {
  return /\b\d{5}(?:-\d{4})?\b/.test(value)
}

/** Street, city, state, and ZIP in one line, without repeating a part already present. */
export function studioLeadAddress(input: Pick<StudioSiteSource, 'address' | 'city' | 'state' | 'zip'>): string | null {
  const street = clean(input.address)
  const city = clean(input.city)
  const state = clean(input.state)
  const zip = clean(input.zip)
  if (!street && !city && !state && !zip) return null
  if (street && hasZip(street)) return street

  const streetLower = street.toLowerCase()
  const cityInStreet = Boolean(city) && streetLower.includes(city.toLowerCase())
  if (street && cityInStreet) {
    return zip && !hasZip(street) ? `${street} ${zip}` : street
  }

  const region = [state, zip].filter(Boolean).join(' ')
  const town = [city, region].filter(Boolean).join(', ')
  if (street && town) return `${street}, ${town}`
  return street || town || null
}

export function studioSiteResearch(source: StudioSiteSource): StudioSiteResearch {
  const rating = typeof source.rating === 'number' && Number.isFinite(source.rating) ? source.rating : null
  const reviewCount = typeof source.reviewCount === 'number' && Number.isFinite(source.reviewCount)
    ? source.reviewCount
    : null
  return {
    website: studioLeadWebsite(source.website),
    phone: clean(source.phone) || null,
    address: studioLeadAddress(source),
    category: clean(source.category) || null,
    rating,
    review_count: reviewCount
  }
}
