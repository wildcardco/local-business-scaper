import { db, generateId } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name, subject, body: templateBody, isActive = true } = body

  if (!name || !subject || !templateBody) {
    throw createError({
      statusCode: 400,
      message: 'Name, subject, and body are required'
    })
  }

  try {
    const templateId = generateId()
    await db.execute({
      sql: `INSERT INTO email_templates (id, name, subject, body, is_active) VALUES (?, ?, ?, ?, ?)`,
      args: [templateId, name, subject, templateBody, isActive ? 1 : 0]
    })

    return {
      success: true,
      template: {
        id: templateId,
        name,
        subject,
        body: templateBody,
        isActive
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to create template: ${errorMessage}`
    })
  }
})
