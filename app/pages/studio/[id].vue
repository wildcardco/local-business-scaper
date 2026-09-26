<script setup lang="ts">
import { upload } from '@imagekit/vue'

const route = useRoute()
const toast = useToast()
const config = useRuntimeConfig()
const { open: openGenerateModal, postGenerateMockup } = useGenerateMockup()
const id = computed(() => String(route.params.id))

const { data, pending, refresh } = await useFetch(() => `/api/mockups/${id.value}`)
const mockup = computed(() => data.value?.mockup)

const notes = ref('')
const isGenerating = ref(false)
const isRevising = ref(false)
const isPitching = ref(false)
const isUploading = ref(false)

const busy = computed(() =>
  ['generating', 'writing_pitch', 'enhancing', 'revising'].includes(mockup.value?.status || '')
)

let pollTimer: ReturnType<typeof setInterval> | null = null

watch(busy, (isBusy) => {
  if (!import.meta.client) return
  if (isBusy) startPoll()
  else stopPoll()
})

onMounted(() => {
  if (busy.value) startPoll()
})

onUnmounted(() => stopPoll())

watch(() => mockup.value?.status, (status, previous) => {
  if (status === 'failed' && previous && previous !== 'failed') {
    toast.add({
      title: 'n8n did not finish',
      description: mockup.value?.lastFeedback || 'The factory stopped before a mockup was ready',
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

function startPoll() {
  if (pollTimer) return
  pollTimer = setInterval(() => refresh(), 8000)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function generate() {
  if (mockup.value?.businessId) {
    openGenerateModal(mockup.value.businessId)
    return
  }

  isGenerating.value = true
  try {
    const result = await postGenerateMockup({ mockupId: id.value })
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
  isRevising.value = true
  try {
    const result = await $fetch(`/api/mockups/${id.value}/revise`, {
      method: 'POST',
      body: { notes: notes.value }
    })
    toast.add({
      title: result.warning ? 'Feedback sent with a warning' : 'Feedback sent',
      description: result.warning || 'n8n is revising this mockup.',
      color: result.warning ? 'warning' : 'success'
    })
    notes.value = ''
    await refresh()
  } catch (error: unknown) {
    toast.add({
      title: 'Feedback failed',
      description: readError(error, 'n8n did not accept the revision.'),
      color: 'error'
    })
  } finally {
    isRevising.value = false
  }
}

async function writePitch() {
  isPitching.value = true
  try {
    await $fetch(`/api/mockups/${id.value}/pitch`, { method: 'POST' })
    toast.add({ title: 'Pitch writer started', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    toast.add({
      title: 'Pitch failed',
      description: readError(error, 'n8n did not accept the pitch request.'),
      color: 'error'
    })
  } finally {
    isPitching.value = false
  }
}

async function handlePhotoUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.add({ title: 'Upload an image file', color: 'error' })
    return
  }
  isUploading.value = true
  try {
    const authResponse = await $fetch('/api/imagekit/auth')
    const result = await upload({
      file,
      fileName: `studio-${id.value}-${Date.now()}.${file.name.split('.').pop()}`,
      folder: '/studio',
      useUniqueFileName: true,
      publicKey: config.public.imageKitPublicKey,
      urlEndpoint: config.public.imageKitUrl,
      authenticator: async () => ({
        signature: authResponse.signature,
        expire: authResponse.expire,
        token: authResponse.token
      })
    })

    await $fetch(`/api/mockups/${id.value}/photos`, {
      method: 'POST',
      body: { photoUrls: [result.url] }
    })
    toast.add({ title: 'Photo added', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    toast.add({
      title: 'Photo upload failed',
      description: readError(error, 'Try again'),
      color: 'error'
    })
  } finally {
    isUploading.value = false
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
  <div class="min-w-0 space-y-6 overflow-x-hidden pb-28 sm:pb-8">
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
      <UButton
        class="min-h-11 w-full justify-center sm:w-auto"
        to="/studio"
        variant="ghost"
        icon="i-lucide-arrow-left"
      >
        All mockups
      </UButton>
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
          {{ mockup.status.replaceAll('_', ' ') }}
        </UBadge>
        <span class="text-xs text-muted">v{{ mockup.mockupVersion }}</span>
        <span
          v-if="mockup.aiModel"
          class="text-xs text-muted"
        >{{ mockup.aiModel }}</span>
      </div>

      <UAlert
        v-if="mockup.status === 'failed'"
        color="error"
        icon="i-lucide-triangle-alert"
        title="n8n did not finish"
        :description="mockup.lastFeedback || 'The factory stopped before a mockup URL came back. You can generate again.'"
      />

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
            GitHub repo appears once the business name and place id are on file.
          </p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Feedback
          </h3>
        </template>
        <UFormField
          label="Revision notes"
          help="Sends action revise_mockup to the Studio webhook. Photos still go through ImageKit."
        >
          <UTextarea
            v-model="notes"
            class="w-full"
            :rows="4"
            placeholder="Move the hero photo down, make the phone number bigger…"
          />
        </UFormField>
        <p
          v-if="mockup.lastFeedback && mockup.status !== 'failed'"
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

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UCard class="lg:col-span-2">
          <template #header>
            <h2 class="font-semibold">
              Preview
            </h2>
          </template>
          <div
            v-if="mockup.mockupUrl"
            class="space-y-3"
          >
            <iframe
              :src="mockup.mockupUrl"
              class="h-64 w-full max-w-full rounded-lg bg-white sm:h-112"
              title="Mockup preview"
            />
            <p class="break-all text-xs text-muted">
              {{ mockup.mockupUrl }}
            </p>
            <UButton
              class="min-h-11 w-full justify-center sm:w-auto"
              :to="mockup.mockupUrl"
              target="_blank"
              variant="outline"
              icon="i-lucide-external-link"
            >
              Open live mockup
            </UButton>
          </div>
          <p
            v-else
            class="text-muted text-sm"
          >
            {{ mockup.status === 'failed'
              ? 'Generation stopped. Use Generate mockup below to try again.'
              : busy
                ? 'n8n is generating this mockup. This page refreshes on its own.'
                : 'No mockup URL yet. Generate one below.' }}
          </p>
        </UCard>

        <div class="space-y-6">
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

          <UCard>
            <template #header>
              <h3 class="font-semibold">
                Photos
              </h3>
            </template>
            <div class="space-y-3">
              <div
                v-if="mockup.photoUrls.length"
                class="grid grid-cols-3 gap-2"
              >
                <img
                  v-for="url in mockup.photoUrls"
                  :key="url"
                  :src="url"
                  alt="Studio photo"
                  class="h-20 w-full object-cover rounded"
                >
              </div>
              <input
                id="studio-photo"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handlePhotoUpload"
              >
              <label for="studio-photo">
                <UButton
                  icon="i-lucide-image-plus"
                  variant="outline"
                  :loading="isUploading"
                  as="span"
                  class="cursor-pointer"
                >
                  Add photo
                </UButton>
              </label>
            </div>
          </UCard>
        </div>
      </div>

      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Pitch
          </h3>
        </template>
        <div
          v-if="mockup.pitchDraft"
          class="space-y-2"
        >
          <p
            v-if="mockup.pitchSubject"
            class="font-medium"
          >
            {{ mockup.pitchSubject }}
          </p>
          <pre class="whitespace-pre-wrap text-sm text-muted font-sans">{{ mockup.pitchDraft }}</pre>
        </div>
        <p
          v-else
          class="text-sm text-muted mb-3"
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
    </template>

    <div
      class="fixed bottom-0 inset-x-0 z-20 flex justify-center p-4 sm:justify-end"
    >
      <UButton
        class="min-h-11 w-full sm:w-auto"
        size="lg"
        icon="i-lucide-sparkles"
        :loading="isGenerating"
        @click="generate"
      >
        {{ mockup?.mockupUrl ? 'Regenerate mockup' : busy ? 'Generate again' : 'Generate mockup' }}
      </UButton>
    </div>
  </div>
</template>
