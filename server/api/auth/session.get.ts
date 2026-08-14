import { isEmailAllowed } from '~~/server/utils/allowlist'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = session?.user ?? null

  if (user && !isEmailAllowed(user.email)) {
    await clearUserSession(event)
    return {
      loggedIn: false,
      user: null
    }
  }

  return {
    loggedIn: !!user,
    user
  }
})
