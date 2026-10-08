import { isPlaceId } from './studio-location.ts'

export const PLACE_DETAIL_KEYS = ['name', 'website', 'phone', 'email', 'address', 'city', 'state', 'category'] as const

export type PlaceDetailKey = (typeof PLACE_DETAIL_KEYS)[number]
export type PlaceDetails = Partial<Record<PlaceDetailKey, string>>

function text(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || isPlaceId(trimmed)) return ''
  return trimmed
}

function firstText(values: unknown): string {
  if (!Array.isArray(values)) return ''
  for (const value of values) {
    const trimmed = text(value)
    if (trimmed) return trimmed
  }
  return ''
}

/**
 * Fields a place listing actually returned. Blank, missing, and place-id
 * values are left out so the caller does not invent a town or wipe a typed one.
 */
export function detailsFromPlaceListing(listing: {
  name?: unknown
  website?: unknown
  phone_number?: unknown
  phones?: unknown
  emails?: unknown
  full_address?: unknown
  address?: unknown
  city?: unknown
  state?: unknown
  category?: unknown
} | null | undefined): PlaceDetails {
  if (!listing) return {}
  const found: PlaceDetails = {}
  const assign = (key: PlaceDetailKey, value: unknown) => {
    const trimmed = text(value)
    if (trimmed) found[key] = trimmed
  }
  assign('name', listing.name)
  assign('website', listing.website)
  assign('phone', text(listing.phone_number) || firstText(listing.phones))
  assign('email', firstText(listing.emails))
  assign('address', text(listing.full_address) || text(listing.address))
  assign('city', listing.city)
  assign('state', listing.state)
  assign('category', listing.category)
  return found
}
