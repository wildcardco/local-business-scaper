<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
  label?: string
  showPercentage?: boolean
}>()

const percentage = computed(() => {
  if (props.total === 0) return 0
  return Math.round((props.current / props.total) * 100)
})
</script>

<template>
  <div class="space-y-2">
    <div v-if="label || showPercentage" class="flex items-center justify-between text-sm">
      <span v-if="label" class="text-muted">{{ label }}</span>
      <span class="font-medium">
        <template v-if="showPercentage">{{ percentage }}%</template>
        <template v-else>{{ current }} / {{ total }}</template>
      </span>
    </div>
    <UProgress :value="percentage" />
  </div>
</template>

