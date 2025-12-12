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
    const result = await db.execute({
      sql: `
        SELECT 
          d.*,
          b.name as business_name,
          b.email as business_email,
          b.city,
          b.state
        FROM email_drafts d
        LEFT JOIN businesses b ON d.business_id = b.id
        WHERE d.id = ? AND d.user_id = ?
      `,
      args: [id, user.id]
    })

    if (result.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Draft not found'
      })
    }

    const draft = result.rows[0]

    return {
      success: true,
      draft: {
        id: draft.id,
        businessId: draft.business_id,
        businessName: draft.business_name,
        businessEmail: draft.business_email,
        businessLocation: [draft.city, draft.state].filter(Boolean).join(', '),
        emailTo: draft.email_to,
        subject: draft.subject,
        bodyText: draft.body_text,
        bodyHtml: draft.body_html,
        aiGenerated: Boolean(draft.ai_generated),
        customPrompt: draft.custom_prompt,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at
      }
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch draft: ${errorMessage}`
    })
  }
})


