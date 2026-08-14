<script setup lang="ts">
import {
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_MODEL,
  STUDIO_AI_MODELS,
  TOKEN_PRESETS
} from '~~/shared/studio-ai'

type ListingStatus = 'idle' | 'loading' | 'done' | 'skipped' | 'error'

const { businessId, close, postGenerateMockup } = useGenerateMockup()
const toast = useToast()
const router = useRouter()

const open = computed({
  get: () => !!businessId.value,
  set: (value: boolean) => {
    if (!value) close()
  }
})

const isLoading = ref(false)
const isSaving = ref(false)
const listingStatus = ref<ListingStatus>('idle')
const listingMessage = ref('')
const hasPlaceId = ref(false)

const form = ref({
  name: '',
  category: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  extraPrompt: '',
  model: DEFAULT_AI_MODEL,
  maxTokens: DEFAULT_AI_MAX_TOKENS
})

const socials = ref<{ label: string, href: string }[]>([])

const modelOptions = STUDIO_AI_MODELS.map(model => ({
  value: model.value,
  label: `${model.label} — ${model.cost}`
}))

const tokenOptions = TOKEN_PRESETS.map(preset => ({
  value: preset.value,
  label: preset.label
}))

const modelHint = computed(() =>
  STUDIO_AI_MODELS.find(model => model.value === form.value.model)?.hint || ''
)

function applyBusiness(business: Record<string, unknown> | null | undefined) {
  if (!business) return
  form.value.name = String(business.name || form.value.name)
  form.value.category = String(business.category || form.value.category)
  form.value.website = String(business.website || form.value.website || '')
  form.value.phone = String(business.phone || form.value.phone || '')
  form.value.email = String(business.email || form.value.email || '')
  form.value.address = String(business.address || form.value.address || '')
  form.value.city = String(business.city || form.value.city || '')
  form.value.state = String(business.state || form.value.state || '')
  if (business.placeId !== undefined || business.place_id !== undefined) {
    hasPlaceId.value = Boolean(business.placeId || business.place_id)
  }
  socials.value = socialLinks(business)
}

function socialLinks(source: Record<string, unknown>) {
  const contacts = (source.contactsData || source.contacts_data || {}) as Record<string, unknown>
  const entries: [string, unknown][] = [
    ['Facebook', source.facebook || contacts.facebook],
    ['Instagram', source.instagram || contacts.instagram],
    ['Yelp', source.yelp || contacts.yelp],
    ['LinkedIn', source.linkedin || contacts.linkedin],
    ['YouTube', source.youtube || contacts.youtube],
    ['TikTok', source.tiktok || contacts.tiktok],
    ['X', source.twitter || contacts.twitter]
  ]
  return entries
    .filter(([, href]) => typeof href === 'string' && href.startsWith('http'))
    .map(([label, href]) => ({ label, href: String(href) }))
}

async function refreshListing() {
  if (!businessId.value || !hasPlaceId.value) {
    listingStatus.value = 'skipped'
    listingMessage.value = 'No Google listing on file. Fill in what you have — Facebook and email are pulled from the listing/site when one exists.'
    return
  }

  listingStatus.value = 'loading'
  listingMessage.value = 'Pulling Google listing, emails, and social profiles…'
  try {
    const result = await $fetch(`/api/businesses/${businessId.value}/scrape-contacts`, {
      method: 'POST'
    })
    applyBusiness(result.business as Record<string, unknown>)
    listingStatus.value = 'done'
    listingMessage.value = result.message
  } catch (error: unknown) {
    listingStatus.value = 'error'
    const err = error as { data?: { message?: string } }
    listingMessage.value = err.data?.message || 'Could not refresh Google listing. You can still edit and generate.'
  }
}

watch(businessId, async (id) => {
  if (!id) return
  isLoading.value = true
  listingStatus.value = 'idle'
  listingMessage.value = ''
  socials.value = []
  try {
    const [biz, branding] = await Promise.all([
      $fetch(`/api/businesses/${id}`),
      $fetch('/api/branding').catch(() => ({ branding: null }))
    ])
    form.value.extraPrompt = ''
    form.value.model = branding.branding?.aiModel || DEFAULT_AI_MODEL
    form.value.maxTokens = branding.branding?.aiMaxTokens || DEFAULT_AI_MAX_TOKENS
    applyBusiness(biz.business as Record<string, unknown>)
    isLoading.value = false
    await refreshListing()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Could not load business',
      description: err.data?.message || 'Try again',
      color: 'error'
    })
    close()
  } finally {
    isLoading.value = false
  }
})

async function confirm() {
  if (!businessId.value) return
  if (!form.value.name.trim()) {
    toast.add({ title: 'Business name is required', color: 'error' })
    return
  }

  isSaving.value = true
  try {
    await $fetch(`/api/businesses/${businessId.value}`, {
      method: 'PATCH',
      body: {
        name: form.value.name,
        category: form.value.category,
        website: form.value.website || null,
        phone: form.value.phone || null,
        email: form.value.email || null,
        address: form.value.address || null,
        city: form.value.city || null,
        state: form.value.state || null
      }
    })

    const result = await postGenerateMockup({
      businessId: businessId.value,
      extraPrompt: form.value.extraPrompt.trim() || undefined,
      model: form.value.model,
      maxTokens: form.value.maxTokens
    })
    if (!result) return

    toast.add({
      title: 'Mockup started',
      description: 'Opening Studio',
      color: 'success'
    })
    const id = result.mockup?.id
    close()
    if (id) {
      router.push(`/studio/${id}`)
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Could not start mockup',
      description: err.data?.message || 'Check n8n studio webhook settings',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Generate mockup"
    description="Confirm the listing, add direction for the designer, and pick the model for this run."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div v-if="isLoading" class="flex justify-center py-10">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-primary" />
      </div>

      <div v-else class="space-y-4">
        <div class="flex items-start justify-between gap-3 rounded-lg border border-default p-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ listingStatus === 'loading' ? 'Refreshing listing' : 'Google listing' }}
            </p>
            <p class="text-xs text-muted mt-1">
              {{ listingMessage || 'Search stays cheap. This lookup runs only when you generate a mockup.' }}
            </p>
          </div>
          <UButton
            size="xs"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="listingStatus === 'loading'"
            :disabled="isSaving || !hasPlaceId"
            @click="refreshListing"
          >
            Refresh
          </UButton>
        </div>

        <UFormField label="Business name">
          <UInput v-model="form.name" size="lg" class="w-full" icon="i-lucide-building-2" />
        </UFormField>
        <UFormField label="Category">
          <UInput v-model="form.category" size="lg" class="w-full" />
        </UFormField>
        <UFormField label="Website">
          <UInput v-model="form.website" size="lg" class="w-full" icon="i-lucide-globe" placeholder="https://" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Phone">
            <UInput v-model="form.phone" size="lg" class="w-full" icon="i-lucide-phone" />
          </UFormField>
          <UFormField label="Email">
            <UInput v-model="form.email" size="lg" class="w-full" icon="i-lucide-mail" />
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

        <div v-if="socials.length" class="flex flex-wrap gap-2">
          <UButton
            v-for="social in socials"
            :key="social.href"
            :to="social.href"
            target="_blank"
            size="xs"
            variant="soft"
            color="neutral"
            trailing-icon="i-lucide-external-link"
          >
            {{ social.label }}
          </UButton>
        </div>
        <p v-else class="text-xs text-muted">
          Facebook, Instagram, and extra emails are pulled from the Google listing and its website when you refresh — not during dashboard search.
        </p>

        <UFormField label="Add to prompt" help="Optional direction for this mockup — layout, tone, photos to feature, what to avoid.">
          <UTextarea
            v-model="form.extraPrompt"
            class="w-full"
            :rows="4"
            placeholder="Make the hero a night-time storefront photo. Keep copy short. Don’t invent awards."
          />
        </UFormField>

        <UFormField label="Claude model" :help="modelHint">
          <USelect
            v-model="form.model"
            :items="modelOptions"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Max tokens" help="Lower this to save money if pages are coming out complete enough.">
          <USelect
            v-model="form.maxTokens"
            :items="tokenOptions"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="outline" :disabled="isSaving" @click="close">
          Cancel
        </UButton>
        <UButton
          icon="i-lucide-palette"
          :loading="isSaving"
          :disabled="isLoading || listingStatus === 'loading'"
          @click="confirm"
        >
          Generate mockup
        </UButton>
      </div>
    </template>
  </UModal>
</template>
