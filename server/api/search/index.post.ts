import { db, generateId } from '~~/server/utils/db'
import { searchBusinesses, transformBusinessData } from '~~/server/utils/openweb-ninja'
import { calculateInitialScore } from '~~/server/utils/lead-scorer'

// Extract state abbreviation or name from location string
function extractStateFromLocation(location: string): string | null {
  // Common patterns: "City, State", "City, ST", "City, State, USA"
  const parts = location.split(',').map(p => p.trim())

  // State abbreviations
  const stateAbbreviations: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming'
  }

  for (const part of parts) {
    const upperPart = part.toUpperCase()
    // Check if it's a state abbreviation
    if (stateAbbreviations[upperPart]) {
      return upperPart
    }
    // Check if it's a full state name
    for (const [abbr, name] of Object.entries(stateAbbreviations)) {
      if (name.toLowerCase() === part.toLowerCase()) {
        return abbr
      }
    }
  }
  return null
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)

  const { query, location, limit = 20, lat, lng, placeId } = body

  if (!query || !location) {
    throw createError({
      statusCode: 400,
      message: 'Query and location are required'
    })
  }

  // Extract expected state from location for filtering
  const expectedState = extractStateFromLocation(location)

  try {
    // Create search record
    const searchId = generateId()
    await db.execute({
      sql: `INSERT INTO searches (id, user_id, query, location) VALUES (?, ?, ?, ?)`,
      args: [searchId, user.id, query, location]
    })

    // Search for businesses using the API with optional coordinates
    // Request more results than needed so we can filter
    const requestLimit = expectedState ? Math.min((limit as number) * 2, 100) : limit
    let businesses = await searchBusinesses({ query, location, limit: requestLimit, lat, lng, placeId })

    // Post-filter: Only keep businesses that match the expected state
    if (expectedState && businesses.length > 0) {
      const stateAbbreviations: Record<string, string> = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
        'WI': 'Wisconsin', 'WY': 'Wyoming'
      }

      const expectedStateName = stateAbbreviations[expectedState]?.toLowerCase()

      businesses = businesses.filter(b => {
        if (!b.state) return false
        const businessState = b.state.toUpperCase().trim()
        const businessStateLower = b.state.toLowerCase().trim()
        // Match by abbreviation or full name
        return businessState === expectedState ||
               businessStateLower === expectedStateName
      })

      // Limit to requested amount after filtering
      businesses = businesses.slice(0, limit as number)
    }

    // Transform and save businesses to database
    const savedBusinesses = []
    for (const business of businesses) {
      const businessData = transformBusinessData(business, searchId)

      // Calculate initial lead score
      const hasWebsite = !!businessData.website
      const scoring = calculateInitialScore(
        hasWebsite,
        businessData.reviewCount || undefined,
        businessData.rating || undefined
      )

      // Check if business already exists (by placeId) for this user
      let existingId = null
      if (businessData.placeId) {
        const existing = await db.execute({
          sql: 'SELECT id FROM businesses WHERE place_id = ? AND user_id = ?',
          args: [businessData.placeId, user.id]
        })
        if (existing.rows.length > 0) {
          existingId = existing.rows[0].id
        }
      }

      if (existingId) {
        // Update existing business
        await db.execute({
          sql: `UPDATE businesses SET 
            search_id = ?, name = ?, address = ?, city = ?, state = ?, zip_code = ?,
            phone = ?, website = ?, google_maps_url = ?, category = ?, rating = ?,
            review_count = ?, price_level = ?, lead_score = ?, lead_category = ?,
            updated_at = datetime('now')
            WHERE id = ?`,
          args: [
            searchId, businessData.name, businessData.address, businessData.city,
            businessData.state, businessData.zipCode, businessData.phone,
            businessData.website, businessData.googleMapsUrl, businessData.category,
            businessData.rating, businessData.reviewCount, businessData.priceLevel,
            scoring.score, scoring.category, existingId
          ]
        })
        savedBusinesses.push({ id: existingId, ...businessData, leadScore: scoring.score, leadCategory: scoring.category })
      } else {
        // Create new business
        const businessId = generateId()
        await db.execute({
          sql: `INSERT INTO businesses (
            id, user_id, search_id, name, address, city, state, zip_code,
            phone, website, google_maps_url, place_id, category, rating,
            review_count, price_level, lead_score, lead_category
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            businessId, user.id, searchId, businessData.name, businessData.address,
            businessData.city, businessData.state, businessData.zipCode, businessData.phone,
            businessData.website, businessData.googleMapsUrl, businessData.placeId,
            businessData.category, businessData.rating, businessData.reviewCount,
            businessData.priceLevel, scoring.score, scoring.category
          ]
        })
        savedBusinesses.push({ id: businessId, ...businessData, leadScore: scoring.score, leadCategory: scoring.category })
      }
    }

    return {
      success: true,
      search: {
        id: searchId,
        query,
        location,
        createdAt: new Date().toISOString()
      },
      businesses: savedBusinesses,
      count: savedBusinesses.length
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to search businesses: ${errorMessage}`
    })
  }
})
