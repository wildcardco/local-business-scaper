<script setup lang="ts">
import { leadScoreBadge, scoreOutOf100 } from '~~/shared/lead-context'

const props = defineProps<{
  score: number | null
  category: string | null
  showScore?: boolean
}>()

const badgeConfig = computed(() => leadScoreBadge(props.category))
const scoreText = computed(() => scoreOutOf100(props.score))
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
    <span
      v-if="showScore && scoreText"
      class="text-sm font-medium text-muted"
    >
      {{ scoreText }}
    </span>
  </div>
</template>
