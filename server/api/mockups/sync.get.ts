import { getSyncJob } from '~~/server/utils/mockup-sync'

// Job status only. The open app polls this on login and when the tab becomes visible.
// n8n is contacted by POST /api/mockups/sync-step while a job is running.
export default defineEventHandler(async (event) => {
  const user = event.context.user
  const job = await getSyncJob(user.id)
  console.info(
    `[studio-sync] GET status n8n=not_called job=${job?.id || 'none'} status=${job?.status || 'none'} pages=${job?.pages ?? 0} imported=${job?.imported ?? 0} refreshed=${job?.refreshed ?? 0} synced=${job?.synced ?? 0}`
  )
  return {
    success: true,
    job
  }
})
