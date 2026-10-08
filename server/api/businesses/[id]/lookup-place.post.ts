import { detailsFromPlaceListing, type PlaceDetailKey, type PlaceDetails } from '~~/shared/place-lookup'
import { db } from '~~/server/utils/db'
import { businessCategoryFromListing } from '~~/server/utils/openweb-ninja'

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

  const listing = await fetchPlaceListing(placeId)
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

  const labels = Object.keys(found)
  return {
    found,
    message: labels.length
      ? `Filled from Google: ${labels.join(', ')}.`
      : 'Google did not return those details. Type them in. Empty fields stay empty.'
  }
})

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

async function fetchPlaceListing(placeId: string) {
  const config = useRuntimeConfig()
  if (!config.rapidApiKey) {
    throw createError({
      statusCode: 500,
      message: 'RAPIDAPI_KEY is not configured. Look up uses the existing RapidAPI business-details call. Type the town until that key is set.'
    })
  }

  const query = new URLSearchParams({
    business_id: placeId,
    extract_emails_and_contacts: 'true',
    extract_share_link: 'false',
    region: 'us',
    language: 'en'
  })
  const response = await fetch(`https://${config.rapidApiHost}/business-details?${query}`, {
    headers: {
      'X-RapidAPI-Key': config.rapidApiKey,
      'X-RapidAPI-Host': config.rapidApiHost
    }
  })
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: `Google listing lookup failed (${response.status}). Nothing was changed. Type the details.`
    })
  }

  const data = await response.json() as { data?: Record<string, unknown>[] }
  const listing = data.data?.[0]
  if (!listing) return null
  return listing as {
    name?: unknown
    website?: unknown
    phone_number?: unknown
    full_address?: unknown
    address?: unknown
    city?: unknown
    state?: unknown
    type?: unknown
    subtypes?: unknown
    types?: unknown
    emails_and_contacts?: { emails?: unknown, phone_numbers?: unknown }
  }
}
