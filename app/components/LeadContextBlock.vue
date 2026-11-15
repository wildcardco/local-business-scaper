<script setup lang="ts">
import {
  formatLeadPhone,
  gbpPhotoUrls,
  googlePhotosNote,
  leadAddressLine,
  leadTypeLine,
  phoneTelHref,
  scoreOutOf100,
  websiteHref,
  websiteLabel
} from '~~/shared/lead-context'

const props = defineProps<{
  score?: number | null
  category?: string | null
  leadGroup?: string | null
  website?: string | null
  siteCheck?: string | null
  rating?: number | null
  reviewCount?: number | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  angle?: string | null
  photoCount?: number | null
  photos?: unknown
  emails?: string[] | null
}>()

const scoreText = computed(() => scoreOutOf100(props.score))
const typeLine = computed(() => leadTypeLine(props.category, props.leadGroup))
const href = computed(() => websiteHref(props.website))
const siteLabel = computed(() => websiteLabel(props.website))
const checkText = computed(() => typeof props.siteCheck === 'string' ? props.siteCheck.trim() : '')
const phoneText = computed(() => formatLeadPhone(props.phone))
const telHref = computed(() => phoneText.value ? phoneTelHref(props.phone) : null)
const addressText = computed(() => leadAddressLine(props.address, props.city, props.state))
const photosText = computed(() => googlePhotosNote(props.photoCount, props.photos))
const photoUrls = computed(() => gbpPhotoUrls(props.photos))

function hideBrokenPhoto(event: Event) {
  const image = event.target
  if (image instanceof HTMLImageElement) image.remove()
}
const emailList = computed(() => (props.emails || []).map(email => email.trim()).filter(Boolean))
const ratingText = computed(() => {
  const rating = Number(props.rating)
  if (!Number.isFinite(rating) || rating <= 0) return ''
  const reviews = Number(props.reviewCount)
  const count = Number.isFinite(reviews) && reviews > 0 ? Math.round(reviews) : 0
  const label = count === 1 ? 'review' : 'reviews'
  return `${rating} (${count} ${label})`
})
</script>

<template>
  <div class="min-w-0 space-y-2 text-sm">
    <div
      v-if="scoreText || typeLine"
      class="flex flex-wrap items-baseline gap-x-3 gap-y-1"
    >
      <span
        v-if="scoreText"
        class="font-medium text-highlighted"
      >{{ scoreText }}</span>
      <span
        v-if="typeLine"
        class="min-w-0 break-words text-muted"
      >{{ typeLine }}</span>
    </div>

    <p
      v-if="href || checkText"
      class="break-words"
    >
      <a
        v-if="href"
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        class="break-all text-primary hover:underline"
      >{{ siteLabel }}</a>
      <span
        v-if="checkText"
        class="text-muted"
      >
        <template v-if="href"> · </template>{{ checkText }}
      </span>
    </p>

    <p
      v-if="ratingText"
      class="flex items-center gap-1 text-highlighted"
    >
      <UIcon
        name="i-lucide-star"
        class="shrink-0 text-wcGold-400"
      />
      <span>{{ ratingText }}</span>
    </p>

    <p v-if="phoneText && telHref">
      <a
        :href="telHref"
        class="text-primary hover:underline"
      >{{ phoneText }}</a>
    </p>

    <p
      v-if="addressText"
      class="flex items-start gap-1.5 text-muted"
    >
      <UIcon
        name="i-lucide-map-pin"
        class="mt-0.5 shrink-0"
      />
      <span class="min-w-0 break-words">{{ addressText }}</span>
    </p>

    <p
      v-if="angle"
      class="flex items-start gap-2"
    >
      <UIcon
        name="i-lucide-lightbulb"
        class="mt-0.5 shrink-0 text-wcGold-400"
      />
      <span class="min-w-0 break-words text-muted">{{ angle }}</span>
    </p>

    <div
      v-if="photoUrls.length"
      class="flex flex-wrap gap-2"
    >
      <img
        v-for="url in photoUrls"
        :key="url"
        :src="url"
        alt="Google photo"
        loading="lazy"
        class="h-16 w-16 rounded-md border border-default bg-muted object-cover"
        @error="hideBrokenPhoto"
      >
    </div>

    <p
      v-if="photosText"
      class="flex items-start gap-2 text-muted"
    >
      <UIcon
        name="i-lucide-camera"
        class="mt-0.5 shrink-0"
      />
      <span class="min-w-0 break-words">{{ photosText }}</span>
    </p>

    <div
      v-if="emailList.length"
      class="flex flex-col gap-1"
    >
      <a
        v-for="email in emailList"
        :key="email"
        :href="`mailto:${email}`"
        class="break-all text-primary hover:underline"
      >{{ email }}</a>
    </div>
  </div>
</template>
