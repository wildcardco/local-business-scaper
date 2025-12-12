import { db } from '~~/server/utils/db'
import { buildReportData, generateHtmlReport, generateMarkdownReport, generateSummary } from '~~/server/utils/report-generator'
import type { ReportFormat } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const format = (query.format as ReportFormat) || 'json'

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    })
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT b.*, a.performance_score, a.accessibility_score, a.best_practices_score,
          a.seo_score, a.first_contentful_paint, a.largest_contentful_paint,
          a.total_blocking_time, a.cumulative_layout_shift, a.speed_index,
          a.has_ssl, a.detected_platform, a.audited_at
        FROM businesses b
        LEFT JOIN audits a ON b.id = a.business_id
        WHERE b.id = ?
      `,
      args: [id]
    })

    if (result.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Business not found'
      })
    }

    const row = result.rows[0]
    
    // Transform to expected format
    const business = {
      id: row.id as string,
      name: row.name as string,
      category: row.category as string | null,
      address: row.address as string | null,
      city: row.city as string | null,
      state: row.state as string | null,
      zipCode: row.zip_code as string | null,
      phone: row.phone as string | null,
      email: row.email as string | null,
      website: row.website as string | null,
      googleMapsUrl: row.google_maps_url as string | null,
      rating: row.rating as number | null,
      reviewCount: row.review_count as number | null,
      leadScore: row.lead_score as number,
      leadCategory: row.lead_category as string | null,
      audit: row.performance_score !== null ? {
        performanceScore: row.performance_score as number | null,
        accessibilityScore: row.accessibility_score as number | null,
        bestPracticesScore: row.best_practices_score as number | null,
        seoScore: row.seo_score as number | null,
        firstContentfulPaint: row.first_contentful_paint as string | null,
        largestContentfulPaint: row.largest_contentful_paint as string | null,
        totalBlockingTime: row.total_blocking_time as string | null,
        cumulativeLayoutShift: row.cumulative_layout_shift as string | null,
        speedIndex: row.speed_index as string | null,
        hasSSL: Boolean(row.has_ssl),
        detectedPlatform: row.detected_platform as string | null,
        auditedAt: row.audited_at ? new Date(row.audited_at as string) : null
      } : null
    }

    const reportData = buildReportData(business)

    switch (format) {
      case 'html': {
        const html = generateHtmlReport(reportData)
        setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
        setResponseHeader(event, 'Content-Disposition', `attachment; filename="audit-report-${business.name.replace(/[^a-z0-9]/gi, '-')}.html"`)
        return html
      }

      case 'markdown': {
        const markdown = generateMarkdownReport(reportData)
        setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
        setResponseHeader(event, 'Content-Disposition', `attachment; filename="audit-report-${business.name.replace(/[^a-z0-9]/gi, '-')}.md"`)
        return markdown
      }

      case 'pdf': {
        const html = generateHtmlReport(reportData)
        return {
          success: true,
          format: 'pdf',
          data: reportData,
          html,
          filename: `audit-report-${business.name.replace(/[^a-z0-9]/gi, '-')}.pdf`
        }
      }

      case 'json':
      default: {
        setResponseHeader(event, 'Content-Type', 'application/json')
        return {
          success: true,
          format: 'json',
          data: reportData,
          summary: generateSummary(reportData)
        }
      }
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to generate report: ${errorMessage}`
    })
  }
})
