import { detailsFromPlaceListing } from '~~/shared/place-lookup'
import { intakeErrorMessage } from '~~/shared/intake-lookup'
import { isPlaceId } from '~~/shared/studio-location'
import { businessCategoryFromListing } from '~~/server/utils/openweb-ninja'
import { loadGbpListing } from '~~/server/utils/gbp-load'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const placeId = text(body?.placeId)
  if (!isPlaceId(placeId)) {
    throw createError({ statusCode: 400, message: intakeErrorMessage('details-failed') })
  }

  let loaded
  try {
    loaded = await loadGbpListing(placeId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    if (/RAPIDAPI_KEY is not configured/i.test(message)) {
      throw createError({ statusCode: 500, message: intakeErrorMessage('missing-key') })
    }
    throw createError({ statusCode: 502, message: intakeErrorMessage('details-failed') })
  }
  const listing = loaded.listing
  if (!listing) {
    return {
      found: {},
      placeId,
      googleMapsUrl: null,
      zipCode: null,
      rating: null,
      reviewCount: null,
      googleBusinessId: null,
      gbpPhotos: [],
      photoCount: null,
      photoMessage: loaded.photoMessage,
      message: intakeErrorMessage('details-empty')
    }
  }

  const found = detailsFromPlaceListing({
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
  })

  return {
    found,
    placeId: text(listing.place_id) || placeId,
    googleMapsUrl: text(listing.google_maps_url) || null,
    zipCode: text(listing.postal_code) || null,
    rating: numberOrNull(listing.rating),
    reviewCount: numberOrNull(listing.review_count),
    googleBusinessId: loaded.googleBusinessId,
    gbpPhotos: loaded.gbpPhotos,
    photoCount: loaded.photoCount,
    photoMessage: loaded.photoMessage,
    message: Object.keys(found).length
      ? `Filled from the Google listing you chose. ${loaded.photoMessage} Edit anything that is wrong before you generate.`
      : intakeErrorMessage('details-empty')
  }
})
