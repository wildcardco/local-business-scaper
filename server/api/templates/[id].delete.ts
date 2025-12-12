import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Template ID is required'
    })
  }

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM email_templates WHERE id = ?',
      args: [id]
    })

    if (existing.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Template not found'
      })
    }

    await db.execute({
      sql: 'DELETE FROM email_templates WHERE id = ?',
      args: [id]
    })

    return {
      success: true,
      message: 'Template deleted'
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to delete template: ${errorMessage}`
    })
  }
})
