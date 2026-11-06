import { intakeErrorMessage, intakeMatches, intakeResultCopy, type IntakeListing, type IntakeQuery } from '~~/shared/intake-lookup'
import { businessCategoryFromListing, searchBusinesses } from '~~/server/utils/openweb-ninja'
import type { OpenWebBusiness } from '~~/shared/types'

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

  const body = await readBody(event)
  const query: IntakeQuery = {
    name: text(body?.name),
    city: text(body?.city),
    state: text(body?.state),
    website: text(body?.website),
    phone: text(body?.phone),
    address: text(body?.address)
  }
  if (!query.name || (!query.city && !query.state)) {
    throw createError({ statusCode: 400, message: intakeErrorMessage('need-town') })
  }

  const location = [query.city, query.state].filter(Boolean).join(', ')
  try {
    const rows = await searchBusinesses({ query: query.name, location, limit: 10 })
    const matches = intakeMatches(query, rows.map(toListing))
    const copy = intakeResultCopy(query, matches)
    return { matches, status: copy.status, message: copy.message }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    if (/RAPIDAPI_KEY is not configured/i.test(message)) {
      throw createError({ statusCode: 500, message: intakeErrorMessage('missing-key') })
    }
    throw createError({ statusCode: 502, message: intakeErrorMessage('search-failed') })
  }
})
