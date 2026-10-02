import { getMockupForUser } from '~~/server/utils/mockups'
import { readMockupPhotoSlots } from '~~/server/utils/stock-photos'

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

  if (!mockup.vercelUrl) {
    return { queries: [], slots: [], error: 'No live mockup yet.' }
  }

  const slots = await readMockupPhotoSlots(mockup.vercelUrl)
  if (!slots.length) {
    return {
      queries: [],
      slots: [],
      error: 'The live page has no photo slots, or it could not be read.'
    }
  }

  return {
    queries: slots.map(slot => slot.query),
    slots
  }
})
