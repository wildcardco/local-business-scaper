import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Thread ID is required'
    })
  }

  try {
    // Fetch outreach log with business details
    const outreachResult = await db.execute({
      sql: `
        SELECT 
          o.*,
          b.name as business_name,
          b.category as business_category,
          b.website,
          b.phone,
          b.city,
          b.state
        FROM outreach_logs o
        JOIN businesses b ON o.business_id = b.id
        WHERE o.id = ? AND o.user_id = ?
      `,
      args: [id, user.id]
    })

    if (outreachResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Thread not found'
      })
    }

    const outreach = outreachResult.rows[0]

    // Fetch all replies for this thread
    const repliesResult = await db.execute({
      sql: `
        SELECT *
        FROM email_replies
        WHERE outreach_log_id = ?
        ORDER BY received_at ASC
      `,
      args: [id]
    })

    const replies = repliesResult.rows.map(row => ({
      id: row.id,
      fromEmail: row.from_email,
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      receivedAt: row.received_at,
      resendEventId: row.resend_event_id
    }))

    const thread = {
      id: outreach.id,
      businessId: outreach.business_id,
      businessName: outreach.business_name,
      businessCategory: outreach.business_category,
      businessWebsite: outreach.website,
      businessPhone: outreach.phone,
      businessLocation: [outreach.city, outreach.state].filter(Boolean).join(', '),
      emailTo: outreach.email_to,
      subject: outreach.subject,
      status: outreach.status,
      sentAt: outreach.sent_at,
      messageId: outreach.message_id,
      generatedBody: outreach.generated_body,
      aiGenerated: Boolean(outreach.ai_generated),
      replies
    }

    return {
      success: true,
      thread
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch thread: ${errorMessage}`
    })
  }
})






