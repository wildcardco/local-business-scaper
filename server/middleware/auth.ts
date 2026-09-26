import type { H3Event } from 'h3'
import { isEmailAllowed } from '~~/server/utils/allowlist'
import { sessionCookieName, slideUserSession, stripSessionCookie } from '~~/server/utils/session'

const ASSET_PATH = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf|eot|txt|xml|webmanifest)$/i

const publicPaths = [
  '/api/auth/',
  '/api/_nuxt_icon/',
  '/api/health',
  '/api/mockups/webhook',
  '/api/digests/ingest'
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // DELETE /api/_auth/session is logout. Do not reseal the cookie first.
  if (path.startsWith('/api/_auth/session') && event.method === 'DELETE') {
    return
  }

  // The client session read is public when nobody is signed in, but a removed
  // allowlist email must not keep coming back as logged in from this route.
  if (path === '/api/_auth/session') {
    await endDisallowedSession(event)
    await slideUserSession(event)
    return
  }

  if (publicPaths.some(prefix => path.startsWith(prefix))) {
    return
  }

  // Unsealing the session is intentionally slow. Skip static assets; the
  // browser still sends the cookie on those requests.
  if (path.startsWith('/_nuxt') || path.startsWith('/__nuxt') || ASSET_PATH.test(path)) {
    return
  }

  const requiresAuth = path.startsWith('/api/')

  if (!getCookie(event, sessionCookieName())) {
    if (requiresAuth) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized - Please login'
      })
    }
    return
  }

  const session = await getUserSession(event)

  if (!session?.user) {
    if (requiresAuth) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized - Please login'
      })
    }
    return
  }

  if (!isEmailAllowed(session.user.email)) {
    await endDisallowedSession(event, true)
    if (requiresAuth) {
      throw createError({
        statusCode: 403,
        message: 'This email is not authorized'
      })
    }
    return
  }

  if (requiresAuth) {
    event.context.user = session.user
  }

  await slideUserSession(event)
})

async function endDisallowedSession(event: H3Event, alreadyLoaded = false) {
  if (!alreadyLoaded) {
    if (!getCookie(event, sessionCookieName())) return
    const session = await getUserSession(event)
    if (!session?.user || isEmailAllowed(session.user.email)) return
  }

  await clearUserSession(event)
  // h3 restores a cleared session from the request Cookie header. Remove it
  // so this same request cannot seal the user back in.
  stripSessionCookie(event)
}
