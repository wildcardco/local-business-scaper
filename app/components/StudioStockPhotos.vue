<script setup lang="ts">
import type { StockPhoto, StockProviderNotice } from '~~/shared/stock-photos'
import { STOCK_PROVIDER_LABEL } from '~~/shared/stock-photos'

const props = defineProps<{
  mockupId: string
  existingUrls: string[]
  hintQuery?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  added: []
}>()

const toast = useToast()
const query = ref('')
const photos = ref<StockPhoto[]>([])
const notices = ref<StockProviderNotice[]>([])
const picked = ref<StockPhoto[]>([])
const slotQueries = ref<string[]>([])
const isSearching = ref(false)
const isAdding = ref(false)
const searched = ref(false)

const suggestionQueries = computed(() => {
  if (slotQueries.value.length) return slotQueries.value
  const hint = props.hintQuery?.replace(/\s+/g, ' ').trim()
  return hint ? [hint] : []
})

const suggestionLabel = computed(() =>
  slotQueries.value.length ? 'Photo slots on this mockup' : 'Suggested search'
)

const allSkipped = computed(() =>
  notices.value.length === 3 && notices.value.every(notice => notice.status === 'skipped')
)

const showEmpty = computed(() =>
  searched.value
  && !isSearching.value
  && photos.value.length === 0
  && notices.value.length < 3
)

onMounted(async () => {
  try {
    const result = await $fetch<{ queries: string[] }>(`/api/mockups/${props.mockupId}/photo-queries`)
    slotQueries.value = result.queries
  } catch {
    slotQueries.value = []
  }
})

watch(() => props.existingUrls, (urls) => {
  picked.value = picked.value.filter(photo => !urls.includes(photo.url))
})

function pickIndex(photo: StockPhoto) {
  return picked.value.findIndex(item => item.url === photo.url)
}

function alreadyAdded(photo: StockPhoto) {
  return props.existingUrls.includes(photo.url)
}

function toggle(photo: StockPhoto) {
  if (alreadyAdded(photo)) return
  const index = pickIndex(photo)
  if (index === -1) {
    if (picked.value.length >= 12) {
      toast.add({ title: 'You can add up to 12 photos at a time', color: 'warning' })
      return
    }
    picked.value = [...picked.value, photo]
    return
  }
  picked.value = picked.value.filter(item => item.url !== photo.url)
}

async function searchPhotos(nextQuery?: string) {
  const text = (typeof nextQuery === 'string' ? nextQuery : query.value).replace(/\s+/g, ' ').trim()
  if (text.length < 2) {
    toast.add({ title: 'Enter a search, such as asphalt crew Crown Point', color: 'warning' })
    return
  }
  query.value = text
  isSearching.value = true
  searched.value = true
  try {
    const result = await $fetch<{ photos: StockPhoto[], notices: StockProviderNotice[] }>('/api/studio/stock-photos', {
      query: { q: text }
    })
    photos.value = result.photos
    notices.value = result.notices
  } catch (error: unknown) {
    toast.add({
      title: 'Photo search failed',
      description: readError(error, 'Try the search again'),
      color: 'error'
    })
  } finally {
    isSearching.value = false
  }
}

async function addPicked() {
  if (props.disabled || isAdding.value) return
  const urls = picked.value
    .map(photo => photo.url)
    .filter(url => url.startsWith('http') && !props.existingUrls.includes(url))
  if (urls.length === 0) {
    toast.add({ title: 'Pick a photo that is not already on this mockup', color: 'warning' })
    return
  }
  const unsplashIds = picked.value
    .filter(photo => photo.provider === 'unsplash' && urls.includes(photo.url))
    .map(photo => photo.sourceId)
  isAdding.value = true
  try {
    await $fetch(`/api/mockups/${props.mockupId}/photos`, {
      method: 'POST',
      body: { photoUrls: urls }
    })
    if (unsplashIds.length) {
      $fetch('/api/studio/stock-photos/download', {
        method: 'POST',
        body: { ids: unsplashIds }
      }).catch(() => {})
    }
    toast.add({
      title: urls.length === 1 ? 'Photo added' : `${urls.length} photos added`,
      color: 'success'
    })
    picked.value = []
    emit('added')
  } catch (error: unknown) {
    toast.add({
      title: 'Could not add photos',
      description: readError(error, 'Try again'),
      color: 'error'
    })
  } finally {
    isAdding.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <form
      class="flex flex-col gap-2 sm:flex-row sm:items-end"
      @submit.prevent="searchPhotos()"
    >
      <UFormField
        label="Search stock photos"
        class="min-w-0 flex-1"
      >
        <UInput
          id="studio-stock-query"
          v-model="query"
          class="w-full"
          placeholder="asphalt crew Crown Point"
          icon="i-lucide-search"
          autocomplete="off"
        />
      </UFormField>
      <UButton
        type="submit"
        class="min-h-11 w-full justify-center sm:w-auto"
        variant="outline"
        icon="i-lucide-search"
        :loading="isSearching"
      >
        Search
      </UButton>
    </form>
    <p class="text-sm text-muted">
      Pick several. They are added in this order and fill the hero, then each service slot.
    </p>

    <div v-if="suggestionQueries.length">
      <p class="text-xs text-muted">
        {{ suggestionLabel }}
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <UButton
          v-for="phrase in suggestionQueries"
          :key="phrase"
          type="button"
          size="xs"
          variant="outline"
          class="max-w-full"
          @click="searchPhotos(phrase)"
        >
          <span class="truncate">{{ phrase }}</span>
        </UButton>
      </div>
    </div>

    <div
      v-if="picked.length"
      class="space-y-2"
    >
      <p class="text-xs text-muted">
        Selected, in the order they will be added
      </p>
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button
          v-for="(photo, index) in picked"
          :key="photo.id"
          type="button"
          class="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-secondary"
          :aria-label="`Remove ${photo.alt}`"
          @click="toggle(photo)"
        >
          <img
            :src="photo.thumb"
            :alt="photo.alt"
            class="h-full w-full object-cover"
          >
          <span class="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs font-medium text-inverted">
            {{ index + 1 }}
          </span>
        </button>
      </div>
      <UButton
        type="button"
        class="min-h-11 w-full justify-center sm:w-auto"
        variant="outline"
        icon="i-lucide-image-plus"
        :loading="isAdding"
        :disabled="disabled"
        @click="addPicked"
      >
        {{ picked.length === 1 ? 'Add photo' : `Add ${picked.length} photos` }}
      </UButton>
    </div>

    <ul
      v-if="notices.length"
      class="space-y-1"
      aria-live="polite"
    >
      <li
        v-for="notice in notices"
        :key="notice.provider"
        class="flex items-start gap-2 text-sm text-muted"
      >
        <UIcon
          :name="notice.status === 'error' ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
          class="mt-0.5 shrink-0"
          :class="notice.status === 'error' ? 'text-warning' : 'text-info'"
        />
        <span>{{ notice.message }}</span>
      </li>
    </ul>

    <p
      v-if="showEmpty && !allSkipped"
      class="text-sm text-muted"
    >
      No photos matched that search.
    </p>

    <div
      v-if="photos.length"
      class="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      <div
        v-for="photo in photos"
        :key="photo.id"
        class="min-w-0"
      >
        <button
          type="button"
          class="relative block w-full overflow-hidden rounded-lg border text-left"
          :class="pickIndex(photo) >= 0 ? 'border-secondary ring-2 ring-secondary' : 'border-default'"
          :aria-pressed="pickIndex(photo) >= 0"
          :disabled="alreadyAdded(photo)"
          @click="toggle(photo)"
        >
          <img
            :src="photo.thumb"
            :alt="photo.alt"
            class="h-24 w-full object-cover"
            loading="lazy"
          >
          <span
            v-if="pickIndex(photo) >= 0"
            class="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs font-medium text-inverted"
          >
            {{ pickIndex(photo) + 1 }}
          </span>
          <span
            v-else-if="alreadyAdded(photo)"
            class="absolute left-1 top-1 rounded bg-default/90 px-1.5 py-0.5 text-[10px] text-muted"
          >
            Added
          </span>
          <span class="block truncate px-1.5 py-1 text-[11px] text-muted">
            {{ STOCK_PROVIDER_LABEL[photo.provider] }}
          </span>
        </button>
        <p class="mt-1 truncate text-[11px] text-muted">
          <a
            v-if="photo.pageUrl"
            :href="photo.pageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
          >{{ photo.author }}</a>
          <span v-else>{{ photo.author }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
