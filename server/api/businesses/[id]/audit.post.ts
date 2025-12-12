import { db, generateId } from '~~/server/utils/db'
import { auditWebsite, detectPlatform, hasSSL } from '~~/server/utils/pagespeed'
import { calculateAuditScore } from '~~/server/utils/lead-scorer'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const startTime = Date.now()

  console.log(`[Audit API] 🚀 Starting audit for business ID: ${id}`)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    })
  }

  try {
    // Get the business
    const result = await db.execute({
      sql: 'SELECT * FROM businesses WHERE id = ? AND user_id = ?',
      args: [id, user.id]
    })

    if (result.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Business not found'
      })
    }

    const business = result.rows[0]
    console.log(`[Audit API] ✓ Found business: "${business.name}" | Website: ${business.website || 'N/A'}`)

    // If no website, mark as hot lead without audit
    if (!business.website) {
      console.log(`[Audit API] ℹ️ No website - marking as hot lead (score: 95)`)
      await db.execute({
        sql: `UPDATE businesses SET lead_score = 95, lead_category = 'hot', updated_at = datetime('now') WHERE id = ?`,
        args: [id]
      })

      return {
        success: true,
        message: 'Business has no website - marked as hot lead',
        business: { ...business, leadScore: 95, leadCategory: 'hot' },
        audit: null
      }
    }

    // Run PageSpeed audit
    console.log(`[Audit API] 🔍 Running PageSpeed audit for: ${business.website}`)
    const auditResult = await auditWebsite(business.website as string)
    const platform = detectPlatform(auditResult.rawJson)
    const ssl = hasSSL(business.website as string)

    // Calculate lead score
    const scoring = calculateAuditScore(
      auditResult.performanceScore,
      auditResult.seoScore,
      auditResult.accessibilityScore,
      ssl,
      business.review_count as number | undefined,
      business.rating as number | undefined
    )

    // Check if audit exists
    const existingAudit = await db.execute({
      sql: 'SELECT id FROM audits WHERE business_id = ?',
      args: [id]
    })

    if (existingAudit.rows.length > 0) {
      // Update existing audit
      await db.execute({
        sql: `UPDATE audits SET
          performance_score = ?, accessibility_score = ?, best_practices_score = ?,
          seo_score = ?, first_contentful_paint = ?, largest_contentful_paint = ?,
          total_blocking_time = ?, cumulative_layout_shift = ?, speed_index = ?,
          has_ssl = ?, detected_platform = ?, raw_lighthouse_json = ?, audited_at = datetime('now')
          WHERE business_id = ?`,
        args: [
          auditResult.performanceScore, auditResult.accessibilityScore,
          auditResult.bestPracticesScore, auditResult.seoScore,
          auditResult.firstContentfulPaint, auditResult.largestContentfulPaint,
          auditResult.totalBlockingTime, auditResult.cumulativeLayoutShift,
          auditResult.speedIndex, ssl ? 1 : 0, platform, auditResult.rawJson, id
        ]
      })
    } else {
      // Create new audit
      const auditId = generateId()
      await db.execute({
        sql: `INSERT INTO audits (
          id, business_id, performance_score, accessibility_score, best_practices_score,
          seo_score, first_contentful_paint, largest_contentful_paint, total_blocking_time,
          cumulative_layout_shift, speed_index, has_ssl, detected_platform, raw_lighthouse_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          auditId, id, auditResult.performanceScore, auditResult.accessibilityScore,
          auditResult.bestPracticesScore, auditResult.seoScore,
          auditResult.firstContentfulPaint, auditResult.largestContentfulPaint,
          auditResult.totalBlockingTime, auditResult.cumulativeLayoutShift,
          auditResult.speedIndex, ssl ? 1 : 0, platform, auditResult.rawJson
        ]
      })
    }

    // Update business lead score
    await db.execute({
      sql: `UPDATE businesses SET lead_score = ?, lead_category = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [scoring.score, scoring.category, id]
    })

    const duration = Date.now() - startTime
    console.log(`[Audit API] ✅ Audit complete in ${duration}ms`)

    return {
      success: true,
      business: { ...business, leadScore: scoring.score, leadCategory: scoring.category },
      audit: {
        performanceScore: auditResult.performanceScore,
        seoScore: auditResult.seoScore,
        accessibilityScore: auditResult.accessibilityScore,
        bestPracticesScore: auditResult.bestPracticesScore,
        hasSSL: ssl,
        detectedPlatform: platform
      },
      scoring: {
        score: scoring.score,
        category: scoring.category,
        reasons: scoring.reasons
      }
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to audit business: ${errorMessage}`
    })
  }
})
