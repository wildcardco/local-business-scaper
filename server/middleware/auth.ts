// Server-side auth middleware
// Protects API routes that require authentication

export default defineEventHandler(async (event) => {
  // Only apply to API routes (except auth endpoints)
  const path = getRequestURL(event).pathname

  // Skip auth for public endpoints
  const publicPaths = [
    '/api/auth/',
    '/api/_auth/',  // nuxt-auth-utils built-in session endpoint
    '/api/_nuxt_icon/', // Nuxt icon API
    '/api/health'
  ]

  if (publicPaths.some(p => path.startsWith(p))) {
    return
  }

  // Skip for non-API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // Require authentication for all other API routes
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized - Please login'
    })
  }

  // Set user in event context for downstream handlers
  event.context.user = session.user
})
