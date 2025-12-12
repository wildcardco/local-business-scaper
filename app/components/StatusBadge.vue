<script setup lang="ts">
const props = defineProps<{
  status: 'new' | 'approved' | 'sent' | 'responded' | 'rejected'
}>()

const badgeConfig = computed(() => {
  switch (props.status) {
    case 'new':
      return {
        color: 'sky' as const,
        icon: 'i-lucide-sparkles',
        label: 'New'
      }
    case 'approved':
      return {
        color: 'emerald' as const,
        icon: 'i-lucide-check',
        label: 'Approved'
      }
    case 'sent':
      return {
        color: 'violet' as const,
        icon: 'i-lucide-send',
        label: 'Sent'
      }
    case 'responded':
      return {
        color: 'green' as const,
        icon: 'i-lucide-message-circle',
        label: 'Responded'
      }
    case 'rejected':
      return {
        color: 'red' as const,
        icon: 'i-lucide-x',
        label: 'Rejected'
      }
    default:
      return {
        color: 'neutral' as const,
        icon: 'i-lucide-help-circle',
        label: props.status
      }
  }
})
</script>

<template>
  <UBadge
    :color="badgeConfig.color"
    :icon="badgeConfig.icon"
    variant="soft"
    size="sm"
  >
    {{ badgeConfig.label }}
  </UBadge>
</template>

