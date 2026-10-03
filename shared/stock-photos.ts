export type StockProvider = 'pixabay' | 'pexels' | 'unsplash'

export interface StockPhoto {
  id: string
  sourceId: string
  provider: StockProvider
  url: string
  thumb: string
  pageUrl: string
  author: string
  authorUrl: string | null
  alt: string
}

export interface StockProviderNotice {
  provider: StockProvider
  status: 'skipped' | 'error'
  message: string
}

export const STOCK_PROVIDER_LABEL: Record<StockProvider, string> = {
  pixabay: 'Pixabay',
  pexels: 'Pexels',
  unsplash: 'Unsplash'
}

const IMAGE_HOSTS: Record<StockProvider, string[]> = {
  pixabay: ['cdn.pixabay.com', 'pixabay.com'],
  pexels: ['images.pexels.com'],
  unsplash: ['images.unsplash.com', 'plus.unsplash.com']
}

const PAGE_HOSTS: Record<StockProvider, string[]> = {
  pixabay: ['pixabay.com', 'www.pixabay.com'],
  pexels: ['pexels.com', 'www.pexels.com'],
  unsplash: ['unsplash.com', 'www.unsplash.com']
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Keep a URL only when the provider actually returned it on an image host. */
export function providerImageUrl(provider: StockProvider, value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!IMAGE_HOSTS[provider].includes(host)) return null
  return url.toString()
}

export function providerPageUrl(provider: StockProvider, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return ''
  }
  if (url.protocol !== 'https:') return ''
  if (url.username || url.password) return ''
  const host = url.hostname.toLowerCase()
  if (!PAGE_HOSTS[provider].includes(host)) return ''
  return url.toString()
}

function firstImage(provider: StockProvider, values: unknown[]): string | null {
  for (const value of values) {
    const url = providerImageUrl(provider, value)
    if (url) return url
  }
  return null
}

export function mapPixabayHit(hit: unknown): StockPhoto | null {
  const row = asRecord(hit)
  if (!row) return null
  const sourceId = typeof row.id === 'number' || typeof row.id === 'string' ? String(row.id) : ''
  if (!sourceId) return null
  const url = firstImage('pixabay', [row.largeImageURL, row.webformatURL])
  if (!url) return null
  const thumb = firstImage('pixabay', [row.previewURL, row.webformatURL]) || url
  return {
    id: `pixabay:${sourceId}`,
    sourceId,
    provider: 'pixabay',
    url,
    thumb,
    pageUrl: providerPageUrl('pixabay', row.pageURL),
    author: asText(row.user) || 'Pixabay contributor',
    authorUrl: null,
    alt: asText(row.tags) || 'Pixabay photo'
  }
}

export function mapPexelsPhoto(photo: unknown): StockPhoto | null {
  const row = asRecord(photo)
  if (!row) return null
  const sourceId = typeof row.id === 'number' || typeof row.id === 'string' ? String(row.id) : ''
  if (!sourceId) return null
  const src = asRecord(row.src)
  const url = firstImage('pexels', [src?.large2x, src?.large, src?.original])
  if (!url) return null
  const thumb = firstImage('pexels', [src?.tiny, src?.small, src?.medium]) || url
  return {
    id: `pexels:${sourceId}`,
    sourceId,
    provider: 'pexels',
    url,
    thumb,
    pageUrl: providerPageUrl('pexels', row.url),
    author: asText(row.photographer) || 'Pexels contributor',
    authorUrl: providerPageUrl('pexels', row.photographer_url) || null,
    alt: asText(row.alt) || 'Pexels photo'
  }
}

export function mapUnsplashPhoto(photo: unknown): StockPhoto | null {
  const row = asRecord(photo)
  if (!row) return null
  const sourceId = asText(row.id)
  if (!sourceId) return null
  const urls = asRecord(row.urls)
  const url = firstImage('unsplash', [urls?.regular, urls?.full, urls?.raw])
  if (!url) return null
  const thumb = firstImage('unsplash', [urls?.thumb, urls?.small]) || url
  const user = asRecord(row.user)
  const links = asRecord(row.links)
  const userLinks = asRecord(user?.links)
  return {
    id: `unsplash:${sourceId}`,
    sourceId,
    provider: 'unsplash',
    url,
    thumb,
    pageUrl: providerPageUrl('unsplash', links?.html),
    author: asText(user?.name) || 'Unsplash contributor',
    authorUrl: providerPageUrl('unsplash', userLinks?.html) || null,
    alt: asText(row.alt_description) || asText(row.description) || 'Unsplash photo'
  }
}

export function interleavePhotos(groups: StockPhoto[][]): StockPhoto[] {
  const photos: StockPhoto[] = []
  const seen = new Set<string>()
  const max = groups.reduce((length, group) => Math.max(length, group.length), 0)
  for (let index = 0; index < max; index++) {
    for (const group of groups) {
      const photo = group[index]
      if (!photo || seen.has(photo.url)) continue
      seen.add(photo.url)
      photos.push(photo)
    }
  }
  return photos
}

export function normalizeStockQuery(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const query = input.replace(/\s+/g, ' ').trim()
  if (query.length < 2) return null
  return query.slice(0, 120)
}

export { extractPhotoQueries, extractPhotoSlots, preferredSlotIndex, slotAfterAssign, slotOrderedPhotoUrls, slotLabel } from './photo-slots'
export type { PhotoSlot } from './photo-slots'
