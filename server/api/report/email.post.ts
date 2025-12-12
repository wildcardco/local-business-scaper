import { db, generateId } from '~~/server/utils/db'
import { buildReportData, generateHtmlReport, generateSummary } from '~~/server/utils/report-generator'
import { sendEmail } from '~~/server/utils/mailgun'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)

  const { businessId, recipientEmail, customSubject, includeRecommendations = true } = body as {
    businessId: string
    recipientEmail: string
    customSubject?: string
    includeRecommendations?: boolean
  }

  if (!businessId) {
    throw createError({
      statusCode: 400,
      message: 'businessId is required'
    })
  }

  if (!recipientEmail) {
    throw createError({
      statusCode: 400,
      message: 'recipientEmail is required'
    })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(recipientEmail)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid email address format'
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

    if (!includeRecommendations) {
      reportData.recommendations = []
    }

    const htmlReport = generateHtmlReport(reportData)
    const summary = generateSummary(reportData)
    const subject = customSubject || `Website Audit Report: ${business.name}`
    const emailHtml = createEmailWrapper(htmlReport, business.name)

    const emailResult = await sendEmail({
      to: recipientEmail,
      subject,
      html: emailHtml
    })

    // Log the outreach
    const logId = generateId()
    await db.execute({
      sql: `INSERT INTO outreach_logs (id, user_id, business_id, template_id, email_to, subject, status, message_id)
            VALUES (?, ?, ?, 'audit-report', ?, ?, 'sent', ?)`,
      args: [logId, user.id, businessId, recipientEmail, subject, emailResult.id]
    })

    return {
      success: true,
      message: `Audit report sent to ${recipientEmail}`,
      businessId: business.id,
      businessName: business.name,
      summary,
      messageId: emailResult.id
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to send report email: ${errorMessage}`
    })
  }
})

function createEmailWrapper(htmlReport: string, businessName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Audit Report - ${businessName}</title>
</head>
<body style="margin: 0; padding: 20px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 800px; margin: 0 auto;">
    <div style="display: none; max-height: 0; overflow: hidden;">
      Website audit results for ${businessName} - See performance scores and recommendations
    </div>
    
    ${htmlReport}
    
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
      <p>This audit report was generated automatically by Wild Card Creative.</p>
      <p>Questions? Reply to this email or contact us at hello@wildcardcreative.com</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
