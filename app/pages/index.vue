<script setup lang="ts">
import { getTodayCentralTime } from '~~/shared/date-utils'

const toast = useToast()
const route = useRoute()
const { open: openGenerateMockup } = useGenerateMockup()

const isSearching = ref(false)
const showAdvanced = ref(false)
const skippingId = ref('')
const quickSearch = ref<{ focus: () => void } | null>(null)
const searchResults = ref<{
  count: number
  businesses: {
    id: string
    name: string
    city?: string | null
    state?: string | null
    leadCategory?: string | null
    website?: string | null
  }[]
} | null>(null)

const today = getTodayCentralTime()

const { data: home, refresh: refreshHome } = await useFetch('/api/dashboard')
const { data: digestData, refresh: refreshDigest, status: digestStatus } = await useFetch('/api/digests', {
  query: { date: today }
})

const counts = computed(() => home.value?.counts || {
  total: 0,
  hot: 0,
  noWebsite: 0,
  newThisWeek: 0
})

const formattedDate = computed(() => {
  const date = new Date(`${today}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(date)
})

const digestLeads = computed(() => digestData.value?.leads || [])

const visibleLeads = computed(() =>
  digestLeads.value.filter(lead =>
    lead.business?.status !== 'rejected' && lead.tier?.slug !== 'skip'
  )
)

const skipCount = computed(() =>
  digestLeads.value.filter(lead =>
    lead.tier?.slug === 'skip' && lead.business?.status !== 'rejected'
  ).length
)

const digestLoading = computed(() => digestStatus.value === 'pending' && !digestData.value)

const statTiles = computed(() => [
  {
    label: 'Total Leads',
    value: counts.value.total,
    to: '/businesses',
    icon: 'i-lucide-users'
  },
  {
    label: 'Hot',
    value: counts.value.hot,
    to: '/businesses?category=hot',
    icon: 'i-lucide-flame'
  },
  {
    label: 'No Website',
    value: counts.value.noWebsite,
    to: '/businesses?website=none',
    icon: 'i-lucide-globe'
  },
  {
    label: 'New this week',
    value: counts.value.newThisWeek,
    to: '/businesses?since=7d',
    icon: 'i-lucide-calendar-plus'
  }
])

function placeOf(business: { city?: string | null, state?: string | null }) {
  return [business.city, business.state].filter(Boolean).join(', ')
}

async function handleSearch(params: { query: string, location: string, limit: number, lat?: number, lng?: number, placeId?: string }) {
  isSearching.value = true
  try {
    const result = await $fetch('/api/search', {
      method: 'POST',
      body: params
    })
    searchResults.value = {
      count: result.count,
      businesses: result.businesses || []
    }
    toast.add({
      title: 'Search complete',
      description: `Found ${result.count} businesses`,
      color: 'success'
    })
    await Promise.all([refreshHome(), refreshDigest()])
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to search'
    toast.add({
      title: 'Search failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isSearching.value = false
  }
}

function handleGenerate(id: string) {
  openGenerateMockup(id)
}

async function handleSkip(id: string) {
  skippingId.value = id
  try {
    await $fetch(`/api/businesses/${id}`, {
      method: 'PATCH',
      body: { status: 'rejected' }
    })
    toast.add({ title: 'Lead skipped', color: 'warning' })
    await refreshDigest()
  } catch {
    toast.add({ title: 'Could not skip that lead', color: 'error' })
  } finally {
    skippingId.value = ''
  }
}

function rerunSearch(query: string, location: string) {
  handleSearch({ query, location, limit: 20 })
}

watch(() => route.query.focus, (focus) => {
  if (focus !== 'search') return
  nextTick(() => {
    document.getElementById('dashboard-search')?.scrollIntoView({ block: 'start' })
    quickSearch.value?.focus()
  })
}, { immediate: true })
</script>

<template>
  <div class="min-w-0 space-y-5">
    <section
      id="todays-leads"
      class="min-w-0"
    >
      <div class="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="eyebrow mb-1">
            Today
          </p>
          <h1 class="font-display text-2xl font-semibold tracking-tight text-highlighted">
            Today's Leads
          </h1>
          <p class="truncate text-sm text-muted">
            {{ formattedDate }}
            <span v-if="digestData?.digest">
              · {{ visibleLeads.length }} to work
            </span>
          </p>
        </div>
        <UButton
          to="/leads/today"
          size="sm"
          variant="ghost"
          class="shrink-0"
          trailing-icon="i-lucide-arrow-right"
        >
          All
        </UButton>
      </div>

      <DigestReroll
        class="mb-3"
        :reroll-count="Number(digestData?.rerollCount || 0)"
        @done="refreshDigest()"
      />

      <DashboardQuickSearch
        ref="quickSearch"
        :loading="isSearching"
        @search="handleSearch"
      />
      <UButton
        class="mt-2"
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? 'Hide advanced search' : 'Advanced search' }}
      </UButton>
      <div
        v-show="showAdvanced"
        class="mt-3 min-w-0"
      >
        <SearchForm
          :loading="isSearching"
          @search="handleSearch"
        />
      </div>

      <div
        v-if="searchResults"
        class="mt-3 min-w-0 rounded-xl border border-default bg-default p-3"
      >
        <div class="mb-2 flex min-w-0 items-center justify-between gap-2">
          <h2 class="truncate text-sm font-semibold">
            {{ searchResults.count }} found
          </h2>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            @click="searchResults = null"
          >
            Close
          </UButton>
        </div>
        <ul class="space-y-2">
          <li
            v-for="business in searchResults.businesses.slice(0, 5)"
            :key="business.id"
            class="min-w-0"
          >
            <NuxtLink
              :to="`/businesses/${business.id}`"
              class="block min-w-0 rounded-lg px-1 py-1 hover:bg-elevated"
            >
              <span class="line-clamp-2 break-words text-sm font-medium text-highlighted">
                {{ business.name }}
              </span>
              <span class="block truncate text-xs text-muted">
                {{ placeOf(business) || 'No town' }}
                <template v-if="!business.website"> · No website</template>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div
        v-if="digestLoading"
        class="flex justify-center py-10"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="size-8 animate-spin text-primary"
        />
      </div>
      <p
        v-else-if="!digestData?.digest"
        class="py-8 text-center text-sm text-muted"
      >
        Today's digest has not come in yet.
      </p>
      <div
        v-else-if="visibleLeads.length === 0"
        class="py-8 text-center text-sm text-muted"
      >
        Nothing left to work from today's list.
      </div>
      <div
        v-else
        class="mt-3 space-y-3"
      >
        <DashboardLeadCard
          v-for="lead in visibleLeads"
          :id="lead.id === visibleLeads[0]?.id ? 'todays-lead-card' : undefined"
          :key="lead.id"
          :lead="lead"
          :skipping="skippingId === lead.business.id"
          @generate="handleGenerate"
          @skip="handleSkip"
        />
      </div>
      <p
        v-if="skipCount > 0"
        class="mt-3 text-sm text-muted"
      >
        <NuxtLink
          to="/leads/today"
          class="underline"
        >
          {{ skipCount }} in the skip tier
        </NuxtLink>
      </p>
    </section>

    <section
      id="stat-tiles"
      aria-label="Lead counts"
    >
      <div class="grid grid-cols-2 gap-2">
        <NuxtLink
          v-for="tile in statTiles"
          :key="tile.label"
          :to="tile.to"
          class="flex min-h-16 min-w-0 items-center gap-2 rounded-xl border border-default bg-elevated px-3 py-2"
        >
          <UIcon
            :name="tile.icon"
            class="size-5 shrink-0 text-primary"
          />
          <span class="min-w-0">
            <span class="block text-xl font-semibold tabular-nums leading-none">{{ tile.value.toLocaleString() }}</span>
            <span class="mt-1 block truncate text-xs text-muted">{{ tile.label }}</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <section
      id="recent-activity"
      class="min-w-0 space-y-3"
    >
      <h2 class="font-display text-lg font-semibold">
        Recent activity
      </h2>

      <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
        <h3 class="mb-2 text-sm font-medium text-muted">
          Searches
        </h3>
        <p
          v-if="!home?.searches?.length"
          class="text-sm text-muted"
        >
          No searches yet.
        </p>
        <ul
          v-else
          class="space-y-1"
        >
          <li
            v-for="search in home.searches"
            :key="`${search.query}-${search.location}`"
          >
            <button
              type="button"
              class="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-1 text-left hover:bg-muted"
              @click="rerunSearch(search.query, search.location)"
            >
              <UIcon
                name="i-lucide-rotate-cw"
                class="size-4 shrink-0 text-muted"
              />
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ search.query }}</span>
                <span class="block truncate text-xs text-muted">{{ search.location }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div class="min-w-0 rounded-xl border border-default bg-elevated p-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-muted">
            Studio
          </h3>
          <UButton
            to="/studio"
            size="xs"
            variant="ghost"
            class="shrink-0"
          >
            Open
          </UButton>
        </div>
        <p
          v-if="!home?.mockups?.length"
          class="text-sm text-muted"
        >
          No mockups yet.
        </p>
        <ul
          v-else
          class="space-y-1"
        >
          <li
            v-for="mockup in home.mockups"
            :key="mockup.id"
          >
            <NuxtLink
              :to="`/studio/${mockup.id}`"
              class="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 hover:bg-muted"
            >
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ mockup.name }}</span>
              <UBadge
                class="shrink-0"
                :color="mockup.activity === 'failed' ? 'error' : mockup.activity === 'ready' ? 'success' : mockup.activity === 'building' ? 'warning' : 'neutral'"
                variant="soft"
              >
                {{ mockup.label }}
              </UBadge>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
