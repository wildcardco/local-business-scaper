import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const limit = Number(query.limit) || 50
  const offset = Number(query.offset) || 0

  try {
    // Get drafts with business info
    const result = await db.execute({
      sql: `
        SELECT 
          d.id,
          d.business_id,
          d.email_to,
          d.subject,
          d.body_text,
          d.body_html,
          d.ai_generated,
          d.custom_prompt,
          d.created_at,
          d.updated_at,
          b.name as business_name,
          b.city,
          b.state
        FROM email_drafts d
        LEFT JOIN businesses b ON d.business_id = b.id
        WHERE d.user_id = ?
        ORDER BY d.updated_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [user.id, limit, offset]
    })

    // Get total count
    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as total FROM email_drafts WHERE user_id = ?',
      args: [user.id]
    })

    const total = Number(countResult.rows[0]?.total || 0)

    return {
      success: true,
      drafts: result.rows.map(row => ({
        id: row.id,
        businessId: row.business_id,
        businessName: row.business_name,
        businessLocation: [row.city, row.state].filter(Boolean).join(', '),
        emailTo: row.email_to,
        subject: row.subject,
        bodyText: row.body_text,
        bodyHtml: row.body_html,
        aiGenerated: Boolean(row.ai_generated),
        customPrompt: row.custom_prompt,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch drafts: ${errorMessage}`
    })
  }
})


