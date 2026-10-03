<script setup lang="ts">
import { upload } from '@imagekit/vue'
import type { PhotoSlot } from '~~/shared/photo-slots'
import { slotLabel, slotOrderedPhotoUrls } from '~~/shared/photo-slots'
import type { JobPhase } from '~~/shared/studio-job'
import type { StockPhoto, StockProviderNotice } from '~~/shared/stock-photos'
import { STOCK_PROVIDER_LABEL } from '~~/shared/stock-photos'

export interface ChosenPhoto {
  id: string
  url: string
  thumb: string
  alt: string
  provider: StockPhoto['provider'] | 'upload'
  sourceId: string
  author: string
  pageUrl: string
}

const props = defineProps<{
  mockupId: string
  slots: PhotoSlot[]
  slotNote: string
  assignments: Record<number, string>
  activeIndex: number | null
  chosen: ChosenPhoto | null
  disabled?: boolean
  phase: JobPhase
  detail: string
  hintQuery?: string
}>()

const emit = defineEmits<{
  choose: [photo: ChosenPhoto | null]
  aim: [index: number]
  clear: [index: number]
  apply: [payload: { urls: string[], unsplashIds: string[] }]
}>()

const toast = useToast()
const config = useRuntimeConfig()
const query = ref('')
const photos = ref<StockPhoto[]>([])
const notices = ref<StockProviderNotice[]>([])
const isSearching = ref(false)
const isUploading = ref(false)
const searched = ref(false)
const unsplashByUrl = ref<Record<string, string>>({})

const photoSteps = [
  { id: 'sending' as const, label: 'Sending to n8n' },
  { id: 'building' as const, label: 'Building on Vercel' },
  { id: 'ready' as const, label: 'Ready' },
  { id: 'failed' as const, label: 'Failed' }
]

const orderedUrls = computed(() => slotOrderedPhotoUrls(props.slots.map(slot => props.assignments[slot.index] || '')))
const canSend = computed(() => orderedUrls.value.some(url => url.startsWith('http')))

watch(() => props.activeIndex, (index) => {
  if (index == null) return
  const phrase = props.slots.find(slot => slot.index === index)?.query
  if (phrase && !query.value.trim()) query.value = phrase
})

function rememberUnsplash(photo: ChosenPhoto) {
  if (photo.provider !== 'unsplash' || !photo.sourceId) return
  unsplashByUrl.value = { ...unsplashByUrl.value, [photo.url]: photo.sourceId }
}

function chooseStock(photo: StockPhoto) {
  const chosenPhoto: ChosenPhoto = {
    id: photo.id,
    url: photo.url,
    thumb: photo.thumb,
    alt: photo.alt,
    provider: photo.provider,
    sourceId: photo.sourceId,
    author: photo.author,
    pageUrl: photo.pageUrl
  }
  rememberUnsplash(chosenPhoto)
  emit('choose', chosenPhoto)
}

function onDragStart(event: DragEvent, photo: ChosenPhoto) {
  event.dataTransfer?.setData('text/uri-list', photo.url)
  event.dataTransfer?.setData('text/plain', photo.url)
  rememberUnsplash(photo)
  emit('choose', photo)
}

async function searchPhotos(nextQuery?: string) {
  const text = (typeof nextQuery === 'string' ? nextQuery : query.value).replace(/\s+/g, ' ').trim()
  if (text.length < 2) {
    toast.add({ title: 'Enter a search of at least two characters', color: 'warning' })
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

async function onUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.add({ title: 'Upload an image file', color: 'error' })
    return
  }
  isUploading.value = true
  try {
    const authResponse = await $fetch('/api/imagekit/auth')
    const result = await upload({
      file,
      fileName: `studio-${props.mockupId}-${Date.now()}.${file.name.split('.').pop()}`,
      folder: '/studio',
      useUniqueFileName: true,
      publicKey: config.public.imageKitPublicKey,
      authenticator: async () => ({
        signature: authResponse.signature,
        expire: authResponse.expire,
        token: authResponse.token
      })
    })
    if (!result.url?.startsWith('http')) {
      toast.add({ title: 'Upload did not return a photo URL', color: 'error' })
      return
    }
    emit('choose', {
      id: `upload:${result.url}`,
      url: result.url,
      thumb: result.url,
      alt: file.name,
      provider: 'upload',
      sourceId: '',
      author: 'Upload',
      pageUrl: ''
    })
    toast.add({
      title: 'Photo ready to place',
      description: 'Assign it to a slot, or click that slot on the mockup.',
      color: 'success'
    })
  } catch (error: unknown) {
    toast.add({
      title: 'Photo upload failed',
      description: readError(error, 'Try again'),
      color: 'error'
    })
  } finally {
    isUploading.value = false
  }
}

function assignSlot(index: number) {
  if (props.disabled) return
  if (!props.chosen?.url.startsWith('http')) {
    toast.add({ title: 'Select a photo, then choose a slot', color: 'warning' })
    return
  }
  emit('aim', index)
}

function sendAssigned() {
  if (!canSend.value || props.disabled) return
  const urls = orderedUrls.value
  const unsplashIds = props.slots.flatMap((slot) => {
    const url = props.assignments[slot.index]
    const sourceId = url ? unsplashByUrl.value[url] : ''
    return sourceId ? [sourceId] : []
  })
  emit('apply', { urls, unsplashIds: [...new Set(unsplashIds)] })
}

defineExpose({ sendAssigned })
</script>

<template>
  <div class="flex flex-col gap-4">
    <StudioJobStatus
      class="order-1"
      :phase="phase"
      :detail="detail"
      :steps="photoSteps"
    />

    <p
      v-if="slotNote"
      class="order-2 text-sm text-muted"
    >
      {{ slotNote }}
    </p>
    <ol
      v-else-if="slots.length"
      class="order-10 space-y-2 lg:order-3"
    >
      <li
        v-for="slot in slots"
        :key="slot.index"
        class="flex items-stretch gap-2"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 rounded-lg border p-2 text-left"
          :class="activeIndex === slot.index ? 'border-primary' : 'border-default'"
          @click="emit('aim', slot.index)"
        >
          <img
            v-if="assignments[slot.index]"
            :src="assignments[slot.index]"
            :alt="slot.query"
            class="h-14 w-14 shrink-0 overflow-hidden rounded object-cover"
          >
          <span
            v-else
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted"
          >
            Empty
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-xs text-muted">{{ slot.role === 'hero' ? 'Hero' : `Slot ${slot.index + 1}` }}</span>
            <span class="block truncate text-sm">{{ slot.query }}</span>
          </span>
        </button>
        <div class="hidden shrink-0 flex-col justify-center gap-1 lg:flex">
          <UButton
            type="button"
            size="xs"
            variant="outline"
            :disabled="disabled"
            @click="assignSlot(slot.index)"
          >
            Assign
          </UButton>
          <UButton
            v-if="assignments[slot.index]"
            type="button"
            size="xs"
            variant="ghost"
            :disabled="disabled"
            @click="emit('clear', slot.index)"
          >
            Clear
          </UButton>
        </div>
      </li>
    </ol>

    <p
      v-if="chosen"
      class="order-4 hidden rounded-lg border border-secondary bg-elevated p-3 text-sm lg:block"
    >
      Selected {{ chosen.alt }}. Assign it to a named slot, or click that slot on the mockup.
    </p>

    <form
      class="order-3 flex flex-col gap-2 sm:flex-row sm:items-end lg:order-5"
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
          placeholder="asphalt crew paving a driveway"
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
    <p class="order-4 text-sm text-muted lg:order-6">
      Choose a photo, then Assign it to a named slot or click that slot on the mockup. On a phone, open Actions and use that bar while you scroll. Hide it when you are done. The hero is first. Empty slots stay empty. Save sends the real photo URLs.
    </p>
    <div
      v-if="slots.length"
      class="order-5 flex flex-wrap gap-2 lg:order-7"
    >
      <UButton
        v-for="slot in slots"
        :key="`search-${slot.index}`"
        type="button"
        size="xs"
        variant="outline"
        class="max-w-full"
        @click="searchPhotos(slot.query)"
      >
        <span class="truncate">{{ slotLabel(slot) }}</span>
      </UButton>
    </div>
    <UButton
      v-else-if="hintQuery"
      type="button"
      size="xs"
      variant="outline"
      class="order-5 lg:order-7"
      @click="searchPhotos(hintQuery)"
    >
      {{ hintQuery }}
    </UButton>

    <ul
      v-if="notices.length"
      class="order-6 space-y-1 lg:order-8"
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
      v-if="searched && !isSearching && !photos.length && notices.length < 3"
      class="order-7 text-sm text-muted lg:order-9"
    >
      No photos matched that search.
    </p>

    <div
      v-if="photos.length"
      class="studio-photo-grid order-8 grid grid-cols-2 gap-2 lg:order-10"
    >
      <div
        v-for="photo in photos"
        :key="photo.id"
        class="min-w-0"
      >
        <button
          type="button"
          draggable="true"
          class="relative block w-full overflow-hidden rounded-lg border text-left"
          :class="chosen?.url === photo.url ? 'border-secondary ring-2 ring-secondary' : 'border-default'"
          :aria-pressed="chosen?.url === photo.url"
          @click="chooseStock(photo)"
          @dragstart="onDragStart($event, {
            id: photo.id,
            url: photo.url,
            thumb: photo.thumb,
            alt: photo.alt,
            provider: photo.provider,
            sourceId: photo.sourceId,
            author: photo.author,
            pageUrl: photo.pageUrl
          })"
        >
          <img
            :src="photo.thumb"
            :alt="photo.alt"
            class="h-24 w-full object-cover"
            loading="lazy"
          >
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

    <div class="order-9 lg:order-11">
      <input
        id="studio-photo"
        type="file"
        accept="image/*"
        class="hidden"
        :disabled="disabled || isUploading"
        @change="onUpload"
      >
      <label
        for="studio-photo"
        :class="disabled ? 'pointer-events-none opacity-60' : ''"
      >
        <UButton
          icon="i-lucide-upload"
          variant="outline"
          :loading="isUploading"
          :disabled="disabled"
          as="span"
          class="cursor-pointer"
        >
          Upload a photo
        </UButton>
      </label>
    </div>

    <div class="order-12 max-lg:hidden">
      <UButton
        type="button"
        class="min-h-11 w-full justify-center"
        icon="i-lucide-save"
        :disabled="disabled || !canSend"
        @click="sendAssigned"
      >
        Save
      </UButton>
    </div>
  </div>
</template>
