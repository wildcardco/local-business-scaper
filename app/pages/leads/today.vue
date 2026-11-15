<script setup lang="ts">
import { getTodayCentralTime, addDays, formatCentralTime } from '~~/shared/date-utils'
import type { RerollLeadView, RerollSummary } from '~~/shared/digest-reroll'

const route = useRoute()
const router = useRouter()
const { open: openGenerateMockup } = useGenerateMockup()

type TodayDigest = {
  search?: { category?: string | null, location?: string | null } | null
  lead_count?: number | null
  received_at?: string | null
} | null

type TodayPayload = {
  digest?: TodayDigest
  leads?: RerollLeadView[]
  reroll?: RerollSummary | null
  rerollLeads?: RerollLeadView[]
  rerollPending?: boolean
  rerollCount?: number
}

type TodayView = {
  date: string
  digest: TodayDigest
  leads: RerollLeadView[]
  reroll: RerollSummary | null
  rerollLeads: RerollLeadView[]
  rerollPending: boolean
  rerollCount: number
}

const view = useState<TodayView | null>('today-leads-view', () => null)
const isLoading = ref(false)
const loadError = ref('')

const today = computed(() => getTodayCentralTime())

const displayDate = computed(() => {
  const dateParam = route.query.date
  if (typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return dateParam
  }
  return today.value
})

const previousDate = computed(() => addDays(displayDate.value, -1))

const nextDate = computed(() => addDays(displayDate.value, 1))

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
  const groups: Record<'call_first' | 'good' | 'worth_a_look' | 'long_shot' | 'skip', RerollLeadView[]> = {
    call_first: [],
    good: [],
    worth_a_look: [],
    long_shot: [],
    skip: []
  }

  for (const lead of leads.value) {
    const slug = lead.tier?.slug || 'skip'
    if (slug === 'call_first' || slug === 'good' || slug === 'worth_a_look' || slug === 'long_shot' || slug === 'skip') {
      groups[slug].push(lead)
    }
  }

  return groups
})

const active = computed(() => view.value?.date === displayDate.value ? view.value : null)
const digest = computed(() => active.value?.digest ?? null)
const leads = computed(() => active.value?.leads ?? [])
const reroll = computed(() => active.value?.reroll ?? null)
const rerollLeads = computed(() => active.value?.rerollLeads ?? [])
const rerollPending = computed(() => Boolean(active.value?.rerollPending))
const rerollCount = computed(() => active.value?.rerollCount ?? 0)

const receivedLabel = computed(() => {
  const received = digest.value?.received_at
  if (!received) return ''
  return formatCentralTime(String(received))
})

function applyView(date: string, result: TodayPayload) {
  view.value = {
    date,
    digest: result.digest ?? null,
    leads: result.leads || [],
    reroll: result.reroll || null,
    rerollLeads: result.rerollLeads || [],
    rerollPending: Boolean(result.rerollPending),
    rerollCount: Number(result.rerollCount || 0)
  }
}

async function fetchDigest() {
  const date = displayDate.value
  const keep = view.value?.date === date
  if (!keep) isLoading.value = true
  loadError.value = ''
  try {
    const result = await $fetch<TodayPayload>('/api/digests', {
      query: { date }
    })
    if (displayDate.value !== date) return
    applyView(date, result)
  } catch (error: unknown) {
    if (displayDate.value !== date) return
    if (!keep) {
      const err = error as { data?: { message?: string } }
      loadError.value = err.data?.message || 'Could not load today\'s leads. Try again.'
      view.value = null
    }
  } finally {
    if (displayDate.value === date) isLoading.value = false
  }
}

function goToDate(date: string) {
  router.push({ query: { date } })
}

function handleGenerateMockup(businessId: string) {
  openGenerateMockup(businessId)
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

    <DigestReroll
      v-if="isToday"
      class="mb-6"
      :reroll-count="rerollCount"
      :last-ran-at="reroll?.createdAt || null"
      :result-count="reroll ? rerollLeads.length : null"
      :pending="rerollPending"
      @done="fetchDigest()"
    />

    <div v-if="isLoading && !active" class="flex justify-center py-20">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-4xl text-primary" />
    </div>

    <div v-else-if="loadError && !active" class="text-center py-20">
      <UIcon name="i-lucide-cloud-off" class="text-6xl text-muted mb-4" />
      <h2 class="font-display text-xl font-medium text-highlighted mb-2">
        Could not load leads
      </h2>
      <p class="text-muted mb-6">{{ loadError }}</p>
      <UButton icon="i-lucide-refresh-cw" @click="fetchDigest">
        Retry
      </UButton>
    </div>

    <div v-else-if="!digest && !reroll" class="text-center py-20">
      <UIcon name="i-lucide-inbox" class="text-6xl text-muted mb-4" />
      <h2 class="font-display text-xl font-medium text-highlighted mb-2">
        No digest yet
      </h2>
      <p class="text-muted">
        {{ isToday ? "Today's digest hasn't come in yet" : "No digest for this date" }}
      </p>
    </div>

    <div v-else>
      <div v-if="!reroll" class="rounded-lg border border-default bg-muted p-4 mb-6">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <UIcon name="i-lucide-search" class="text-primary-500" />
              <p class="font-medium text-highlighted">
                {{ digest?.search?.category }}
              </p>
            </div>
            <p class="text-sm text-muted">
              {{ digest?.search?.location }}
              • {{ digest?.lead_count || 0 }} lead{{ digest?.lead_count === 1 ? '' : 's' }}
            </p>
            <p v-if="receivedLabel" class="text-xs text-muted mt-1">
              Received {{ receivedLabel }}
            </p>
          </div>
        </div>
      </div>

      <RerollResults
        v-if="reroll"
        :key="reroll.id"
        :leads="rerollLeads"
        :reroll="reroll"
        from="today"
        :date="displayDate"
        @dismissed="fetchDigest()"
      >
        <template #lead="{ lead, detailsTo }">
          <LeadCard
            :lead="lead"
            :tier-slug="String(lead.tier?.slug || 'skip')"
            :details-to="detailsTo"
            @generate-mockup="handleGenerateMockup"
          />
        </template>
      </RerollResults>

      <div v-else-if="!digest || digest.lead_count === 0" class="text-center py-12">
        <UIcon name="i-lucide-inbox" class="text-5xl text-muted mb-3" />
        <p class="text-muted">No leads today</p>
      </div>

      <div v-else class="space-y-8">
        <div v-for="(tierLeads, tierSlug) in tierGroups" :key="tierSlug">
          <div v-if="tierLeads.length > 0 && tierSlug === 'skip'">
            <UAccordion
              :items="[{
                label: `Skip tier (${tierLeads.length})`,
                slot: 'skip-leads'
              }]"
            >
              <template #skip-leads>
                <div class="grid grid-cols-1 gap-4">
                  <LeadCard
                    v-for="lead in tierLeads"
                    :key="lead.id"
                    :lead="lead"
                    tier-slug="skip"
                    @generate-mockup="handleGenerateMockup"
                  />
                </div>
              </template>
            </UAccordion>
          </div>
          <div v-else-if="tierLeads.length > 0" class="grid grid-cols-1 gap-4">
            <LeadCard
              v-for="lead in tierLeads"
              :key="lead.id"
              :lead="lead"
              :tier-slug="String(tierSlug)"
              @generate-mockup="handleGenerateMockup"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
