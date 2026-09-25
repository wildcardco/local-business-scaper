import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const date = typeof query.date === 'string' ? query.date : null

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid date format (must be YYYY-MM-DD)'
    })
  }

  const digestResult = await db.execute({
    sql: `SELECT id, digest_date, search_category, search_location, lead_count, received_at
          FROM digests WHERE user_id = ? AND digest_date = ? LIMIT 1`,
    args: [user.id, date]
  })

  const digest = digestResult.rows[0]
  if (!digest) {
    return {
      digest: null,
      leads: []
    }
  }

  const leadsResult = await db.execute({
    sql: `
      SELECT
        dl.id,
        dl.place_id,
        dl.rank,
        dl.score,
        dl.tier_slug,
        dl.tier_label,
        dl.angle,
        dl.note,
        dl.signals,
        b.id as business_id,
        b.name,
        b.address,
        b.city,
        b.state,
        b.phone,
        b.website,
        b.category,
        b.rating,
        b.review_count,
        b.status,
        m.id as mockup_id,
        m.status as mockup_status,
        m.mockup_url
      FROM digest_leads dl
      INNER JOIN businesses b ON dl.business_id = b.id
      LEFT JOIN mockups m ON b.id = m.business_id
      WHERE dl.digest_id = ?
      ORDER BY
        CASE dl.tier_slug
          WHEN 'call_first' THEN 1
          WHEN 'good' THEN 2
          WHEN 'worth_a_look' THEN 3
          WHEN 'long_shot' THEN 4
          WHEN 'skip' THEN 5
          ELSE 6
        END,
        COALESCE(dl.rank, 999999),
        dl.score DESC
    `,
    args: [digest.id]
  })

  return {
    digest: {
      id: digest.id,
      date: digest.digest_date,
      search: {
        category: digest.search_category,
        location: digest.search_location
      },
      lead_count: digest.lead_count,
      received_at: digest.received_at
    },
    leads: leadsResult.rows.map(row => ({
      id: row.id,
      place_id: row.place_id,
      rank: row.rank,
      score: row.score,
      tier: {
        slug: row.tier_slug,
        label: row.tier_label
      },
      angle: row.angle,
      note: row.note,
      signals: row.signals ? JSON.parse(String(row.signals)) : null,
      business: {
        id: row.business_id,
        name: row.name,
        address: row.address,
        city: row.city,
        state: row.state,
        phone: row.phone,
        website: row.website,
        category: row.category,
        rating: row.rating,
        review_count: row.review_count,
        status: row.status
      },
      mockup: row.mockup_id ? {
        id: row.mockup_id,
        status: row.mockup_status,
        url: row.mockup_url
      } : null
    }))
  }
})
