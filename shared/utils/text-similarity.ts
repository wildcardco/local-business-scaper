/**
 * Dependency-free similarity for short labels (categories, town names).
 * Token overlap plus a small edit distance, with a cutoff so weak overlaps
 * stay out of the menu.
 */

export const SUGGESTION_MIN_SCORE = 0.48

/**
 * Typos and near-exact labels sit at or above this score ("plumer" → Plumber).
 * Weaker overlaps ("food bank" → Bank, when Food bank is not in the list)
 * stay as suggestions only.
 */
export const CLOSE_MATCH_SCORE = 0.8

export interface PreparedText {
  norm: string
  tokens: string[]
  compact: string
}

export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function prepareSearchText(input: string): PreparedText {
  const norm = normalizeSearchText(input)
  return {
    norm,
    tokens: norm.split(' ').filter(token => token.length > 0),
    compact: norm.replace(/ /g, '')
  }
}

export interface PreparedCategory {
  label: PreparedText
  value: PreparedText
}

export function prepareCategory(label: string, value: string): PreparedCategory {
  return {
    label: prepareSearchText(label),
    value: prepareSearchText(value)
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const rows = b.length + 1
  let prev = Array.from({ length: rows }, (_, index) => index)
  let curr = new Array<number>(rows)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    const aChar = a[i - 1]
    for (let j = 1; j <= b.length; j++) {
      const cost = aChar === b[j - 1] ? 0 : 1
      const insert = curr[j - 1] ?? 0
      const remove = prev[j] ?? 0
      const replace = prev[j - 1] ?? 0
      curr[j] = Math.min(remove + 1, insert + 1, replace + cost)
    }
    const swap = prev
    prev = curr
    curr = swap
  }

  return prev[b.length] ?? 0
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const minLen = Math.min(a.length, b.length)
  if (minLen < 3) return 0
  if (a.startsWith(b) || b.startsWith(a)) {
    return 0.84 + 0.16 * (minLen / Math.max(a.length, b.length))
  }
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  if (dist > 2) return 0
  const similarity = 1 - dist / maxLen
  return similarity >= 0.7 ? similarity : 0
}

function bestTokenSimilarity(token: string, candidates: string[]): number {
  let best = 0
  for (const candidate of candidates) {
    const similarity = tokenSimilarity(token, candidate)
    if (similarity > best) best = similarity
    if (best === 1) return 1
  }
  return best
}

function coverage(source: string[], target: string[]): number {
  if (!source.length) return 0
  const total = source.reduce((sum, token) => sum + bestTokenSimilarity(token, target), 0)
  return total / source.length
}

function compactSimilarity(query: string, candidate: string, queryTokenCount: number, candidateTokenCount: number): number {
  if (!query || !candidate) return 0
  if (query === candidate) return 1
  if (query.length >= 4 && candidate.includes(query)) {
    return 0.9 + 0.08 * (query.length / candidate.length)
  }
  // Edit distance is for a typo in one word ("plumer" → "plumber"), not for
  // multi-word labels that only share a suffix ("hair salon" vs "nail salon").
  if (queryTokenCount !== 1 || candidateTokenCount !== 1) return 0
  const dist = levenshtein(query, candidate)
  if (dist > 2) return 0
  const similarity = 1 - dist / Math.max(query.length, candidate.length)
  return similarity >= 0.7 ? similarity : 0
}

/** Score one free-text query against one prepared category label and value. */
export function scorePreparedCategory(query: PreparedText, category: PreparedCategory): number {
  const { norm: queryNorm, tokens: queryTokens, compact: queryCompact } = query
  if (!queryNorm) return 0
  if (queryNorm === category.label.norm || queryNorm === category.value.norm) return 1

  const labelTokens = category.label.tokens
  const tokenScore = coverage(queryTokens, labelTokens) * 0.7 + coverage(labelTokens, queryTokens) * 0.3
  const compactScore = Math.max(
    compactSimilarity(queryCompact, category.label.compact, queryTokens.length, labelTokens.length),
    compactSimilarity(queryCompact, category.value.compact, queryTokens.length, category.value.tokens.length)
  )
  let score = Math.max(tokenScore, compactScore)

  if (category.label.norm.includes(queryNorm) || category.value.norm.includes(queryNorm)) {
    score = Math.max(score, 0.93)
  }

  return score
}

export function scoreCategoryQuery(query: string, label: string, value: string): number {
  return scorePreparedCategory(prepareSearchText(query), prepareCategory(label, value))
}

/** Rank a town label. The city name (before the first comma) counts as much as the full string. */
export function scoreTownLabel(query: string, label: string): number {
  const main = label.split(',')[0]?.trim() || label
  const prepared = prepareSearchText(query)
  const mainScore = scorePreparedCategory(prepared, prepareCategory(main, main))
  if (main === label) return mainScore
  return Math.max(mainScore, scorePreparedCategory(prepared, prepareCategory(label, label)))
}
