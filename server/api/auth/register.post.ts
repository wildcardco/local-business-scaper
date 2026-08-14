export default defineEventHandler(async () => {
  throw createError({
    statusCode: 410,
    message: 'Use email sign-in. Password registration is no longer available.'
  })
})
