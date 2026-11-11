import { requestBusinessResearch } from '~~/server/utils/research-request'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Business ID is required' })
  const body = await readBody(event).catch(() => ({}))
  return requestBusinessResearch(event, user, id, text(body?.notes))
})
