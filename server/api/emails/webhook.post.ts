import { db, generateId } from '~~/server/utils/db'

// Resend webhook events we handle
type ResendEvent = 
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked'

interface ResendWebhookPayload {
  type: ResendEvent
  created_at: string
  data: {
    email_id: string
    to: string
    from: string
    subject: string
    [key: string]: unknown
  }
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ResendWebhookPayload>(event)
    
    // TODO: In production, verify webhook signature for security
    // const signature = getHeader(event, 'resend-signature')
    // if (!verifySignature(signature, body)) {
    //   throw createError({ statusCode: 401, message: 'Invalid signature' })
    // }

    const { type, data } = body

    if (!type || !data || !data.email_id) {
      throw createError({
        statusCode: 400,
        message: 'Invalid webhook payload'
      })
    }

    // Find the outreach log by message_id (Resend's email_id)
    const logResult = await db.execute({
      sql: 'SELECT id FROM outreach_logs WHERE message_id = ?',
      args: [data.email_id]
    })

    if (logResult.rows.length === 0) {
      console.warn(`No outreach log found for email_id: ${data.email_id}`)
      return { success: true, message: 'Email not tracked' }
    }

    const outreachLogId = logResult.rows[0].id as string

    // Handle different event types
    switch (type) {
      case 'email.delivered':
        await db.execute({
          sql: 'UPDATE outreach_logs SET status = ? WHERE id = ?',
          args: ['delivered', outreachLogId]
        })
        break

      case 'email.bounced':
        await db.execute({
          sql: 'UPDATE outreach_logs SET status = ? WHERE id = ?',
          args: ['bounced', outreachLogId]
        })
        break

      case 'email.complained':
        await db.execute({
          sql: 'UPDATE outreach_logs SET status = ? WHERE id = ?',
          args: ['complained', outreachLogId]
        })
        break

      case 'email.opened':
        await db.execute({
          sql: 'UPDATE outreach_logs SET status = ? WHERE id = ? AND status = ?',
          args: ['opened', outreachLogId, 'delivered']
        })
        break

      case 'email.clicked':
        await db.execute({
          sql: 'UPDATE outreach_logs SET status = ? WHERE id = ?',
          args: ['clicked', outreachLogId]
        })
        break

      default:
        console.log(`Unhandled webhook event type: ${type}`)
    }

    return {
      success: true,
      message: 'Webhook processed'
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook processing error:', errorMessage)
    
    throw createError({
      statusCode: 500,
      message: `Failed to process webhook: ${errorMessage}`
    })
  }
})

// Handle inbound email replies (requires Resend inbound email setup)
// This would be a separate endpoint or handled differently based on Resend's inbound email feature
export async function handleInboundEmail(payload: {
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  in_reply_to?: string
  message_id: string
}) {
  try {
    // Find the parent outreach log by message_id or email address
    const logResult = await db.execute({
      sql: `
        SELECT id FROM outreach_logs 
        WHERE message_id = ? OR email_to = ?
        ORDER BY sent_at DESC
        LIMIT 1
      `,
      args: [payload.in_reply_to || '', payload.to]
    })

    if (logResult.rows.length === 0) {
      console.warn(`No outreach log found for reply from: ${payload.from}`)
      return
    }

    const outreachLogId = logResult.rows[0].id as string

    // Insert reply record
    const replyId = generateId()
    await db.execute({
      sql: `
        INSERT INTO email_replies 
        (id, outreach_log_id, from_email, subject, body_text, body_html, resend_event_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        replyId,
        outreachLogId,
        payload.from,
        payload.subject,
        payload.text || null,
        payload.html || null,
        payload.message_id
      ]
    })

    // Update outreach log status to indicate reply received
    await db.execute({
      sql: 'UPDATE outreach_logs SET status = ? WHERE id = ?',
      args: ['replied', outreachLogId]
    })

    console.log(`Reply recorded for outreach log: ${outreachLogId}`)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to handle inbound email:', errorMessage)
  }
}






