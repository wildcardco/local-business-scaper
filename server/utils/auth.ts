import type { H3Event } from 'h3'

export interface AuthUser {
  id: string
  username: string
  email: string
  name: string | null
  role: string
}

export interface AuthSession {
  user: AuthUser
}

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

export async function getCurrentUser(event: H3Event): Promise<AuthUser | null> {
  const session = await getUserSession(event)
  return (session?.user as AuthUser) || null
}
