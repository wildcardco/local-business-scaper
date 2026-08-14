import { fireMockupAction } from '~~/server/utils/mockups'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }
  if (!notes) {
    throw createError({ statusCode: 400, message: 'Revision notes are required' })
  }

  const mockup = await fireMockupAction({
    event,
    user: { id: user.id, email: user.email },
    mockupId: id,
    action: 'revise_mockup',
    feedback: notes
  })

  return { success: true, mockup }
})
