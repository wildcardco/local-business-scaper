<script setup lang="ts">
import type { IntakeMatch } from '~~/shared/intake-lookup'

defineProps<{
  matches: IntakeMatch[]
  confirmingId?: string
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [match: IntakeMatch]
}>()

function locationLine(match: IntakeMatch) {
  if (match.address) return match.address
  const town = [match.city, match.state].filter(Boolean).join(', ')
  return town || 'Address not on the listing'
}
</script>

<template>
  <ul
    v-if="matches.length"
    class="space-y-2"
    data-intake-matches
  >
    <li
      v-for="match in matches"
      :key="match.placeId"
      class="rounded-wc-lg border border-default p-3"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <p class="font-medium">
          {{ match.name }}
        </p>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-if="match.exactName"
            color="success"
            variant="subtle"
          >
            Exact name
          </UBadge>
          <UBadge
            v-else-if="match.nameEquivalent"
            color="success"
            variant="subtle"
          >
            Name matches
          </UBadge>
          <UBadge
            v-else
            color="neutral"
            variant="subtle"
          >
            Similar name
          </UBadge>
          <UBadge
            v-if="match.websiteMatch"
            color="neutral"
            variant="subtle"
          >
            Website matches
          </UBadge>
          <UBadge
            v-if="match.phoneMatch"
            color="neutral"
            variant="subtle"
          >
            Phone matches
          </UBadge>
        </div>
      </div>
      <p class="mt-1 text-sm text-muted">
        {{ locationLine(match) }}
      </p>
      <p
        v-if="match.category || match.phone || match.website"
        class="mt-1 break-words text-sm text-muted"
      >
        <span v-if="match.category">{{ match.category }}</span>
        <span v-if="match.phone"> · {{ match.phone }}</span>
        <span v-if="match.website"> · {{ match.website }}</span>
      </p>
      <UButton
        type="button"
        class="mt-3 min-h-11 w-full justify-center sm:w-auto"
        size="sm"
        variant="outline"
        :data-intake-use="match.placeId"
        :loading="confirmingId === match.placeId"
        :disabled="disabled || loading || (Boolean(confirmingId) && confirmingId !== match.placeId)"
        @click="emit('select', match)"
      >
        Load this Google listing
      </UButton>
    </li>
  </ul>
</template>
