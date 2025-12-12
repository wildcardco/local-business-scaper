import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    })
  }

  const { status, email, leadScore, leadCategory } = body

  // Validate status if provided
  const validStatuses = ['new', 'approved', 'sent', 'responded', 'rejected']
  if (status && !validStatuses.includes(status)) {
    throw createError({
      statusCode: 400,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    })
  }

  // Validate leadCategory if provided
  const validCategories = ['hot', 'warm', 'cold', 'skip']
  if (leadCategory && !validCategories.includes(leadCategory)) {
    throw createError({
      statusCode: 400,
      message: `Invalid lead category. Must be one of: ${validCategories.join(', ')}`
    })
  }

  try {
    // Check if user owns this business
    const existing = await db.execute({
      sql: 'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
      args: [id, user.id]
    })

    if (existing.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Business not found'
      })
    }

    // Build dynamic UPDATE query
    const updates: string[] = [`updated_at = datetime('now')`]
    const args: (string | number | null)[] = []

    if (status !== undefined) {
      updates.push('status = ?')
      args.push(status)
      if (status === 'approved') {
        updates.push(`approved_at = datetime('now')`)
      } else if (status === 'sent') {
        updates.push(`sent_at = datetime('now')`)
      }
    }

    if (email !== undefined) {
      updates.push('email = ?')
      args.push(email)
    }

    if (leadScore !== undefined) {
      updates.push('lead_score = ?')
      args.push(leadScore)
    }

    if (leadCategory !== undefined) {
      updates.push('lead_category = ?')
      args.push(leadCategory)
    }

    args.push(id)

    await db.execute({
      sql: `UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`,
      args
    })

    // Fetch updated business with audit
    const result = await db.execute({
      sql: `
        SELECT b.*, a.id as audit_id, a.performance_score, a.seo_score
        FROM businesses b
        LEFT JOIN audits a ON b.id = a.business_id
        WHERE b.id = ?
      `,
      args: [id]
    })

    const row = result.rows[0]
    const business = {
      id: row.id,
      name: row.name,
      status: row.status,
      email: row.email,
      leadScore: row.lead_score,
      leadCategory: row.lead_category,
      updatedAt: row.updated_at,
      audit: row.audit_id ? {
        performanceScore: row.performance_score,
        seoScore: row.seo_score
      } : null
    }

    return {
      success: true,
      business
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to update business: ${errorMessage}`
    })
  }
})
