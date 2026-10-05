import { normalizeStockQuery, type StockProvider } from '~~/shared/stock-photos'
import { searchStockPhotos } from '~~/server/utils/stock-photos'

const PROVIDERS = new Set<StockProvider>(['pixabay', 'pexels', 'unsplash'])

export default defineEventHandler(async (event) => {
  const query = normalizeStockQuery(getQuery(event).q)
  if (!query) {
    throw createError({ statusCode: 400, message: 'Enter at least 2 characters to search photos' })
  }

  const raw = getQuery(event).sources
  const sources = typeof raw === 'string'
    ? raw.split(',').map(item => item.trim().toLowerCase()).filter((item): item is StockProvider => PROVIDERS.has(item as StockProvider))
    : undefined

  return searchStockPhotos(query, sources?.length ? sources : undefined)
})
