<script setup lang="ts">
import type { GbpPhoto } from '~~/shared/gbp-listing'
import { intakeErrorMessage } from '~~/shared/intake-lookup'
import type { PlaceDetails } from '~~/shared/place-lookup'
import type { WebsiteInspection, WebsiteIntakeMatch } from '~~/shared/website-intake'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  'apply': [payload: {
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
    url: string
    host: string
  }]
  'use-url': [payload: { url: string, host: string }]
}>()

const website = ref('')
const loading = ref(false)
const confirmingId = ref('')
const inspection = ref<WebsiteInspection | null>(null)
const tone = ref<'idle' | 'matches' | 'none' | 'lookup-failed' | 'error' | 'filled'>('idle')
const message = ref('')

function readError(error: unknown, fallback: string) {
  const err = error as { data?: { message?: string }, message?: string }
  return err.data?.message || err.message || fallback
}

function locationLine(match: WebsiteIntakeMatch) {
  if (match.address) return match.address
  const town = [match.city, match.state].filter(Boolean).join(', ')
  return town || 'Address not on the listing'
}

async function inspect() {
  if (loading.value || confirmingId.value) return
  inspection.value = null
  message.value = ''
  tone.value = 'idle'
  loading.value = true
  try {
    const result = await $fetch<WebsiteInspection>('/api/studio/website-intake', {
      method: 'POST',
      body: { website: website.value }
    })
    inspection.value = result
    message.value = result.message
    tone.value = result.listingStatus
  } catch (error: unknown) {
    tone.value = 'error'
    message.value = readError(error, 'That website could not be checked. Nothing was filled in.')
  } finally {
    loading.value = false
  }
}

async function useListing(match: WebsiteIntakeMatch) {
  if (loading.value || confirmingId.value || !inspection.value) return
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
      photoMessage: result.photoMessage,
      url: inspection.value.url,
      host: inspection.value.host
    })
    tone.value = 'filled'
    message.value = 'Filled from the listing you chose. Edit any field, then generate the one-page mockup. This search did not start it.'
  } catch (error: unknown) {
    tone.value = 'error'
    message.value = readError(error, intakeErrorMessage('details-failed'))
  } finally {
    confirmingId.value = ''
  }
}

function useUrl() {
  if (!inspection.value || loading.value || confirmingId.value) return
  emit('use-url', { url: inspection.value.url, host: inspection.value.host })
  tone.value = 'filled'
  message.value = 'Using this URL. Enter the business name if it is still blank. Generate has not started.'
}
</script>

<template>
  <div
    class="space-y-3"
    data-website-intake
  >
    <UFormField label="Current website">
      <UInput
        v-model="website"
        size="lg"
        class="w-full"
        icon="i-lucide-globe"
        placeholder="https://www.leeps.com/"
        data-website-url
      />
    </UFormField>
    <div class="space-y-1">
      <UButton
        type="button"
        data-website-inspect
        class="min-h-11 w-full justify-center sm:w-auto"
        color="neutral"
        variant="outline"
        icon="i-lucide-search"
        :loading="loading"
        :disabled="disabled || Boolean(confirmingId)"
        @click="inspect"
      >
        Inspect website
      </UButton>
      <p class="text-sm text-muted">
        Paste the current site. A matching Google listing can fill the form after you choose it. Then pick a one-page or multi-page build. Inspect does not start generation.
      </p>
    </div>

    <UAlert
      v-if="inspection"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="Site content is not previewed here"
      :description="inspection.siteProfileReason"
      data-website-note
    />

    <UAlert
      v-if="message && (tone === 'error' || tone === 'none' || tone === 'lookup-failed')"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="tone === 'error' ? 'Website check did not finish' : 'No listing for this website'"
      :description="message"
      data-website-message
    />
    <p
      v-else-if="message"
      data-website-message
      class="text-sm text-muted"
    >
      {{ message }}
    </p>

    <ul
      v-if="inspection?.matches.length"
      class="space-y-2"
      data-website-matches
    >
      <li
        v-for="match in inspection.matches"
        :key="match.placeId"
        class="rounded-wc-lg border border-default p-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <p class="font-medium">
            {{ match.name }}
          </p>
          <UBadge
            color="success"
            variant="subtle"
          >
            Website matches
          </UBadge>
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
          :data-website-use="match.placeId"
          :loading="confirmingId === match.placeId"
          :disabled="disabled || loading || (Boolean(confirmingId) && confirmingId !== match.placeId)"
          @click="useListing(match)"
        >
          Load this Google listing
        </UButton>
      </li>
    </ul>

    <UButton
      v-if="inspection && tone !== 'filled'"
      type="button"
      class="min-h-11 w-full justify-center sm:w-auto"
      size="sm"
      color="neutral"
      variant="ghost"
      data-website-url-only
      :disabled="disabled || loading || Boolean(confirmingId)"
      @click="useUrl"
    >
      Use this URL without a listing
    </UButton>
  </div>
</template>
