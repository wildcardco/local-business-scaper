import { prepareMockupPreviewHtml } from '~~/shared/mockup-preview'
import { getMockupForUser } from '~~/server/utils/mockups'
import { readMockupHtml } from '~~/server/utils/stock-photos'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  if (!user) throw createError({ statusCode: 401, message: 'Sign in required' })
  if (!id) throw createError({ statusCode: 400, message: 'Mockup ID is required' })

  const mockup = await getMockupForUser(id, user.id)
  if (!mockup) throw createError({ statusCode: 404, message: 'Mockup not found' })
  if (!mockup.vercelUrl) throw createError({ statusCode: 404, message: 'This mockup has no live page yet' })

  const html = await readMockupHtml(mockup.vercelUrl)
  if (!html) throw createError({ statusCode: 502, message: 'The live mockup page could not be read' })

  const body = prepareMockupPreviewHtml(html, {
    pageUrl: mockup.vercelUrl,
    origin: getRequestURL(event).origin
  })
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'x-frame-options', 'SAMEORIGIN')
  return body
})
