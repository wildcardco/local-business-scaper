import { ensureDigestTables } from '~~/server/utils/digest-schema'
import { loadRerollNavigation } from '~~/server/utils/reroll-results'

export default defineEventHandler(async (event) => {
  await ensureDigestTables()
  const user = event.context.user
  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const id = getRouterParam(event, 'id')
  if (!id || id === '_none') {
    throw createError({ statusCode: 400, message: 'Missing re-roll id' })
  }
  const reroll = await loadRerollNavigation(String(user.id), id)
  if (!reroll) {
    throw createError({ statusCode: 404, message: 'Re-roll not found' })
  }
  return reroll
})
