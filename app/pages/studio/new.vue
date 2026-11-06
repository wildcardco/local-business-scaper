<script setup lang="ts">
import { fillIntakeFields } from '~~/shared/intake-lookup'
import type { PlaceDetails } from '~~/shared/place-lookup'
import { parseWebsiteIntakeUrl } from '~~/shared/website-intake'

definePageMeta({ hidePhoneTabs: true })

const toast = useToast()
const router = useRouter()
const isSaving = ref(false)
const mode = ref<'website' | 'manual'>('website')
const confirmedHost = ref('')

const form = ref({
  name: '',
  category: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  generateNow: true,
  placeId: '',
  googleMapsUrl: '',
  zipCode: '',
  rating: null as number | null,
  reviewCount: null as number | null
})

function applyLookup(payload: {
  found: PlaceDetails
  placeId: string
  googleMapsUrl: string | null
  zipCode: string | null
  rating: number | null
  reviewCount: number | null
}) {
  form.value = fillIntakeFields(form.value, payload.found)
  form.value.placeId = payload.placeId
  if (payload.googleMapsUrl) form.value.googleMapsUrl = payload.googleMapsUrl
  if (payload.zipCode) form.value.zipCode = payload.zipCode
  if (payload.rating != null) form.value.rating = payload.rating
  if (payload.reviewCount != null) form.value.reviewCount = payload.reviewCount
}

function applyWebsite(payload: {
  found: PlaceDetails
  placeId: string
  googleMapsUrl: string | null
  zipCode: string | null
  rating: number | null
  reviewCount: number | null
  url: string
  host: string
}) {
  if (!form.value.website.trim()) form.value.website = payload.url
  applyLookup(payload)
  const saved = parseWebsiteIntakeUrl(form.value.website)
  if (!saved.ok || saved.host !== payload.host) form.value.website = payload.url
  confirmedHost.value = payload.host
}

function useWebsiteUrl(payload: { url: string, host: string }) {
  form.value.website = payload.url
  confirmedHost.value = payload.host
}

function setMode(next: 'website' | 'manual') {
  mode.value = next
  if (next === 'manual') confirmedHost.value = ''
}

async function submit() {
  const onePage = mode.value === 'website'
  if (onePage) {
    const parsed = parseWebsiteIntakeUrl(form.value.website)
    if (!parsed.ok || parsed.host !== confirmedHost.value) {
      toast.add({
        title: 'Confirm the website',
        description: parsed.ok
          ? 'Inspect this website and confirm the listing or the URL before generating.'
          : parsed.message,
        color: 'error'
      })
      return
    }
  }

  if (!form.value.name.trim()) {
    toast.add({
      title: 'Name required',
      description: onePage
        ? 'Enter the business name. The website check did not fill one in.'
        : 'Enter the business name',
      color: 'error'
    })
    return
  }

  isSaving.value = true
  try {
    const created = await $fetch('/api/businesses/manual', {
      method: 'POST',
      body: form.value
    })

    if (form.value.generateNow && created.mockup?.id) {
      await $fetch('/api/mockups/generate', {
        method: 'POST',
        body: {
          mockupId: created.mockup.id,
          ...(onePage ? { pageIntent: 'one_page' } : {})
        }
      })
    }

    toast.add({
      title: form.value.generateNow ? 'Mockup started' : 'Business saved',
      color: 'success'
    })
    router.push(`/studio/${created.mockup.id}`)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Could not create mockup',
      description: err.data?.message || 'Try again',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-28 sm:pb-6">
    <div>
      <p class="eyebrow">Studio</p>
      <h1 class="font-display text-2xl font-semibold tracking-tight">New mockup</h1>
      <p class="text-muted">Start from the current website, or enter the business yourself.</p>
    </div>

    <div
      class="flex flex-col gap-2 sm:flex-row"
      role="group"
      aria-label="How to start this mockup"
    >
      <UButton
        type="button"
        class="min-h-11 justify-center"
        data-intake-mode="website"
        :color="mode === 'website' ? 'primary' : 'neutral'"
        :variant="mode === 'website' ? 'solid' : 'outline'"
        :aria-pressed="mode === 'website'"
        @click="setMode('website')"
      >
        Current website
      </UButton>
      <UButton
        type="button"
        class="min-h-11 justify-center"
        data-intake-mode="manual"
        :color="mode === 'manual' ? 'primary' : 'neutral'"
        :variant="mode === 'manual' ? 'solid' : 'outline'"
        :aria-pressed="mode === 'manual'"
        @click="setMode('manual')"
      >
        Business details
      </UButton>
    </div>

    <UCard class="max-w-2xl">
      <form class="space-y-4" @submit.prevent="submit">
        <StudioWebsiteIntake
          v-if="mode === 'website'"
          :disabled="isSaving"
          @apply="applyWebsite"
          @use-url="useWebsiteUrl"
        />
        <UFormField label="Business name">
          <UInput v-model="form.name" size="lg" class="w-full" icon="i-lucide-building-2" />
        </UFormField>
        <UFormField label="Category">
          <UInput v-model="form.category" size="lg" class="w-full" placeholder="plumber, salon, gym…" />
        </UFormField>
        <UFormField
          v-if="mode === 'manual' || confirmedHost"
          label="Website"
        >
          <UInput v-model="form.website" size="lg" class="w-full" icon="i-lucide-globe" placeholder="https://" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Phone">
            <UInput v-model="form.phone" size="lg" class="w-full" icon="i-lucide-phone" />
          </UFormField>
          <UFormField label="Email">
            <UInput v-model="form.email" type="email" size="lg" class="w-full" icon="i-lucide-mail" />
          </UFormField>
        </div>
        <UFormField label="Street address">
          <UInput v-model="form.address" size="lg" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="City">
            <UInput v-model="form.city" size="lg" class="w-full" />
          </UFormField>
          <UFormField label="State">
            <UInput v-model="form.state" size="lg" class="w-full" />
          </UFormField>
        </div>
        <StudioIntakeLookup
          :name="form.name"
          :city="form.city"
          :state="form.state"
          :website="form.website"
          :disabled="isSaving"
          @apply="applyLookup"
        />
        <UCheckbox
          v-model="form.generateNow"
          :label="mode === 'website' ? 'Generate the one-page mockup now' : 'Generate mockup now'"
        />
      </form>
    </UCard>

    <div
      class="fixed bottom-0 inset-x-0 sm:static z-20 flex justify-center sm:justify-start p-4 sm:p-0"
    >
      <UButton
        class="min-h-11 w-full sm:w-auto"
        size="lg"
        :loading="isSaving"
        :style="{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }"
        @click="submit"
      >
        {{ form.generateNow ? (mode === 'website' ? 'Generate one-page mockup' : 'Generate mockup') : 'Save business' }}
      </UButton>
    </div>
  </div>
</template>
