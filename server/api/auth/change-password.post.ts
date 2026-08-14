export default defineEventHandler(async () => {
  throw createError({
    statusCode: 410,
    message: 'Password sign-in is no longer available. Use the email code on the login page.'
  })
})
