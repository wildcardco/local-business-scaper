<script setup lang="ts">
defineProps<{
  statusLabel?: string | null
  previewUrl?: string | null
  agentUrl?: string | null
  error?: string | null
}>()
</script>

<template>
  <div class="min-w-0 space-y-2">
    <p
      v-if="statusLabel"
      class="text-xs text-muted"
    >
      {{ statusLabel }}
    </p>
    <p
      v-if="error"
      class="flex items-start gap-2 text-sm text-highlighted"
    >
      <UIcon
        name="i-lucide-triangle-alert"
        class="mt-0.5 size-4 shrink-0 text-wcError-500"
      />
      <span class="min-w-0 break-words">{{ error }}</span>
    </p>
    <div
      v-if="previewUrl || agentUrl"
      class="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
    >
      <UButton
        v-if="previewUrl"
        :to="previewUrl"
        target="_blank"
        rel="noopener noreferrer"
        size="sm"
        variant="soft"
        trailing-icon="i-lucide-external-link"
        class="min-h-11 justify-center"
      >
        Preview
      </UButton>
      <UButton
        v-if="agentUrl"
        :to="agentUrl"
        target="_blank"
        rel="noopener noreferrer"
        size="sm"
        variant="outline"
        trailing-icon="i-lucide-bot"
        class="min-h-11 justify-center"
      >
        Open agent
      </UButton>
    </div>
  </div>
</template>
