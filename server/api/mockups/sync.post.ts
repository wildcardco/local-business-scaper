import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { startSyncJob } from '~~/server/utils/mockup-sync'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const owner = ownerSlugFromEmail(user.email)
  const job = await startSyncJob(user.id)
  console.info(
    `[studio-sync] POST start n8n=not_called job=${job?.id || 'none'} status=${job?.status || 'none'} owner=${owner}`
  )
  return {
    success: true,
    background: true,
    owner,
    job
  }
})
