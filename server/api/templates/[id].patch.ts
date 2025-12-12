import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Template ID is required'
    })
  }

  const { name, subject, body: templateBody, isActive } = body

  try {
    // Check if template exists
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

    // Build dynamic update
    const updates: string[] = [`updated_at = datetime('now')`]
    const args: (string | number)[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      args.push(name)
    }
    if (subject !== undefined) {
      updates.push('subject = ?')
      args.push(subject)
    }
    if (templateBody !== undefined) {
      updates.push('body = ?')
      args.push(templateBody)
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?')
      args.push(isActive ? 1 : 0)
    }

    args.push(id)

    await db.execute({
      sql: `UPDATE email_templates SET ${updates.join(', ')} WHERE id = ?`,
      args
    })

    // Fetch updated template
    const result = await db.execute({
      sql: 'SELECT * FROM email_templates WHERE id = ?',
      args: [id]
    })

    const row = result.rows[0]
    const template = {
      id: row.id,
      name: row.name,
      subject: row.subject,
      body: row.body,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }

    return {
      success: true,
      template
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to update template: ${errorMessage}`
    })
  }
})
