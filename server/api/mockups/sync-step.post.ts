import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { stepSyncJob } from '~~/server/utils/mockup-sync'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const owner = ownerSlugFromEmail(user.email)
  const result = await stepSyncJob(user.id, user.email, owner)
  return {
    success: true,
    background: true,
    busy: result.busy,
    owner,
    job: result.job
  }
})
