import { findOrCreateMockupForBusiness, fireMockupAction, getMockupForUser } from '~~/server/utils/mockups'
import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)
  const businessId = typeof body.businessId === 'string' ? body.businessId : ''
  const mockupId = typeof body.mockupId === 'string' ? body.mockupId : ''

  let targetMockupId = mockupId

  if (!targetMockupId && businessId) {
    const business = await db.execute({
      sql: 'SELECT id, place_id FROM businesses WHERE id = ? AND user_id = ?',
      args: [businessId, user.id]
    })
    if (!business.rows[0]) {
      throw createError({ statusCode: 404, message: 'Business not found' })
    }
    const mockup = await findOrCreateMockupForBusiness(user.id, user.email, {
      id: String(business.rows[0].id),
      place_id: (business.rows[0].place_id as string) || null
    })
    targetMockupId = String(mockup.id)
  }

  if (!targetMockupId) {
    throw createError({
      statusCode: 400,
      message: 'businessId or mockupId is required'
    })
  }

  const mockup = await fireMockupAction({
    event,
    user: { id: user.id, email: user.email },
    mockupId: targetMockupId,
    action: 'generate_mockup',
    extraPrompt: typeof body.extraPrompt === 'string' ? body.extraPrompt.trim() : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
    maxTokens: body.maxTokens != null ? Number(body.maxTokens) : undefined,
    force: body.force === true
  })

  return { success: true, mockup: mockup || await getMockupForUser(targetMockupId, user.id) }
})
