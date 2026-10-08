import { applyImageSpotPhotos, type ImageSpotUpdate } from '~~/shared/mockup-image-spots'
import { db } from '~~/server/utils/db'
import { commitMockupIndex } from '~~/server/utils/github-mockup'
import { getMockupForUser } from '~~/server/utils/mockups'
import { readMockupHtml } from '~~/server/utils/stock-photos'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  if (!id) throw createError({ statusCode: 400, message: 'Mockup ID is required' })

  const mockup = await getMockupForUser(id, user.id)
  if (!mockup) throw createError({ statusCode: 404, message: 'Mockup not found' })
  if (!mockup.vercelUrl) {
    throw createError({ statusCode: 400, message: 'This mockup has no live page to update.' })
  }
  if (!mockup.githubRepo) {
    throw createError({
      statusCode: 400,
      message: 'This mockup has no GitHub repo on file, so the page cannot be saved in place.'
    })
  }

  const updates = normalizeUpdates(body?.slots)
  if (!updates.length) {
    throw createError({ statusCode: 400, message: 'Assign at least one photo to a spot on the page.' })
  }

  const html = await readMockupHtml(mockup.vercelUrl)
  if (!html) {
    throw createError({ statusCode: 502, message: 'The live page could not be read.' })
  }

  const patched = applyImageSpotPhotos(html, updates)
  if (!patched.applied) {
    throw createError({
      statusCode: 400,
      message: 'None of those spots are images on the page. Name a spot that is already there, or regenerate if you need new sections.'
    })
  }

  const saved = await commitMockupIndex(
    mockup.githubRepo,
    patched.html,
    `Swap photos on ${updates.length} slot${updates.length === 1 ? '' : 's'}`
  )

  const urls = updates.map(update => update.url)
  await db.execute({
    sql: `UPDATE mockups SET photo_urls = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
    args: [JSON.stringify(urls), id, user.id]
  })

  return {
    success: true,
    applied: patched.applied,
    commit: saved.commit,
    mockup: await getMockupForUser(id, user.id)
  }
})

function normalizeUpdates(raw: unknown): ImageSpotUpdate[] {
  if (!Array.isArray(raw)) return []
  const updates: ImageSpotUpdate[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const index = Number(row.index)
    const url = typeof row.url === 'string' ? row.url.trim() : ''
    const label = typeof row.label === 'string' ? row.label : ''
    const key = typeof row.key === 'string' ? row.key : ''
    if (!Number.isInteger(index) || index < 0 || index > 23) continue
    if (!/^https?:\/\//i.test(url)) continue
    updates.push({ index, key, label, url })
  }
  return updates
}
