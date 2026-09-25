// Global client-side auth middleware
// Redirects unauthenticated users to login page

export default defineNuxtRouteMiddleware((to) => {
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register']

  // Skip auth check for public routes
  if (publicRoutes.includes(to.path)) {
    return
  }

  // Check if user is authenticated (client-side)
  const { loggedIn } = useUserSession()

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








