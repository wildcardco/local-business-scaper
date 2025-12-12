import { db, generateId } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)
  const { id, businessId, emailTo, subject, bodyText, bodyHtml, aiGenerated, customPrompt } = body

  if (!subject || !bodyText) {
    throw createError({
      statusCode: 400,
      message: 'subject and bodyText are required'
    })
  }

  try {
    if (id) {
      // Update existing draft
      await db.execute({
        sql: `UPDATE email_drafts 
              SET subject = ?, body_text = ?, body_html = ?, email_to = ?, 
                  business_id = ?, custom_prompt = ?, updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
        args: [subject, bodyText, bodyHtml, emailTo, businessId, customPrompt, id, user.id]
      })

      return { success: true, draftId: id, message: 'Draft updated' }
    } else {
      // Create new draft
      const draftId = generateId()
      
      await db.execute({
        sql: `INSERT INTO email_drafts 
              (id, user_id, business_id, email_to, subject, body_text, body_html, ai_generated, custom_prompt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [draftId, user.id, businessId, emailTo, subject, bodyText, bodyHtml, aiGenerated ? 1 : 0, customPrompt]
      })

      return { success: true, draftId, message: 'Draft saved' }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to save draft: ${errorMessage}`
    })
  }
})


