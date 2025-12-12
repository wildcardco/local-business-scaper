<script setup lang="ts">
const toast = useToast()
const router = useRouter()
const { state: auditState, runAudit, closeProgress } = useAudit()

const isSearching = ref(false)
const searchResults = ref<{
  searchId: string
  businesses: unknown[]
  count: number
} | null>(null)
const hideRecent = ref(false)

// Fetch stats
const { data: stats, refresh: refreshStats } = await useFetch('/api/businesses', {
  query: { limit: 1000 },
  transform: (data) => {
    const businesses = data.businesses || []
    return {
      total: businesses.length,
      hot: businesses.filter((b: { leadCategory: string }) => b.leadCategory === 'hot').length,
      warm: businesses.filter((b: { leadCategory: string }) => b.leadCategory === 'warm').length,
      cold: businesses.filter((b: { leadCategory: string }) => b.leadCategory === 'cold').length,
      noWebsite: businesses.filter((b: { website: string | null }) => !b.website).length,
      pending: businesses.filter((b: { status: string }) => b.status === 'new').length
    }
  }
})

// Fetch recent businesses
const { data: recentData, refresh: refreshRecent } = await useFetch('/api/businesses', {
  query: { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
})

const recentBusinesses = computed(() => recentData.value?.businesses || [])

async function handleSearch(params: { query: string; location: string; limit: number; lat?: number; lng?: number; placeId?: string }) {
  isSearching.value = true
  try {
    const result = await $fetch('/api/search', {
      method: 'POST',
      body: params
    })

    searchResults.value = {
      searchId: result.search.id,
      businesses: result.businesses,
      count: result.count
    }

    toast.add({
      title: 'Search Complete',
      description: `Found ${result.count} businesses`,
      color: 'success'
    })

    // Refresh stats and recent, show recent leads again
    hideRecent.value = false
    await Promise.all([refreshStats(), refreshRecent()])
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to search'
    toast.add({
      title: 'Search Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isSearching.value = false
  }
}

async function handleAudit(id: string) {
  // Find the business from recent or search results
  const allBusinesses = [
    ...recentBusinesses.value,
    ...(searchResults.value?.businesses || [])
  ] as { id: string; name: string; website: string | null }[]

  const business = allBusinesses.find(b => b.id === id)

  if (!business) {
    toast.add({
      title: 'Error',
      description: 'Business not found',
      color: 'error'
    })
    return
  }

  const success = await runAudit({
    id: business.id,
    name: business.name,
    website: business.website
  })

  if (success) {
    await Promise.all([refreshStats(), refreshRecent()])
  }
}

function handleView(id: string) {
  router.push(`/businesses/${id}`)
}

async function handleApprove(id: string) {
  try {
    await $fetch(`/api/businesses/${id}`, {
      method: 'PATCH',
      body: { status: 'approved' }
    })
    toast.add({ title: 'Lead approved', color: 'success' })
    await Promise.all([refreshStats(), refreshRecent()])
  } catch {
    toast.add({ title: 'Failed to approve', color: 'error' })
  }
}

async function handleReject(id: string) {
  try {
    await $fetch(`/api/businesses/${id}`, {
      method: 'PATCH',
      body: { status: 'rejected' }
    })
    toast.add({ title: 'Lead rejected', color: 'warning' })
    await Promise.all([refreshStats(), refreshRecent()])
  } catch {
    toast.add({ title: 'Failed to reject', color: 'error' })
  }
}

function handleClearRecent() {
  hideRecent.value = true
  toast.add({
    title: 'Recent Leads Hidden',
    description: 'Recent leads cleared from view. They are still saved in the database.',
    color: 'info'
  })
}

function showRecentAgain() {
  hideRecent.value = false
}

function clearSearchResults() {
  searchResults.value = null
}

const statCards = computed(() => [
  {
    label: 'Total Leads',
    value: stats.value?.total || 0,
    icon: 'i-lucide-users',
    color: 'primary'
  },
  {
    label: 'Hot Leads',
    value: stats.value?.hot || 0,
    icon: 'i-lucide-flame',
    color: 'red'
  },
  {
    label: 'No Website',
    value: stats.value?.noWebsite || 0,
    icon: 'i-lucide-globe',
    color: 'amber'
  },
  {
    label: 'Pending Review',
    value: stats.value?.pending || 0,
    icon: 'i-lucide-clock',
    color: 'sky'
  }
])
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-muted">Search local businesses, audit their websites, and generate leads.</p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard v-for="stat in statCards" :key="stat.label">
        <div class="flex items-center gap-4">
          <div
            class="flex items-center justify-center w-12 h-12 rounded-xl"
            :class="{
              'bg-primary-500/20 text-primary-400': stat.color === 'primary',
              'bg-red-500/20 text-red-400': stat.color === 'red',
              'bg-amber-500/20 text-amber-400': stat.color === 'amber',
              'bg-sky-500/20 text-sky-400': stat.color === 'sky'
            }"
          >
            <UIcon :name="stat.icon" class="text-2xl" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ stat.value }}</p>
            <p class="text-sm text-muted">{{ stat.label }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Search Form -->
    <SearchForm :loading="isSearching" @search="handleSearch" />

    <!-- Search Results -->
    <UCard v-if="searchResults">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Search Results</h3>
          <div class="flex items-center gap-2">
            <UBadge color="primary" variant="soft">
              {{ searchResults.count }} found
            </UBadge>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="clearSearchResults"
            >
              Close
            </UButton>
          </div>
        </div>
      </template>

      <BusinessTable
        :businesses="searchResults.businesses"
        @audit="handleAudit"
        @view="handleView"
        @approve="handleApprove"
        @reject="handleReject"
      />
    </UCard>

    <!-- Recent Businesses -->
    <UCard v-else-if="recentBusinesses.length > 0 && !hideRecent">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Recent Leads</h3>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-eye-off"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="handleClearRecent"
            >
              Hide
            </UButton>
            <UButton
              to="/businesses"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-arrow-right"
            >
              View All
            </UButton>
          </div>
        </div>
      </template>

      <BusinessTable
        :businesses="recentBusinesses"
        @audit="handleAudit"
        @view="handleView"
        @approve="handleApprove"
        @reject="handleReject"
      />
    </UCard>

    <!-- Hidden Recent - Show button to restore -->
    <UCard v-else-if="recentBusinesses.length > 0 && hideRecent">
      <div class="text-center py-6">
        <UIcon name="i-lucide-eye-off" class="text-3xl text-muted mb-2" />
        <p class="text-muted mb-4">Recent leads are hidden</p>
        <UButton
          icon="i-lucide-eye"
          variant="soft"
          @click="showRecentAgain"
        >
          Show Recent Leads
        </UButton>
      </div>
    </UCard>

    <!-- Empty State -->
    <UCard v-else>
      <div class="text-center py-12">
        <UIcon name="i-lucide-search" class="text-5xl text-muted mb-4" />
        <h3 class="text-lg font-semibold mb-2">No businesses yet</h3>
        <p class="text-muted mb-4">
          Search for local businesses to start generating leads
        </p>
      </div>
    </UCard>

    <!-- Audit Progress Modal -->
    <AuditProgress :state="auditState" @close="closeProgress" />
  </div>
</template>
