import {
  STOCK_PROVIDER_LABEL,
  interleavePhotos,
  mapPexelsPhoto,
  mapPixabayHit,
  mapUnsplashPhoto,
  extractPhotoQueries,
  type StockPhoto,
  type StockProvider,
  type StockProviderNotice
} from '~~/shared/stock-photos'

const PER_PAGE = '12'
const TIMEOUT_MS = 8000

interface ProviderResult {
  provider: StockProvider
  photos: StockPhoto[]
  notice: StockProviderNotice | null
}

function configuredKey(configValue: unknown, names: string[]): string {
  if (typeof configValue === 'string' && configValue.trim()) return configValue.trim()
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

function stockKeys() {
  const config = useRuntimeConfig()
  return {
    pixabay: configuredKey(config.pixabayApiKey, ['PIXABAY_API_KEY', 'PIXABAY_KEY']),
    pexels: configuredKey(config.pexelsApiKey, ['PEXELS_API_KEY', 'PEXELS_KEY']),
    unsplash: configuredKey(config.unsplashAccessKey, ['UNSPLASH_ACCESS_KEY', 'UNSPLASH_API_KEY', 'UNSPLASH_KEY'])
  }
}

function skipped(provider: StockProvider): ProviderResult {
  const label = STOCK_PROVIDER_LABEL[provider]
  return {
    provider,
    photos: [],
    notice: {
      provider,
      status: 'skipped',
      message: `${label} is skipped because no API key is configured.`
    }
  }
}

function failed(provider: StockProvider): ProviderResult {
  const label = STOCK_PROVIDER_LABEL[provider]
  return {
    provider,
    photos: [],
    notice: {
      provider,
      status: 'error',
      message: `${label} did not return results.`
    }
  }
}

function takePhotos(photos: Array<StockPhoto | null>): StockPhoto[] {
  return photos.filter((photo): photo is StockPhoto => photo !== null).slice(0, 12)
}

async function searchPixabay(query: string, apiKey: string): Promise<ProviderResult> {
  if (!apiKey) return skipped('pixabay')
  try {
    const endpoint = new URL('https://pixabay.com/api/')
    endpoint.searchParams.set('key', apiKey)
    endpoint.searchParams.set('q', query)
    endpoint.searchParams.set('image_type', 'photo')
    endpoint.searchParams.set('safesearch', 'true')
    endpoint.searchParams.set('per_page', PER_PAGE)
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) return failed('pixabay')
    const body = await response.json() as { hits?: unknown }
    const hits = Array.isArray(body.hits) ? body.hits : []
    return { provider: 'pixabay', photos: takePhotos(hits.map(mapPixabayHit)), notice: null }
  } catch {
    return failed('pixabay')
  }
}

async function searchPexels(query: string, apiKey: string): Promise<ProviderResult> {
  if (!apiKey) return skipped('pexels')
  try {
    const endpoint = new URL('https://api.pexels.com/v1/search')
    endpoint.searchParams.set('query', query)
    endpoint.searchParams.set('per_page', PER_PAGE)
    const response = await fetch(endpoint, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!response.ok) return failed('pexels')
    const body = await response.json() as { photos?: unknown }
    const photos = Array.isArray(body.photos) ? body.photos : []
    return { provider: 'pexels', photos: takePhotos(photos.map(mapPexelsPhoto)), notice: null }
  } catch {
    return failed('pexels')
  }
}

async function searchUnsplash(query: string, apiKey: string): Promise<ProviderResult> {
  if (!apiKey) return skipped('unsplash')
  try {
    const endpoint = new URL('https://api.unsplash.com/search/photos')
    endpoint.searchParams.set('query', query)
    endpoint.searchParams.set('per_page', PER_PAGE)
    endpoint.searchParams.set('content_filter', 'high')
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
        'Accept-Version': 'v1'
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!response.ok) return failed('unsplash')
    const body = await response.json() as { results?: unknown }
    const results = Array.isArray(body.results) ? body.results : []
    return { provider: 'unsplash', photos: takePhotos(results.map(mapUnsplashPhoto)), notice: null }
  } catch {
    return failed('unsplash')
  }
}

export async function searchStockPhotos(query: string): Promise<{ photos: StockPhoto[], notices: StockProviderNotice[] }> {
  const keys = stockKeys()
  const results = await Promise.all([
    searchPixabay(query, keys.pixabay),
    searchPexels(query, keys.pexels),
    searchUnsplash(query, keys.unsplash)
  ])
  return {
    photos: interleavePhotos(results.map(result => result.photos)),
    notices: results.flatMap(result => result.notice ? [result.notice] : [])
  }
}

export async function trackUnsplashDownloads(ids: string[]): Promise<number> {
  const apiKey = stockKeys().unsplash
  if (!apiKey || ids.length === 0) return 0
  const results = await Promise.all(ids.map(async (id) => {
    try {
      const response = await fetch(`https://api.unsplash.com/photos/${id}/download`, {
        headers: {
          'Authorization': `Client-ID ${apiKey}`,
          'Accept-Version': 'v1'
        },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      return response.ok
    } catch {
      return false
    }
  }))
  return results.filter(Boolean).length
}

function isFetchableMockupUrl(value: string | null | undefined): string | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (
      host.startsWith('10.')
      || host.startsWith('127.')
      || host.startsWith('192.168.')
      || host.startsWith('169.254.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) return null
  }
  return url.toString()
}

export async function readMockupPhotoQueries(mockupUrl: string | null | undefined): Promise<string[]> {
  const url = isFetchableMockupUrl(mockupUrl)
  if (!url) return []
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'accept': 'text/html',
        'user-agent': 'wildcard-studio'
      }
    })
    if (!response.ok) return []
    if (!isFetchableMockupUrl(response.url)) return []
    const html = await response.text()
    return extractPhotoQueries(html.slice(0, 1_500_000))
  } catch {
    return []
  }
}
