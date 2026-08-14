<script setup lang="ts">
import { h, resolveComponent } from 'vue'

interface Business {
  id: string
  name: string
  category: string | null
  city: string | null
  state: string | null
  website: string | null
  phone: string | null
  rating: number | null
  reviewCount: number | null
  leadScore: number
  leadCategory: 'hot' | 'warm' | 'cold' | 'skip' | null
  status: 'new' | 'approved' | 'sent' | 'responded' | 'rejected'
  audit?: {
    performanceScore: number | null
    seoScore: number | null
  } | null
}

const props = withDefaults(defineProps<{
  businesses: Business[]
  loading?: boolean
  selectable?: boolean
  pageSize?: number
}>(), {
  loading: false,
  selectable: false,
  pageSize: 25
})

const emit = defineEmits<{
  audit: [id: string]
  view: [id: string]
  approve: [id: string]
  reject: [id: string]
  'update:selected': [ids: string[]]
}>()

const UBadge = resolveComponent('UBadge')
const UIcon = resolveComponent('UIcon')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

// Selection state
const selectedIds = ref<string[]>([])
const lastClickedIndex = ref<number | null>(null)

// Drag selection state
const isDragging = ref(false)
const dragStartIndex = ref<number | null>(null)
const dragCurrentIndex = ref<number | null>(null)

// Pagination
const currentPage = ref(1)

// Filters and sorting
const selectedCategory = ref<string | null>(null)
const selectedStatus = ref<string | null>(null)
const selectedLocation = ref<string | null>(null)
const selectedWebsite = ref<string | null>(null)
const selectedRating = ref<string | null>(null)
const selectedAudited = ref<string | null>(null)
const sortField = ref<string>('leadScore')
const sortOrder = ref<'asc' | 'desc'>('desc')
const searchQuery = ref('')
const showFilters = ref(true)

const categoryOptions = [
  { label: 'All Lead Types', value: null },
  { label: '🔥 Hot', value: 'hot' },
  { label: '🌡️ Warm', value: 'warm' },
  { label: '❄️ Cold', value: 'cold' },
  { label: '⏭️ Skip', value: 'skip' }
]

const statusOptions = [
  { label: 'All Statuses', value: null },
  { label: 'New', value: 'new' },
  { label: 'Approved', value: 'approved' },
  { label: 'Sent', value: 'sent' },
  { label: 'Responded', value: 'responded' },
  { label: 'Rejected', value: 'rejected' }
]

const websiteOptions = [
  { label: 'All', value: null },
  { label: '✓ Has Website', value: 'yes' },
  { label: '✗ No Website', value: 'no' }
]

const ratingOptions = [
  { label: 'Any Rating', value: null },
  { label: '⭐ 4.5+', value: '4.5' },
  { label: '⭐ 4.0+', value: '4.0' },
  { label: '⭐ 3.5+', value: '3.5' },
  { label: '⭐ 3.0+', value: '3.0' },
  { label: 'No Rating', value: 'none' }
]

const auditedOptions = [
  { label: 'All', value: null },
  { label: '✓ Audited', value: 'yes' },
  { label: '✗ Not Audited', value: 'no' }
]

// Dynamic location options based on business data
const locationOptions = computed(() => {
  const locations = new Map<string, number>()
  props.businesses.forEach(b => {
    const loc = [b.city, b.state].filter(Boolean).join(', ')
    if (loc) {
      locations.set(loc, (locations.get(loc) || 0) + 1)
    }
  })
  const sorted = Array.from(locations.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  return [
    { label: 'All Locations', value: null },
    ...sorted.map(([loc, count]) => ({ label: `${loc} (${count})`, value: loc }))
  ]
})

const sortOptions = [
  { label: 'Lead Score', value: 'leadScore' },
  { label: 'Name', value: 'name' },
  { label: 'Rating', value: 'rating' },
  { label: 'Status', value: 'status' }
]

const pageSizeOptions = [
  { label: '10 per page', value: 10 },
  { label: '25 per page', value: 25 },
  { label: '50 per page', value: 50 },
  { label: '100 per page', value: 100 }
]

const itemsPerPage = ref(props.pageSize)

// Count active filters
const activeFilterCount = computed(() => {
  let count = 0
  if (selectedCategory.value) count++
  if (selectedStatus.value) count++
  if (selectedLocation.value) count++
  if (selectedWebsite.value) count++
  if (selectedRating.value) count++
  if (selectedAudited.value) count++
  if (searchQuery.value) count++
  return count
})

const filteredBusinesses = computed(() => {
  let result = [...props.businesses]

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(b =>
      b.name.toLowerCase().includes(query)
      || b.category?.toLowerCase().includes(query)
      || b.city?.toLowerCase().includes(query)
      || b.state?.toLowerCase().includes(query)
      || b.phone?.includes(query)
    )
  }

  // Filter by lead category
  if (selectedCategory.value) {
    result = result.filter(b => b.leadCategory === selectedCategory.value)
  }

  // Filter by status
  if (selectedStatus.value) {
    result = result.filter(b => b.status === selectedStatus.value)
  }

  // Filter by location
  if (selectedLocation.value) {
    result = result.filter(b => {
      const loc = [b.city, b.state].filter(Boolean).join(', ')
      return loc === selectedLocation.value
    })
  }

  // Filter by website
  if (selectedWebsite.value) {
    if (selectedWebsite.value === 'yes') {
      result = result.filter(b => b.website)
    } else {
      result = result.filter(b => !b.website)
    }
  }

  // Filter by rating
  if (selectedRating.value) {
    if (selectedRating.value === 'none') {
      result = result.filter(b => !b.rating)
    } else {
      const minRating = parseFloat(selectedRating.value)
      result = result.filter(b => b.rating && b.rating >= minRating)
    }
  }

  // Filter by audited status
  if (selectedAudited.value) {
    if (selectedAudited.value === 'yes') {
      result = result.filter(b => b.audit)
    } else {
      result = result.filter(b => !b.audit)
    }
  }

  // Sort
  result.sort((a, b) => {
    let aVal: unknown
    let bVal: unknown

    if (sortField.value === 'location') {
      aVal = [a.state || '', a.city || ''].filter(Boolean).join(', ') || null
      bVal = [b.state || '', b.city || ''].filter(Boolean).join(', ') || null
    } else {
      aVal = a[sortField.value as keyof Business]
      bVal = b[sortField.value as keyof Business]
    }

    if (aVal === null || aVal === '') aVal = sortOrder.value === 'asc' ? 'zzzzz' : ''
    if (bVal === null || bVal === '') bVal = sortOrder.value === 'asc' ? 'zzzzz' : ''

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder.value === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder.value === 'asc' ? aVal - bVal : bVal - aVal
    }

    return 0
  })

  return result
})

// Pagination
const totalPages = computed(() => Math.ceil(filteredBusinesses.value.length / itemsPerPage.value))

const paginatedBusinesses = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredBusinesses.value.slice(start, end)
})

const paginationInfo = computed(() => {
  const total = filteredBusinesses.value.length
  const start = Math.min((currentPage.value - 1) * itemsPerPage.value + 1, total)
  const end = Math.min(currentPage.value * itemsPerPage.value, total)
  return { start, end, total }
})

// Reset to page 1 when filters change
watch([selectedCategory, selectedStatus, selectedLocation, selectedWebsite, selectedRating, selectedAudited, searchQuery, itemsPerPage], () => {
  currentPage.value = 1
})

// Drag selection range
const dragSelectedRange = computed(() => {
  if (!isDragging.value || dragStartIndex.value === null || dragCurrentIndex.value === null) {
    return new Set<string>()
  }
  const start = Math.min(dragStartIndex.value, dragCurrentIndex.value)
  const end = Math.max(dragStartIndex.value, dragCurrentIndex.value)
  const ids = new Set<string>()
  for (let i = start; i <= end; i++) {
    if (paginatedBusinesses.value[i]) {
      ids.add(paginatedBusinesses.value[i].id)
    }
  }
  return ids
})

// Selection helpers
const isAllSelected = computed(() => {
  return paginatedBusinesses.value.length > 0
    && selectedIds.value.length >= paginatedBusinesses.value.length
    && paginatedBusinesses.value.every(b => selectedIds.value.includes(b.id))
})

const isIndeterminate = computed(() => {
  const selectedOnPage = paginatedBusinesses.value.filter(b => selectedIds.value.includes(b.id)).length
  return selectedOnPage > 0 && selectedOnPage < paginatedBusinesses.value.length
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    // Deselect all on current page
    const pageIds = new Set(paginatedBusinesses.value.map(b => b.id))
    selectedIds.value = selectedIds.value.filter(id => !pageIds.has(id))
  } else {
    // Select all on current page
    const pageIds = paginatedBusinesses.value.map(b => b.id)
    const newSelection = new Set([...selectedIds.value, ...pageIds])
    selectedIds.value = Array.from(newSelection)
  }
  emit('update:selected', selectedIds.value)
}

function toggleSelect(id: string, index: number, event?: MouseEvent) {
  if (event?.shiftKey && lastClickedIndex.value !== null) {
    const start = Math.min(lastClickedIndex.value, index)
    const end = Math.max(lastClickedIndex.value, index)
    const rangeIds = paginatedBusinesses.value.slice(start, end + 1).map(b => b.id)
    const newSelection = new Set(selectedIds.value)
    rangeIds.forEach(rid => newSelection.add(rid))
    selectedIds.value = Array.from(newSelection)
    emit('update:selected', selectedIds.value)
    return
  }

  const idx = selectedIds.value.indexOf(id)
  if (idx === -1) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value.splice(idx, 1)
  }
  lastClickedIndex.value = index
  emit('update:selected', [...selectedIds.value])
}

function clearSelection() {
  selectedIds.value = []
  lastClickedIndex.value = null
  emit('update:selected', [])
}

function clearFilters() {
  selectedCategory.value = null
  selectedStatus.value = null
  selectedLocation.value = null
  selectedWebsite.value = null
  selectedRating.value = null
  selectedAudited.value = null
  searchQuery.value = ''
}

// Drag selection handlers
function handleRowMouseDown(index: number, event: MouseEvent) {
  if (!props.selectable) return
  if (event.button !== 0) return
  const target = event.target as HTMLElement
  if (target.closest('button, a, input, [role="button"], [role="checkbox"]')) return

  isDragging.value = true
  dragStartIndex.value = index
  dragCurrentIndex.value = index
  event.preventDefault()
}

function handleRowMouseEnter(index: number) {
  if (!isDragging.value) return
  dragCurrentIndex.value = index
}

function handleMouseUp() {
  if (!isDragging.value) return

  if (dragStartIndex.value !== null && dragCurrentIndex.value !== null) {
    const start = Math.min(dragStartIndex.value, dragCurrentIndex.value)
    const end = Math.max(dragStartIndex.value, dragCurrentIndex.value)

    const newSelection = new Set(selectedIds.value)
    for (let i = start; i <= end; i++) {
      if (paginatedBusinesses.value[i]) {
        newSelection.add(paginatedBusinesses.value[i].id)
      }
    }
    selectedIds.value = Array.from(newSelection)
    emit('update:selected', selectedIds.value)
  }

  isDragging.value = false
  dragStartIndex.value = null
  dragCurrentIndex.value = null
}

onMounted(() => {
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', handleMouseUp)
})

function isInDragRange(id: string): boolean {
  return dragSelectedRange.value.has(id)
}

watch(() => props.businesses, () => {
  const validIds = new Set(props.businesses.map(b => b.id))
  selectedIds.value = selectedIds.value.filter(id => validIds.has(id))
  emit('update:selected', selectedIds.value)
})

defineExpose({
  selectedIds,
  clearSelection
})
</script>

<template>
  <div class="space-y-4">
    <!-- Search & Filter Toggle -->
    <div class="flex flex-wrap gap-3 items-center">
      <UInput
        v-model="searchQuery"
        placeholder="Search name, category, location, phone..."
        icon="i-lucide-search"
        size="md"
        class="w-full sm:w-80"
      />

      <UButton
        :icon="showFilters ? 'i-lucide-filter-x' : 'i-lucide-filter'"
        :color="activeFilterCount > 0 ? 'primary' : 'neutral'"
        variant="soft"
        @click="showFilters = !showFilters"
      >
        Filters
        <UBadge v-if="activeFilterCount > 0" color="primary" size="xs" class="ml-1">
          {{ activeFilterCount }}
        </UBadge>
      </UButton>

      <UButton
        v-if="activeFilterCount > 0"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="clearFilters"
      >
        Clear Filters
      </UButton>

      <div class="flex-1" />

      <!-- Selection info -->
      <div v-if="selectable && selectedIds.length > 0" class="flex items-center gap-2">
        <UBadge color="primary" variant="soft">
          {{ selectedIds.length }} selected
        </UBadge>
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-x"
          @click="clearSelection"
        >
          Clear
        </UButton>
      </div>

      <UBadge color="neutral" variant="soft">
        {{ filteredBusinesses.length }} of {{ businesses.length }}
      </UBadge>
    </div>

    <!-- Filters Panel -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="showFilters" class="bg-elevated/50 rounded-xl p-4 space-y-3">
        <div class="flex flex-wrap gap-3 items-center">
          <!-- Location Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Location</label>
            <USelect
              v-model="selectedLocation"
              :items="locationOptions"
              placeholder="All Locations"
              size="md"
              class="w-48"
            />
          </div>

          <!-- Website Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Website</label>
            <USelect
              v-model="selectedWebsite"
              :items="websiteOptions"
              placeholder="All"
              size="md"
              class="w-36"
            />
          </div>

          <!-- Rating Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Rating</label>
            <USelect
              v-model="selectedRating"
              :items="ratingOptions"
              placeholder="Any Rating"
              size="md"
              class="w-32"
            />
          </div>

          <!-- Audited Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Audited</label>
            <USelect
              v-model="selectedAudited"
              :items="auditedOptions"
              placeholder="All"
              size="md"
              class="w-32"
            />
          </div>

          <!-- Lead Type Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Lead Type</label>
            <USelect
              v-model="selectedCategory"
              :items="categoryOptions"
              placeholder="All Lead Types"
              size="md"
              class="w-36"
            />
          </div>

          <!-- Status Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Status</label>
            <USelect
              v-model="selectedStatus"
              :items="statusOptions"
              placeholder="All Statuses"
              size="md"
              class="w-36"
            />
          </div>

          <div class="border-l border-default h-12 mx-2" />

          <!-- Sort By -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Sort By</label>
            <div class="flex items-center gap-1">
              <USelect
                v-model="sortField"
                :items="sortOptions"
                size="md"
                class="w-32"
              />
              <UButton
                :icon="sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Selection hint -->
    <div v-if="selectable" class="text-xs text-muted flex items-center gap-4">
      <span class="flex items-center gap-1">
        <UIcon name="i-lucide-mouse-pointer-click" />
        Click to select
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="i-lucide-arrow-up" />
        Shift+Click for range
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="i-lucide-move" />
        Click & drag to select multiple
      </span>
    </div>

    <!-- Table (scrolls horizontally on small screens) -->
    <div
      class="relative select-none overflow-x-auto"
      :class="{ 'cursor-crosshair': isDragging }"
    >
      <table class="w-full min-w-160 text-left">
        <thead class="border-b border-default sticky top-0 bg-muted z-10">
          <tr>
            <th v-if="selectable" class="p-3 w-10">
              <UCheckbox
                :model-value="isAllSelected"
                :indeterminate="isIndeterminate"
                @change="toggleSelectAll"
              />
            </th>
            <th class="p-3 font-medium text-sm text-muted">Business</th>
            <th class="p-3 font-medium text-sm text-muted">Location</th>
            <th class="p-3 font-medium text-sm text-muted">Website</th>
            <th class="p-3 font-medium text-sm text-muted">Rating</th>
            <th class="p-3 font-medium text-sm text-muted">Lead Score</th>
            <th class="p-3 font-medium text-sm text-muted">Status</th>
            <th class="p-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(business, index) in paginatedBusinesses"
            :key="business.id"
            class="border-b border-default transition-colors"
            :class="{
              'bg-primary-500/10': selectedIds.includes(business.id),
              'bg-primary-500/20': isInDragRange(business.id) && !selectedIds.includes(business.id),
              'hover:bg-elevated/50': !selectedIds.includes(business.id) && !isInDragRange(business.id)
            }"
            @mousedown="handleRowMouseDown(index, $event)"
            @mouseenter="handleRowMouseEnter(index)"
          >
            <!-- Checkbox -->
            <td v-if="selectable" class="p-3">
              <UCheckbox
                :model-value="selectedIds.includes(business.id) || isInDragRange(business.id)"
                @change="toggleSelect(business.id, index, $event as MouseEvent)"
              />
            </td>

            <!-- Business Name -->
            <td class="p-3">
              <div class="flex flex-col">
                <span class="font-medium">{{ business.name }}</span>
                <span v-if="business.category" class="text-xs text-muted">{{ business.category }}</span>
              </div>
            </td>

            <!-- Location -->
            <td class="p-3">
              <span v-if="business.city || business.state" class="text-sm">
                {{ [business.city, business.state].filter(Boolean).join(', ') }}
              </span>
              <span v-else class="text-muted text-sm">—</span>
            </td>

            <!-- Website -->
            <td class="p-3">
              <UBadge v-if="business.website" color="success" variant="soft" size="xs">
                <UIcon name="i-lucide-globe" class="mr-1" />
                Has Site
              </UBadge>
              <UBadge v-else color="error" variant="soft" size="xs">
                <UIcon name="i-lucide-globe" class="mr-1" />
                No Site
              </UBadge>
            </td>

            <!-- Rating -->
            <td class="p-3">
              <div v-if="business.rating" class="flex items-center gap-1">
                <UIcon name="i-lucide-star" class="text-amber-500" />
                <span class="text-sm font-medium">{{ business.rating }}</span>
                <span class="text-xs text-muted">({{ business.reviewCount }})</span>
              </div>
              <span v-else class="text-muted text-sm">—</span>
            </td>

            <!-- Lead Score -->
            <td class="p-3">
              <div class="flex items-center gap-2">
                <UBadge
                  :color="business.leadCategory === 'hot' ? 'error' : business.leadCategory === 'warm' ? 'warning' : business.leadCategory === 'cold' ? 'info' : 'neutral'"
                  variant="soft"
                >
                  {{ business.leadCategory ? business.leadCategory.charAt(0).toUpperCase() + business.leadCategory.slice(1) : 'Unknown' }}
                </UBadge>
                <span class="text-xs text-muted">{{ business.leadScore }}</span>
              </div>
            </td>

            <!-- Status -->
            <td class="p-3">
              <UBadge
                :color="business.status === 'new' ? 'info' : business.status === 'approved' ? 'success' : business.status === 'sent' ? 'warning' : business.status === 'responded' ? 'primary' : 'error'"
                variant="subtle"
                class="capitalize"
              >
                {{ business.status }}
              </UBadge>
            </td>

            <!-- Actions -->
            <td class="p-3 text-right">
              <UDropdownMenu
                :items="[[
                  { label: 'View Details', icon: 'i-lucide-eye', onSelect: () => emit('view', business.id) },
                  { label: 'Run Audit', icon: 'i-lucide-scan', disabled: !business.website, onSelect: () => emit('audit', business.id) }
                ], [
                  { label: 'Approve', icon: 'i-lucide-check', disabled: business.status !== 'new', onSelect: () => emit('approve', business.id) },
                  { label: 'Reject', icon: 'i-lucide-x', color: 'error', disabled: business.status !== 'new', onSelect: () => emit('reject', business.id) }
                ]]"
                :content="{ align: 'end' }"
              >
                <UButton
                  icon="i-lucide-more-horizontal"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </UDropdownMenu>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Loading overlay -->
      <div v-if="loading" class="absolute inset-0 bg-muted/50 flex items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="text-3xl animate-spin text-primary-500" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!loading && paginatedBusinesses.length === 0" class="text-center py-8">
      <UIcon name="i-lucide-inbox" class="text-4xl text-muted mb-2" />
      <p class="text-muted">No businesses match your filters</p>
      <UButton
        v-if="activeFilterCount > 0"
        variant="soft"
        size="sm"
        class="mt-2"
        @click="clearFilters"
      >
        Clear Filters
      </UButton>
    </div>

    <!-- Pagination -->
    <div v-if="filteredBusinesses.length > 0" class="flex items-center justify-between pt-4 border-t border-default">
      <div class="flex items-center gap-4">
        <span class="text-sm text-muted">
          Showing {{ paginationInfo.start }} - {{ paginationInfo.end }} of {{ paginationInfo.total }}
        </span>
        <USelect
          v-model="itemsPerPage"
          :items="pageSizeOptions"
          size="md"
          class="w-36"
        />
      </div>

      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevrons-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="currentPage === 1"
          @click="currentPage = 1"
        />
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="currentPage === 1"
          @click="currentPage--"
        />

        <div class="flex items-center gap-1">
          <template v-for="page in totalPages" :key="page">
            <UButton
              v-if="page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)"
              :color="page === currentPage ? 'primary' : 'neutral'"
              :variant="page === currentPage ? 'solid' : 'ghost'"
              size="sm"
              @click="currentPage = page"
            >
              {{ page }}
            </UButton>
            <span
              v-else-if="page === currentPage - 2 || page === currentPage + 2"
              class="text-muted px-1"
            >
              ...
            </span>
          </template>
        </div>

        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        />
        <UButton
          icon="i-lucide-chevrons-right"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="currentPage === totalPages"
          @click="currentPage = totalPages"
        />
      </div>
    </div>
  </div>
</template>
