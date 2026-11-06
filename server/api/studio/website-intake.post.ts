import { businessCategoryFromListing, searchBusinessesByText } from '~~/server/utils/openweb-ninja'
import type { OpenWebBusiness } from '~~/shared/types'
import { parseWebsiteIntakeUrl, websiteInspection, websiteIntakeMatches, type WebsiteListing } from '~~/shared/website-intake'

function toListing(business: OpenWebBusiness): WebsiteListing {
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

  const body = await readBody(event)
  const parsed = parseWebsiteIntakeUrl(body?.website)
  if (!parsed.ok) {
    throw createError({ statusCode: 400, message: parsed.message })
  }

  try {
    const rows = await searchBusinessesByText(parsed.host, 10)
    const matches = websiteIntakeMatches(parsed.host, rows.map(toListing))
    return websiteInspection({ url: parsed.url, host: parsed.host, matches })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    if (!/RAPIDAPI_KEY is not configured|Local Business Data API error/i.test(message)) {
      throw createError({ statusCode: 502, message: 'The business search did not answer. Nothing was filled in.' })
    }
    return websiteInspection({
      url: parsed.url,
      host: parsed.host,
      matches: [],
      lookupFailed: true
    })
  }
})
