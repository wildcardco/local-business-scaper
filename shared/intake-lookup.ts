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
  phone?: string
  address?: string
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
  /** Same name after dropping legal suffixes such as Company, Inc, and LLC. */
  nameEquivalent: boolean
  sameCity: boolean
  sameState: boolean
  websiteMatch: boolean
  phoneMatch: boolean
  streetMatch: boolean
  /** Both sides had this fact and they disagreed. A blank listing value is not a conflict. */
  phoneConflict: boolean
  websiteConflict: boolean
  streetConflict: boolean
  /** The query named a town and this listing is in it. */
  townConfirmed: boolean
  score: number
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

const LEGAL_SUFFIXES = new Set([
  'co',
  'company',
  'inc',
  'incorporated',
  'llc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'plc',
  'pc',
  'pllc',
  'llp',
  'lp'
])

const STREET_WORDS = new Set([
  'street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'boulevard', 'blvd',
  'lane', 'ln', 'court', 'ct', 'place', 'pl', 'highway', 'hwy', 'suite', 'ste', 'unit', 'apt'
])

function coreTokens(value: string) {
  const words = nameKey(value).split(' ').filter(word => word && word !== 'the')
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1] || '')) words.pop()
  return words
}

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length > 10) return digits.slice(-10)
  return digits.length === 10 ? digits : ''
}

function streetSignature(value: string) {
  const line = (value.split(',')[0] || value).toLowerCase()
  const words = line.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  const number = words.find(word => /^\d+$/.test(word)) || ''
  const name = words.filter(word => !/^\d+$/.test(word) && !STREET_WORDS.has(word)).join(' ')
  if (!number || !name) return ''
  return `${number} ${name}`
}

function containedName(shorter: string[], longer: string[]) {
  if (shorter.length < 2 || shorter.length >= longer.length) return false
  const haystack = ` ${longer.join(' ')} `
  return haystack.includes(` ${shorter.join(' ')} `)
}

/**
 * Listings the user can choose. Ranking uses the name, town, phone, street,
 * and website that are actually present. A legal suffix such as Company does
 * not by itself make a different business. Nothing is written until the caller
 * loads one place id from this list.
 */
export function intakeMatches(query: IntakeQuery, listings: IntakeListing[]): IntakeMatch[] {
  const queryCore = coreTokens(query.name)
  const queryName = queryCore.join(' ')
  const queryCity = cityKey(query.city)
  const queryState = stateKey(query.state)
  const queryHost = websiteHost(query.website)
  const queryPhone = phoneDigits(query.phone || '')
  const queryStreet = streetSignature(query.address || '')
  const seen = new Set<string>()
  const matches: IntakeMatch[] = []

  for (const listing of listings) {
    const placeId = clean(listing.placeId)
    const name = clean(listing.name)
    if (!placeId || !name || seen.has(placeId)) continue
    const listingCore = coreTokens(name)
    const listingName = listingCore.join(' ')
    const listingCity = cityKey(clean(listing.city))
    const listingState = stateKey(clean(listing.state))
    const listingHost = websiteHost(clean(listing.website))
    const listingPhone = phoneDigits(clean(listing.phone))
    const listingStreet = streetSignature(clean(listing.address))
    const exactName = Boolean(nameKey(query.name)) && nameKey(query.name) === nameKey(name)
    const singleToken = queryCore.length === 1 ? (queryCore[0] || '') : ''
    const nameEquivalent = Boolean(queryName)
      && queryName === listingName
      && (queryCore.length >= 2 || singleToken.length >= 4)
    const sameCity = Boolean(queryCity) && queryCity === listingCity
    const sameState = Boolean(queryState) && queryState === listingState
    const stateAgreed = !queryState || sameState
    const townConfirmed = Boolean(queryCity) && sameCity && stateAgreed
    const websiteMatch = Boolean(queryHost) && queryHost === listingHost
    const websiteConflict = Boolean(queryHost) && Boolean(listingHost) && !websiteMatch
    const phoneMatch = Boolean(queryPhone) && queryPhone === listingPhone
    const phoneConflict = Boolean(queryPhone) && Boolean(listingPhone) && !phoneMatch
    const streetMatch = Boolean(queryStreet) && queryStreet === listingStreet
    const streetConflict = Boolean(queryStreet) && Boolean(listingStreet) && !streetMatch
    const related = containedName(
      queryCore.length <= listingCore.length ? queryCore : listingCore,
      queryCore.length <= listingCore.length ? listingCore : queryCore
    )
    const inTown = !queryCity || sameCity
    const include = stateAgreed && (
      ((nameEquivalent || related) && inTown)
      || websiteMatch
      || phoneMatch
      || (streetMatch && inTown)
    )
    if (!include) continue
    const score = (exactName ? 60 : nameEquivalent ? 50 : related ? 25 : 0)
      + (websiteMatch ? 30 : 0)
      + (phoneMatch ? 30 : 0)
      + (streetMatch ? 25 : 0)
      + (sameCity ? 15 : 0)
      + (sameState ? 10 : 0)
      - (websiteConflict ? 20 : 0)
      - (phoneConflict ? 20 : 0)
      - (streetConflict ? 20 : 0)
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
      nameEquivalent,
      sameCity,
      sameState,
      websiteMatch,
      phoneMatch,
      streetMatch,
      phoneConflict,
      websiteConflict,
      streetConflict,
      townConfirmed,
      score
    })
  }

  matches.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
  return matches.slice(0, 5)
}

/**
 * One listing may be loaded without another click only when it is the only
 * candidate, the name agrees after normal suffix cleanup, the town agrees,
 * and phone, website, and street do not contradict it.
 */
export function confidentChoice(matches: IntakeMatch[]): IntakeMatch | null {
  if (matches.length !== 1) return null
  const match = matches[0]
  if (!match?.nameEquivalent || !match.townConfirmed) return null
  if (match.phoneConflict || match.websiteConflict || match.streetConflict) return null
  return match
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
  if (confidentChoice(matches)) {
    return {
      status: 'confident' as const,
      message: `One Google listing matches ${who}${place ? ` in ${place}` : ''}. Loading it does not start generation.`
    }
  }
  const conflict = matches.length === 1 && Boolean(
    matches[0]?.phoneConflict || matches[0]?.websiteConflict || matches[0]?.streetConflict
  )
  if (conflict) {
    return {
      status: 'matches' as const,
      message: 'One listing is close, but the phone, website, or street does not agree. Choose it only if it is the right business. Nothing is filled in until you do.'
    }
  }
  const named = matches.some(match => match.exactName || match.nameEquivalent)
  return {
    status: 'matches' as const,
    message: matches.length > 1 && named
      ? 'More than one listing fits. Choose the right business. Nothing is filled in until you do.'
      : 'No exact name match. Choose a listing only if it is the right business. Nothing is filled in until you do.'
  }
}

export type ListingLookupAction = 'load-saved' | 'load-confirmed' | 'load-confident' | 'choose' | 'none' | 'rejected'

/**
 * A saved Google place id is loaded as itself. With no id, a single safe
 * match is loaded. Several matches, or a match that only looks similar,
 * wait for the place id the user picked.
 */
export function resolveListingLookup(input: {
  savedPlaceId?: string | null
  requestedPlaceId?: string | null
  matches: IntakeMatch[]
}): { action: ListingLookupAction, placeId: string | null, message: string } {
  const requested = clean(input.requestedPlaceId)
  if (requested) {
    const chosen = confirmedMatch(input.matches, requested)
    if (!chosen) {
      return {
        action: 'rejected',
        placeId: null,
        message: 'That listing is not one of the matches for this lead. Nothing was saved.'
      }
    }
    return { action: 'load-confirmed', placeId: chosen.placeId, message: '' }
  }

  const saved = clean(input.savedPlaceId)
  if (saved && /^ChIJ[A-Za-z0-9_-]{8,}$/.test(saved)) {
    return { action: 'load-saved', placeId: saved, message: '' }
  }

  const confident = confidentChoice(input.matches)
  if (confident) return { action: 'load-confident', placeId: confident.placeId, message: '' }
  if (input.matches.length) {
    return {
      action: 'choose',
      placeId: null,
      message: 'More than one listing fits. Choose the right business. Nothing is filled in until you do.'
    }
  }
  return {
    action: 'none',
    placeId: null,
    message: 'No listing matched this lead. Nothing was filled in.'
  }
}

export function listingLookupFailure(message: string) {
  if (/RAPIDAPI_KEY is not configured/i.test(message)) return 'missing-key' as const
  return 'search-failed' as const
}

/** A mockup still on a synthetic id should follow the Google place id once the lead has one. */
export function mockupPlaceNeedsGoogleId(current: unknown) {
  if (typeof current !== 'string') return true
  const value = current.trim()
  return !value || value.startsWith('studio_')
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
