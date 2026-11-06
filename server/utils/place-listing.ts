export interface PlaceListing {
  name?: unknown
  website?: unknown
  phone_number?: unknown
  full_address?: unknown
  address?: unknown
  city?: unknown
  state?: unknown
  postal_code?: unknown
  google_maps_url?: unknown
  place_id?: unknown
  rating?: unknown
  review_count?: unknown
  type?: unknown
  subtypes?: unknown
  types?: unknown
  emails_and_contacts?: { emails?: unknown, phone_numbers?: unknown }
}

/** One Google listing from the existing RapidAPI business-details call. */
export async function fetchPlaceListing(placeId: string): Promise<PlaceListing | null> {
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

  const data = await response.json() as { data?: PlaceListing[] }
  return data.data?.[0] || null
}
