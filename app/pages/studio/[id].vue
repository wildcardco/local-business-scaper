<script setup lang="ts">
import type { ChosenPhoto } from '~/components/StudioStockPhotos.vue'
import { preferredSlotIndex, slotAfterAssign, slotLabel, slotOrderedPhotoUrls, slugPhotoSlot, type PhotoSlot } from '~~/shared/photo-slots'
import {
  failureDetail,
  feedbackJobView,
  pageJob,
  photoJobView,
  pitchJobView,
  type JobPhase
} from '~~/shared/studio-job'

definePageMeta({ hidePhoneTabs: true })

const route = useRoute()
const toast = useToast()
const { open: openGenerateModal, postGenerateMockup } = useGenerateMockup()
const id = computed(() => String(route.params.id))

const { data, pending, refresh } = await useFetch(() => `/api/mockups/${id.value}`)
const mockup = computed(() => data.value?.mockup)

const notes = ref('')
const isGenerating = ref(false)
const isRevising = ref(false)
const isPitching = ref(false)
const isSendingPhotos = ref(false)
const slots = ref<PhotoSlot[]>([])
const slotNote = ref('')
const assignments = ref<Record<number, string>>({})
const activeIndex = ref<number | null>(null)
const chosen = ref<ChosenPhoto | null>(null)
const focus = ref<'photos' | 'pitch' | 'feedback' | 'generate' | null>(null)
const photoError = ref('')
const pitchError = ref('')
const feedbackError = ref('')
const pitchNode = ref<string | null>(null)
const pitchExecution = ref<string | null>(null)
const jobFailure = ref('')
const seededUrl = ref('')
const usingImageSpots = ref(false)
const toolbarOpen = ref(false)
const slotListOpen = ref(false)
const stockPhotos = ref<{ sendAssigned: () => void } | null>(null)

const busy = computed(() =>
  ['generating', 'writing_pitch', 'enhancing', 'revising'].includes(mockup.value?.status || '')
)

const pageSteps: { id: JobPhase, label: string }[] = [
  { id: 'sending', label: 'Sending to n8n' },
  { id: 'building', label: 'Building on Vercel' },
  { id: 'writing', label: 'Writing the pitch' },
  { id: 'ready', label: 'Ready' },
  { id: 'failed', label: 'Failed' }
]

const pitchSteps: { id: JobPhase, label: string }[] = [
  { id: 'writing', label: 'Writing the pitch' },
  { id: 'sending', label: 'Sending the pitch' },
  { id: 'building', label: 'Building the preview' },
  { id: 'ready', label: 'Ready' },
  { id: 'failed', label: 'Failed' }
]

const feedbackSteps: { id: JobPhase, label: string }[] = [
  { id: 'sending', label: 'Sending to n8n' },
  { id: 'building', label: 'Building on Vercel' },
  { id: 'ready', label: 'Ready' },
  { id: 'failed', label: 'Failed' }
]

const failedText = computed(() => {
  if (jobFailure.value) return jobFailure.value
  return failureDetail(mockup.value?.status || '', mockup.value?.lastFeedback)
})

const headerJob = computed(() => {
  const view = pageJob({
    posting: isGenerating.value || isRevising.value || isPitching.value || isSendingPhotos.value,
    status: mockup.value?.status || ''
  })
  if (view.phase === 'failed') return { ...view, detail: failedText.value }
  return view
})

const pitchView = computed(() => {
  const view = pitchJobView({
    posting: isPitching.value,
    status: mockup.value?.status || '',
    node: pitchNode.value,
    executionStatus: pitchExecution.value,
    focused: focus.value === 'pitch',
    error: pitchError.value
  })
  if (view.phase === 'failed' && !view.detail) return { ...view, detail: failedText.value }
  return view
})

const photoView = computed(() => {
  const view = photoJobView({
    posting: isSendingPhotos.value,
    status: mockup.value?.status || '',
    focused: focus.value === 'photos',
    error: photoError.value
  })
  if (view.phase === 'failed' && !view.detail) return { ...view, detail: failedText.value }
  return view
})

const feedbackView = computed(() => {
  const view = feedbackJobView({
    posting: isRevising.value,
    status: mockup.value?.status || '',
    focused: focus.value === 'feedback',
    error: feedbackError.value
  })
  if (view.phase === 'failed' && !view.detail) return { ...view, detail: failedText.value }
  return view
})

const showSavedNotes = computed(() => {
  const saved = mockup.value?.lastFeedback || ''
  return Boolean(saved) && !/Studio webhook failed|N8N_STUDIO_SECRET|N8N_API_KEY|X-Studio-Secret|n8n API \d/.test(saved)
})

const spotPresets = ['Hero', 'Services', 'About', 'Gallery']

const stockHint = computed(() => {
  const category = mockup.value?.business?.category?.trim()
  const city = mockup.value?.business?.city?.trim()
  if (!category || !city) return ''
  return `${category} ${city}`.replace(/\s+/g, ' ')
})

let pollTimer: ReturnType<typeof setInterval> | null = null

watch(busy, (isBusy) => {
  if (!import.meta.client) return
  if (isBusy) startPoll()
  else stopPoll()
})

watch(() => mockup.value?.status, (status, previous) => {
  if (status === 'writing_pitch') focus.value = 'pitch'
  else if (status === 'enhancing') focus.value = 'photos'
  else if (status === 'revising') focus.value = 'feedback'
  else if (status === 'generating') focus.value = 'generate'

  if (status === 'failed' && previous && previous !== 'failed') {
    toast.add({
      title: 'n8n did not finish',
      description: failedText.value,
      color: 'error'
    })
  }
  if (
    (status === 'mockup_ready' || status === 'pitch_ready')
    && previous
    && ['generating', 'revising', 'enhancing', 'writing_pitch'].includes(previous)
  ) {
    toast.add({
      title: 'Mockup ready',
      description: mockup.value?.mockupUrl || 'Open the live preview',
      color: 'success'
    })
  }
})

watch(() => mockup.value?.vercelUrl, () => {
  loadSlots()
})

const toolbarTargetIndex = computed(() => preferredSlotIndex(slots.value, assignments.value, activeIndex.value))
const toolbarTarget = computed(() => slots.value.find(slot => slot.index === toolbarTargetIndex.value) ?? null)
const toolbarLead = computed(() => chosen.value ? 'This photo goes to' : 'Next photo goes to')
const toolbarThumb = computed(() => {
  if (chosen.value?.thumb) return chosen.value.thumb
  const index = toolbarTarget.value?.index
  if (index == null) return ''
  const url = assignments.value[index]
  return url?.startsWith('http') ? url : ''
})
const canSavePhotos = computed(() =>
  slotOrderedPhotoUrls(slots.value.map(slot => assignments.value[slot.index] || '')).some(url => url.startsWith('http'))
)
const photosLocked = computed(() => busy.value || isSendingPhotos.value)
const generateLabel = computed(() => {
  if (mockup.value?.mockupUrl) return 'Regenerate mockup'
  if (busy.value) return 'Generate again'
  return 'Generate mockup'
})

function openToolbar() {
  toolbarOpen.value = true
}

function closeToolbar() {
  toolbarOpen.value = false
  slotListOpen.value = false
}

function assignFromToolbar() {
  if (photosLocked.value || toolbarTargetIndex.value == null) return
  if (!chosen.value?.url.startsWith('http')) {
    toast.add({ title: 'Select a photo, then choose a slot', color: 'warning' })
    return
  }
  aimSlot(toolbarTargetIndex.value)
}

function saveFromToolbar() {
  stockPhotos.value?.sendAssigned()
}

onMounted(() => {
  if (busy.value) startPoll()
  loadSlots()
})

onUnmounted(() => {
  stopPoll()
})

function startPoll() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    refresh()
    refreshJob()
  }, 8000)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function refreshJob() {
  const status = mockup.value?.status
  if (status !== 'writing_pitch' && status !== 'enhancing') return
  try {
    const job = await $fetch<{
      node: string | null
      executionStatus: string | null
      failed: boolean
      detail: string
    }>(`/api/mockups/${id.value}/job`)
    pitchNode.value = job.node
    pitchExecution.value = job.executionStatus
    if (job.failed) {
      jobFailure.value = job.detail || 'The work stopped before it finished.'
      await refresh()
    }
  } catch {
    // The mockup poll still shows the local status.
  }
}

function renameSpot(index: number, label: string) {
  const next = label.replace(/\s+/g, ' ')
  slots.value = slots.value.map(slot => slot.index === index
    ? { ...slot, query: next, slot: next.trim() ? slugPhotoSlot(next) : slot.slot }
    : slot)
}

function applyPresetNames() {
  slots.value = slots.value.map((slot, index) => {
    const label = spotPresets[index]
    if (!label) return slot
    return { ...slot, query: label, slot: slugPhotoSlot(label) }
  })
}

async function loadSlots() {
  if (!mockup.value?.vercelUrl) {
    slots.value = []
    usingImageSpots.value = false
    slotNote.value = 'No live mockup yet.'
    return
  }
  try {
    const result = await $fetch<{
      slots: PhotoSlot[]
      error?: string
    }>(`/api/mockups/${id.value}/photo-queries`)
    if (result.slots?.length) {
      slots.value = result.slots
      usingImageSpots.value = false
      slotNote.value = ''
    } else {
      const spots = await $fetch<{
        spots: { index: number, key: string, label: string, src: string }[]
        error?: string
      }>(`/api/mockups/${id.value}/image-spots`)
      slots.value = (spots.spots || []).map(spot => ({
        index: spot.index,
        query: spot.label,
        role: spot.index === 0 ? 'hero' as const : 'section' as const,
        open: !spot.src,
        src: spot.src || null,
        slot: spot.key
      }))
      usingImageSpots.value = slots.value.length > 0
      slotNote.value = slots.value.length
        ? ''
        : (spots.error || 'This page has no photo slots and no images to attach one to. Regenerate builds a new page.')
    }
    const url = mockup.value.vercelUrl
    if (seededUrl.value === url) {
      ensureActiveSlot()
      return
    }
    const next: Record<number, string> = {}
    const saved = mockup.value.photoUrls || []
    for (const slot of slots.value) {
      const assigned = saved[slot.index]
      if (assigned?.startsWith('http')) next[slot.index] = assigned
    }
    assignments.value = next
    seededUrl.value = url
    ensureActiveSlot()
  } catch {
    slots.value = []
    slotNote.value = 'The live page could not be read.'
  }
}

function ensureActiveSlot() {
  if (!slots.value.length) {
    activeIndex.value = null
    return
  }
  if (activeIndex.value != null && slots.value.some(slot => slot.index === activeIndex.value)) return
  activeIndex.value = preferredSlotIndex(slots.value, assignments.value, null)
}

function placeOnSlot(index: number, url: string) {
  if (!url.startsWith('http')) {
    activeIndex.value = index
    return
  }
  const next = { ...assignments.value, [index]: url }
  assignments.value = next
  chosen.value = null
  activeIndex.value = slotAfterAssign(slots.value, next, index)
}

function onPickSlot(index: number) {
  placeOnSlot(index, chosen.value?.url || '')
}

function onDropSlot(payload: { index: number, url: string }) {
  placeOnSlot(payload.index, payload.url)
}

function aimSlot(index: number) {
  placeOnSlot(index, chosen.value?.url || '')
}

function clearSlot(index: number) {
  const next: Record<number, string> = {}
  for (const [key, url] of Object.entries(assignments.value)) {
    if (Number(key) === index) continue
    next[Number(key)] = url
  }
  assignments.value = next
  activeIndex.value = index
}

async function sendAssignedPhotos(payload: { urls: string[], unsplashIds: string[] }) {
  focus.value = 'photos'
  photoError.value = ''
  isSendingPhotos.value = true
  try {
    if (usingImageSpots.value) {
      await $fetch(`/api/mockups/${id.value}/image-spots`, {
        method: 'POST',
        body: {
          slots: slots.value.map(slot => ({
            index: slot.index,
            key: slot.slot || slugPhotoSlot(slot.query),
            label: slot.query,
            url: assignments.value[slot.index] || ''
          }))
        }
      })
    } else {
      await $fetch(`/api/mockups/${id.value}/photos`, {
        method: 'POST',
        body: { photoUrls: payload.urls, ordered: true }
      })
    }
    if (payload.unsplashIds.length) {
      await $fetch('/api/studio/stock-photos/download', {
        method: 'POST',
        body: { ids: payload.unsplashIds }
      }).catch(() => {})
    }
    toast.add({ title: 'Photos sent', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    photoError.value = readError(error, 'n8n did not accept the photos.')
    toast.add({
      title: 'Photos failed',
      description: photoError.value,
      color: 'error'
    })
  } finally {
    isSendingPhotos.value = false
  }
}

async function generate() {
  focus.value = 'generate'
  const regenerating = Boolean(mockup.value?.mockupUrl)
  if (mockup.value?.businessId) {
    openGenerateModal(mockup.value.businessId, regenerating ? 'regenerate' : 'generate')
    return
  }

  isGenerating.value = true
  try {
    const result = await postGenerateMockup({ mockupId: id.value, regenerate: regenerating })
    if (!result) return
    toast.add({ title: 'Mockup generation started', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    toast.add({
      title: 'Could not start mockup',
      description: readError(error, 'Check the n8n studio webhook and X-Studio-Secret'),
      color: 'error'
    })
  } finally {
    isGenerating.value = false
  }
}

async function revise() {
  if (!notes.value.trim()) {
    toast.add({ title: 'Add revision notes first', color: 'warning' })
    return
  }
  focus.value = 'feedback'
  feedbackError.value = ''
  isRevising.value = true
  try {
    const result = await $fetch<{ warning?: string }>(`/api/mockups/${id.value}/revise`, {
      method: 'POST',
      body: { notes: notes.value }
    })
    toast.add({
      title: result.warning ? 'Revision requested, with a warning' : 'Revision requested, in progress',
      description: result.warning || 'n8n accepted the notes. This page stays on Building on Vercel until the live mockup updates.',
      color: result.warning ? 'warning' : 'success'
    })
    notes.value = ''
    await refresh()
  } catch (error: unknown) {
    feedbackError.value = readError(error, 'n8n did not accept the revision.')
    toast.add({
      title: 'Feedback failed',
      description: feedbackError.value,
      color: 'error'
    })
  } finally {
    isRevising.value = false
  }
}

async function writePitch() {
  focus.value = 'pitch'
  pitchError.value = ''
  isPitching.value = true
  try {
    await $fetch(`/api/mockups/${id.value}/pitch`, { method: 'POST' })
    toast.add({ title: 'Pitch writer started', color: 'success' })
    await refresh()
    await refreshJob()
  } catch (error: unknown) {
    pitchError.value = readError(error, 'n8n did not accept the pitch request.')
    toast.add({
      title: 'Pitch failed',
      description: pitchError.value,
      color: 'error'
    })
  } finally {
    isPitching.value = false
  }
}

function statusColor(status: string) {
  if (status === 'mockup_ready' || status === 'pitch_ready') return 'success'
  if (status === 'generating' || status === 'writing_pitch' || status === 'enhancing' || status === 'revising') return 'warning'
  if (status === 'failed') return 'error'
  return 'neutral'
}
</script>

<template>
  <div class="studio-item min-w-0 space-y-6 overflow-x-clip">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="eyebrow">
          Studio
        </p>
        <h1 class="truncate font-display text-2xl font-semibold tracking-tight">
          {{ mockup?.business?.name || 'Mockup' }}
        </h1>
        <p class="text-muted">
          {{ mockup?.locationLabel || mockup?.business?.category || 'City not on file' }}
        </p>
      </div>
      <div class="flex w-full flex-col gap-2 sm:w-auto">
        <UButton
          v-if="mockup"
          data-regenerate-mockup
          class="min-h-11 w-full justify-center"
          icon="i-lucide-sparkles"
          :loading="isGenerating"
          @click="generate"
        >
          {{ generateLabel }}
        </UButton>
        <UButton
          class="min-h-11 w-full justify-center sm:w-auto"
          to="/studio"
          variant="ghost"
          icon="i-lucide-arrow-left"
        >
          All mockups
        </UButton>
      </div>
    </div>

    <div
      v-if="pending && !mockup"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin text-3xl text-primary"
      />
    </div>

    <template v-else-if="mockup">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          :color="statusColor(mockup.status)"
          variant="subtle"
          class="capitalize"
        >
          {{ studioStatusLabel(mockup.status) }}
        </UBadge>
        <span class="text-xs text-muted">v{{ mockup.mockupVersion }}</span>
        <span
          v-if="mockup.aiModel"
          class="text-xs text-muted"
        >{{ mockup.aiModel }}</span>
      </div>

      <section
        v-if="mockup.costs?.entries?.length"
        class="rounded-2xl border border-default bg-elevated p-4"
      >
        <h2 class="font-semibold">
          Spend
        </h2>
        <p class="mt-1 text-sm text-muted">
          The first reported cost starts this total. Each later call adds its own amount.
        </p>
        <ul class="mt-3 space-y-2">
          <li
            v-for="(entry, index) in mockup.costs.entries"
            :key="`${entry.action}-${index}`"
            class="flex items-baseline justify-between gap-3 text-sm"
          >
            <span class="min-w-0">
              <span class="font-medium">{{ entry.action }}</span>
              <span class="block truncate text-muted">{{ entry.raw }}</span>
            </span>
            <span class="shrink-0 font-mono">{{ entry.amount }}</span>
          </li>
        </ul>
        <p class="mt-3 font-display text-lg font-semibold">
          Total {{ mockup.costs.total }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Steps with no reported cost are left out of this total.
        </p>
      </section>

      <StudioJobStatus
        :phase="headerJob.phase"
        :label="headerJob.label"
        :detail="headerJob.detail"
        :steps="pageSteps"
      />

      <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <StudioMockupStage
          class="lg:sticky lg:top-4"
          :mockup-id="id"
          :mockup-url="mockup.vercelUrl"
          :active-index="activeIndex"
          :assignments="assignments"
          :armed="Boolean(chosen)"
          @pick="onPickSlot"
          @drop="onDropSlot"
        />

        <div class="space-y-6">
          <UCard>
            <template #header>
              <h3 class="font-semibold">
                Photos
              </h3>
            </template>
            <div
              v-if="usingImageSpots"
              class="mb-4 space-y-2"
            >
              <p class="text-sm text-muted">
                These are images already on the page. Name a spot, assign a photo, and save. The copy and layout stay as they are.
              </p>
              <UButton
                type="button"
                size="xs"
                variant="outline"
                @click="applyPresetNames"
              >
                Name them Hero, Services, About, Gallery
              </UButton>
              <label
                v-for="slot in slots"
                :key="`name-${slot.index}`"
                class="block"
              >
                <span class="mb-1 block text-xs text-muted">Spot {{ slot.index + 1 }}</span>
                <UInput
                  :model-value="slot.query"
                  class="w-full"
                  @update:model-value="renameSpot(slot.index, String($event || ''))"
                />
              </label>
            </div>
            <StudioStockPhotos
              ref="stockPhotos"
              :mockup-id="id"
              :slots="slots"
              :slot-note="slotNote"
              :assignments="assignments"
              :active-index="activeIndex"
              :chosen="chosen"
              :disabled="busy || isSendingPhotos"
              :phase="photoView.phase"
              :detail="photoView.detail"
              :hint-query="stockHint"
              @choose="chosen = $event"
              @aim="aimSlot"
              @clear="clearSlot"
              @apply="sendAssignedPhotos"
            />
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-semibold">
                Business
              </h3>
            </template>
            <dl class="space-y-2 text-sm">
              <div>
                <dt class="text-muted">
                  Website
                </dt>
                <dd class="break-all">
                  {{ mockup.business?.website || 'None' }}
                </dd>
              </div>
              <div>
                <dt class="text-muted">
                  Phone
                </dt>
                <dd>{{ mockup.business?.phone || '—' }}</dd>
              </div>
              <div>
                <dt class="text-muted">
                  Location
                </dt>
                <dd>{{ mockup.locationLabel }}</dd>
              </div>
            </dl>
            <UButton
              v-if="mockup.businessId"
              class="mt-4"
              variant="ghost"
              size="sm"
              :to="`/businesses/${mockup.businessId}`"
            >
              Open lead
            </UButton>
          </UCard>
        </div>
      </div>

      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Feedback
          </h3>
        </template>
        <StudioJobStatus
          class="mb-4"
          :phase="feedbackView.phase"
          :label="feedbackView.label"
          :detail="feedbackView.detail"
          :steps="feedbackSteps"
        />
        <UFormField
          label="Revision notes"
          help="Sends action revise_mockup to the Studio webhook. Photos are added separately."
        >
          <UTextarea
            v-model="notes"
            class="w-full"
            :rows="4"
            placeholder="Move the hero photo down, make the phone number bigger…"
          />
        </UFormField>
        <p
          v-if="showSavedNotes"
          class="mt-3 text-sm text-muted"
        >
          Last notes: {{ mockup.lastFeedback }}
        </p>
        <div class="mt-3">
          <UButton
            class="min-h-11 w-full justify-center sm:w-auto"
            icon="i-lucide-message-square"
            variant="outline"
            :loading="isRevising"
            :disabled="busy"
            @click="revise"
          >
            Send feedback
          </UButton>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Pitch
          </h3>
        </template>
        <StudioJobStatus
          class="mb-4"
          :phase="pitchView.phase"
          :label="pitchView.label"
          :detail="pitchView.detail"
          :steps="pitchSteps"
        />
        <div
          v-if="mockup.pitchDraft"
          class="mb-3 space-y-2"
        >
          <p
            v-if="mockup.pitchSubject"
            class="font-medium"
          >
            {{ mockup.pitchSubject }}
          </p>
          <pre class="whitespace-pre-wrap font-sans text-sm text-muted">{{ mockup.pitchDraft }}</pre>
        </div>
        <p
          v-else
          class="mb-3 text-sm text-muted"
        >
          Writes through n8n WF-3 when a mockup exists. Groq templates stay for bulk outreach without a mockup.
        </p>
        <UButton
          class="min-h-11 w-full justify-center sm:w-auto"
          icon="i-lucide-mail"
          variant="outline"
          :loading="isPitching"
          :disabled="busy || !mockup.mockupUrl"
          @click="writePitch"
        >
          Write pitch
        </UButton>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Where it lives
          </h3>
        </template>
        <div class="space-y-3">
          <div
            v-if="mockup.vercelUrl"
            class="min-w-0"
          >
            <p class="text-xs text-muted">
              Vercel deployment
            </p>
            <a
              :href="mockup.vercelUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-flex min-h-11 items-center break-all text-sm text-primary underline"
            >
              {{ mockup.vercelUrl }}
            </a>
          </div>
          <p
            v-else-if="mockup.deploymentMissing"
            class="text-sm text-muted"
          >
            That Vercel deployment was removed, so this mockup is no longer live.
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            No Vercel deployment yet.
          </p>
          <div
            v-if="mockup.githubUrl"
            class="min-w-0"
          >
            <p class="text-xs text-muted">
              GitHub repo
            </p>
            <a
              :href="mockup.githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-flex min-h-11 items-center break-all text-sm text-primary underline"
            >
              {{ mockup.githubUrl }}
            </a>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            No GitHub repo on file.
          </p>
        </div>
      </UCard>
    </template>

    <Teleport to="#teleports">
      <div class="lg:hidden">
        <div
          id="studio-action-toolbar"
          data-studio-action-toolbar
          class="fixed inset-x-0 bottom-0 z-40 border-t border-default bg-elevated shadow-[0_-8px_24px_rgba(0,0,0,0.45)] touch-manipulation"
          :class="chosen && toolbarOpen ? 'border-secondary' : 'border-default'"
          :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
          role="region"
          aria-label="Photo actions"
        >
          <button
            v-if="!toolbarOpen"
            type="button"
            data-studio-actions
            class="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-base font-semibold text-highlighted"
            aria-expanded="false"
            aria-controls="studio-action-toolbar"
            @click="openToolbar"
          >
            <span class="inline-flex items-center gap-2">
              <UIcon
                name="i-lucide-sliders-horizontal"
                class="size-5 text-primary"
              />
              Actions
            </span>
            <UIcon
              name="i-lucide-chevron-up"
              class="size-5 text-muted"
            />
          </button>
          <div v-else>
            <div
              v-if="slotListOpen && slots.length"
              id="studio-toolbar-slots"
              class="max-h-52 space-y-2 overflow-y-auto overscroll-contain border-b border-default px-3 py-3"
            >
              <div
                v-for="slot in slots"
                :key="`toolbar-slot-${slot.index}`"
                class="flex items-stretch gap-2"
              >
                <button
                  type="button"
                  class="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border p-2 text-left"
                  :class="toolbarTargetIndex === slot.index ? 'border-primary' : 'border-default'"
                  :aria-current="toolbarTargetIndex === slot.index ? 'true' : undefined"
                  @click="activeIndex = slot.index"
                >
                  <img
                    v-if="assignments[slot.index]"
                    :src="assignments[slot.index]"
                    alt=""
                    class="size-11 shrink-0 rounded object-cover"
                  >
                  <span
                    v-else
                    class="flex size-11 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted"
                  >
                    Empty
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-xs text-muted">{{ slot.role === 'hero' ? 'Hero' : `Slot ${slot.index + 1}` }}</span>
                    <span class="line-clamp-2 text-sm">{{ slot.query }}</span>
                  </span>
                  <UIcon
                    v-if="toolbarTargetIndex === slot.index"
                    name="i-lucide-check"
                    class="shrink-0 text-primary"
                  />
                </button>
                <UButton
                  v-if="assignments[slot.index]"
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="shrink-0 self-center"
                  :disabled="photosLocked"
                  @click="clearSlot(slot.index)"
                >
                  Clear
                </UButton>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3 pt-2">
              <button
                type="button"
                class="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
                :aria-expanded="slotListOpen"
                aria-controls="studio-toolbar-slots"
                :disabled="!slots.length"
                @click="slotListOpen = !slotListOpen"
              >
                <img
                  v-if="toolbarThumb"
                  :src="toolbarThumb"
                  alt=""
                  class="size-11 shrink-0 rounded object-cover"
                >
                <span
                  v-else
                  class="flex size-11 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted"
                >
                  Empty
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs text-muted">{{ toolbarLead }}</span>
                  <span
                    class="block truncate text-sm font-medium"
                    data-studio-slot-target
                  >
                    {{ toolbarTarget ? slotLabel(toolbarTarget) : 'No slots' }}
                  </span>
                </span>
                <UIcon
                  name="i-lucide-chevrons-up-down"
                  class="shrink-0 text-muted"
                />
              </button>
              <UButton
                type="button"
                variant="ghost"
                class="min-h-11 shrink-0"
                icon="i-lucide-chevron-down"
                @click="closeToolbar"
              >
                Hide
              </UButton>
            </div>
            <div class="grid grid-cols-3 gap-2 px-3 pt-2">
              <UButton
                type="button"
                variant="outline"
                class="min-h-11 justify-center"
                :disabled="photosLocked || !chosen"
                @click="assignFromToolbar"
              >
                Assign
              </UButton>
              <UButton
                type="button"
                class="min-h-11 justify-center"
                icon="i-lucide-save"
                data-studio-photo-save
                :loading="isSendingPhotos || photoView.phase === 'sending'"
                :disabled="photosLocked || !canSavePhotos"
                @click="saveFromToolbar"
              >
                Save
              </UButton>
              <UButton
                type="button"
                variant="outline"
                class="min-h-11 justify-center whitespace-normal px-2 text-center text-xs leading-tight"
                icon="i-lucide-sparkles"
                :loading="isGenerating"
                @click="generate"
              >
                {{ generateLabel }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <div
      class="fixed bottom-0 inset-x-0 z-20 hidden justify-end px-4 pt-4 lg:flex"
      :style="{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }"
    >
      <UButton
        class="min-h-11"
        size="lg"
        icon="i-lucide-sparkles"
        :loading="isGenerating"
        @click="generate"
      >
        {{ generateLabel }}
      </UButton>
    </div>
  </div>
</template>
