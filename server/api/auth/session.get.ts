// Custom session endpoint (nuxt-auth-utils also provides /api/_auth/session)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  return {
    loggedIn: !!session?.user,
    user: session?.user ?? null
  }
})








