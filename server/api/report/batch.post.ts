import { db } from '~~/server/utils/db'
import { buildReportData, generateHtmlReport, generateMarkdownReport, generateSummary } from '~~/server/utils/report-generator'
import type { AuditReportData, ReportFormat } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { businessIds, format = 'json' } = body as { businessIds: string[]; format?: ReportFormat }

  if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'businessIds array is required'
    })
  }

  if (businessIds.length > 50) {
    throw createError({
      statusCode: 400,
      message: 'Maximum 50 businesses per batch report'
    })
  }

  try {
    const placeholders = businessIds.map(() => '?').join(', ')
    const result = await db.execute({
      sql: `
        SELECT b.*, a.performance_score, a.accessibility_score, a.best_practices_score,
          a.seo_score, a.first_contentful_paint, a.largest_contentful_paint,
          a.total_blocking_time, a.cumulative_layout_shift, a.speed_index,
          a.has_ssl, a.detected_platform, a.audited_at
        FROM businesses b
        LEFT JOIN audits a ON b.id = a.business_id
        WHERE b.id IN (${placeholders})
        ORDER BY b.lead_score DESC
      `,
      args: businessIds
    })

    if (result.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'No businesses found with the provided IDs'
      })
    }

    const reports: AuditReportData[] = result.rows.map(row => {
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
      return buildReportData(business)
    })

    switch (format) {
      case 'html': {
        const combinedHtml = generateBatchHtmlReport(reports)
        setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
        setResponseHeader(event, 'Content-Disposition', `attachment; filename="batch-audit-report-${Date.now()}.html"`)
        return combinedHtml
      }

      case 'markdown': {
        const combinedMarkdown = reports
          .map((r, i) => {
            const md = generateMarkdownReport(r)
            return i === 0 ? md : `\n\n---\n\n${md}`
          })
          .join('')
        setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
        setResponseHeader(event, 'Content-Disposition', `attachment; filename="batch-audit-report-${Date.now()}.md"`)
        return combinedMarkdown
      }

      case 'pdf': {
        const html = generateBatchHtmlReport(reports)
        return {
          success: true,
          format: 'pdf',
          count: reports.length,
          data: reports,
          html,
          filename: `batch-audit-report-${Date.now()}.pdf`
        }
      }

      case 'json':
      default: {
        return {
          success: true,
          format: 'json',
          generatedAt: new Date().toISOString(),
          count: reports.length,
          data: reports,
          summaries: reports.map(r => ({
            businessId: r.business.id,
            businessName: r.business.name,
            summary: generateSummary(r)
          }))
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
      message: `Failed to generate batch report: ${errorMessage}`
    })
  }
})

// Generate a combined HTML report for multiple businesses
function generateBatchHtmlReport(reports: AuditReportData[]): string {
  const getScoreColor = (score: number | null): string => {
    if (score === null) return '#9ca3af'
    if (score >= 90) return '#22c55e'
    if (score >= 50) return '#f59e0b'
    return '#ef4444'
  }

  const getCategoryStyle = (category: string | null) => {
    switch (category) {
      case 'hot': return { bg: '#fef2f2', text: '#dc2626', label: '🔥 Hot' }
      case 'warm': return { bg: '#fffbeb', text: '#d97706', label: '⚡ Warm' }
      case 'cold': return { bg: '#eff6ff', text: '#2563eb', label: '❄️ Cold' }
      default: return { bg: '#f3f4f6', text: '#6b7280', label: 'N/A' }
    }
  }

  const businessRow = (data: AuditReportData) => {
    const cat = getCategoryStyle(data.leadScore.category)
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${data.business.name}</strong>
          <div style="font-size: 12px; color: #6b7280;">${data.business.category || 'Uncategorized'}</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="font-weight: bold; font-size: 18px;">${data.leadScore.score}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 12px; background: ${cat.bg}; color: ${cat.text};">${cat.label}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${data.business.website ? `<a href="${data.business.website.startsWith('http') ? data.business.website : 'https://' + data.business.website}" style="color: #2563eb; text-decoration: none;">Visit</a>` : '<span style="color: #ef4444;">None</span>'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: ${getScoreColor(data.audit?.performanceScore ?? null)};">
          ${data.audit?.performanceScore ?? '—'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: ${getScoreColor(data.audit?.seoScore ?? null)};">
          ${data.audit?.seoScore ?? '—'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${data.audit?.hasSSL ? '✅' : data.audit?.hasSSL === false ? '❌' : '—'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${data.business.phone || '—'}
        </td>
      </tr>
    `
  }

  const totalLeads = reports.length
  const hotLeads = reports.filter(r => r.leadScore.category === 'hot').length
  const warmLeads = reports.filter(r => r.leadScore.category === 'warm').length
  const noWebsite = reports.filter(r => !r.business.website).length
  const avgScore = Math.round(reports.reduce((sum, r) => sum + r.leadScore.score, 0) / reports.length)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Audit Report - ${reports.length} Businesses</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 1200px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #2d1818 0%, #D6293E 100%); color: white; padding: 40px; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { padding: 40px; }
    .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #f9fafb; border-radius: 12px; padding: 20px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #1f2937; }
    .stat-label { font-size: 13px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 12px; text-align: left; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Batch Audit Report</h1>
      <p>${reports.length} businesses analyzed</p>
    </div>
    
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${totalLeads}</div><div class="stat-label">Total Leads</div></div>
        <div class="stat-card"><div class="stat-value" style="color: #dc2626;">🔥 ${hotLeads}</div><div class="stat-label">Hot Leads</div></div>
        <div class="stat-card"><div class="stat-value" style="color: #d97706;">⚡ ${warmLeads}</div><div class="stat-label">Warm Leads</div></div>
        <div class="stat-card"><div class="stat-value" style="color: #C9A227;">${noWebsite}</div><div class="stat-label">No Website</div></div>
        <div class="stat-card"><div class="stat-value">${avgScore}</div><div class="stat-label">Avg. Score</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Business</th><th style="text-align: center;">Score</th><th style="text-align: center;">Category</th>
            <th style="text-align: center;">Website</th><th style="text-align: center;">Perf.</th>
            <th style="text-align: center;">SEO</th><th style="text-align: center;">SSL</th><th>Phone</th>
          </tr>
        </thead>
        <tbody>${reports.map(r => businessRow(r)).join('')}</tbody>
      </table>
    </div>
    <div class="footer">
      <p>Report generated on ${new Date().toLocaleString()}</p>
      <p style="margin-top: 8px;">Powered by Wild Card Creative Lead Generator</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
