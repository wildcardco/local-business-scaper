import categoryNames from '~~/shared/data/google-business-categories.json'
import { businessCategories } from '~~/app/data/business-categories'
import {
  prepareCategory,
  prepareSearchText,
  scorePreparedCategory,
  SUGGESTION_MIN_SCORE,
  type PreparedCategory
} from '~~/shared/utils/text-similarity'

export interface GoogleCategoryMatch {
  label: string
  value: string
  group?: string
  score: number
}

interface IndexedCategory {
  label: string
  value: string
  group?: string
  prepared: PreparedCategory
}

const SUGGESTION_LIMIT = 8
const PREFIX_LENGTH = 2

function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const popularByNorm = new Map<string, (typeof businessCategories)[number]>()
for (const category of businessCategories) {
  popularByNorm.set(normalizeKey(category.label), category)
  popularByNorm.set(normalizeKey(category.value), category)
}

function toIndexed(label: string, value: string, group?: string): IndexedCategory {
  return {
    label,
    value,
    group,
    prepared: prepareCategory(label, value)
  }
}

const indexed: IndexedCategory[] = []
const seenNorms = new Set<string>()
const prefixBuckets = new Map<string, number[]>()

function remember(category: IndexedCategory) {
  const key = category.prepared.label.norm
  if (!key || seenNorms.has(key)) return
  seenNorms.add(key)
  const index = indexed.length
  indexed.push(category)
  const prefixes = new Set<string>()
  for (const token of category.prepared.label.tokens) {
    if (token.length >= PREFIX_LENGTH) prefixes.add(token.slice(0, PREFIX_LENGTH))
  }
  if (category.prepared.label.compact.length >= PREFIX_LENGTH) {
    prefixes.add(category.prepared.label.compact.slice(0, PREFIX_LENGTH))
  }
  for (const prefix of prefixes) {
    const bucket = prefixBuckets.get(prefix)
    if (bucket) bucket.push(index)
    else prefixBuckets.set(prefix, [index])
  }
}

for (const name of categoryNames) {
  const popular = popularByNorm.get(normalizeKey(name))
  remember(toIndexed(popular?.label ?? name, popular?.value ?? name, popular?.group))
}

for (const category of businessCategories) {
  remember(toIndexed(category.label, category.value, category.group))
}

function candidateIndexes(queryTokens: string[], queryCompact: string): number[] {
  const indexes = new Set<number>()
  const prefixes = new Set<string>()
  for (const token of queryTokens) {
    if (token.length >= PREFIX_LENGTH) prefixes.add(token.slice(0, PREFIX_LENGTH))
  }
  if (queryCompact.length >= PREFIX_LENGTH) prefixes.add(queryCompact.slice(0, PREFIX_LENGTH))

  for (const prefix of prefixes) {
    const bucket = prefixBuckets.get(prefix)
    if (!bucket) continue
    for (const index of bucket) indexes.add(index)
  }
  return indexes.size ? [...indexes] : indexed.map((_, index) => index)
}

/**
 * Rank the full Google Business Profile category list.
 * The grouped preset list is what the menu shows before typing; this is the
 * search. A prefix index keeps the scan small enough to run on each keystroke.
 */
export function suggestGoogleCategories(input: string | null | undefined, limit = SUGGESTION_LIMIT): GoogleCategoryMatch[] {
  const query = prepareSearchText(input?.trim() ?? '')
  if (query.norm.length < 2) return []

  const matches: GoogleCategoryMatch[] = []
  for (const index of candidateIndexes(query.tokens, query.compact)) {
    const category = indexed[index]
    if (!category) continue
    const score = scorePreparedCategory(query, category.prepared)
    if (score < SUGGESTION_MIN_SCORE) continue
    matches.push({
      label: category.label,
      value: category.value,
      group: category.group,
      score
    })
  }

  matches.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return matches.slice(0, limit)
}
