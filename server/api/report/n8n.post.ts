import { db } from '~~/server/utils/db'
import { buildReportData, generateHtmlReport, generateMarkdownReport } from '~~/server/utils/report-generator'
import type { N8nReportPayload, ReportFormat } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { businessId, format = 'json', webhookUrl } = body as {
    businessId: string
    format?: ReportFormat
    webhookUrl?: string
  }

  const targetWebhook = webhookUrl || config.n8nWebhookUrl

  if (!targetWebhook) {
    throw createError({
      statusCode: 400,
      message: 'n8n webhook URL is not configured'
    })
  }

  if (!businessId) {
    throw createError({
      statusCode: 400,
      message: 'businessId is required'
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
      args: [businessId]
    })

    if (result.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Business not found'
      })
    }

    const row = result.rows[0]
    
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
    const htmlContent = generateHtmlReport(reportData)
    const markdownContent = generateMarkdownReport(reportData)

    const payload: N8nReportPayload = {
      action: 'send_audit_report',
      report: reportData,
      format,
      htmlContent,
      markdownContent
    }

    const response = await fetch(targetWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`n8n webhook error: ${response.status} - ${errorText}`)
    }

    return {
      success: true,
      message: `Audit report sent to n8n webhook`,
      businessId: business.id,
      businessName: business.name,
      format
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to send report to n8n: ${errorMessage}`
    })
  }
})
