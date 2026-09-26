export interface StudioSyncJob {
  id: string
  status: 'running' | 'done' | 'failed'
  imported: number
  refreshed: number
  synced: number
  pages: number
  error: string | null
  partial: boolean
}

let loop: Promise<void> | null = null

function summary(job: StudioSyncJob, owner?: string) {
  if (job.synced === 0 && job.status === 'done') {
    return `n8n returned no leads${owner ? ` for ${owner}` : ''}.`
  }
  return [
    job.imported ? `Imported ${job.imported} new` : '',
    job.refreshed ? `Refreshed ${job.refreshed} already in Studio` : '',
    `Checked ${job.synced} n8n lead${job.synced === 1 ? '' : 's'}`,
    job.partial ? 'Stopped after 40 pages. Run sync again to continue.' : ''
  ].filter(Boolean).join('. ')
}

export function useStudioSync() {
  const toast = useToast()
  const job = useState<StudioSyncJob | null>('studio-sync-job', () => null)
  const revision = useState('studio-sync-revision', () => 0)
  const running = computed(() => job.value?.status === 'running')

  function finish(next: StudioSyncJob | null) {
    if (!next || next.status === 'running') return
    if (next.status === 'failed') {
      toast.add({
        title: 'Sync failed',
        description: next.error || 'Could not read n8n leads.',
        color: 'error'
      })
    } else {
      toast.add({
        title: 'Studio synced',
        description: summary(next),
        color: 'success'
      })
    }
    revision.value++
  }

  async function pump() {
    let pauses = 0
    while (job.value?.status === 'running') {
      const result = await $fetch('/api/mockups/sync-step', { method: 'POST' })
      job.value = result.job
      if (result.busy) {
        pauses++
        if (pauses > 20) break
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      pauses = 0
      if (job.value?.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }
    finish(job.value)
  }

  function ensureLoop() {
    if (loop || job.value?.status !== 'running') return
    loop = pump()
      .catch((error: unknown) => {
        toast.add({
          title: 'Sync paused',
          description: readError(error, 'The phone dropped the connection. Leads already saved are kept. Sync again to continue.'),
          color: 'error'
        })
      })
      .finally(() => {
        loop = null
      })
  }

  async function refreshStatus() {
    const result = await $fetch('/api/mockups/sync')
    job.value = result.job
    if (job.value?.status === 'running') ensureLoop()
  }

  async function start() {
    try {
      const result = await $fetch('/api/mockups/sync', { method: 'POST' })
      job.value = result.job
      toast.add({
        title: 'Syncing in the background',
        description: 'One page at a time. You can leave Studio. This keeps going while the app is open.',
        color: 'success'
      })
      ensureLoop()
    } catch (error: unknown) {
      toast.add({
        title: 'Sync failed',
        description: readError(error, 'Could not start the background sync.'),
        color: 'error'
      })
    }
  }

  return { job, running, revision, start, refreshStatus }
}
