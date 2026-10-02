import { slotOrderedPhotoUrls } from '~~/shared/photo-slots'
import { fireMockupAction, getMockupForUser } from '~~/server/utils/mockups'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const ordered = body?.ordered === true
  const photoUrls = ordered
    ? slotOrderedPhotoUrls(body?.photoUrls)
    : Array.isArray(body?.photoUrls)
      ? body.photoUrls.filter((url: unknown) => typeof url === 'string' && url.trim().startsWith('http')).map((url: string) => url.trim())
      : []

  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }
  if (!photoUrls.some((url: string) => url.startsWith('http'))) {
    throw createError({ statusCode: 400, message: 'At least one photo URL is required' })
  }

  const existing = await getMockupForUser(id, user.id)
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  // Slot order keeps the hero at index 0. Empty strings are open slots, so a
  // later slot does not slide forward. Leftover slots stay empty.
  const nextUrls = ordered
    ? photoUrls
    : [...new Set([...existing.photoUrls, ...photoUrls])]

  const mockup = await fireMockupAction({
    event,
    user: { id: user.id, email: user.email },
    mockupId: id,
    action: 'add_photos',
    photoUrls: nextUrls
  })

  return { success: true, mockup }
})
