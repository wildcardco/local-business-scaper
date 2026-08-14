<script setup lang="ts">
const props = defineProps<{
  score: number
  category: 'hot' | 'warm' | 'cold' | 'skip' | null
  showScore?: boolean
}>()

const badgeConfig = computed(() => {
  switch (props.category) {
    case 'hot':
      return {
        color: 'error' as const,
        icon: 'i-lucide-flame',
        label: 'Hot'
      }
    case 'warm':
      return {
        color: 'warning' as const,
        icon: 'i-lucide-sun',
        label: 'Warm'
      }
    case 'cold':
      return {
        color: 'info' as const,
        icon: 'i-lucide-snowflake',
        label: 'Cold'
      }
    case 'skip':
      return {
        color: 'neutral' as const,
        icon: 'i-lucide-minus-circle',
        label: 'Skip'
      }
    default:
      return {
        color: 'neutral' as const,
        icon: 'i-lucide-help-circle',
        label: 'Unknown'
      }
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <UBadge
      :color="badgeConfig.color"
      :icon="badgeConfig.icon"
      variant="subtle"
      size="sm"
    >
      {{ badgeConfig.label }}
    </UBadge>
    <span v-if="showScore" class="text-sm font-medium text-muted">
      {{ score }}
    </span>
  </div>
</template>

