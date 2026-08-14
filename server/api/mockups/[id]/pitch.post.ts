import { fireMockupAction } from '~~/server/utils/mockups'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }

  const mockup = await fireMockupAction({
    event,
    user: { id: user.id, email: user.email },
    mockupId: id,
    action: 'write_pitch'
  })

  return { success: true, mockup }
})
