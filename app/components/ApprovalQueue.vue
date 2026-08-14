<script setup lang="ts">
interface Business {
  id: string
  name: string
  category: string | null
  city: string | null
  state: string | null
  website: string | null
  phone: string | null
  email: string | null
  rating: number | null
  reviewCount: number | null
  leadScore: number
  leadCategory: 'hot' | 'warm' | 'cold' | 'skip' | null
  audit?: {
    performanceScore: number | null
    seoScore: number | null
    accessibilityScore: number | null
  } | null
}

const props = defineProps<{
  businesses: Business[]
  loading?: boolean
}>()

const emit = defineEmits<{
  approve: [id: string]
  reject: [id: string]
  view: [id: string]
  bulkApprove: [ids: string[]]
  bulkReject: [ids: string[]]
}>()

const selectedIds = ref<string[]>([])

const selectAll = computed({
  get: () => selectedIds.value.length === props.businesses.length && props.businesses.length > 0,
  set: (val) => {
    selectedIds.value = val ? props.businesses.map(b => b.id) : []
  }
})

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx === -1) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value.splice(idx, 1)
  }
}

function bulkApprove() {
  if (selectedIds.value.length > 0) {
    emit('bulkApprove', [...selectedIds.value])
    selectedIds.value = []
  }
}

function bulkReject() {
  if (selectedIds.value.length > 0) {
    emit('bulkReject', [...selectedIds.value])
    selectedIds.value = []
  }
}

function getIssues(business: Business): string[] {
  const issues: string[] = []
  if (!business.website) {
    issues.push('No website')
  } else if (business.audit) {
    if (business.audit.performanceScore !== null && business.audit.performanceScore < 50) {
      issues.push(`Performance: ${business.audit.performanceScore}`)
    }
    if (business.audit.seoScore !== null && business.audit.seoScore < 50) {
      issues.push(`SEO: ${business.audit.seoScore}`)
    }
    if (business.audit.accessibilityScore !== null && business.audit.accessibilityScore < 50) {
      issues.push(`Accessibility: ${business.audit.accessibilityScore}`)
    }
  }
  return issues
}
</script>

<template>
  <div class="space-y-4">
    <!-- Bulk Actions -->
    <div v-if="businesses.length > 0" class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <UCheckbox v-model="selectAll" label="Select All" />
        <span v-if="selectedIds.length > 0" class="text-sm text-muted">
          {{ selectedIds.length }} selected
        </span>
      </div>

      <div v-if="selectedIds.length > 0" class="flex gap-2">
        <UButton
          icon="i-lucide-check"
          color="success"
          variant="soft"
          size="sm"
          @click="bulkApprove"
        >
          Approve Selected
        </UButton>
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="soft"
          size="sm"
          @click="bulkReject"
        >
          Reject Selected
        </UButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-primary-500" />
    </div>

    <!-- Empty State -->
    <div v-else-if="businesses.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-inbox" class="text-4xl text-muted mb-3" />
      <p class="text-lg font-medium mb-1">Queue Empty</p>
      <p class="text-muted">No leads pending approval</p>
    </div>

    <!-- Queue Cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard
        v-for="business in businesses"
        :key="business.id"
        :class="{ 'ring-2 ring-primary-500': selectedIds.includes(business.id) }"
      >
        <div class="space-y-3">
          <!-- Header -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <UCheckbox
                :model-value="selectedIds.includes(business.id)"
                @update:model-value="toggleSelect(business.id)"
              />
              <div>
                <h3 class="font-semibold">{{ business.name }}</h3>
                <p class="text-sm text-muted">{{ business.category || 'Unknown' }}</p>
              </div>
            </div>
            <LeadScoreBadge
              :score="business.leadScore"
              :category="business.leadCategory"
            />
          </div>

          <!-- Details -->
          <div class="text-sm space-y-1">
            <div class="flex items-center gap-2 text-muted">
              <UIcon name="i-lucide-map-pin" />
              <span>{{ [business.city, business.state].filter(Boolean).join(', ') || '—' }}</span>
            </div>
            <div class="flex items-center gap-2 text-muted">
              <UIcon name="i-lucide-globe" />
              <span v-if="business.website" class="truncate">{{ business.website }}</span>
              <UBadge v-else color="error" variant="soft" size="xs">No Website</UBadge>
            </div>
            <div v-if="business.rating" class="flex items-center gap-2">
              <UIcon name="i-lucide-star" class="text-amber-500" />
              <span>{{ business.rating }} ({{ business.reviewCount }} reviews)</span>
            </div>
          </div>

          <!-- Issues -->
          <div v-if="getIssues(business).length > 0" class="flex flex-wrap gap-1">
            <UBadge
              v-for="issue in getIssues(business)"
              :key="issue"
              color="amber"
              variant="soft"
              size="xs"
            >
              {{ issue }}
            </UBadge>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-2 border-t border-default">
            <UButton
              icon="i-lucide-check"
              color="success"
              variant="soft"
              size="sm"
              class="flex-1 max-w-40"
              @click="emit('approve', business.id)"
            >
              Approve
            </UButton>
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="soft"
              size="sm"
              class="flex-1 max-w-40"
              @click="emit('reject', business.id)"
            >
              Reject
            </UButton>
            <UButton
              icon="i-lucide-eye"
              variant="ghost"
              size="sm"
              @click="emit('view', business.id)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

