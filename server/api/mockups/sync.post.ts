import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { startSyncJob } from '~~/server/utils/mockup-sync'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const job = await startSyncJob(user.id)
  return {
    success: true,
    background: true,
    owner: ownerSlugFromEmail(user.email),
    job
  }
})
