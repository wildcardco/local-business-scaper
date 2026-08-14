import { getMockupForUser } from '~~/server/utils/mockups'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }

  const mockup = await getMockupForUser(id, user.id)
  if (!mockup) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  return { success: true, mockup }
})
