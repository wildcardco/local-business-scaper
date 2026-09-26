import type { H3Event } from 'h3'

/**
 * How long a sealed session stays valid while the user is idle.
 * Active requests renew it (see slideUserSession). h3 will not move this
 * window on its own: cookie Expires, the iron seal TTL, and the createdAt
 * check are all fixed when the seal is written.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** Renew once an hour so a burst of API calls does not rewrite the cookie. */
export const SESSION_SLIDE_AFTER_SECONDS = 60 * 60

const DEFAULT_SESSION_COOKIE = 'nuxt-session'

interface StoredSession {
  id?: string
  createdAt?: number
  data?: {
    user?: {
      id: string
      username: string
      name: string
      email: string
      role: string
    }
  }
}

export function sessionCookieName(): string {
  const name = useRuntimeConfig().session?.name
  return typeof name === 'string' && name.length > 0 ? name : DEFAULT_SESSION_COOKIE
}

export function sessionMaxAgeSeconds(): number {
  const configured = Number(useRuntimeConfig().session?.maxAge)
  if (Number.isFinite(configured) && configured > 0) return configured
  return SESSION_MAX_AGE_SECONDS
}

/**
 * Slide after an hour, but never later than halfway through a shorter maxAge,
 * so a reduced lifetime still renews before it expires.
 */
export function sessionSlideAfterMs(maxAgeSeconds: number): number {
  const maxAgeMs = Math.max(0, maxAgeSeconds) * 1000
  const defaultAfterMs = SESSION_SLIDE_AFTER_SECONDS * 1000
  if (maxAgeMs === 0) return defaultAfterMs
  return Math.min(defaultAfterMs, Math.floor(maxAgeMs / 2))
}

export function sessionNeedsSlide(createdAt: number, now: number, slideAfterMs: number): boolean {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false
  if (!Number.isFinite(slideAfterMs) || slideAfterMs <= 0) return false
  return now - createdAt >= slideAfterMs
}

/**
 * h3 seals createdAt into the cookie and refuses to change it on update.
 * Moving it forward and resealing is what makes the 30-day lifetime slide.
 * The password stays server-side inside nuxt-auth-utils.
 */
export async function slideUserSession(event: H3Event): Promise<void> {
  const name = sessionCookieName()
  const sessions = (event.context as { sessions?: Record<string, StoredSession> }).sessions
  const current = sessions?.[name]
  const user = current?.data?.user
  if (!current?.id || !current.createdAt || !user?.email) return

  const slideAfterMs = sessionSlideAfterMs(sessionMaxAgeSeconds())
  if (!sessionNeedsSlide(current.createdAt, Date.now(), slideAfterMs)) return

  current.createdAt = Date.now()
  await setUserSession(event, { user })
}

/** Drop the sealed cookie from this request so a later read cannot restore it. */
export function stripSessionCookie(event: H3Event): void {
  const name = sessionCookieName()
  const header = getRequestHeader(event, 'cookie')
  if (!header || !event.node?.req?.headers) return

  const next = header
    .split(';')
    .map(part => part.trim())
    .filter(part => part.length > 0 && !part.startsWith(`${name}=`))
    .join('; ')

  if (next) event.node.req.headers.cookie = next
  else delete event.node.req.headers.cookie
}
