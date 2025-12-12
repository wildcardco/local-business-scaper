import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    })
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT 
          b.*,
          a.id as audit_id,
          a.performance_score,
          a.accessibility_score,
          a.best_practices_score,
          a.seo_score,
          a.first_contentful_paint,
          a.largest_contentful_paint,
          a.total_blocking_time,
          a.cumulative_layout_shift,
          a.speed_index,
          a.is_mobile_responsive,
          a.has_ssl,
          a.has_missing_meta_tags,
          a.detected_platform,
          a.raw_lighthouse_json,
          a.audited_at,
          s.query as search_query,
          s.location as search_location,
          s.created_at as search_created_at
        FROM businesses b
        LEFT JOIN audits a ON b.id = a.business_id
        LEFT JOIN searches s ON b.search_id = s.id
        WHERE b.id = ? AND b.user_id = ?
      `,
      args: [id, user.id]
    })

    if (result.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Business not found'
      })
    }

    const row = result.rows[0]

    // Parse contacts data if available
    let contactsData = null
    if (row.contacts_data) {
      try {
        contactsData = JSON.parse(row.contacts_data as string)
      } catch (e) {
        console.error('Failed to parse contacts_data:', e)
      }
    }

    const business = {
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
      contactsData,
      facebook: row.facebook,
      instagram: row.instagram,
      twitter: row.twitter,
      linkedin: row.linkedin,
      youtube: row.youtube,
      tiktok: row.tiktok,
      yelp: row.yelp,
      audit: row.audit_id ? {
        id: row.audit_id,
        performanceScore: row.performance_score,
        accessibilityScore: row.accessibility_score,
        bestPracticesScore: row.best_practices_score,
        seoScore: row.seo_score,
        firstContentfulPaint: row.first_contentful_paint,
        largestContentfulPaint: row.largest_contentful_paint,
        totalBlockingTime: row.total_blocking_time,
        cumulativeLayoutShift: row.cumulative_layout_shift,
        speedIndex: row.speed_index,
        isMobileResponsive: Boolean(row.is_mobile_responsive),
        hasSSL: Boolean(row.has_ssl),
        hasMissingMetaTags: Boolean(row.has_missing_meta_tags),
        detectedPlatform: row.detected_platform,
        rawLighthouseJson: row.raw_lighthouse_json,
        auditedAt: row.audited_at
      } : null,
      search: {
        query: row.search_query,
        location: row.search_location,
        createdAt: row.search_created_at
      }
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
      message: `Failed to fetch business: ${errorMessage}`
    })
  }
})
