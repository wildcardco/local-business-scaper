import { getMockupForUser } from '~~/server/utils/mockups'
import { readMockupPhotoQueries } from '~~/server/utils/stock-photos'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  if (!user) {
    throw createError({ statusCode: 401, message: 'Sign in required' })
  }
  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }

  const mockup = await getMockupForUser(id, user.id)
  if (!mockup) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  const queries = await readMockupPhotoQueries(mockup.vercelUrl)
  return { queries }
})
