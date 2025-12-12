import { db, generateId } from '~~/server/utils/db'
import { auditWebsite, detectPlatform, hasSSL } from '~~/server/utils/pagespeed'
import { calculateAuditScore, calculateInitialScore } from '~~/server/utils/lead-scorer'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)
  const { businessIds } = body

  if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'businessIds array is required'
    })
  }

  if (businessIds.length > 50) {
    throw createError({
      statusCode: 400,
      message: 'Maximum batch size is 50 businesses'
    })
  }

  const results: Array<{
    id: string
    name: string
    success: boolean
    error?: string
    scoring?: { score: number; category: string; reasons: string[] }
  }> = []

  for (const id of businessIds) {
    try {
      // Fetch business
      const businessResult = await db.execute({
        sql: 'SELECT * FROM businesses WHERE id = ? AND user_id = ?',
        args: [id, user.id]
      })

      if (businessResult.rows.length === 0) {
        results.push({
          id,
          name: 'Unknown',
          success: false,
          error: 'Business not found'
        })
        continue
      }

      const business = businessResult.rows[0]

      // If no website, mark as hot lead
      if (!business.website) {
        const scoring = calculateInitialScore(false, business.review_count as number | undefined, business.rating as number | undefined)

        await db.execute({
          sql: `UPDATE businesses SET lead_score = ?, lead_category = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [scoring.score, scoring.category, id]
        })

        results.push({
          id,
          name: business.name as string,
          success: true,
          scoring: {
            score: scoring.score,
            category: scoring.category,
            reasons: scoring.reasons
          }
        })
        continue
      }

      // Run audit
      const auditResult = await auditWebsite(business.website as string)
      const platform = detectPlatform(auditResult.rawJson)
      const ssl = hasSSL(business.website as string)

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

      // Update business score
      await db.execute({
        sql: `UPDATE businesses SET lead_score = ?, lead_category = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [scoring.score, scoring.category, id]
      })

      results.push({
        id,
        name: business.name as string,
        success: true,
        scoring: {
          score: scoring.score,
          category: scoring.category,
          reasons: scoring.reasons
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.push({
        id,
        name: 'Unknown',
        success: false,
        error: errorMessage
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length

  return {
    success: true,
    summary: {
      total: businessIds.length,
      succeeded: successCount,
      failed: failedCount
    },
    results
  }
})
