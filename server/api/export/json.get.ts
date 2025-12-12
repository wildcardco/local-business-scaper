import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const { category, status, includeRawAudit } = query

  let sql = `
    SELECT b.*, 
      a.id as audit_id, a.performance_score, a.accessibility_score, a.best_practices_score,
      a.seo_score, a.first_contentful_paint, a.largest_contentful_paint, a.total_blocking_time,
      a.cumulative_layout_shift, a.speed_index, a.has_ssl, a.detected_platform, a.audited_at,
      ${includeRawAudit === 'true' ? 'a.raw_lighthouse_json,' : ''}
      s.query as search_query, s.location as search_location, s.created_at as search_created_at
    FROM businesses b
    LEFT JOIN audits a ON b.id = a.business_id
    LEFT JOIN searches s ON b.search_id = s.id
    WHERE b.user_id = ?
  `
  const args: (string | number)[] = [user.id]

  if (category) {
    sql += ` AND b.lead_category = ?`
    args.push(category as string)
  }
  if (status) {
    sql += ` AND b.status = ?`
    args.push(status as string)
  }

  sql += ` ORDER BY b.lead_score DESC`

  try {
    const result = await db.execute({ sql, args })

    const exportData = result.rows.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      address: b.address,
      city: b.city,
      state: b.state,
      zipCode: b.zip_code,
      phone: b.phone,
      email: b.email,
      website: b.website,
      googleMapsUrl: b.google_maps_url,
      rating: b.rating,
      reviewCount: b.review_count,
      leadScore: b.lead_score,
      leadCategory: b.lead_category,
      status: b.status,
      search: {
        query: b.search_query,
        location: b.search_location,
        createdAt: b.search_created_at
      },
      audit: b.audit_id ? {
        performanceScore: b.performance_score,
        accessibilityScore: b.accessibility_score,
        bestPracticesScore: b.best_practices_score,
        seoScore: b.seo_score,
        firstContentfulPaint: b.first_contentful_paint,
        largestContentfulPaint: b.largest_contentful_paint,
        totalBlockingTime: b.total_blocking_time,
        cumulativeLayoutShift: b.cumulative_layout_shift,
        speedIndex: b.speed_index,
        hasSSL: Boolean(b.has_ssl),
        detectedPlatform: b.detected_platform,
        auditedAt: b.audited_at,
        ...(includeRawAudit === 'true' ? { rawLighthouseJson: b.raw_lighthouse_json } : {})
      } : null,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    }))

    setResponseHeader(event, 'Content-Type', 'application/json')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="leads-${Date.now()}.json"`)

    return {
      exportedAt: new Date().toISOString(),
      count: exportData.length,
      filters: { category, status },
      data: exportData
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to export JSON: ${errorMessage}`
    })
  }
})
