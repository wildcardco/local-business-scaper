import { db } from '~~/server/utils/db'
import { expireStaleMockups, mapMockup } from '~~/server/utils/mockups'
import { applyN8nLeadToMockup } from '~~/server/utils/n8n'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''

  const pending = await db.execute({
    sql: `SELECT id, place_id, status FROM mockups
          WHERE user_id = ?
            AND status IN ('generating', 'writing_pitch', 'enhancing', 'revising')
            AND place_id IS NOT NULL
            AND place_id != ''`,
    args: [user.id]
  })
  await Promise.all(pending.rows.map(row =>
    applyN8nLeadToMockup(user.id, String(row.id), String(row.place_id))
  ))

  await expireStaleMockups(user.id)

  const result = await db.execute({
    sql: `
      SELECT m.*, b.name as b_name, b.website as b_website, b.phone as b_phone, b.email as b_email,
        b.address as b_address, b.city as b_city, b.state as b_state, b.category as b_category,
        b.rating as b_rating, b.review_count as b_review_count, b.place_id as b_place_id, b.id as b_id
      FROM mockups m
      LEFT JOIN businesses b ON m.business_id = b.id
      WHERE m.user_id = ? ${businessId ? 'AND m.business_id = ?' : ''}
      ORDER BY m.updated_at DESC
    `,
    args: businessId ? [user.id, businessId] : [user.id]
  })

  const mockups = result.rows.map((row) => {
    const business = row.b_id
      ? {
          id: row.b_id,
          name: row.b_name,
          website: row.b_website,
          phone: row.b_phone,
          email: row.b_email,
          address: row.b_address,
          city: row.b_city,
          state: row.b_state,
          category: row.b_category,
          rating: row.b_rating,
          review_count: row.b_review_count,
          place_id: row.b_place_id
        }
      : null
    return mapMockup(row as Record<string, unknown>, business as Record<string, unknown> | null)
  })

  return { success: true, mockups }
})
