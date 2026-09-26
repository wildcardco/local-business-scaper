// Redirects unauthenticated users to the login page.

export default defineNuxtRouteMiddleware(async (to) => {
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register']

  // Skip auth check for public routes
  if (publicRoutes.includes(to.path)) {
    return
  }

  const { loggedIn, ready, session, fetch: fetchSession } = useUserSession()

  // The sealed cookie is loaded by the session plugin. Redirecting before that
  // resolves treats a still-valid session as logged out. A null session means
  // the read failed (network or 5xx), not that the server said logged out, so
  // retry once instead of sending the user to /login.
  if (!ready.value || session.value === null) {
    await fetchSession()
  }

  // Redirect to login if not authenticated
  if (!loggedIn.value) {
    // Preserve the destination URL (same-origin relative paths only)
    // Skip adding ?redirect= for the root path
    const destination = to.fullPath
    if (destination === '/') {
      return navigateTo('/login')
    }
    return navigateTo(`/login?redirect=${encodeURIComponent(destination)}`)
  }
})
