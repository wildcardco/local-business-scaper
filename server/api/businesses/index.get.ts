import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)

  const {
    searchId,
    category,
    status,
    hasWebsite,
    limit = 50,
    offset = 0,
    sortBy = 'lead_score',
    sortOrder = 'desc'
  } = query

  // Build SQL query with filters
  let sql = `
    SELECT 
      b.*,
      a.id as audit_id,
      a.performance_score,
      a.accessibility_score,
      a.best_practices_score,
      a.seo_score,
      a.is_mobile_responsive,
      a.has_ssl,
      a.detected_platform,
      a.audited_at,
      s.query as search_query,
      s.location as search_location
    FROM businesses b
    LEFT JOIN audits a ON b.id = a.business_id
    LEFT JOIN searches s ON b.search_id = s.id
    WHERE b.user_id = ?
  `
  const args: (string | number)[] = [user.id]

  if (searchId) {
    sql += ` AND b.search_id = ?`
    args.push(searchId as string)
  }

  if (category) {
    sql += ` AND b.lead_category = ?`
    args.push(category as string)
  }

  if (status) {
    sql += ` AND b.status = ?`
    args.push(status as string)
  }

  if (hasWebsite === 'true') {
    sql += ` AND b.website IS NOT NULL`
  } else if (hasWebsite === 'false') {
    sql += ` AND b.website IS NULL`
  }

  // Validate and add sorting
  const validSortFields = ['lead_score', 'name', 'created_at', 'rating', 'review_count']
  const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'lead_score'
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC'
  sql += ` ORDER BY b.${sortField} ${order}`

  // Add pagination
  sql += ` LIMIT ? OFFSET ?`
  args.push(Number(limit), Number(offset))

  try {
    const result = await db.execute({ sql, args })

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM businesses WHERE user_id = ?`
    const countArgs: (string | number)[] = [user.id]

    if (searchId) {
      countSql += ` AND search_id = ?`
      countArgs.push(searchId as string)
    }
    if (category) {
      countSql += ` AND lead_category = ?`
      countArgs.push(category as string)
    }
    if (status) {
      countSql += ` AND status = ?`
      countArgs.push(status as string)
    }
    if (hasWebsite === 'true') {
      countSql += ` AND website IS NOT NULL`
    } else if (hasWebsite === 'false') {
      countSql += ` AND website IS NULL`
    }

    const countResult = await db.execute({ sql: countSql, args: countArgs })
    const total = Number(countResult.rows[0]?.total) || 0

    // Transform rows to include nested audit object
    const businesses = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      searchId: row.search_id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      phone: row.phone,
      website: row.website,
      email: row.email,
      googleMapsUrl: row.google_maps_url,
      placeId: row.place_id,
      category: row.category,
      rating: row.rating,
      reviewCount: row.review_count,
      priceLevel: row.price_level,
      leadScore: row.lead_score,
      leadCategory: row.lead_category,
      status: row.status,
      approvedAt: row.approved_at,
      sentAt: row.sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      audit: row.audit_id ? {
        id: row.audit_id,
        performanceScore: row.performance_score,
        accessibilityScore: row.accessibility_score,
        bestPracticesScore: row.best_practices_score,
        seoScore: row.seo_score,
        isMobileResponsive: Boolean(row.is_mobile_responsive),
        hasSSL: Boolean(row.has_ssl),
        detectedPlatform: row.detected_platform,
        auditedAt: row.audited_at
      } : null,
      search: {
        query: row.search_query,
        location: row.search_location
      }
    }))

    return {
      success: true,
      businesses,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + businesses.length < total
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch businesses: ${errorMessage}`
    })
  }
})
