const GOOGLE_PLACE_ID = /^ChIJ[A-Za-z0-9_-]{8,}$/
const STUDIO_PLACE_ID = /^studio_[A-Za-z0-9_]+$/

export function isPlaceId(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return GOOGLE_PLACE_ID.test(trimmed) || STUDIO_PLACE_ID.test(trimmed)
}

export function parseUsCityState(address: string | null | undefined): { city: string | null, state: string | null } {
  if (!address) return { city: null, state: null }
  const parts = address.split(',').map(part => part.trim()).filter(Boolean)
  for (let index = parts.length - 1; index >= 1; index--) {
    const stateMatch = parts[index].match(/^([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/)
    if (!stateMatch) continue
    const city = parts[index - 1]
    if (!city || /^\d/.test(city) || isPlaceId(city)) continue
    return { city, state: stateMatch[1] }
  }
  return { city: null, state: null }
}

export function locationLabel(input: {
  city?: string | null
  state?: string | null
  address?: string | null
  category?: string | null
}): string {
  const parsed = parseUsCityState(input.address)
  const city = input.city && !isPlaceId(input.city) ? input.city.trim() : (parsed.city || '')
  const state = input.state && !isPlaceId(input.state) ? input.state.trim() : (parsed.state || '')
  if (city && state) return `${city}, ${state}`
  if (city) return city
  if (input.category && !isPlaceId(input.category)) return input.category
  return 'City not on file'
}
