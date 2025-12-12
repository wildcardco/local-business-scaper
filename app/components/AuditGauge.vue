<script setup lang="ts">
const props = defineProps<{
  score: number | null
  label: string
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return { container: 'w-16 h-16', text: 'text-lg', label: 'text-xs' }
    case 'lg':
      return { container: 'w-32 h-32', text: 'text-3xl', label: 'text-sm' }
    default:
      return { container: 'w-24 h-24', text: 'text-2xl', label: 'text-xs' }
  }
})

const scoreColor = computed(() => {
  if (props.score === null) return 'text-neutral-400'
  if (props.score >= 90) return 'text-emerald-500'
  if (props.score >= 50) return 'text-amber-500'
  return 'text-red-500'
})

const ringColor = computed(() => {
  if (props.score === null) return 'stroke-neutral-200 dark:stroke-neutral-700'
  if (props.score >= 90) return 'stroke-emerald-500'
  if (props.score >= 50) return 'stroke-amber-500'
  return 'stroke-red-500'
})

const circumference = 2 * Math.PI * 40 // radius = 40
const dashOffset = computed(() => {
  if (props.score === null) return circumference
  return circumference - (props.score / 100) * circumference
})
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div :class="['relative', sizeClasses.container]">
      <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <!-- Background ring -->
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke-width="8"
          class="stroke-neutral-200 dark:stroke-neutral-700"
        />
        <!-- Score ring -->
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke-width="8"
          :class="ringColor"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          style="transition: stroke-dashoffset 0.5s ease"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span :class="['font-bold', sizeClasses.text, scoreColor]">
          {{ score !== null ? score : '—' }}
        </span>
      </div>
    </div>
    <span :class="['text-muted font-medium text-center', sizeClasses.label]">
      {{ label }}
    </span>
  </div>
</template>

