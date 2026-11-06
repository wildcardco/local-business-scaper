import { db, generateId } from '~~/server/utils/db'
import { calculateInitialScore } from '~~/server/utils/lead-scorer'
import { findOrCreateMockupForBusiness, mapMockup } from '~~/server/utils/mockups'
import { gbpPhotosFrom, googleBusinessIdFrom, photoCountFrom } from '~~/shared/gbp-listing'

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
  const placeId = typeof body.placeId === 'string' && body.placeId.trim() ? body.placeId.trim() : null
  const fields = [
    name,
    body.address || null,
    body.city || null,
    body.state || null,
    body.zipCode || null,
    body.phone ? String(body.phone) : null,
    website,
    body.email || null,
    body.googleMapsUrl || null,
    body.category || null,
    body.rating ?? null,
    body.reviewCount ?? null,
    scoring.score,
    scoring.category
  ]

  let businessId = ''
  if (placeId) {
    const existing = await db.execute({
      sql: 'SELECT id FROM businesses WHERE user_id = ? AND place_id = ? LIMIT 1',
      args: [user.id, placeId]
    })
    const existingId = existing.rows[0]?.id ? String(existing.rows[0].id) : ''
    if (existingId) {
      businessId = existingId
      await db.execute({
        sql: `UPDATE businesses SET
          name = ?, address = ?, city = ?, state = ?, zip_code = ?,
          phone = ?, website = ?, email = ?, google_maps_url = ?, category = ?,
          rating = ?, review_count = ?, lead_score = ?, lead_category = ?,
          updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
        args: [...fields, businessId, user.id]
      })
    }
  }

  if (!businessId) {
    businessId = generateId()
    await db.execute({
      sql: `INSERT INTO businesses (
        id, user_id, search_id, name, address, city, state, zip_code,
        phone, website, email, google_maps_url, place_id, category, rating,
        review_count, lead_score, lead_category, status
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      args: [
        businessId,
        user.id,
        ...fields.slice(0, 9),
        placeId,
        ...fields.slice(9)
      ]
    })
  }

  if (body.gbpLoaded === true) {
    const photos = gbpPhotosFrom(body.gbpPhotos)
    const photoCount = photoCountFrom(body.photoCount, photos)
    await db.execute({
      sql: `UPDATE businesses SET
        google_business_id = ?, gbp_photos = ?, photo_count = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`,
      args: [
        googleBusinessIdFrom(body.googleBusinessId),
        photos.length ? JSON.stringify(photos) : null,
        photoCount,
        businessId,
        user.id
      ]
    })
  }

  const mockupRow = await findOrCreateMockupForBusiness(user.id, user.email, {
    id: businessId,
    place_id: placeId
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
      placeId
    },
    mockup: mapMockup(mockupRow as Record<string, unknown>, businessResult.rows[0] as Record<string, unknown>)
  }
})
