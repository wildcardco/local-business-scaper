import type { BusinessSearchParams, OpenWebBusiness } from '~~/shared/types'

export async function searchBusinesses(params: BusinessSearchParams): Promise<OpenWebBusiness[]> {
  const config = useRuntimeConfig()

  if (!config.rapidApiKey) {
    throw new Error('RAPIDAPI_KEY is not configured')
  }

  // Build search parameters
  const searchParamsObj: Record<string, string> = {
    query: `${params.query} in ${params.location}`,
    limit: String(params.limit || 20),
    language: 'en',
    region: 'us'
  }

  // Add coordinates if available for precise location filtering
  // This ensures we only get results from the specific city selected
  if (params.lat && params.lng) {
    searchParamsObj.lat = String(params.lat)
    searchParamsObj.lng = String(params.lng)
    // Use a tighter zoom level when we have coordinates to focus on the specific area
    searchParamsObj.zoom = '14'
  }

  const searchParams = new URLSearchParams(searchParamsObj)

  const response = await fetch(
    `https://${config.rapidApiHost}/search?${searchParams}`,
    {
      headers: {
        'X-RapidAPI-Key': config.rapidApiKey,
        'X-RapidAPI-Host': config.rapidApiHost
      }
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Local Business Data API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.data || []
}

// Transform API response to our database model format
export function transformBusinessData(business: OpenWebBusiness, searchId: string) {
  // Extract first email from emails_and_contacts if available
  const email = business.emails_and_contacts?.emails?.[0] || null
  
  return {
    searchId,
    name: business.name || 'Unknown Business',
    address: business.full_address || null,
    city: business.city || null,
    state: business.state || null,
    zipCode: business.postal_code || null,
    phone: business.phone_number || null,
    email,
    website: business.website || null,
    googleMapsUrl: business.google_maps_url || null,
    placeId: business.place_id || null,
    category: business.types?.[0] || null,
    rating: business.rating || null,
    reviewCount: business.review_count || null,
    priceLevel: business.price_level || null
  }
}

