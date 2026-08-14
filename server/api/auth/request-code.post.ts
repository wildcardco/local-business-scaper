import { assertEmailAllowed, normalizeEmail } from '~~/server/utils/allowlist'
import { issueLoginCode } from '~~/server/utils/login-code'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = normalizeEmail(body?.email)

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'A valid email is required'
    })
  }

  assertEmailAllowed(email)
  await issueLoginCode(email)

  return {
    success: true,
    message: 'If this email is authorized, a code is on the way'
  }
})
