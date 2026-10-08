import { resolveCategoryQuery } from '~/data/business-categories'
import { getTodayCentralTime } from '~~/shared/date-utils'
import { normalizeRerollCategory, rerollNeedsCostWarning, rerollWebhookChoice } from '~~/shared/digest-reroll'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { db, generateId } from '~~/server/utils/db'
import { ensureDigestTables } from '~~/server/utils/digest-schema'

const WEBHOOK_TIMEOUT_MS = 25_000

/**
 * Asks n8n to rebuild today's leads for the signed-in owner.
 * Generation stays in WF-0. This route does not search, score, or send the digest email.
 * The webhook should answer as soon as it accepts the job, then POST the finished
 * list to /api/digests/ingest with X-Digest-Secret and skip the email node.
 */
export default defineEventHandler(async (event) => {
  await ensureDigestTables()

  const user = event.context.user
  if (!user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const requested = body && typeof body === 'object' ? body as { random?: unknown, category?: unknown, acknowledgeCost?: unknown } : {}
  const typed = normalizeRerollCategory(requested.category)
  const resolved = typed ? resolveCategoryQuery(typed) : ''
  const choice = rerollWebhookChoice({
    random: requested.random,
    category: resolved
  })
  if ('error' in choice) {
    throw createError({
      statusCode: 400,
      message: choice.error
    })
  }

  const date = getTodayCentralTime()
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM digest_rerolls WHERE user_id = ? AND digest_date = ?`,
    args: [String(user.id), date]
  })
  const rerollCount = Number(countResult.rows[0]?.n || 0)

  if (rerollNeedsCostWarning(rerollCount) && requested.acknowledgeCost !== true) {
    throw createError({
      statusCode: 409,
      message: 'You already re-rolled today\'s leads. Another search spends RapidAPI and scoring credits. Confirm that cost before running it again.',
      data: {
        needsCostWarning: true,
        rerollCount
      }
    })
  }

  const webhookUrl = rerollWebhookUrl()
  const owner = ownerSlugFromEmail(user.email)
  const payload = {
    owner,
    date,
    category: choice.category,
    random: choice.random
  }

  await postRerollWebhook(webhookUrl, payload)

  await db.execute({
    sql: `INSERT INTO digest_rerolls (id, user_id, digest_date, category, random) VALUES (?, ?, ?, ?, ?)`,
    args: [generateId(), String(user.id), date, choice.category, choice.random ? 1 : 0]
  })

  return {
    ok: true,
    date,
    owner,
    category: choice.category,
    random: choice.random,
    rerollCount: rerollCount + 1
  }
})

function rerollWebhookUrl() {
  const config = useRuntimeConfig()
  const raw = String(config.n8nRerollWebhookUrl || '').trim()
  if (!raw) {
    throw createError({
      statusCode: 500,
      message: 'N8N_REROLL_WEBHOOK_URL is not configured. Re-roll calls an n8n webhook that searches for this owner and posts the result to /api/digests/ingest. It does not send the daily digest email. Set the Vercel env var to that webhook URL, for example https://n8n.wildcardcreative.cloud/webhook/reroll-digest.'
    })
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw createError({
      statusCode: 500,
      message: 'N8N_REROLL_WEBHOOK_URL is not a valid URL.'
    })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw createError({
      statusCode: 500,
      message: 'N8N_REROLL_WEBHOOK_URL must be an http or https URL.'
    })
  }
  return url.toString()
}

async function postRerollWebhook(url: string, payload: { owner: string, date: string, category: string, random: boolean }) {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
    })
  } catch (error: unknown) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
    const message = error instanceof Error ? error.message : 'network error'
    if (name === 'TimeoutError' || name === 'AbortError' || /timeout/i.test(message)) {
      throw createError({
        statusCode: 504,
        message: 'The re-roll webhook did not answer in time. If n8n is still running that search, wait and refresh this page. The webhook should respond as soon as it accepts the job, then post the finished list to /api/digests/ingest.'
      })
    }
    throw createError({
      statusCode: 502,
      message: `The re-roll webhook could not be reached: ${message}`
    })
  }

  if (!response.ok) {
    const text = (await response.text()).slice(0, 300)
    throw createError({
      statusCode: 502,
      message: text
        ? `The re-roll webhook returned ${response.status}: ${text}`
        : `The re-roll webhook returned ${response.status}.`
    })
  }
}
