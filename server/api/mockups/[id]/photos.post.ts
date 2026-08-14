import { fireMockupAction, getMockupForUser } from '~~/server/utils/mockups'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((url: unknown) => typeof url === 'string' && url.startsWith('http'))
    : []

  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }
  if (photoUrls.length === 0) {
    throw createError({ statusCode: 400, message: 'At least one photo URL is required' })
  }

  const existing = await getMockupForUser(id, user.id)
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  const merged = [...new Set([...existing.photoUrls, ...photoUrls])]

  const mockup = await fireMockupAction({
    event,
    user: { id: user.id, email: user.email },
    mockupId: id,
    action: 'add_photos',
    photoUrls: merged
  })

  return { success: true, mockup }
})
