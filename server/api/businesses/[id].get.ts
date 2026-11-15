import { db } from '~~/server/utils/db'
import { ensureDigestTables } from '~~/server/utils/digest-schema'
import { normalizeGbpPhotos, normalizePhotoCount } from '~~/shared/digest-ingest'

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

    let digestLead: {
      angle: string | null
      note: string | null
      signals: unknown
      score: number | null
      tier: { slug: string | null, label: string | null }
      leadGroup: string | null
    } | null = null
    try {
      await ensureDigestTables()
      const placeId = typeof row.place_id === 'string' ? row.place_id : ''
      const digestResult = await db.execute({
        sql: `
          SELECT dl.angle, dl.note, dl.signals, dl.score, dl.tier_slug, dl.tier_label, dl.lead_group
          FROM digest_leads dl
          INNER JOIN digests d ON d.id = dl.digest_id
          WHERE d.user_id = ?
            AND (dl.business_id = ? OR (? != '' AND dl.place_id = ?))
          ORDER BY d.digest_date DESC, dl.created_at DESC
          LIMIT 1
        `,
        args: [user.id, id, placeId, placeId]
      })
      const digestRow = digestResult.rows[0]
      if (digestRow) {
        let signals = null
        if (digestRow.signals) {
          try {
            signals = JSON.parse(String(digestRow.signals))
          } catch (error) {
            console.error('Failed to parse digest signals:', error)
          }
        }
        const score = typeof digestRow.score === 'number'
          ? digestRow.score
          : typeof digestRow.score === 'bigint'
            ? Number(digestRow.score)
            : null
        const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null
        digestLead = {
          angle: text(digestRow.angle),
          note: text(digestRow.note),
          signals,
          score,
          tier: {
            slug: text(digestRow.tier_slug),
            label: text(digestRow.tier_label)
          },
          leadGroup: text(digestRow.lead_group)
        }
      }
    } catch (error) {
      console.error('Failed to load digest lead:', error)
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
      researchStatus: row.research_status === 'requested' || row.research_status === 'complete' ? row.research_status : null,
      researchRequestedAt: row.research_requested_at || null,
      approvedAt: row.approved_at,
      sentAt: row.sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      contactsData,
      photoCount: normalizePhotoCount(row.photo_count),
      gbpPhotos: normalizeGbpPhotos(row.gbp_photos),
      digestLead,
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
