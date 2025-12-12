import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Draft ID is required'
    })
  }

  try {
    await db.execute({
      sql: 'DELETE FROM email_drafts WHERE id = ? AND user_id = ?',
      args: [id, user.id]
    })

    return { success: true, message: 'Draft deleted' }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to delete draft: ${errorMessage}`
    })
  }
})


