import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const { 
    limit = 50, 
    offset = 0,
    status,
    hasReplies,
    search
  } = query

  try {
    let sql = `
      SELECT 
        o.id,
        o.business_id,
        o.email_to,
        o.subject,
        o.status,
        o.sent_at,
        o.message_id,
        o.ai_generated,
        b.name as business_name,
        b.category as business_category,
        b.city,
        b.state,
        (SELECT COUNT(*) FROM email_replies WHERE outreach_log_id = o.id) as reply_count,
        (SELECT MAX(received_at) FROM email_replies WHERE outreach_log_id = o.id) as last_reply_at
      FROM outreach_logs o
      JOIN businesses b ON o.business_id = b.id
      WHERE o.user_id = ?
    `
    
    const args: (string | number)[] = [user.id]

    // Apply filters
    if (status) {
      sql += ` AND o.status = ?`
      args.push(status as string)
    }

    if (hasReplies === 'true') {
      sql += ` AND (SELECT COUNT(*) FROM email_replies WHERE outreach_log_id = o.id) > 0`
    } else if (hasReplies === 'false') {
      sql += ` AND (SELECT COUNT(*) FROM email_replies WHERE outreach_log_id = o.id) = 0`
    }

    if (search) {
      sql += ` AND (b.name LIKE ? OR o.subject LIKE ? OR o.email_to LIKE ?)`
      const searchPattern = `%${search}%`
      args.push(searchPattern, searchPattern, searchPattern)
    }

    // Order by most recent activity (either sent or last reply)
    sql += ` ORDER BY COALESCE(last_reply_at, o.sent_at) DESC LIMIT ? OFFSET ?`
    args.push(Number(limit), Number(offset))

    const result = await db.execute({ sql, args })

    // Get total count
    let countSql = `
      SELECT COUNT(*) as total
      FROM outreach_logs o
      JOIN businesses b ON o.business_id = b.id
      WHERE o.user_id = ?
    `
    const countArgs: (string | number)[] = [user.id]

    if (status) {
      countSql += ` AND o.status = ?`
      countArgs.push(status as string)
    }

    if (hasReplies === 'true') {
      countSql += ` AND (SELECT COUNT(*) FROM email_replies WHERE outreach_log_id = o.id) > 0`
    } else if (hasReplies === 'false') {
      countSql += ` AND (SELECT COUNT(*) FROM email_replies WHERE outreach_log_id = o.id) = 0`
    }

    if (search) {
      countSql += ` AND (b.name LIKE ? OR o.subject LIKE ? OR o.email_to LIKE ?)`
      const searchPattern = `%${search}%`
      countArgs.push(searchPattern, searchPattern, searchPattern)
    }

    const countResult = await db.execute({ sql: countSql, args: countArgs })
    const total = Number(countResult.rows[0]?.total) || 0

    const threads = result.rows.map(row => ({
      id: row.id,
      businessId: row.business_id,
      businessName: row.business_name,
      businessCategory: row.business_category,
      businessLocation: [row.city, row.state].filter(Boolean).join(', '),
      emailTo: row.email_to,
      subject: row.subject,
      status: row.status,
      sentAt: row.sent_at,
      messageId: row.message_id,
      aiGenerated: Boolean(row.ai_generated),
      replyCount: Number(row.reply_count) || 0,
      lastReplyAt: row.last_reply_at,
      lastActivityAt: row.last_reply_at || row.sent_at
    }))

    return {
      success: true,
      threads,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + threads.length < total
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch inbox threads: ${errorMessage}`
    })
  }
})






