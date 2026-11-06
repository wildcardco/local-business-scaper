<script setup lang="ts">
import type { GbpPhoto } from '~~/shared/gbp-listing'
import { confidentChoice, intakeErrorMessage, type IntakeMatch } from '~~/shared/intake-lookup'
import type { PlaceDetails } from '~~/shared/place-lookup'

const props = defineProps<{
  name: string
  city: string
  state: string
  website: string
  phone?: string
  address?: string
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
    googleBusinessId: string | null
    gbpPhotos: GbpPhoto[]
    photoCount: number | null
    photoMessage: string | null
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
        website: props.website,
        phone: props.phone || '',
        address: props.address || ''
      }
    })
    const found = result.matches || []
    const choice = confidentChoice(found)
    message.value = result.message
    if (choice) {
      matches.value = []
      await useListing(choice, true)
      if (tone.value === 'error') matches.value = found
      return
    }
    matches.value = found
    tone.value = result.status === 'none' || found.length === 0 ? 'none' : 'matches'
  } catch (error: unknown) {
    tone.value = 'error'
    message.value = readError(error, intakeErrorMessage('search-failed'))
  } finally {
    loading.value = false
  }
}

async function useListing(match: IntakeMatch, automatic = false) {
  if ((!automatic && loading.value) || confirmingId.value) return
  confirmingId.value = match.placeId
  try {
    const result = await $fetch<{
      found: PlaceDetails
      placeId: string
      googleMapsUrl: string | null
      zipCode: string | null
      rating: number | null
      reviewCount: number | null
      googleBusinessId: string | null
      gbpPhotos: GbpPhoto[]
      photoCount: number | null
      photoMessage: string | null
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
      reviewCount: result.reviewCount,
      googleBusinessId: result.googleBusinessId,
      gbpPhotos: result.gbpPhotos || [],
      photoCount: result.photoCount,
      photoMessage: result.photoMessage
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
        Search Google with this name, town, phone, and website. One clear match fills the form. If more than one listing fits, you choose. Generate does not start from this search.
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

    <ListingMatchList
      :matches="matches"
      :confirming-id="confirmingId"
      :disabled="disabled"
      :loading="loading"
      @select="useListing"
    />
  </div>
</template>
