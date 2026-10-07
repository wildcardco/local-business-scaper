<script setup lang="ts">
import { rankTownSuggestions } from '~~/shared/utils/town-suggestions'

const emit = defineEmits<{
  search: [{ query: string, location: string, limit: number, lat?: number, lng?: number, placeId?: string }]
}>()

defineProps<{
  loading?: boolean
}>()

const query = ref('')
const town = ref('')
const townPlaceId = ref<string | undefined>()
const townLat = ref<number | undefined>()
const townLng = ref<number | undefined>()
const suggestions = ref<{ label: string, value: string, placeId?: string, lat?: number, lng?: number }[]>([])
const loadingTowns = ref(false)
const root = ref<HTMLElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

const canSearch = computed(() => Boolean(query.value.trim() && town.value.trim()))

watch(town, (value) => {
  const selected = suggestions.value.find(item => item.value === value || item.label === value)
  townPlaceId.value = selected?.placeId
  townLat.value = selected?.lat
  townLng.value = selected?.lng
})

function onTownSearch(term: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  const current = ++requestId
  const text = term.trim()
  if (text.length < 2) {
    suggestions.value = []
    loadingTowns.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    loadingTowns.value = true
    try {
      const response = await $fetch<{
        suggestions?: { label?: string, value?: string, placeId?: string, lat?: number, lng?: number }[]
      }>('/api/autocomplete', {
        query: { query: text, region: 'us' }
      })
      if (current !== requestId) return
      const rows = (response.suggestions || []).map(item => ({
        label: String(item.label || item.value || ''),
        value: String(item.value || item.label || ''),
        placeId: item.placeId,
        lat: item.lat,
        lng: item.lng
      })).filter(item => item.label)
      suggestions.value = rankTownSuggestions(text, rows)
    } catch {
      if (current === requestId) suggestions.value = []
    } finally {
      if (current === requestId) loadingTowns.value = false
    }
  }, 300)
}

function submit() {
  const businessType = query.value.trim()
  const place = town.value.trim()
  if (!businessType || !place) return
  const location = /usa|united states/i.test(place) ? place : `${place}, USA`
  emit('search', {
    query: businessType,
    location,
    limit: 20,
    lat: townLat.value,
    lng: townLng.value,
    placeId: townPlaceId.value
  })
}

function focus() {
  root.value?.querySelector('input')?.focus()
}

defineExpose({ focus })
</script>

<template>
  <form
    id="dashboard-search"
    ref="root"
    class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
    @submit.prevent="submit"
  >
    <label class="col-span-2 min-w-0 sm:col-span-1">
      <span class="sr-only">Business type</span>
      <UInput
        v-model="query"
        placeholder="Business type"
        icon="i-lucide-store"
        size="md"
        class="w-full"
        autocomplete="off"
      />
    </label>
    <label class="min-w-0">
      <span class="sr-only">Town</span>
      <UInputMenu
        v-model="town"
        :items="suggestions"
        value-key="value"
        placeholder="Town"
        icon="i-lucide-map-pin"
        size="md"
        ignore-filter
        create-item
        :loading="loadingTowns"
        class="w-full"
        @update:search-term="onTownSearch"
      />
    </label>
    <UButton
      type="submit"
      size="md"
      class="shrink-0"
      :disabled="!canSearch"
      :loading="loading"
    >
      Go
    </UButton>
  </form>
</template>
