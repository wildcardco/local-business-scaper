<script setup lang="ts">
import type { StockPhoto, StockProviderNotice } from '~~/shared/stock-photos'
import { STOCK_PROVIDER_LABEL } from '~~/shared/stock-photos'
import {
  defaultPhotoQuery,
  generatePhotoWebhookFields,
  slugPhotoSlot,
  type GeneratePhotoWebhookFields
} from '~~/shared/photo-slots'

const props = defineProps<{
  category: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:payload': [payload: GeneratePhotoWebhookFields | null]
}>()

interface DraftSlot {
  key: string
  label: string
  query: string
  queryTouched: boolean
  url: string
  thumb: string
  alt: string
}

const STARTER: { key: string, label: string }[] = [
  { key: 'hero', label: 'Hero' },
  { key: 'service-1', label: 'Service 1' },
  { key: 'service-2', label: 'Service 2' },
  { key: 'service-3', label: 'Service 3' },
  { key: 'about', label: 'About' },
  { key: 'gallery', label: 'Gallery' }
]

const toast = useToast()
const slots = ref<DraftSlot[]>(STARTER.map(item => ({
  key: item.key,
  label: item.label,
  query: '',
  queryTouched: false,
  url: '',
  thumb: '',
  alt: ''
})))
const addedLabel = ref('')
const activeKey = ref<string | null>(null)
const photos = ref<StockPhoto[]>([])
const notices = ref<StockProviderNotice[]>([])
const isSearching = ref(false)

function applyDefaultQueries() {
  for (const slot of slots.value) {
    if (slot.queryTouched) continue
    slot.query = defaultPhotoQuery(slot.key, props.category)
  }
}

watch(() => props.category, applyDefaultQueries, { immediate: true })

watch(slots, () => {
  emit('update:payload', generatePhotoWebhookFields(slots.value.map(slot => ({
    key: slot.key,
    label: slot.label,
    url: slot.url
  }))))
}, { deep: true, immediate: true })

function uniqueKey(base: string) {
  const key = base === 'hero' ? 'photo' : base
  const taken = new Set(slots.value.map(slot => slot.key))
  if (!taken.has(key)) return key
  let n = 2
  while (taken.has(`${key}-${n}`)) n += 1
  return `${key}-${n}`
}

function addSlot() {
  const label = addedLabel.value.replace(/\s+/g, ' ').trim()
  if (!label || props.disabled) return
  if (slots.value.length >= 12) {
    toast.add({ title: 'Twelve slots is the limit', color: 'warning' })
    return
  }
  const key = uniqueKey(slugPhotoSlot(label))
  slots.value.push({
    key,
    label,
    query: defaultPhotoQuery(key, props.category),
    queryTouched: false,
    url: '',
    thumb: '',
    alt: ''
  })
  addedLabel.value = ''
}

function removeSlot(key: string) {
  if (key === 'hero' || props.disabled) return
  slots.value = slots.value.filter(slot => slot.key !== key)
  if (activeKey.value === key) {
    activeKey.value = null
    photos.value = []
  }
}

function markQuery(slot: DraftSlot, value: string) {
  slot.queryTouched = true
  slot.query = value
}

async function searchSlot(slot: DraftSlot) {
  const text = slot.query.replace(/\s+/g, ' ').trim()
  if (text.length < 2) {
    toast.add({ title: 'Enter a search of at least two characters', color: 'warning' })
    return
  }
  slot.query = text
  activeKey.value = slot.key
  isSearching.value = true
  try {
    const result = await $fetch<{ photos: StockPhoto[], notices: StockProviderNotice[] }>('/api/studio/stock-photos', {
      query: { q: text, sources: 'pixabay,pexels' }
    })
    photos.value = result.photos.filter(photo => photo.provider === 'pixabay' || photo.provider === 'pexels')
    notices.value = result.notices.filter(notice => notice.provider !== 'unsplash')
  } catch (error: unknown) {
    photos.value = []
    toast.add({
      title: 'Photo search failed',
      description: readError(error, 'Try the search again'),
      color: 'error'
    })
  } finally {
    isSearching.value = false
  }
}

function pick(slot: DraftSlot, photo: StockPhoto) {
  slot.url = photo.url
  slot.thumb = photo.thumb
  slot.alt = photo.alt
}

function clearPhoto(slot: DraftSlot) {
  slot.url = ''
  slot.thumb = ''
  slot.alt = ''
}
</script>

<template>
  <section
    data-generate-photos
    class="space-y-3"
  >
    <div>
      <h3 class="text-sm font-semibold text-highlighted">
        Photos
      </h3>
      <p class="mt-1 text-xs text-muted">
        Optional. Search Pixabay and Pexels for each slot. The hero stays first. Empty slots stay open.
      </p>
    </div>

    <article
      v-for="slot in slots"
      :key="slot.key"
      :data-generate-photo-slot="slot.key"
      class="space-y-2 rounded-lg border border-default p-3"
    >
      <div class="flex items-center gap-2">
        <UInput
          :model-value="slot.label"
          size="sm"
          class="min-w-0 flex-1"
          :disabled="disabled"
          :aria-label="`${slot.label} name`"
          @update:model-value="slot.label = String($event || '')"
        />
        <UButton
          v-if="slot.key !== 'hero'"
          type="button"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          :disabled="disabled"
          :aria-label="`Remove ${slot.label}`"
          @click="removeSlot(slot.key)"
        />
      </div>

      <form
        class="flex flex-col gap-2 sm:flex-row"
        @submit.prevent="searchSlot(slot)"
      >
        <UInput
          :model-value="slot.query"
          size="sm"
          class="min-w-0 flex-1"
          icon="i-lucide-search"
          placeholder="Search photos"
          :disabled="disabled"
          :aria-label="`Search photos for ${slot.label}`"
          @update:model-value="markQuery(slot, String($event || ''))"
        />
        <UButton
          type="submit"
          size="sm"
          variant="outline"
          class="min-h-11 justify-center sm:min-h-0"
          icon="i-lucide-search"
          :loading="isSearching && activeKey === slot.key"
          :disabled="disabled"
          :data-generate-photo-search="slot.key"
        >
          Search
        </UButton>
      </form>

      <div
        v-if="slot.url"
        class="flex items-center gap-2"
      >
        <img
          :src="slot.thumb || slot.url"
          :alt="slot.alt || slot.label"
          class="size-14 shrink-0 rounded object-cover"
        >
        <p class="min-w-0 flex-1 truncate text-xs text-muted">
          {{ slot.alt || 'Photo chosen' }}
        </p>
        <UButton
          type="button"
          size="xs"
          variant="ghost"
          color="neutral"
          :disabled="disabled"
          @click="clearPhoto(slot)"
        >
          Clear
        </UButton>
      </div>

      <div
        v-if="activeKey === slot.key"
        class="space-y-2"
      >
        <ul
          v-if="notices.length"
          class="space-y-1"
        >
          <li
            v-for="notice in notices"
            :key="notice.provider"
            class="text-xs text-muted"
          >
            {{ notice.message }}
          </li>
        </ul>
        <p
          v-if="!isSearching && !photos.length"
          class="text-xs text-muted"
        >
          No Pixabay or Pexels photos matched that search.
        </p>
        <div
          v-if="photos.length"
          class="grid grid-cols-2 gap-2"
        >
          <button
            v-for="photo in photos"
            :key="photo.id"
            type="button"
            data-generate-photo-result
            class="overflow-hidden rounded-lg border text-left"
            :class="slot.url === photo.url ? 'border-secondary ring-2 ring-secondary' : 'border-default'"
            @click="pick(slot, photo)"
          >
            <img
              :src="photo.thumb"
              :alt="photo.alt"
              class="h-20 w-full object-cover"
              loading="lazy"
            >
            <span class="block truncate px-1.5 py-1 text-[11px] text-muted">
              {{ STOCK_PROVIDER_LABEL[photo.provider] }}
            </span>
          </button>
        </div>
      </div>
    </article>

    <form
      class="flex flex-col gap-2 sm:flex-row"
      @submit.prevent="addSlot"
    >
      <UInput
        v-model="addedLabel"
        size="sm"
        class="min-w-0 flex-1"
        placeholder="Service 4, Team"
        :disabled="disabled"
        aria-label="New slot name"
      />
      <UButton
        type="submit"
        size="sm"
        variant="outline"
        class="min-h-11 justify-center sm:min-h-0"
        icon="i-lucide-plus"
        :disabled="disabled"
      >
        Add slot
      </UButton>
    </form>
  </section>
</template>
