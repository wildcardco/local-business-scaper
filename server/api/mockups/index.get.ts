import { db } from '~~/server/utils/db'
import { expireStaleMockups, mapMockup } from '~~/server/utils/mockups'
import { applyN8nLeadToMockup } from '~~/server/utils/n8n'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { STUDIO_OWNERS, studioOwnerBySlug } from '~~/shared/studio-owners'

const MOCKUP_SELECT = `
  SELECT m.*, b.name as b_name, b.website as b_website, b.phone as b_phone, b.email as b_email,
    b.address as b_address, b.city as b_city, b.state as b_state, b.category as b_category,
    b.rating as b_rating, b.review_count as b_review_count, b.place_id as b_place_id, b.id as b_id
  FROM mockups m
  LEFT JOIN businesses b ON m.business_id = b.id
`

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''
  const requestedOwner = typeof query.owner === 'string' ? query.owner : ''
  const viewerOwner = ownerSlugFromEmail(user.email)
  const teammate = requestedOwner && requestedOwner !== 'mine' && requestedOwner !== viewerOwner
    ? studioOwnerBySlug(requestedOwner)
    : null

  if (requestedOwner && requestedOwner !== 'mine' && requestedOwner !== viewerOwner && !teammate) {
    throw createError({ statusCode: 400, message: 'Unknown owner. Use mine, ryan, chase, or aaron.' })
  }

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

  const mineCount = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM mockups WHERE user_id = ?',
    args: [user.id]
  })

  const result = teammate
    ? await db.execute({
        sql: `${MOCKUP_SELECT}
         JOIN users u ON u.id = m.user_id
         WHERE lower(u.email) = ?
         ORDER BY m.updated_at DESC`,
        args: [teammate.email]
      })
    : await db.execute({
        sql: `${MOCKUP_SELECT}
         WHERE m.user_id = ? ${businessId ? 'AND m.business_id = ?' : ''}
         ORDER BY m.updated_at DESC`,
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

  return {
    success: true,
    mockups,
    viewerOwner,
    scope: teammate ? teammate.slug : 'mine',
    owners: STUDIO_OWNERS.map(owner => ({
      slug: owner.slug,
      label: owner.label,
      isViewer: owner.slug === viewerOwner
    })),
    counts: {
      mine: Number(mineCount.rows[0]?.count || 0),
      showing: mockups.length
    }
  }
})
