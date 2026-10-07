import { db } from '~~/server/utils/db'

function countOf(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function activityOf(status: string, deploymentMissing: number) {
  const building = ['generating', 'writing_pitch', 'enhancing', 'revising']
  if (building.includes(status)) return { activity: 'building' as const, label: 'Building' }
  if (status === 'failed' || deploymentMissing === 1) return { activity: 'failed' as const, label: 'Failed' }
  if (status === 'mockup_ready') return { activity: 'ready' as const, label: 'Ready' }
  const words = status.replace(/_/g, ' ').trim()
  const label = words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Draft'
  return { activity: 'other' as const, label }
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  const [countsResult, searchResult, mockupResult] = await db.batch([
    {
      sql: `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN lead_category = 'hot' THEN 1 ELSE 0 END) AS hot,
          SUM(CASE WHEN website IS NULL OR trim(website) = '' THEN 1 ELSE 0 END) AS no_website,
          SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS new_this_week
        FROM businesses
        WHERE user_id = ?`,
      args: [user.id]
    },
    {
      sql: `SELECT query, location, MAX(created_at) AS created_at
        FROM searches
        WHERE user_id = ?
        GROUP BY lower(query), lower(location)
        ORDER BY created_at DESC
        LIMIT 5`,
      args: [user.id]
    },
    {
      sql: `SELECT m.id, m.status, COALESCE(m.deployment_missing, 0) AS deployment_missing,
          COALESCE(b.name, 'Mockup') AS name
        FROM mockups m
        LEFT JOIN businesses b ON b.id = m.business_id
        WHERE m.user_id = ?
        ORDER BY COALESCE(m.made_at, m.updated_at, m.created_at) DESC
        LIMIT 4`,
      args: [user.id]
    }
  ], 'read')

  const counts = countsResult.rows[0] || {}

  return {
    counts: {
      total: countOf(counts.total),
      hot: countOf(counts.hot),
      noWebsite: countOf(counts.no_website),
      newThisWeek: countOf(counts.new_this_week)
    },
    searches: searchResult.rows.map(row => ({
      query: String(row.query || ''),
      location: String(row.location || ''),
      createdAt: row.created_at ? String(row.created_at) : null
    })),
    mockups: mockupResult.rows.map((row) => {
      const status = String(row.status || 'draft')
      const activity = activityOf(status, Number(row.deployment_missing || 0))
      return {
        id: String(row.id),
        name: String(row.name || 'Mockup'),
        status,
        activity: activity.activity,
        label: activity.label
      }
    })
  }
})
