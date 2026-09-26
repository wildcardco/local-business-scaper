<script setup lang="ts">
const owner = ref('mine')
const { running: syncRunning, revision: syncRevision, start: startSync } = useStudioSync()

const { data, pending, refresh } = await useFetch('/api/mockups', {
  query: computed(() => owner.value === 'mine' ? {} : { owner: owner.value }),
  watch: [owner]
})

const mockups = computed(() => data.value?.mockups || [])
const counts = computed(() => data.value?.counts || { mine: 0, showing: 0 })
const owners = computed(() => data.value?.owners || [])
const scope = computed(() => data.value?.scope || 'mine')
const scopeLabel = computed(() => {
  if (scope.value === 'mine') return 'Your mockups'
  return owners.value.find(item => item.slug === scope.value)?.label || 'Mockups'
})

const ownerOptions = computed(() => {
  const viewer = owners.value.find(item => item.isViewer)
  const others = owners.value.filter(item => !item.isViewer)
  return [
    { value: 'mine', label: viewer ? `Mine (${viewer.label})` : 'Mine' },
    ...others.map(item => ({ value: item.slug, label: item.label }))
  ]
})

watch(syncRevision, () => {
  refresh()
})

function statusColor(status: string) {
  if (status === 'mockup_ready' || status === 'pitch_ready') return 'success'
  if (status === 'generating' || status === 'writing_pitch' || status === 'enhancing' || status === 'revising') return 'warning'
  if (status === 'failed') return 'error'
  return 'neutral'
}
</script>

<template>
  <div class="min-w-0 space-y-6 overflow-x-hidden pb-24 sm:pb-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="eyebrow">
          Mockups
        </p>
        <h1 class="font-display text-2xl font-semibold tracking-tight">
          Studio
        </h1>
        <p class="text-sm text-muted">
          {{ scopeLabel }}: {{ counts.showing }}.
          <span v-if="scope !== 'mine'">You have {{ counts.mine }}.</span>
        </p>
      </div>
      <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
        <UButton
          class="min-h-11 w-full justify-center sm:w-auto"
          icon="i-lucide-refresh-cw"
          variant="outline"
          :loading="syncRunning"
          :disabled="syncRunning"
          @click="startSync"
        >
          {{ syncRunning ? 'Syncing in background' : 'Sync from n8n' }}
        </UButton>
        <UButton
          class="min-h-11 w-full justify-center sm:w-auto"
          to="/studio/new"
          icon="i-lucide-plus"
        >
          New mockup
        </UButton>
      </div>
    </div>

    <UFormField
      label="Whose mockups"
      class="max-w-xs"
    >
      <USelect
        v-model="owner"
        :items="ownerOptions"
        class="w-full"
      />
    </UFormField>

    <div
      v-if="pending"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin text-3xl text-primary"
      />
    </div>

    <UCard v-else-if="mockups.length === 0">
      <div class="space-y-3 py-10 text-center">
        <UIcon
          name="i-lucide-palette"
          class="mx-auto size-10 text-muted"
        />
        <h2 class="font-display text-lg font-semibold">
          No mockups yet
        </h2>
        <p class="mx-auto max-w-md text-sm text-muted">
          Sync keeps rows that already have a Vercel deployment. Leads without one stay off this list. You can still start a mockup by hand.
        </p>
        <UButton
          class="min-h-11"
          to="/studio/new"
          icon="i-lucide-plus"
        >
          New mockup
        </UButton>
      </div>
    </UCard>

    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="mockup in mockups"
        :key="mockup.id"
        class="min-w-0 rounded-wc-lg border border-default bg-elevated p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-medium">
              {{ mockup.business?.name || 'Untitled' }}
            </p>
            <p class="truncate text-sm text-muted">
              {{ mockup.locationLabel }}
            </p>
          </div>
          <UBadge
            :color="statusColor(mockup.status)"
            variant="subtle"
            class="max-w-full whitespace-normal text-left"
          >
            {{ studioStatusLabel(mockup.status) }}
          </UBadge>
        </div>
        <p
          v-if="mockup.status === 'failed' && mockup.lastFeedback"
          class="mt-2 line-clamp-2 text-xs text-muted"
        >
          {{ mockup.lastFeedback }}
        </p>
        <p class="mt-2 text-xs text-muted">
          <span v-if="mockup.aiModel">{{ mockup.aiModel }}</span>
          <span v-if="mockup.aiModel"> · </span>
          <span>{{ mockup.updatedAt }}</span>
        </p>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <UButton
            v-if="mockup.vercelUrl"
            class="min-h-11 justify-center"
            :to="mockup.vercelUrl"
            target="_blank"
            external
            variant="outline"
            icon="i-lucide-external-link"
          >
            Vercel deployment
          </UButton>
          <UButton
            v-if="mockup.githubUrl"
            class="min-h-11 justify-center"
            :to="mockup.githubUrl"
            target="_blank"
            external
            variant="outline"
            icon="i-lucide-github"
          >
            GitHub repo
          </UButton>
          <UButton
            class="min-h-11 justify-center sm:ml-auto"
            :to="`/studio/${mockup.id}`"
            icon="i-lucide-arrow-right"
          >
            Open
          </UButton>
        </div>
      </li>
    </ul>
  </div>
</template>
