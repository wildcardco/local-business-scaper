import { getSyncJob } from '~~/server/utils/mockup-sync'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  return {
    success: true,
    job: await getSyncJob(user.id)
  }
})
