/** One re-roll per owner per Central Time day is unmarked. Later ones must acknowledge API cost. */
export function rerollNeedsCostWarning(count: number): boolean {
  return count >= 1
}

/** Header WF-10 expects. Sent only when N8N_REROLL_SECRET is set. */
export const REROLL_SECRET_HEADER = 'X-Reroll-Secret'

/** Background search takes about a minute. Poll until the digest row changes, then stop. */
export const REROLL_POLL_INTERVAL_MS = 10_000
export const REROLL_POLL_TIMEOUT_MS = 150_000

export function rerollSecretHeader(secret: unknown): string | null {
  const value = typeof secret === 'string' ? secret.trim() : ''
  return value || null
}

/** Delay until the next digest check. Null means the wait is over. */
export function nextRerollPollDelay(
  elapsedMs: number,
  intervalMs = REROLL_POLL_INTERVAL_MS,
  timeoutMs = REROLL_POLL_TIMEOUT_MS
): number | null {
  if (elapsedMs >= timeoutMs) return null
  return Math.min(intervalMs, timeoutMs - elapsedMs)
}

export type DigestStamp = {
  id: string | null
  updatedAt: string | null
}

export function digestStampFrom(digest: { id?: unknown, updated_at?: unknown } | null | undefined): DigestStamp {
  const id = digest?.id == null ? '' : String(digest.id).trim()
  const updatedAt = digest?.updated_at == null ? '' : String(digest.updated_at).trim()
  return {
    id: id || null,
    updatedAt: updatedAt || null
  }
}

/** A new digest id or a newer updated_at means ingest replaced today's list. */
export function digestStampChanged(before: DigestStamp, after: DigestStamp): boolean {
  return before.id !== after.id || before.updatedAt !== after.updatedAt
}

/**
 * WF-10 answers immediately. 200 {ok:true, accepted:true} means the search is running.
 * 400 {ok:false, error} is the caller's message. Anything else is a transport failure.
 */
export function rerollWebhookResult(status: number, body: unknown): { accepted: true } | { accepted: false, statusCode: number, message: string } {
  const errorText = webhookErrorText(body)
  if (status === 400) {
    return {
      accepted: false,
      statusCode: 400,
      message: errorText || 'The re-roll was rejected.'
    }
  }
  if (status >= 200 && status < 300) {
    if (body && typeof body === 'object' && 'ok' in body && body.ok === false) {
      return {
        accepted: false,
        statusCode: 400,
        message: errorText || 'The re-roll was rejected.'
      }
    }
    return { accepted: true }
  }
  return {
    accepted: false,
    statusCode: 502,
    message: errorText
      ? `The re-roll webhook returned ${status}: ${errorText}`
      : `The re-roll webhook returned ${status}.`
  }
}

function webhookErrorText(body: unknown): string {
  if (typeof body === 'string') return body.trim().slice(0, 300)
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error.trim().slice(0, 300)
  }
  return ''
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
