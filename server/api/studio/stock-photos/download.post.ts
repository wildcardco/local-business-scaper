import { trackUnsplashDownloads } from '~~/server/utils/stock-photos'

const UNSPLASH_ID = /^[A-Za-z0-9_-]{1,64}$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const raw: unknown[] = Array.isArray(body?.ids) ? body.ids : []
  const ids: string[] = []
  for (const value of raw) {
    if (typeof value !== 'string' || !UNSPLASH_ID.test(value) || ids.includes(value)) continue
    ids.push(value)
    if (ids.length === 12) break
  }

  if (ids.length === 0) return { tracked: 0 }
  const tracked = await trackUnsplashDownloads(ids)
  return { tracked }
})
