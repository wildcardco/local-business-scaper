import { isEmailAllowed } from '~~/server/utils/allowlist'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  const publicPaths = [
    '/api/auth/',
    '/api/_auth/',
    '/api/_nuxt_icon/',
    '/api/health',
    '/api/mockups/webhook'
  ]

  if (publicPaths.some(p => path.startsWith(p))) {
    return
  }

  if (!path.startsWith('/api/')) {
    return
  }

  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized - Please login'
    })
  }

  if (!isEmailAllowed(session.user.email)) {
    await clearUserSession(event)
    throw createError({
      statusCode: 403,
      message: 'This email is not authorized'
    })
  }

  event.context.user = session.user
})
