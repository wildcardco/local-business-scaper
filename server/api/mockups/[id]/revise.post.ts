import { fireMockupAction, getMockupForUser } from '~~/server/utils/mockups'
import { writeN8nLeadFeedback } from '~~/server/utils/n8n'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'

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

  const current = await getMockupForUser(id, user.id)
  if (!current) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  const owner = ownerSlugFromEmail(user.email)
  const placeId = current.placeId || current.business?.placeId || ''
  const feedbackWrite = placeId
    ? await writeN8nLeadFeedback(placeId, owner, notes)
    : {
        ok: false,
        warning: 'This mockup has no place id, so feedback could not be written to the n8n lead before the revision started.'
      }

  const mockup = await fireMockupAction({
    event,
    user: { id: user.id, email: user.email },
    mockupId: id,
    action: 'revise_mockup',
    feedback: notes
  })

  return { success: true, mockup, warning: feedbackWrite.warning }
})
