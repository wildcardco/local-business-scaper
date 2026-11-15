import { ensureSchemaColumns } from '~~/server/utils/schema-columns'

const ASSET_PATH = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf|eot|txt|xml|webmanifest)$/i

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/_nuxt') || path.startsWith('/__nuxt') || ASSET_PATH.test(path)) return
  await ensureSchemaColumns()
})
