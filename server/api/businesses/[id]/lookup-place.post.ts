import { detailsFromPlaceListing, type PlaceDetailKey, type PlaceDetails } from '~~/shared/place-lookup'
import { db } from '~~/server/utils/db'
import { businessCategoryFromListing } from '~~/server/utils/openweb-ninja'
import { loadGbpListing } from '~~/server/utils/gbp-load'

const COLUMNS: Record<PlaceDetailKey, string> = {
  name: 'name',
  website: 'website',
  phone: 'phone',
  email: 'email',
  address: 'address',
  city: 'city',
  state: 'state',
  category: 'category'
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const existing = await db.execute({
    sql: 'SELECT id, place_id FROM businesses WHERE id = ? AND user_id = ?',
    args: [id, String(user.id)]
  })
  const business = existing.rows[0]
  if (!business) {
    throw createError({ statusCode: 404, message: 'Business not found' })
  }

  const placeId = typeof business.place_id === 'string' ? business.place_id.trim() : ''
  if (!placeId) {
    throw createError({
      statusCode: 400,
      message: 'No Google place id on this lead. Type the town and the other details.'
    })
  }

  const loaded = await loadGbpListing(placeId)
  const listing = loaded.listing
  const found = detailsFromPlaceListing(listing
    ? {
        name: listing.name,
        website: listing.website,
        phone_number: listing.phone_number,
        phones: listing.emails_and_contacts?.phone_numbers,
        emails: listing.emails_and_contacts?.emails,
        full_address: listing.full_address,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        category: businessCategoryFromListing(listing)
      }
    : null)

  await saveFoundDetails(id, String(user.id), found)
  await saveGbpIdentity(id, String(user.id), loaded, listing)

  const labels = Object.keys(found)
  const filled = labels.length
    ? `Filled from Google: ${labels.join(', ')}.`
    : 'Google did not return those details. Type them in. Empty fields stay empty.'
  return {
    found,
    googleBusinessId: loaded.googleBusinessId,
    photoCount: loaded.photoCount,
    message: `${filled} ${loaded.photoMessage}`
  }
})

async function saveGbpIdentity(id: string, userId: string, loaded: {
  googleBusinessId: string | null
  gbpPhotos: unknown
  photoCount: number | null
}, listing: { postal_code?: unknown, rating?: unknown, review_count?: unknown } | null) {
  const zip = typeof listing?.postal_code === 'string' ? listing.postal_code.trim() : ''
  const rating = typeof listing?.rating === 'number' ? listing.rating : null
  const reviewCount = typeof listing?.review_count === 'number' ? listing.review_count : null
  await db.execute({
    sql: `UPDATE businesses SET
      google_business_id = ?,
      gbp_photos = ?,
      photo_count = ?,
      zip_code = COALESCE(?, zip_code),
      rating = COALESCE(?, rating),
      review_count = COALESCE(?, review_count),
      updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [
      loaded.googleBusinessId,
      loaded.gbpPhotos && Array.isArray(loaded.gbpPhotos) && loaded.gbpPhotos.length
        ? JSON.stringify(loaded.gbpPhotos)
        : null,
      loaded.photoCount,
      zip || null,
      rating,
      reviewCount,
      id,
      userId
    ]
  })
}

async function saveFoundDetails(id: string, userId: string, found: PlaceDetails) {
  const sets: string[] = []
  const args: string[] = []
  for (const [key, column] of Object.entries(COLUMNS) as [PlaceDetailKey, string][]) {
    const value = found[key]
    if (!value) continue
    sets.push(`${column} = ?`)
    args.push(value)
  }
  if (!sets.length) return
  sets.push(`updated_at = datetime('now')`)
  args.push(id, userId)
  await db.execute({
    sql: `UPDATE businesses SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    args
  })
}
