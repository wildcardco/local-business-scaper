import { detailsFromPlaceListing, type PlaceDetailKey, type PlaceDetails } from '~~/shared/place-lookup'
import { googlePlaceIdFrom } from '~~/shared/gbp-listing'
import {
  confirmedMatch,
  intakeErrorMessage,
  intakeMatches,
  intakeResultCopy,
  listingLookupFailure,
  mockupPlaceNeedsGoogleId,
  resolveListingLookup,
  type IntakeListing,
  type IntakeQuery
} from '~~/shared/intake-lookup'
import { db } from '~~/server/utils/db'
import { businessCategoryFromListing, searchBusinesses } from '~~/server/utils/openweb-ninja'
import { loadGbpListing } from '~~/server/utils/gbp-load'
import type { OpenWebBusiness } from '~~/shared/types'

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

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toListing(business: OpenWebBusiness): IntakeListing {
  return {
    placeId: business.place_id || '',
    name: business.name || '',
    address: business.full_address || null,
    city: business.city || null,
    state: business.state || null,
    website: business.website || null,
    phone: business.phone_number || null,
    category: businessCategoryFromListing(business)
  }
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
    sql: `SELECT id, place_id, name, city, state, address, phone, website
          FROM businesses WHERE id = ? AND user_id = ?`,
    args: [id, String(user.id)]
  })
  const business = existing.rows[0]
  if (!business) {
    throw createError({ statusCode: 404, message: 'Business not found' })
  }

  const body = await readBody(event).catch(() => ({}))
  const requestedPlaceId = text(body?.placeId)
  const savedPlaceId = googlePlaceIdFrom(business.place_id)

  if (savedPlaceId && !requestedPlaceId) {
    return loadAndStore(id, String(user.id), savedPlaceId)
  }

  const query: IntakeQuery = {
    name: text(body?.name) || text(business.name),
    city: text(body?.city) || text(business.city),
    state: text(body?.state) || text(business.state),
    website: text(body?.website) || text(business.website),
    phone: text(body?.phone) || text(business.phone),
    address: text(body?.address) || text(business.address)
  }
  if (!query.name || (!query.city && !query.state)) {
    throw createError({ statusCode: 400, message: intakeErrorMessage('need-town') })
  }

  let matches
  try {
    const location = [query.city, query.state].filter(Boolean).join(', ')
    const rows = await searchBusinesses({ query: query.name, location, limit: 10 })
    matches = intakeMatches(query, rows.map(toListing))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    const kind = listingLookupFailure(message)
    throw createError({
      statusCode: kind === 'missing-key' ? 500 : 502,
      message: intakeErrorMessage(kind)
    })
  }

  if (requestedPlaceId && !confirmedMatch(matches, requestedPlaceId)) {
    throw createError({
      statusCode: 400,
      message: resolveListingLookup({ requestedPlaceId, matches }).message
    })
  }

  const decision = resolveListingLookup({
    savedPlaceId,
    requestedPlaceId,
    matches
  })
  if (decision.action === 'choose' || decision.action === 'none') {
    const copy = intakeResultCopy(query, matches)
    return {
      status: decision.action,
      found: {},
      matches,
      message: copy.message
    }
  }
  if (!decision.placeId) {
    throw createError({ statusCode: 400, message: decision.message })
  }
  return loadAndStore(id, String(user.id), decision.placeId)
})

async function loadAndStore(id: string, userId: string, placeId: string) {
  let loaded
  try {
    loaded = await loadGbpListing(placeId)
  } catch (error: unknown) {
    const known = error as { statusCode?: number, message?: string }
    if (known.statusCode) throw error
    const message = error instanceof Error ? error.message : ''
    const kind = listingLookupFailure(message)
    throw createError({
      statusCode: kind === 'missing-key' ? 500 : 502,
      message: intakeErrorMessage(kind === 'missing-key' ? 'missing-key' : 'details-failed')
    })
  }

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
  if (!listing) {
    return {
      status: 'loaded' as const,
      found,
      matches: [],
      placeId,
      googleBusinessId: null,
      photoCount: null,
      message: intakeErrorMessage('details-empty')
    }
  }

  const storedPlaceId = googlePlaceIdFrom(listing.place_id) || googlePlaceIdFrom(placeId) || placeId
  await savePlaceIdentity(id, userId, {
    placeId: storedPlaceId,
    googleMapsUrl: text(listing.google_maps_url) || null
  })
  await saveFoundDetails(id, userId, found)
  await saveGbpIdentity(id, userId, loaded, listing)

  const labels = Object.keys(found)
  const filled = labels.length
    ? `Filled from Google: ${labels.join(', ')}.`
    : 'Google did not return those details. Type them in. Empty fields stay empty.'
  return {
    status: 'loaded' as const,
    found,
    matches: [],
    placeId: storedPlaceId,
    googleBusinessId: loaded.googleBusinessId,
    photoCount: loaded.photoCount,
    message: `${filled} ${loaded.photoMessage} This did not start generation.`
  }
}

async function savePlaceIdentity(id: string, userId: string, input: { placeId: string, googleMapsUrl: string | null }) {
  const clash = await db.execute({
    sql: 'SELECT id FROM businesses WHERE user_id = ? AND place_id = ? AND id != ? LIMIT 1',
    args: [userId, input.placeId, id]
  })
  if (clash.rows[0]) {
    throw createError({
      statusCode: 409,
      message: 'That Google place is already saved on another lead. Nothing was changed on this one.'
    })
  }

  await db.execute({
    sql: `UPDATE businesses SET
      place_id = ?,
      google_maps_url = COALESCE(?, google_maps_url),
      updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [input.placeId, input.googleMapsUrl, id, userId]
  })

  const mockups = await db.execute({
    sql: 'SELECT id, place_id FROM mockups WHERE business_id = ? AND user_id = ?',
    args: [id, userId]
  })
  for (const row of mockups.rows) {
    if (!mockupPlaceNeedsGoogleId(row.place_id)) continue
    await db.execute({
      sql: `UPDATE mockups SET place_id = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      args: [input.placeId, String(row.id), userId]
    })
  }
}

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
