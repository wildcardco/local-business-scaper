import { normalizeStockQuery } from '~~/shared/stock-photos'
import { searchStockPhotos } from '~~/server/utils/stock-photos'

export default defineEventHandler(async (event) => {
  const query = normalizeStockQuery(getQuery(event).q)
  if (!query) {
    throw createError({ statusCode: 400, message: 'Enter at least 2 characters to search photos' })
  }

  return searchStockPhotos(query)
})
