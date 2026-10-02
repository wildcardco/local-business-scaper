<script setup lang="ts">
import type { JobPhase } from '~~/shared/studio-job'

const props = defineProps<{
  phase: JobPhase
  label?: string
  detail?: string
  steps: { id: JobPhase, label: string }[]
}>()

const active = computed(() => props.steps.find(step => step.id === props.phase))
const title = computed(() => props.label || active.value?.label || '')
const inProgress = computed(() => props.phase === 'sending' || props.phase === 'building' || props.phase === 'writing')

const color = computed(() => {
  if (props.phase === 'failed') return 'error' as const
  if (props.phase === 'ready') return 'success' as const
  if (inProgress.value) return 'warning' as const
  return 'neutral' as const
})

const icon = computed(() => {
  if (props.phase === 'failed') return 'i-lucide-triangle-alert'
  if (props.phase === 'ready') return 'i-lucide-circle-check'
  return 'i-lucide-loader-circle'
})
</script>

<template>
  <div
    v-if="phase !== 'idle'"
    class="space-y-3"
    role="status"
    aria-live="polite"
  >
    <div class="flex flex-wrap gap-2">
      <UBadge
        v-for="step in steps"
        :key="step.id"
        :color="step.id === phase ? color : 'neutral'"
        :variant="step.id === phase ? 'solid' : 'subtle'"
      >
        {{ step.id === phase && label ? label : step.label }}
      </UBadge>
    </div>
    <UAlert
      v-if="inProgress || phase === 'failed'"
      :color="color"
      :icon="icon"
      :title="title"
      :description="detail || title"
      :ui="inProgress ? { icon: 'animate-spin' } : undefined"
    />
    <p
      v-else-if="detail"
      class="text-sm text-muted"
    >
      {{ detail }}
    </p>
  </div>
</template>
