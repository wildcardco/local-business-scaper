<script setup lang="ts">
import type { IntakeMatch } from '~~/shared/intake-lookup'
import { googlePlaceIdFrom, preferredPlaceId } from '~~/shared/gbp-listing'
import {
  RESEARCH_CONFIRM_COPY,
  RESEARCH_NEEDS_LISTING,
  researchOwnerSlug,
  researchStatusFrom,
  type ResearchStatus
} from '~~/shared/research-report'
import { studioOwnerBySlug } from '~~/shared/studio-owners'

const props = defineProps<{
  mockupId: string
  businessId?: string | null
  placeId?: string | null
  businessPlaceId?: string | null
  researchStatus?: string | null
  owner?: string | null
  name?: string | null
  city?: string | null
  state?: string | null
  website?: string | null
  phone?: string | null
  address?: string | null
}>()

const emit = defineEmits<{
  updated: []
}>()

const toast = useToast()
const open = ref(false)
const notes = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const placeId = ref(props.placeId || '')
const businessPlaceId = ref(props.businessPlaceId || '')
const status = ref<ResearchStatus | null>(researchStatusFrom(props.researchStatus))
const lookupStatus = ref<'idle' | 'loading' | 'done' | 'skipped' | 'error'>('idle')
const lookupMessage = ref('')
const matches = ref<IntakeMatch[]>([])
const confirmingId = ref('')

watch(() => props.placeId, (value) => {
  placeId.value = value || ''
})
watch(() => props.businessPlaceId, (value) => {
  businessPlaceId.value = value || ''
})
watch(() => props.researchStatus, (value) => {
  status.value = researchStatusFrom(value)
})

const googleId = computed(() => googlePlaceIdFrom(preferredPlaceId(placeId.value, businessPlaceId.value)))
const pending = computed(() => status.value === 'requested' || submitting.value)
const ownerLabel = computed(() => {
  const slug = researchOwnerSlug(props.owner)
  return (slug && studioOwnerBySlug(slug)?.label) || 'the lead\'s owner'
})

let timer: ReturnType<typeof setInterval> | null = null

function stopPoll() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

async function refreshStatus() {
  try {
    const result = await $fetch<{ mockup?: { researchStatus?: string } }>(`/api/mockups/${props.mockupId}`)
    const next = researchStatusFrom(result.mockup?.researchStatus)
    if (next === 'complete' && status.value !== 'complete') {
      status.value = 'complete'
      stopPoll()
      emit('updated')
    }
  } catch {
    stopPoll()
  }
}

watch(status, (value) => {
  stopPoll()
  if (value !== 'requested') return
  timer = setInterval(() => {
    void refreshStatus()
  }, 15000)
}, { immediate: true })

onUnmounted(stopPoll)

function readError(error: unknown) {
  const data = (error as { data?: { message?: string } }).data
  return data?.message || 'The research request did not go through.'
}

function showDialog() {
  if (pending.value) return
  errorMessage.value = ''
  lookupMessage.value = ''
  matches.value = []
  open.value = true
}

async function lookupPlace(selectedId = '') {
  if (!props.businessId || lookupStatus.value === 'loading' || confirmingId.value) return
  lookupStatus.value = 'loading'
  lookupMessage.value = ''
  if (!selectedId) matches.value = []
  confirmingId.value = selectedId
  try {
    const result = await $fetch<{
      status?: 'loaded' | 'choose' | 'none'
      matches?: IntakeMatch[]
      placeId?: string
      message?: string
    }>(`/api/businesses/${props.businessId}/lookup-place`, {
      method: 'POST',
      body: {
        placeId: selectedId || undefined,
        name: props.name || '',
        city: props.city || '',
        state: props.state || '',
        website: props.website || '',
        phone: props.phone || '',
        address: props.address || ''
      }
    })
    if (result.status === 'choose') {
      matches.value = result.matches || []
      lookupStatus.value = 'done'
      lookupMessage.value = result.message || 'Choose the Google listing. Nothing is saved until you do.'
      return
    }
    if (result.status === 'none') {
      matches.value = []
      lookupStatus.value = 'skipped'
      lookupMessage.value = result.message || 'No listing matched this lead. Nothing was saved.'
      return
    }
    if (result.placeId) placeId.value = result.placeId
    matches.value = []
    lookupStatus.value = 'done'
    lookupMessage.value = result.message || 'Google listing saved. Request the research report when you are ready. That request is a separate step.'
    emit('updated')
  } catch (error: unknown) {
    lookupStatus.value = 'error'
    lookupMessage.value = readError(error)
  } finally {
    confirmingId.value = ''
  }
}

async function requestReport() {
  if (submitting.value || status.value === 'requested' || !googleId.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/mockups/${props.mockupId}/research`, {
      method: 'POST',
      body: { notes: notes.value }
    })
    status.value = 'requested'
    open.value = false
    notes.value = ''
    toast.add({
      title: 'Research requested',
      description: `n8n accepted the request. The report is emailed to ${ownerLabel.value}. This button stays off until the report is marked complete.`,
      color: 'success'
    })
    emit('updated')
  } catch (error: unknown) {
    const message = readError(error)
    if (/already requested/i.test(message)) status.value = 'requested'
    errorMessage.value = message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-2 sm:w-auto">
    <UBadge
      v-if="status === 'requested'"
      color="warning"
      variant="subtle"
      data-research-status="requested"
    >
      Research requested
    </UBadge>
    <UBadge
      v-else-if="status === 'complete'"
      color="success"
      variant="subtle"
      data-research-status="complete"
    >
      Research complete
    </UBadge>
    <UButton
      type="button"
      data-research-report
      class="min-h-11 w-full justify-center"
      variant="outline"
      icon="i-lucide-file-search"
      :disabled="pending"
      @click="showDialog"
    >
      {{ status === 'requested' ? 'Research requested' : 'Research report' }}
    </UButton>
    <UModal
      v-model:open="open"
      :title="googleId ? 'Request a research report' : 'Match the Google listing'"
      :description="googleId ? RESEARCH_CONFIRM_COPY : RESEARCH_NEEDS_LISTING"
      :ui="{
        content: 'generate-mockup-modal sm:max-w-lg sm:max-h-[90vh]',
        header: 'shrink-0',
        wrapper: 'pe-10',
        body: 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
        footer: 'shrink-0'
      }"
    >
      <template #body>
        <div class="space-y-4">
          <p
            v-if="googleId"
            class="text-sm text-muted"
          >
            The report goes to {{ ownerLabel }}.
          </p>
          <div
            v-else
            class="space-y-3"
          >
            <UButton
              type="button"
              class="min-h-11 w-full justify-center sm:w-auto"
              variant="outline"
              icon="i-lucide-map-pin"
              data-research-load-listing
              :loading="lookupStatus === 'loading'"
              :disabled="!businessId || lookupStatus === 'loading'"
              @click="lookupPlace()"
            >
              Load Google listing
            </UButton>
            <p
              v-if="!businessId"
              class="text-sm text-muted"
            >
              This lead is not linked to a business record, so the Google listing cannot be matched here.
            </p>
            <p
              v-if="lookupMessage"
              class="text-sm text-muted"
              data-research-lookup-message
            >
              {{ lookupMessage }}
            </p>
            <ListingMatchList
              :matches="matches"
              :confirming-id="confirmingId"
              :loading="lookupStatus === 'loading'"
              @select="lookupPlace($event.placeId)"
            />
          </div>
          <UFormField
            v-if="googleId"
            label="Notes (optional)"
          >
            <UTextarea
              v-model="notes"
              class="w-full"
              :rows="3"
              :maxlength="2000"
              placeholder="Anything the report should pay attention to."
              data-research-notes
            />
          </UFormField>
          <p
            v-if="errorMessage"
            class="text-sm text-error"
            data-research-error
          >
            {{ errorMessage }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            type="button"
            variant="outline"
            :disabled="submitting"
            @click="open = false"
          >
            Cancel
          </UButton>
          <UButton
            v-if="googleId"
            type="button"
            data-research-confirm
            icon="i-lucide-file-search"
            :loading="submitting"
            :disabled="submitting || status === 'requested'"
            @click="requestReport"
          >
            Request research report
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
