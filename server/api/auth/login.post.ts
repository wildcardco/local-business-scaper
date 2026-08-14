import { assertEmailAllowed, normalizeEmail } from '~~/server/utils/allowlist'
import { consumeLoginCode, findOrCreateUserByEmail } from '~~/server/utils/login-code'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = normalizeEmail(body?.email)
  const code = typeof body?.code === 'string' ? body.code : ''

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'A valid email is required'
    })
  }

  assertEmailAllowed(email)
  await consumeLoginCode(email, code)

  const user = await findOrCreateUserByEmail(email)

  await setUserSession(event, { user })

  return {
    success: true,
    user
  }
})
