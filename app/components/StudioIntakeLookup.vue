<script setup lang="ts">
import { intakeErrorMessage, type IntakeMatch } from '~~/shared/intake-lookup'
import type { PlaceDetails } from '~~/shared/place-lookup'

const props = defineProps<{
  name: string
  city: string
  state: string
  website: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  apply: [payload: {
    found: PlaceDetails
    placeId: string
    googleMapsUrl: string | null
    zipCode: string | null
    rating: number | null
    reviewCount: number | null
  }]
}>()

const loading = ref(false)
const confirmingId = ref('')
const matches = ref<IntakeMatch[]>([])
const message = ref('')
const tone = ref<'idle' | 'matches' | 'none' | 'error' | 'filled'>('idle')

function readError(error: unknown, fallback: string) {
  const err = error as { data?: { message?: string }, message?: string }
  return err.data?.message || err.message || fallback
}

function locationLine(match: IntakeMatch) {
  if (match.address) return match.address
  const town = [match.city, match.state].filter(Boolean).join(', ')
  return town || 'Address not on the listing'
}

async function findBusiness() {
  if (loading.value || confirmingId.value) return
  matches.value = []
  message.value = ''
  tone.value = 'idle'
  if (!props.name.trim() || (!props.city.trim() && !props.state.trim())) {
    tone.value = 'error'
    message.value = intakeErrorMessage('need-town')
    return
  }

  loading.value = true
  try {
    const result = await $fetch<{ matches: IntakeMatch[], status: 'matches' | 'none', message: string }>('/api/studio/intake-lookup', {
      method: 'POST',
      body: {
        name: props.name,
        city: props.city,
        state: props.state,
        website: props.website
      }
    })
    matches.value = result.matches || []
    message.value = result.message
    tone.value = result.status === 'none' || matches.value.length === 0 ? 'none' : 'matches'
  } catch (error: unknown) {
    tone.value = 'error'
    message.value = readError(error, intakeErrorMessage('search-failed'))
  } finally {
    loading.value = false
  }
}

async function useListing(match: IntakeMatch) {
  if (loading.value || confirmingId.value) return
  confirmingId.value = match.placeId
  try {
    const result = await $fetch<{
      found: PlaceDetails
      placeId: string
      googleMapsUrl: string | null
      zipCode: string | null
      rating: number | null
      reviewCount: number | null
      message: string
    }>('/api/studio/intake-details', {
      method: 'POST',
      body: { placeId: match.placeId }
    })
    if (!result.found || Object.keys(result.found).length === 0) {
      tone.value = 'error'
      message.value = result.message || intakeErrorMessage('details-empty')
      return
    }
    emit('apply', {
      found: result.found,
      placeId: result.placeId,
      googleMapsUrl: result.googleMapsUrl,
      zipCode: result.zipCode,
      rating: result.rating,
      reviewCount: result.reviewCount
    })
    tone.value = 'filled'
    message.value = result.message
  } catch (error: unknown) {
    tone.value = 'error'
    message.value = readError(error, intakeErrorMessage('details-failed'))
  } finally {
    confirmingId.value = ''
  }
}
</script>

<template>
  <div
    class="space-y-3"
    data-intake-lookup
  >
    <div class="space-y-1">
      <UButton
        type="button"
        data-intake-find
        class="min-h-11 w-full justify-center sm:w-auto"
        color="neutral"
        variant="outline"
        icon="i-lucide-search"
        :loading="loading"
        :disabled="disabled || Boolean(confirmingId)"
        @click="findBusiness"
      >
        Find business information
      </UButton>
      <p class="text-sm text-muted">
        Research this name in the town you entered. Pick a listing to fill the form. You can edit every field afterward. Generate does not start from this search.
      </p>
    </div>

    <UAlert
      v-if="message && (tone === 'error' || tone === 'none')"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="tone === 'none' ? 'No matching business' : 'Lookup did not finish'"
      :description="message"
      data-intake-message
    />
    <p
      v-else-if="message"
      data-intake-message
      class="text-sm text-muted"
    >
      {{ message }}
    </p>

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
              v-if="match.websiteMatch"
              color="neutral"
              variant="subtle"
            >
              Website matches
            </UBadge>
            <UBadge
              v-if="!match.exactName"
              color="neutral"
              variant="subtle"
            >
              Similar name
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
          @click="useListing(match)"
        >
          Use this listing
        </UButton>
      </li>
    </ul>
  </div>
</template>
