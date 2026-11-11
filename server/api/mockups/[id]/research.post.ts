import { requestMockupResearch } from '~~/server/utils/research-request'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  const body = await readBody(event).catch(() => ({}))
  return requestMockupResearch(event, user, id, text(body?.notes))
})
