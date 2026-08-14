import { db, generateId } from '~~/server/utils/db'
import { calculateInitialScore } from '~~/server/utils/lead-scorer'
import { findOrCreateMockupForBusiness, mapMockup } from '~~/server/utils/mockups'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Business name is required'
    })
  }

  const website = typeof body.website === 'string' && body.website.trim() ? body.website.trim() : null
  const scoring = calculateInitialScore(!!website)

  const businessId = generateId()
  await db.execute({
    sql: `INSERT INTO businesses (
      id, user_id, search_id, name, address, city, state, zip_code,
      phone, website, email, google_maps_url, place_id, category, rating,
      review_count, lead_score, lead_category, status
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    args: [
      businessId,
      user.id,
      name,
      body.address || null,
      body.city || null,
      body.state || null,
      body.zipCode || null,
      body.phone ? String(body.phone) : null,
      website,
      body.email || null,
      body.googleMapsUrl || null,
      body.placeId || null,
      body.category || null,
      body.rating ?? null,
      body.reviewCount ?? null,
      scoring.score,
      scoring.category
    ]
  })

  const mockupRow = await findOrCreateMockupForBusiness(user.id, user.email, {
    id: businessId,
    place_id: body.placeId || null
  })

  const businessResult = await db.execute({
    sql: 'SELECT * FROM businesses WHERE id = ? AND user_id = ?',
    args: [businessId, user.id]
  })

  return {
    success: true,
    business: {
      id: businessId,
      name,
      website,
      placeId: body.placeId || null
    },
    mockup: mapMockup(mockupRow as Record<string, unknown>, businessResult.rows[0] as Record<string, unknown>)
  }
})
