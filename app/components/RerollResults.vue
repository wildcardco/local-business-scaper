<script setup lang="ts">
import { formatCentralTime } from '~~/shared/date-utils'
import {
  clampRerollPage,
  parseRerollScroll,
  rerollAgeLabel,
  rerollLeadPath,
  rerollPageCount,
  rerollPageStartIndex,
  rerollScrollKey,
  type RerollLeadView,
  type RerollSummary
} from '~~/shared/digest-reroll'

const props = defineProps<{
  leads: RerollLeadView[]
  reroll: RerollSummary
  from: 'home' | 'today'
  date: string
}>()

const emit = defineEmits<{
  dismissed: []
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const root = ref<HTMLElement | null>(null)
const relative = ref('')
const dismissing = ref(false)
const confirmDismiss = ref(false)

const page = computed(() => clampRerollPage(route.query.page, props.leads.length))
const pages = computed(() => rerollPageCount(props.leads.length))
const pageStart = computed(() => rerollPageStartIndex(page.value, props.leads.length))
const pageEnd = computed(() => Math.min(props.leads.length, pageStart.value + 10))

const clockLabel = computed(() => {
  if (!props.reroll.createdAt) return 'Re-roll results'
  return `Re-rolled ${formatCentralTime(props.reroll.createdAt)}`
})

const headline = computed(() => {
  const when = relative.value || clockLabel.value
  return `${when}, ${props.leads.length} result${props.leads.length === 1 ? '' : 's'}`
})

function detailsTo(index: number, businessId: string) {
  if (!businessId) return undefined
  return rerollLeadPath({
    businessId,
    rerollId: props.reroll.id,
    index,
    date: props.date,
    page: page.value,
    from: props.from
  })
}

let scroller: HTMLElement | Window | null = null
let scrollTimer: ReturnType<typeof setTimeout> | null = null

function findScroller(start: HTMLElement | null): HTMLElement | Window {
  let el = start?.parentElement ?? null
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 8) return el
    el = el.parentElement
  }
  return window
}

function currentY() {
  if (!scroller || scroller instanceof Window) return window.scrollY
  return scroller.scrollTop
}

function setY(y: number) {
  if (!scroller || scroller instanceof Window) window.scrollTo(0, y)
  else scroller.scrollTop = y
}

function saveScroll() {
  if (!import.meta.client || !props.reroll.id) return
  try {
    sessionStorage.setItem(
      rerollScrollKey(props.reroll.id, props.from),
      JSON.stringify({ y: currentY(), page: page.value })
    )
  } catch {
    // sessionStorage can be blocked in a private in-app browser
  }
}

function restoreScroll() {
  scroller = findScroller(root.value)
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(rerollScrollKey(props.reroll.id, props.from))
  } catch {
    raw = null
  }
  const saved = parseRerollScroll(raw)
  if (saved && saved.page === page.value) {
    setY(saved.y)
    return
  }
  if (page.value > 1) {
    document.getElementById(`reroll-lead-${pageStart.value}`)?.scrollIntoView({ block: 'start' })
  }
}

async function goToPage(next: number) {
  const clamped = clampRerollPage(next, props.leads.length)
  await router.replace({
    query: { ...route.query, page: String(clamped), reroll: props.reroll.id },
    hash: '#reroll-results'
  })
  await nextTick()
  document.getElementById(`reroll-lead-${rerollPageStartIndex(clamped, props.leads.length)}`)?.scrollIntoView({ block: 'start' })
  saveScroll()
}

function onScroll() {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(saveScroll, 120)
}

async function dismiss() {
  if (dismissing.value) return
  dismissing.value = true
  try {
    await $fetch(`/api/digests/rerolls/${props.reroll.id}/dismiss`, { method: 'POST' })
    confirmDismiss.value = false
    try {
      sessionStorage.removeItem(rerollScrollKey(props.reroll.id, props.from))
    } catch {
      // ignore
    }
    emit('dismissed')
  } catch {
    toast.add({ title: 'Could not dismiss these results', color: 'error' })
  } finally {
    dismissing.value = false
  }
}

onMounted(() => {
  if (props.reroll.createdAt) {
    relative.value = rerollAgeLabel(props.reroll.createdAt, Date.now())
  }
  nextTick(() => {
    scroller = findScroller(root.value)
    const node = !scroller || scroller instanceof Window ? window : scroller
    node.addEventListener('scroll', onScroll, { passive: true })
    requestAnimationFrame(() => restoreScroll())
  })
})

onBeforeUnmount(() => {
  saveScroll()
  const node = !scroller || scroller instanceof Window ? window : scroller
  node.removeEventListener('scroll', onScroll)
  if (scrollTimer) clearTimeout(scrollTimer)
})
</script>

<template>
  <section
    id="reroll-results"
    ref="root"
    data-reroll-results
    class="min-w-0 scroll-mt-20"
    @click.capture="saveScroll"
  >
    <div class="sticky top-0 z-20 -mx-1 mb-3 border-b border-default bg-default/95 px-1 py-2 backdrop-blur">
      <div class="flex min-w-0 items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">
            {{ headline }}
          </p>
          <p class="truncate text-xs text-muted">
            {{ reroll.category || 'Re-roll' }}
            <template v-if="reroll.location">
              · {{ reroll.location }}
            </template>
          </p>
        </div>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          class="shrink-0"
          @click="confirmDismiss = true"
        >
          Dismiss
        </UButton>
      </div>
      <p
        v-if="reroll.pending"
        class="mt-1 text-xs text-muted"
      >
        A new re-roll is running. This list stays until those results arrive. It does not search again on its own.
      </p>
      <div
        v-if="leads.length > 10"
        class="mt-2 flex min-w-0 items-center gap-2"
      >
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          class="min-h-11 shrink-0"
          icon="i-lucide-chevron-left"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          Prev
        </UButton>
        <p class="min-w-0 flex-1 text-center text-xs text-muted">
          Page {{ page }} of {{ pages }}
          <span class="block">{{ pageStart + 1 }}–{{ pageEnd }} of {{ leads.length }} · no API call</span>
        </p>
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          class="min-h-11 shrink-0"
          trailing-icon="i-lucide-chevron-right"
          :disabled="page >= pages"
          @click="goToPage(page + 1)"
        >
          Next
        </UButton>
      </div>
    </div>

    <p
      v-if="leads.length === 0"
      class="py-8 text-center text-sm text-muted"
    >
      This re-roll came back with no businesses.
    </p>
    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="(lead, index) in leads"
        :id="`reroll-lead-${index}`"
        :key="lead.id"
        class="min-w-0 scroll-mt-28"
      >
        <p
          v-if="lead.business.status === 'rejected'"
          class="mb-1 text-xs text-muted"
        >
          {{ index + 1 }}. Already skipped. Still in this list.
        </p>
        <p
          v-else
          class="mb-1 text-xs text-muted"
        >
          {{ index + 1 }} of {{ leads.length }}
        </p>
        <slot
          name="lead"
          :lead="lead"
          :index="index"
          :details-to="detailsTo(index, lead.business.id)"
        />
      </div>
    </div>

    <UModal
      v-model:open="confirmDismiss"
      title="Dismiss these results?"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-md' }"
    >
      <template #body>
        <p class="text-sm text-muted">
          This hides the re-roll list. Businesses already saved stay in Leads. It does not spend API credits.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="dismissing"
            @click="confirmDismiss = false"
          >
            Keep
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            :loading="dismissing"
            @click="dismiss"
          >
            Dismiss list
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
