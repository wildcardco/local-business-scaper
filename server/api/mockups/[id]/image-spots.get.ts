import { detectImageSpots } from '~~/shared/mockup-image-spots'
import { getMockupForUser } from '~~/server/utils/mockups'
import { readMockupHtml } from '~~/server/utils/stock-photos'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Mockup ID is required' })

  const mockup = await getMockupForUser(id, user.id)
  if (!mockup) throw createError({ statusCode: 404, message: 'Mockup not found' })
  if (!mockup.vercelUrl) {
    return { spots: [], error: 'No live mockup yet.' }
  }

  const html = await readMockupHtml(mockup.vercelUrl)
  if (!html) {
    return { spots: [], error: 'The live page could not be read.' }
  }

  return { spots: detectImageSpots(html) }
})
