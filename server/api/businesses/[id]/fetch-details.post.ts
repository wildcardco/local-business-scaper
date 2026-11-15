import { fetchPastLeadDetails } from '~~/server/utils/fetch-lead-details'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Business ID is required' })
  return fetchPastLeadDetails(user, id)
})
