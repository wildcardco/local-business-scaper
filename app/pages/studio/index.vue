<script setup lang="ts">
const toast = useToast()
const isSyncing = ref(false)

const { data, pending, refresh } = await useFetch('/api/mockups')
const mockups = computed(() => data.value?.mockups || [])

async function syncFromN8n() {
  isSyncing.value = true
  try {
    const result = await $fetch('/api/mockups/sync', { method: 'POST' })
    toast.add({
      title: 'Studio synced',
      description: result.imported
        ? `Imported ${result.imported} mockup${result.imported === 1 ? '' : 's'} from n8n`
        : 'No new n8n rows for your email',
      color: 'success'
    })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Sync failed',
      description: err.data?.message || 'Could not read n8n leads',
      color: 'error'
    })
  } finally {
    isSyncing.value = false
  }
}

function statusColor(status: string) {
  if (status === 'mockup_ready' || status === 'pitch_ready') return 'success'
  if (status === 'generating' || status === 'writing_pitch' || status === 'enhancing' || status === 'revising') return 'warning'
  if (status === 'failed') return 'error'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-6 pb-24 sm:pb-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="eyebrow">Mockups</p>
        <h1 class="font-display text-2xl font-semibold tracking-tight">Studio</h1>
        <p class="text-muted">Generate, revise, and pitch site samples. Digest emails still work in parallel.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-refresh-cw"
          variant="outline"
          :loading="isSyncing"
          @click="syncFromN8n"
        >
          Sync from n8n
        </UButton>
        <UButton
          to="/studio/new"
          icon="i-lucide-plus"
        >
          New mockup
        </UButton>
      </div>
    </div>

    <div v-if="pending" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-primary" />
    </div>

    <UCard v-else-if="mockups.length === 0">
      <div class="text-center py-10 space-y-3">
        <UIcon name="i-lucide-palette" class="size-10 text-muted mx-auto" />
        <h2 class="font-display text-lg font-semibold">No mockups yet</h2>
        <p class="text-muted text-sm max-w-md mx-auto">
          Add a business by hand, or generate one from a scraped lead. Email-created mockups show up here after you sync.
        </p>
        <UButton to="/studio/new" icon="i-lucide-plus">
          New mockup
        </UButton>
      </div>
    </UCard>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-muted border-b border-default">
            <th class="p-3 font-medium">Business</th>
            <th class="p-3 font-medium">Status</th>
            <th class="p-3 font-medium hidden sm:table-cell">Model</th>
            <th class="p-3 font-medium hidden md:table-cell">Updated</th>
            <th class="p-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="mockup in mockups"
            :key="mockup.id"
            class="border-b border-default"
          >
            <td class="p-3 min-w-0">
              <p class="font-medium truncate">{{ mockup.business?.name || 'Untitled' }}</p>
              <p class="text-xs text-muted truncate">{{ mockup.business?.city || mockup.placeId }}</p>
            </td>
            <td class="p-3">
              <UBadge :color="statusColor(mockup.status)" variant="subtle" class="capitalize">
                {{ mockup.status.replaceAll('_', ' ') }}
              </UBadge>
              <p v-if="mockup.status === 'failed' && mockup.lastFeedback" class="text-xs text-muted mt-1 max-w-xs truncate">
                {{ mockup.lastFeedback }}
              </p>
            </td>
            <td class="p-3 hidden sm:table-cell text-muted">
              {{ mockup.aiModel || '—' }}
            </td>
            <td class="p-3 hidden md:table-cell text-muted">
              {{ mockup.updatedAt }}
            </td>
            <td class="p-3 text-right">
              <UButton
                :to="`/studio/${mockup.id}`"
                size="sm"
                variant="ghost"
                icon="i-lucide-arrow-right"
              >
                Open
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
