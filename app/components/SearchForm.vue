<script setup lang="ts">
import type { InputMenuItem } from '@nuxt/ui'
import { businessCategories, categoryGroups } from '~/data/business-categories'

const emit = defineEmits<{
  search: [{ query: string; location: string; limit: number; lat?: number; lng?: number; placeId?: string }]
}>()

defineProps<{
  loading?: boolean
}>()

const selectedCategory = ref<string>('')
const city = ref('')
const cityPlaceId = ref<string | undefined>()
const cityLat = ref<number | undefined>()
const cityLng = ref<number | undefined>()
const state = ref('all')
const country = ref('us')
const zipCode = ref('')
const limit = ref(20)

// Transform categories into InputMenu format with groups
const categoryItems = computed<InputMenuItem[]>(() => {
  const items: InputMenuItem[] = []

  categoryGroups.forEach(group => {
    // Add group label
    items.push({
      type: 'label',
      label: group
    })

    // Add items in this group
    businessCategories
      .filter(cat => cat.group === group)
      .forEach(cat => {
        items.push({
          label: cat.label,
          value: cat.value,
          icon: getIconForGroup(cat.group)
        })
      })

    // Add separator after each group
    items.push({ type: 'separator' })
  })

  return items
})

function getIconForGroup(group: string): string {
  const icons: Record<string, string> = {
    'Food & Dining': 'i-lucide-utensils',
    'Home Services': 'i-lucide-wrench',
    'Automotive': 'i-lucide-car',
    'Health & Medical': 'i-lucide-heart-pulse',
    'Beauty & Personal Care': 'i-lucide-sparkles',
    'Retail & Shopping': 'i-lucide-shopping-bag',
    'Professional Services': 'i-lucide-briefcase',
    'Fitness & Recreation': 'i-lucide-dumbbell',
    'Education & Childcare': 'i-lucide-graduation-cap',
    'Lodging & Travel': 'i-lucide-plane',
    'Events & Entertainment': 'i-lucide-party-popper',
    'Pet Services': 'i-lucide-paw-print',
    'Storage & Moving': 'i-lucide-truck',
    'Financial Services': 'i-lucide-landmark',
    'Religious Organizations': 'i-lucide-church',
    'Industrial & Manufacturing': 'i-lucide-factory'
  }
  return icons[group] || 'i-lucide-store'
}

// City autocomplete
interface CitySuggestion {
  label: string
  value: string
  placeId?: string
  lat?: number
  lng?: number
}
const citySuggestions = ref<CitySuggestion[]>([])
const isLoadingSuggestions = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Get state name for filtering
const selectedStateName = computed(() => {
  if (!state.value || state.value === 'all') return ''
  const stateOption = stateOptions.value.find(s => s.value === state.value)
  return stateOption?.label || state.value
})

async function onCitySearch(searchTerm: string) {
  if (!searchTerm || searchTerm.length < 2) {
    citySuggestions.value = []
    return
  }

  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    isLoadingSuggestions.value = true
    try {
      // Include state in query if selected to get more relevant results
      const queryWithState = state.value && state.value !== 'all'
        ? `${searchTerm}, ${selectedStateName.value}`
        : searchTerm

      const response = await $fetch('/api/autocomplete', {
        query: { query: queryWithState, region: country.value }
      })

      let suggestions: CitySuggestion[] = (response.suggestions || []).map((s: CitySuggestion) => ({
        label: s.label,
        value: s.value,
        placeId: s.placeId,
        lat: s.lat,
        lng: s.lng
      }))

      // If a state is selected, prioritize results that match that state
      if (state.value && state.value !== 'all') {
        const stateAbbr = state.value.toUpperCase()
        const stateName = selectedStateName.value.toLowerCase()

        // Sort to put matching state results first
        suggestions = suggestions.sort((a, b) => {
          const aLabel = a.label.toLowerCase()
          const bLabel = b.label.toLowerCase()

          const aMatchesState = aLabel.includes(stateAbbr.toLowerCase()) ||
            aLabel.includes(stateName) ||
            aLabel.includes(`, ${stateAbbr}`)
          const bMatchesState = bLabel.includes(stateAbbr.toLowerCase()) ||
            bLabel.includes(stateName) ||
            bLabel.includes(`, ${stateAbbr}`)

          if (aMatchesState && !bMatchesState) return -1
          if (!aMatchesState && bMatchesState) return 1
          return 0
        })

        // Filter to only show results from selected state if we have matches
        const stateMatches = suggestions.filter((s) => {
          const label = s.label.toLowerCase()
          return label.includes(stateAbbr.toLowerCase()) ||
            label.includes(stateName) ||
            label.includes(`, ${stateAbbr}`)
        })

        // If we have state-specific matches, only show those
        if (stateMatches.length > 0) {
          suggestions = stateMatches
        }
      }

      citySuggestions.value = suggestions
    } catch (error) {
      console.error('Autocomplete error:', error)
      citySuggestions.value = []
    } finally {
      isLoadingSuggestions.value = false
    }
  }, 300)
}

// Country options
const countryOptions = [
  { label: 'United States', value: 'us' },
  { label: 'Canada', value: 'ca' },
  { label: 'United Kingdom', value: 'gb' },
  { label: 'Australia', value: 'au' },
  { label: 'Germany', value: 'de' },
  { label: 'France', value: 'fr' },
  { label: 'Mexico', value: 'mx' }
]

// US States
const usStates = [
  { label: 'All States', value: 'all' },
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' }
]

// Canadian Provinces
const caProvinces = [
  { label: 'All Provinces', value: 'all' },
  { label: 'Alberta', value: 'AB' },
  { label: 'British Columbia', value: 'BC' },
  { label: 'Manitoba', value: 'MB' },
  { label: 'New Brunswick', value: 'NB' },
  { label: 'Newfoundland and Labrador', value: 'NL' },
  { label: 'Nova Scotia', value: 'NS' },
  { label: 'Ontario', value: 'ON' },
  { label: 'Prince Edward Island', value: 'PE' },
  { label: 'Quebec', value: 'QC' },
  { label: 'Saskatchewan', value: 'SK' }
]

const stateOptions = computed(() => {
  switch (country.value) {
    case 'us': return usStates
    case 'ca': return caProvinces
    default: return [{ label: 'All Regions', value: 'all' }]
  }
})

const stateLabel = computed(() => {
  switch (country.value) {
    case 'us': return 'State'
    case 'ca': return 'Province'
    case 'gb': return 'County'
    default: return 'Region'
  }
})

const limitOptions = [
  { label: '5 results', value: 5 },
  { label: '10 results', value: 10 },
  { label: '20 results', value: 20 },
  { label: '50 results', value: 50 }
]

// Build location string
const locationString = computed(() => {
  const parts = []
  if (city.value.trim()) parts.push(city.value.trim())
  if (state.value && state.value !== 'all') parts.push(state.value)
  if (zipCode.value.trim()) parts.push(zipCode.value.trim())

  const countryLabel = countryOptions.find(c => c.value === country.value)?.label || ''
  if (countryLabel && country.value !== 'us') parts.push(countryLabel)
  else if (country.value === 'us') parts.push('USA')

  return parts.join(', ')
})

const canSearch = computed(() =>
  selectedCategory.value &&
  (city.value.trim() || (state.value && state.value !== 'all') || zipCode.value.trim())
)

// Reset state when country changes
watch(country, () => {
  state.value = 'all'
  city.value = ''
  cityPlaceId.value = undefined
  cityLat.value = undefined
  cityLng.value = undefined
  citySuggestions.value = []
})

// Watch for city changes to capture coordinates
watch(city, (newCity) => {
  // Find the selected suggestion to get its coordinates
  const selected = citySuggestions.value.find(s => s.value === newCity || s.label === newCity)
  if (selected) {
    cityPlaceId.value = selected.placeId
    cityLat.value = selected.lat
    cityLng.value = selected.lng
  } else {
    // Manual input - clear coordinates
    cityPlaceId.value = undefined
    cityLat.value = undefined
    cityLng.value = undefined
  }
})

function handleSearch() {
  if (!canSearch.value) return

  emit('search', {
    query: selectedCategory.value,
    location: locationString.value,
    limit: limit.value,
    lat: cityLat.value,
    lng: cityLng.value,
    placeId: cityPlaceId.value
  })
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-search" class="text-primary" />
        <h2 class="font-semibold">Search Local Businesses</h2>
      </div>
    </template>

    <form @submit.prevent="handleSearch" class="space-y-4">
      <!-- Row 1: Business Type with InputMenu -->
      <UFormField label="Business Type / Category">
        <UInputMenu
          v-model="selectedCategory"
          :items="categoryItems"
          value-key="value"
          placeholder="Search or select a category..."
          icon="i-lucide-store"
          size="lg"
          open-on-focus
          class="w-full"
        >
          <template #empty>
            <div class="p-4 text-center text-muted">
              <UIcon name="i-lucide-search-x" class="text-2xl mb-2" />
              <p>No categories found</p>
            </div>
          </template>
        </UInputMenu>

        <p v-if="selectedCategory" class="text-xs text-muted mt-1 flex items-center gap-1">
          <UIcon name="i-lucide-check" class="text-success" />
          Selected: {{ businessCategories.find(c => c.value === selectedCategory)?.label || selectedCategory }}
        </p>
      </UFormField>

      <!-- Row 2: Location Fields -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Country -->
        <UFormField label="Country">
          <USelect
            v-model="country"
            :items="countryOptions"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <!-- State/Province -->
        <UFormField :label="stateLabel">
          <USelect
            v-model="state"
            :items="stateOptions"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <!-- City with InputMenu for autocomplete -->
        <UFormField label="City / Town">
          <UInputMenu
            v-model="city"
            :items="citySuggestions"
            value-key="value"
            :placeholder="state && state !== 'all' ? `City in ${selectedStateName}...` : 'Start typing...'"
            icon="i-lucide-map-pin"
            size="lg"
            :loading="isLoadingSuggestions"
            create-item
            class="w-full"
            @update:search-term="onCitySearch"
          >
            <template #item-label="{ item }">
              <div class="flex items-center gap-2">
                <span>{{ item.label }}</span>
                <UBadge
                  v-if="state && state !== 'all' && item.label.toLowerCase().includes(state.toLowerCase())"
                  color="success"
                  variant="soft"
                  size="xs"
                >
                  Match
                </UBadge>
              </div>
            </template>
            <template #empty>
              <div class="p-3 text-center text-sm text-muted">
                <template v-if="state && state !== 'all'">
                  Type to search cities in {{ selectedStateName }}...
                </template>
                <template v-else>
                  Select a state first for better results, or type to search...
                </template>
              </div>
            </template>
          </UInputMenu>
          <p v-if="state && state !== 'all'" class="text-xs text-muted mt-1">
            Searching in {{ selectedStateName }}
          </p>
        </UFormField>

        <!-- Zip Code -->
        <UFormField label="Zip / Postal Code">
          <UInput
            v-model="zipCode"
            placeholder="e.g., 46402"
            icon="i-lucide-hash"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- Row 3: Results & Search Button -->
      <div class="flex flex-col sm:flex-row gap-4 items-end">
        <UFormField label="Results" class="w-full sm:w-40">
          <USelect
            v-model="limit"
            :items="limitOptions"
            value-key="value"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <div class="flex-1" />

        <!-- Location Preview -->
        <div v-if="locationString && locationString !== 'USA'" class="hidden sm:flex items-center gap-2 text-sm text-muted px-3">
          <UIcon name="i-lucide-navigation" />
          <span class="truncate max-w-xs">{{ locationString }}</span>
        </div>

        <UButton
          type="submit"
          :disabled="!canSearch"
          :loading="loading"
          icon="i-lucide-search"
          size="lg"
        >
          Search & Score
        </UButton>
      </div>
    </form>
  </UCard>
</template>
