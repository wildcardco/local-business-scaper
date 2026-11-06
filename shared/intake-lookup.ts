import { PLACE_DETAIL_KEYS, type PlaceDetailKey, type PlaceDetails } from './place-lookup.ts'

const STATE_NAMES: Record<string, string> = {
  AL: 'alabama',
  AK: 'alaska',
  AZ: 'arizona',
  AR: 'arkansas',
  CA: 'california',
  CO: 'colorado',
  CT: 'connecticut',
  DE: 'delaware',
  FL: 'florida',
  GA: 'georgia',
  HI: 'hawaii',
  ID: 'idaho',
  IL: 'illinois',
  IN: 'indiana',
  IA: 'iowa',
  KS: 'kansas',
  KY: 'kentucky',
  LA: 'louisiana',
  ME: 'maine',
  MD: 'maryland',
  MA: 'massachusetts',
  MI: 'michigan',
  MN: 'minnesota',
  MS: 'mississippi',
  MO: 'missouri',
  MT: 'montana',
  NE: 'nebraska',
  NV: 'nevada',
  NH: 'new hampshire',
  NJ: 'new jersey',
  NM: 'new mexico',
  NY: 'new york',
  NC: 'north carolina',
  ND: 'north dakota',
  OH: 'ohio',
  OK: 'oklahoma',
  OR: 'oregon',
  PA: 'pennsylvania',
  RI: 'rhode island',
  SC: 'south carolina',
  SD: 'south dakota',
  TN: 'tennessee',
  TX: 'texas',
  UT: 'utah',
  VT: 'vermont',
  VA: 'virginia',
  WA: 'washington',
  WV: 'west virginia',
  WI: 'wisconsin',
  WY: 'wyoming'
}

export interface IntakeQuery {
  name: string
  city: string
  state: string
  website: string
}

export interface IntakeListing {
  placeId: string
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  website?: string | null
  phone?: string | null
  category?: string | null
}

export interface IntakeMatch extends IntakeListing {
  exactName: boolean
  sameCity: boolean
  sameState: boolean
  websiteMatch: boolean
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function nameKey(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function cityKey(value: string) {
  return value.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

function stateKey(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/\./g, '')
  if (!trimmed) return ''
  const upper = trimmed.toUpperCase()
  if (STATE_NAMES[upper]) return upper
  const found = Object.entries(STATE_NAMES).find(([, name]) => name === trimmed)
  return found ? found[0] : trimmed
}

export function websiteHost(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function relatedNames(queryName: string, listingName: string) {
  if (!queryName || !listingName) return false
  if (queryName === listingName) return true
  const shorter = queryName.length <= listingName.length ? queryName : listingName
  const longer = shorter === queryName ? listingName : queryName
  if (shorter.split(' ').length < 2) return false
  return ` ${longer} `.includes(` ${shorter} `)
}

/**
 * Listings the user can choose. An exact or closely named business in the
 * requested town is marked, and a matching website in that state stays in the
 * list even when the Google name differs. Nothing is applied until
 * confirmedMatch is given that listing's place id.
 */
export function intakeMatches(query: IntakeQuery, listings: IntakeListing[]): IntakeMatch[] {
  const queryName = nameKey(query.name)
  const queryCity = cityKey(query.city)
  const queryState = stateKey(query.state)
  const queryHost = websiteHost(query.website)
  const seen = new Set<string>()
  const matches: IntakeMatch[] = []

  for (const listing of listings) {
    const placeId = clean(listing.placeId)
    const name = clean(listing.name)
    if (!placeId || !name || seen.has(placeId)) continue
    const listingName = nameKey(name)
    const listingCity = cityKey(clean(listing.city))
    const listingState = stateKey(clean(listing.state))
    const listingHost = websiteHost(clean(listing.website))
    const exactName = Boolean(queryName) && queryName === listingName
    const sameCity = Boolean(queryCity) && queryCity === listingCity
    const sameState = Boolean(queryState) && queryState === listingState
    const websiteMatch = Boolean(queryHost) && queryHost === listingHost
    const cityOk = !queryCity || sameCity
    const stateOk = !queryState || sameState
    const related = relatedNames(queryName, listingName)
    const include = stateOk && (
      (exactName && cityOk)
      || (related && !exactName && cityOk)
      || websiteMatch
    )
    if (!include) continue
    seen.add(placeId)
    matches.push({
      placeId,
      name,
      address: clean(listing.address) || null,
      city: clean(listing.city) || null,
      state: clean(listing.state) || null,
      website: clean(listing.website) || null,
      phone: clean(listing.phone) || null,
      category: clean(listing.category) || null,
      exactName,
      sameCity,
      sameState,
      websiteMatch
    })
  }

  matches.sort((left, right) => {
    const score = (match: IntakeMatch) => (match.exactName ? 4 : 0) + (match.websiteMatch ? 2 : 0) + (match.sameCity ? 1 : 0)
    return score(right) - score(left)
  })
  return matches.slice(0, 5)
}

/** The listing the user picked. A missing or unknown id picks nothing, even when one exact match is in the list. */
export function confirmedMatch(matches: IntakeMatch[], placeId: string | null | undefined): IntakeMatch | null {
  const id = clean(placeId)
  if (!id) return null
  return matches.find(match => match.placeId === id) || null
}

/** Copy returned details onto the form. A blank lookup value keeps what the user already typed. */
export function fillIntakeFields<T extends PlaceDetails>(current: T, found: PlaceDetails): T {
  const next = { ...current }
  for (const key of PLACE_DETAIL_KEYS) {
    const value = found[key]
    if (value) next[key as PlaceDetailKey] = value
  }
  return next
}

export function intakeResultCopy(query: IntakeQuery, matches: IntakeMatch[]) {
  const place = [query.city.trim(), query.state.trim()].filter(Boolean).join(', ')
  const who = query.name.trim() || 'that business'
  if (!matches.length) {
    return {
      status: 'none' as const,
      message: `No listing matched ${who}${place ? ` in ${place}` : ''}. Nothing was filled in. Type the details, or try the name as it appears on Google.`
    }
  }
  const exact = matches.some(match => match.exactName)
  return {
    status: 'matches' as const,
    message: exact
      ? 'Choose the listing. The form stays as you typed it until you do.'
      : 'No exact name match. Choose a listing only if it is the right business. The form stays as you typed it until you do.'
  }
}

export function intakeErrorMessage(kind: 'need-town' | 'missing-key' | 'search-failed' | 'details-failed' | 'details-empty') {
  if (kind === 'need-town') {
    return 'Enter the business name and a city or state before looking it up. Nothing was filled in.'
  }
  if (kind === 'missing-key') {
    return 'Business lookup is not configured. Nothing was filled in. Type the details.'
  }
  if (kind === 'details-failed') {
    return 'That listing did not load. Nothing was filled in.'
  }
  if (kind === 'details-empty') {
    return 'That listing did not include details. Nothing was filled in. You can still type them.'
  }
  return 'The business search did not answer. Nothing was filled in. Type the details.'
}
