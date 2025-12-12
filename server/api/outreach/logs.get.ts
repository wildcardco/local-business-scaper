import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const { businessId, limit = 50, offset = 0 } = query

  let sql = `SELECT * FROM outreach_logs WHERE user_id = ?`
  const args: (string | number)[] = [user.id]

  if (businessId) {
    sql += ` AND business_id = ?`
    args.push(businessId as string)
  }

  sql += ` ORDER BY sent_at DESC LIMIT ? OFFSET ?`
  args.push(Number(limit), Number(offset))

  try {
    const result = await db.execute({ sql, args })

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM outreach_logs WHERE user_id = ?`
    const countArgs: (string | number)[] = [user.id]
    if (businessId) {
      countSql += ` AND business_id = ?`
      countArgs.push(businessId as string)
    }
    const countResult = await db.execute({ sql: countSql, args: countArgs })
    const total = Number(countResult.rows[0]?.total) || 0

    const logs = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      businessId: row.business_id,
      templateId: row.template_id,
      emailTo: row.email_to,
      subject: row.subject,
      status: row.status,
      sentAt: row.sent_at,
      messageId: row.message_id
    }))

    return {
      success: true,
      logs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset)
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch outreach logs: ${errorMessage}`
    })
  }
})
