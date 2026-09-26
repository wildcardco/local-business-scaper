import { scoreTownLabel } from '~~/shared/utils/text-similarity'

export const TOWN_SUGGESTION_LIMIT = 8

/**
 * A state abbreviation has to be its own comma-separated piece.
 * "in" / "or" / "me" also appear inside unrelated city names, and treating
 * those as a match used to hide the rest of the list.
 */
export function locationMatchesRegion(label: string, abbreviation: string, name: string): boolean {
  const abbr = abbreviation.trim().toLowerCase()
  const region = name.trim().toLowerCase()
  if ((!abbr || abbr === 'all') && !region) return true

  const parts = label.split(',').map(part => part.trim().toLowerCase())
  return parts.some((part) => {
    if (abbr && abbr !== 'all' && (part === abbr || part.startsWith(`${abbr} `))) return true
    if (region && (part === region || part.startsWith(`${region} `))) return true
    return false
  })
}

export function preferRegionMatches<T extends { label: string }>(
  suggestions: T[],
  abbreviation: string,
  name: string
): T[] {
  if (!abbreviation || abbreviation === 'all') return suggestions
  const matches = suggestions.filter(item => locationMatchesRegion(item.label, abbreviation, name))
  return matches.length ? matches : suggestions
}

/** Best town names first. Ties keep the API's order. */
export function rankTownSuggestions<T extends { label: string }>(
  query: string,
  suggestions: T[],
  limit = TOWN_SUGGESTION_LIMIT
): T[] {
  const needle = query.trim()
  if (!needle) return suggestions.slice(0, limit)
  return suggestions
    .map((item, index) => ({ item, index, score: scoreTownLabel(needle, item.label) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(row => row.item)
}
