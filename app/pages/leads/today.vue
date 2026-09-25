<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { open: openGenerateMockup } = useGenerateMockup()

const isLoading = ref(true)
const digest = ref<any>(null)
const leads = ref<any[]>([])

const today = computed(() => {
  const tz = 'America/Chicago'
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: tz })).toISOString().slice(0, 10)
})

const displayDate = computed(() => {
  const dateParam = route.query.date
  if (typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return dateParam
  }
  return today.value
})

const previousDate = computed(() => {
  const date = new Date(displayDate.value)
  date.setDate(date.getDate() - 1)
  return date.toISOString().slice(0, 10)
})

const nextDate = computed(() => {
  const date = new Date(displayDate.value)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
})

const canGoNext = computed(() => nextDate.value <= today.value)

const formattedDate = computed(() => {
  const date = new Date(displayDate.value + 'T00:00:00')
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
})

const isToday = computed(() => displayDate.value === today.value)

const tierGroups = computed(() => {
  const groups = {
    call_first: [] as any[],
    good: [] as any[],
    worth_a_look: [] as any[],
    long_shot: [] as any[],
    skip: [] as any[]
  }

  for (const lead of leads.value) {
    const slug = lead.tier?.slug || 'skip'
    if (slug in groups) {
      (groups as any)[slug].push(lead)
    }
  }

  return groups
})

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  call_first: { bg: 'bg-wcRed-500/20', text: 'text-wcRed-400', border: 'border-wcRed-500/30' },
  good: { bg: 'bg-wcGold-400/20', text: 'text-wcGold-400', border: 'border-wcGold-400/30' },
  worth_a_look: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  long_shot: { bg: 'bg-neutral-500/20', text: 'text-neutral-400', border: 'border-neutral-500/30' },
  skip: { bg: 'bg-neutral-600/20', text: 'text-neutral-500', border: 'border-neutral-600/30' }
}

async function fetchDigest() {
  isLoading.value = true
  try {
    const result = await $fetch('/api/digests', {
      query: { date: displayDate.value }
    })
    digest.value = result.digest
    leads.value = result.leads || []
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Could not load digest',
      description: err.data?.message || 'Try again',
      color: 'error'
    })
    digest.value = null
    leads.value = []
  } finally {
    isLoading.value = false
  }
}

function goToDate(date: string) {
  router.push({ query: { date } })
}

function handleGenerateMockup(businessId: string) {
  openGenerateMockup(businessId)
}

function signalLabel(key: string, value: any): string {
  if (key === 'no_website' && value) return 'No website'
  if (key === 'agency_credit' && value) return `Agency: ${value}`
  if (key === 'copyright_year' && value) return `© ${value}`
  return ''
}

watch(() => route.query.date, fetchDigest, { immediate: true })
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div class="min-w-0">
        <h1 class="font-display text-2xl font-semibold tracking-tight text-highlighted">
          Today's Leads
        </h1>
        <p class="text-sm text-muted mt-1">
          {{ formattedDate }}
          <span v-if="isToday" class="text-primary-500 ml-2">• Today</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          variant="outline"
          size="sm"
          @click="goToDate(previousDate)"
        />
        <UButton
          icon="i-lucide-chevron-right"
          variant="outline"
          size="sm"
          :disabled="!canGoNext"
          @click="goToDate(nextDate)"
        />
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center py-20">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-4xl text-primary" />
    </div>

    <div v-else-if="!digest" class="text-center py-20">
      <UIcon name="i-lucide-inbox" class="text-6xl text-muted mb-4" />
      <h2 class="font-display text-xl font-medium text-highlighted mb-2">
        No digest yet
      </h2>
      <p class="text-muted">
        {{ isToday ? "Today's digest hasn't come in yet" : "No digest for this date" }}
      </p>
    </div>

    <div v-else>
      <div class="rounded-lg border border-default bg-muted p-4 mb-6">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <UIcon name="i-lucide-search" class="text-primary-500" />
              <p class="font-medium text-highlighted">
                {{ digest.search.category }}
              </p>
            </div>
            <p class="text-sm text-muted">
              {{ digest.search.location }} • {{ digest.lead_count }} lead{{ digest.lead_count === 1 ? '' : 's' }}
            </p>
            <p v-if="digest.received_at" class="text-xs text-muted mt-1">
              Received {{ new Date(digest.received_at).toLocaleString() }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="digest.lead_count === 0" class="text-center py-12">
        <UIcon name="i-lucide-inbox" class="text-5xl text-muted mb-3" />
        <p class="text-muted">No leads today</p>
      </div>

      <div v-else class="space-y-8">
        <div v-for="(tierLeads, tierSlug) in tierGroups" :key="tierSlug">
          <div v-if="tierLeads.length > 0">
            <div v-if="tierSlug === 'skip'" class="mb-4">
              <UAccordion :items="[{ label: `Skip tier (${tierLeads.length})`, content: 'skip-leads', defaultOpen: false }]">
                <template #default="{ item, open }">
                  <UButton
                    variant="ghost"
                    color="neutral"
                    class="w-full justify-between"
                  >
                    <span class="text-sm text-muted">Skip tier ({{ tierLeads.length }})</span>
                    <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
                  </UButton>
                </template>
                <template #skip-leads>
                  <div class="grid grid-cols-1 gap-4 mt-4">
                    <UCard
                      v-for="lead in tierLeads"
                      :key="lead.id"
                      class="overflow-hidden"
                    >
                      <LeadCard :lead="lead" :tier-colors="tierColors" @generate-mockup="handleGenerateMockup" />
                    </UCard>
                  </div>
                </template>
              </UAccordion>
            </div>
            <div v-else class="grid grid-cols-1 gap-4">
              <UCard
                v-for="lead in tierLeads"
                :key="lead.id"
                class="overflow-hidden"
              >
                <div class="space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <h3 class="font-display font-semibold text-highlighted text-lg mb-1">
                        {{ lead.business.name }}
                      </h3>
                      <p v-if="lead.business.category" class="text-sm text-muted mb-2">
                        {{ lead.business.category }}
                      </p>
                    </div>
                    <div
                      :class="[
                        'px-3 py-1 rounded-full border text-xs font-medium whitespace-nowrap',
                        tierColors[tierSlug].bg,
                        tierColors[tierSlug].text,
                        tierColors[tierSlug].border
                      ]"
                    >
                      {{ lead.tier.label }}
                    </div>
                  </div>

                  <div class="flex items-center gap-4 text-sm">
                    <div v-if="lead.score" class="flex items-center gap-1">
                      <UIcon name="i-lucide-target" class="text-primary-500" />
                      <span class="font-medium text-highlighted">{{ lead.score }}</span>
                    </div>
                    <div v-if="lead.business.rating" class="flex items-center gap-1">
                      <UIcon name="i-lucide-star" class="text-wcGold-400" />
                      <span class="text-highlighted">{{ lead.business.rating }}</span>
                      <span class="text-muted">({{ lead.business.review_count }})</span>
                    </div>
                    <div v-if="lead.business.city" class="flex items-center gap-1">
                      <UIcon name="i-lucide-map-pin" class="text-muted" />
                      <span class="text-muted">{{ lead.business.city }}</span>
                    </div>
                  </div>

                  <div v-if="lead.angle || lead.note" class="space-y-2 text-sm">
                    <div v-if="lead.angle" class="flex items-start gap-2">
                      <UIcon name="i-lucide-lightbulb" class="text-wcGold-400 mt-0.5 shrink-0" />
                      <p class="text-muted">{{ lead.angle }}</p>
                    </div>
                    <div v-if="lead.note" class="flex items-start gap-2">
                      <UIcon name="i-lucide-sticky-note" class="text-blue-400 mt-0.5 shrink-0" />
                      <p class="text-muted">{{ lead.note }}</p>
                    </div>
                  </div>

                  <div v-if="lead.signals" class="flex flex-wrap gap-2">
                    <span
                      v-for="([key, value], idx) in Object.entries(lead.signals)"
                      :key="idx"
                      class="px-2 py-1 rounded text-xs bg-neutral-500/20 text-neutral-400 border border-neutral-500/30"
                    >
                      {{ signalLabel(key, value) }}
                    </span>
                  </div>

                  <div class="flex flex-wrap gap-2 pt-2 border-t border-default">
                    <UButton
                      v-if="lead.business.phone"
                      :to="`tel:${lead.business.phone}`"
                      size="sm"
                      variant="outline"
                      icon="i-lucide-phone"
                    >
                      Call
                    </UButton>
                    <UButton
                      v-if="lead.business.website"
                      :to="lead.business.website"
                      target="_blank"
                      size="sm"
                      variant="outline"
                      icon="i-lucide-globe"
                      trailing-icon="i-lucide-external-link"
                    >
                      Website
                    </UButton>
                    <UButton
                      :to="`/businesses/${lead.business.id}`"
                      size="sm"
                      variant="outline"
                      icon="i-lucide-info"
                    >
                      Details
                    </UButton>
                  </div>

                  <div v-if="lead.mockup" class="rounded-lg border border-default bg-muted p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-highlighted mb-1">Mockup</p>
                        <p class="text-xs text-muted capitalize">{{ lead.mockup.status.replace(/_/g, ' ') }}</p>
                      </div>
                      <UButton
                        :to="`/studio/${lead.mockup.id}`"
                        size="xs"
                        variant="soft"
                        trailing-icon="i-lucide-arrow-right"
                      >
                        View
                      </UButton>
                    </div>
                    <UButton
                      v-if="lead.mockup.url"
                      :to="lead.mockup.url"
                      target="_blank"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      trailing-icon="i-lucide-external-link"
                      class="mt-2"
                    >
                      Live mockup
                    </UButton>
                  </div>
                  <div v-else>
                    <UButton
                      size="sm"
                      icon="i-lucide-palette"
                      block
                      @click="handleGenerateMockup(lead.business.id)"
                    >
                      Generate mockup
                    </UButton>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
