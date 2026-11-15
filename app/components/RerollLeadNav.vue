<script setup lang="ts">
import { rerollBackPath, rerollLeadPath, rerollNeighbor } from '~~/shared/digest-reroll'

const route = useRoute()

const rerollId = computed(() => typeof route.query.reroll === 'string' ? route.query.reroll : '')
const businessId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})
const from = computed(() => route.query.from === 'home' ? 'home' as const : 'today' as const)
const page = computed(() => {
  const value = Number(route.query.page)
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
})

type NavLead = { businessId: string, name: string }
type NavPayload = {
  id: string
  date: string
  leads: NavLead[]
}

const nav = ref<NavPayload | null>(null)

watch(rerollId, async (id) => {
  nav.value = null
  if (!id) return
  try {
    nav.value = await $fetch<NavPayload>(`/api/digests/rerolls/${id}`)
  } catch {
    nav.value = null
  }
}, { immediate: true })

const index = computed(() => {
  const leads = nav.value?.leads || []
  const found = leads.findIndex(lead => lead.businessId === businessId.value)
  if (found >= 0) return found
  const queryIndex = Number(route.query.i)
  if (Number.isInteger(queryIndex) && queryIndex >= 0 && queryIndex < leads.length) return queryIndex
  return -1
})

const total = computed(() => nav.value?.leads.length || 0)
const neighbors = computed(() => rerollNeighbor(index.value, total.value))

const date = computed(() => nav.value?.date || (typeof route.query.date === 'string' ? route.query.date : ''))

const backTo = computed(() => {
  if (!rerollId.value) return '/leads/today'
  if (!date.value && from.value !== 'home') return '/leads/today'
  return rerollBackPath({
    from: from.value,
    date: date.value || '',
    page: page.value,
    rerollId: rerollId.value
  })
})

function leadTo(neighbor: number | null) {
  if (neighbor == null || !nav.value) return ''
  const lead = nav.value.leads[neighbor]
  if (!lead?.businessId) return ''
  return rerollLeadPath({
    businessId: lead.businessId,
    rerollId: rerollId.value,
    index: neighbor,
    date: date.value,
    page: page.value,
    from: from.value
  })
}

const prevTo = computed(() => leadTo(neighbors.value.prev))
const nextTo = computed(() => leadTo(neighbors.value.next))
</script>

<template>
  <div
    v-if="rerollId"
    class="flex w-full min-w-0 flex-col gap-2"
  >
    <div class="flex min-w-0 items-center justify-between gap-2">
      <UButton
        :to="backTo"
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="sm"
        class="min-h-11 shrink"
      >
        Back to results
      </UButton>
      <p class="shrink-0 text-xs tabular-nums text-muted">
        {{ index >= 0 ? index + 1 : '–' }} of {{ total || '…' }}
      </p>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <UButton
        v-if="prevTo"
        :to="prevTo"
        size="sm"
        color="neutral"
        variant="outline"
        class="min-h-11 justify-center"
        icon="i-lucide-chevron-left"
      >
        Prev
      </UButton>
      <UButton
        v-else
        size="sm"
        color="neutral"
        variant="outline"
        class="min-h-11 justify-center"
        icon="i-lucide-chevron-left"
        disabled
      >
        Prev
      </UButton>
      <UButton
        v-if="nextTo"
        :to="nextTo"
        size="sm"
        color="neutral"
        variant="outline"
        class="min-h-11 justify-center"
        trailing-icon="i-lucide-chevron-right"
      >
        Next
      </UButton>
      <UButton
        v-else
        size="sm"
        color="neutral"
        variant="outline"
        class="min-h-11 justify-center"
        trailing-icon="i-lucide-chevron-right"
        disabled
      >
        Next
      </UButton>
    </div>
  </div>
</template>
