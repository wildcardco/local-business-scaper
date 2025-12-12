import type { H3Event } from 'h3'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
}

export interface AuthSession {
  user: AuthUser
}

/**
 * Require authentication for an API route
 * Throws 401 if user is not authenticated
 */
export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required'
    })
  }

  return session.user as AuthUser
}

/**
 * Require admin role for an API route
 * Throws 403 if user is not admin
 */
export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const user = await requireAuth(event)

  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required'
    })
  }

  return user
}

/**
 * Get current user if authenticated, null otherwise
 */
export async function getCurrentUser(event: H3Event): Promise<AuthUser | null> {
  const session = await getUserSession(event)
  return (session?.user as AuthUser) || null
}








