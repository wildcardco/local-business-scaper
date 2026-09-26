<script setup lang="ts">
const { job, running } = useStudioSync()

const detail = computed(() => {
  const current = job.value
  if (!current) return ''
  const page = Math.max(current.pages, 1)
  const checked = current.synced
  const kept = current.imported + current.refreshed
  return checked
    ? `Page ${page}. Checked ${checked} leads. Kept ${kept} with a Vercel link. You can leave this page.`
    : 'Reading the first page from n8n. Only Vercel mockups are saved. You can leave this page.'
})
</script>

<template>
  <p
    v-if="running"
    class="mb-4 rounded-wc-lg border border-default bg-elevated px-3 py-2 text-sm text-muted"
  >
    Syncing from n8n in the background. {{ detail }}
  </p>
</template>
