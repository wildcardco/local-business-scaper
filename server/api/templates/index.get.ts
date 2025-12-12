import { db } from '~~/server/utils/db'

export default defineEventHandler(async () => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM email_templates ORDER BY created_at DESC',
      args: []
    })

    const templates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      subject: row.subject,
      body: row.body,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return {
      success: true,
      templates
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch templates: ${errorMessage}`
    })
  }
})
