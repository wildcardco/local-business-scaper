/** One re-roll per owner per Central Time day is unmarked. Later ones must acknowledge API cost. */
export function rerollNeedsCostWarning(count: number): boolean {
  return count >= 1
}

export function normalizeRerollCategory(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/\s+/g, ' ').slice(0, 80)
}

/**
 * Random wins over a typed category. The word "random" is not a business type.
 * Returns the payload fields n8n should read.
 */
export function rerollWebhookChoice(input: { random?: unknown, category?: unknown }): {
  random: boolean
  category: string
} | { error: string } {
  const category = normalizeRerollCategory(input.category)
  const random = input.random === true || category.toLowerCase() === 'random'
  if (random) return { random: true, category: 'random' }
  if (!category) return { error: 'Pick a category or Random.' }
  return { random: false, category }
}
