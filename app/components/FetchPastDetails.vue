<script setup lang="ts">
import { googlePlaceIdFrom } from '~~/shared/gbp-listing'
import { googlePhotosNote, gbpPhotoUrls, leadEmails } from '~~/shared/lead-context'
import { LEAD_DETAILS_NOT_FOUND } from '~~/shared/lead-details'
import { readError } from '~/utils/read-error'

const props = defineProps<{
  businessId: string
  placeId?: string | null
  email?: string | null
  emails?: string[] | null
  phone?: string | null
  photoCount?: number | null
  photos?: unknown
  category?: string | null
  website?: string | null
  rating?: number | null
  reviewCount?: number | null
  address?: string | null
  city?: string | null
  state?: string | null
}>()

const emit = defineEmits<{
  updated: []
}>()

interface FetchedDetails {
  emails: string[]
  phone: string | null
  photoCount: number | null
  photos: unknown
  leadGroup: string | null
  angle: string | null
  score: number | null
  siteCheck: string | null
}

const toast = useToast()
const pending = ref(false)
const fetched = ref<FetchedDetails | null>(null)

const canFetch = computed(() => Boolean(googlePlaceIdFrom(props.placeId)))
const emailList = computed(() => {
  if (fetched.value) return fetched.value.emails
  return leadEmails(props.email, { emails: props.emails || [] })
})
const photoCount = computed(() => fetched.value ? fetched.value.photoCount : props.photoCount)
const photos = computed(() => fetched.value ? fetched.value.photos : props.photos)
const phone = computed(() => fetched.value?.phone || props.phone || null)
const angle = computed(() => fetched.value?.angle || '')
const siteCheck = computed(() => fetched.value?.siteCheck || '')
const leadGroup = computed(() => fetched.value?.leadGroup || null)
const score = computed(() => fetched.value?.score ?? null)
const photosText = computed(() => googlePhotosNote(photoCount.value, photos.value))
const hasPhotoInfo = computed(() => Boolean(photosText.value) || gbpPhotoUrls(photos.value).length > 0)
const stateLabel = computed(() => {
  if (!canFetch.value) return 'No Google place ID'
  if (pending.value) return 'Looking up saved details.'
  if (!emailList.value.length || !hasPhotoInfo.value) return 'No email or Google photos on file.'
  return 'Email and photos are on file.'
})
const showDetails = computed(() => Boolean(
  emailList.value.length
  || hasPhotoInfo.value
  || angle.value
  || siteCheck.value
  || typeof score.value === 'number'
  || leadGroup.value
))

async function fetchDetails() {
  if (pending.value || !canFetch.value) return
  pending.value = true
  try {
    const result = await $fetch<
      | { ok: true, found: false, message?: string }
      | {
        ok: true
        found: true
        emails?: string[]
        phone?: string | null
        photo_count?: number | null
        gbp_photos?: unknown
        lead_group?: string | null
        angle?: string | null
        score?: number | null
        site_check?: string | null
      }
    >(`/api/businesses/${props.businessId}/fetch-details`, { method: 'POST' })
    if (!result.found) {
      toast.add({
        title: result.message || LEAD_DETAILS_NOT_FOUND,
        color: 'warning'
      })
      return
    }
    fetched.value = {
      emails: Array.isArray(result.emails) ? result.emails : [],
      phone: result.phone || null,
      photoCount: typeof result.photo_count === 'number' ? result.photo_count : null,
      photos: result.gbp_photos,
      leadGroup: result.lead_group || null,
      angle: result.angle || null,
      score: typeof result.score === 'number' ? result.score : null,
      siteCheck: result.site_check || null
    }
    toast.add({ title: 'Details updated', color: 'success' })
    emit('updated')
  } catch (error: unknown) {
    toast.add({
      title: 'Could not fetch details',
      description: readError(error, 'The lookup did not finish.'),
      color: 'error'
    })
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <UButton
      type="button"
      class="min-h-11 w-full justify-center"
      variant="outline"
      icon="i-lucide-search"
      :loading="pending"
      :disabled="pending || !canFetch"
      @click="fetchDetails"
    >
      Fetch past details
    </UButton>
    <p class="mt-2 text-sm text-muted">
      {{ stateLabel }}
    </p>
    <LeadContextBlock
      v-if="showDetails"
      class="mt-4"
      :score="score"
      :category="category"
      :lead-group="leadGroup"
      :website="website"
      :site-check="siteCheck"
      :rating="rating"
      :review-count="reviewCount"
      :phone="phone"
      :address="address"
      :city="city"
      :state="state"
      :angle="angle"
      :photo-count="photoCount"
      :photos="photos"
      :emails="emailList"
    />
  </div>
</template>
