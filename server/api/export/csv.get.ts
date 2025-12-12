import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const { category, status } = query

  let sql = `
    SELECT b.*, a.performance_score, a.seo_score, a.accessibility_score, a.detected_platform, a.has_ssl
    FROM businesses b
    LEFT JOIN audits a ON b.id = a.business_id
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

    // CSV headers
    const headers = [
      'Name', 'Category', 'Address', 'City', 'State', 'Zip', 'Phone', 'Email', 'Website',
      'Rating', 'Reviews', 'Lead Score', 'Lead Category', 'Status',
      'Performance Score', 'SEO Score', 'Accessibility Score', 'Platform', 'Has SSL'
    ]

    // CSV rows
    const rows = result.rows.map(b => [
      escapeCsv(b.name as string || ''),
      escapeCsv(b.category as string || ''),
      escapeCsv(b.address as string || ''),
      escapeCsv(b.city as string || ''),
      escapeCsv(b.state as string || ''),
      escapeCsv(b.zip_code as string || ''),
      escapeCsv(b.phone as string || ''),
      escapeCsv(b.email as string || ''),
      escapeCsv(b.website as string || ''),
      b.rating || '',
      b.review_count || '',
      b.lead_score,
      b.lead_category || '',
      b.status,
      b.performance_score ?? '',
      b.seo_score ?? '',
      b.accessibility_score ?? '',
      escapeCsv(b.detected_platform as string || ''),
      b.has_ssl ? 'Yes' : 'No'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    setResponseHeader(event, 'Content-Type', 'text/csv')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`)

    return csv
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to export CSV: ${errorMessage}`
    })
  }
})

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
