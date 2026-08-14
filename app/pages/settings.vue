<script setup lang="ts">
import { upload } from '@imagekit/vue'
import {
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_MODEL,
  DEFAULT_PITCH_MAX_TOKENS,
  STUDIO_AI_MODELS,
  TOKEN_PRESETS
} from '~~/shared/studio-ai'

const toast = useToast()
const config = useRuntimeConfig()
const { user } = useUserSession()

// Form state
const companyName = ref('')
const tagline = ref('')
const logoUrl = ref('')
const senderEmail = ref('')
const senderName = ref('')
const primaryColor = ref('#D6293E')
const secondaryColor = ref('#2d1818')
const fontFamily = ref('system-ui')
const aiModel = ref(DEFAULT_AI_MODEL)
const aiMaxTokens = ref(DEFAULT_AI_MAX_TOKENS)
const pitchMaxTokens = ref(DEFAULT_PITCH_MAX_TOKENS)

const isLoading = ref(false)
const isSaving = ref(false)
const isUploading = ref(false)

// Load existing branding settings
async function loadBranding() {
  isLoading.value = true
  try {
    const response = await $fetch('/api/branding')
    if (response.success && response.branding) {
      companyName.value = response.branding.companyName || ''
      tagline.value = response.branding.tagline || ''
      logoUrl.value = response.branding.logoUrl || ''
      senderEmail.value = response.branding.senderEmail || ''
      senderName.value = response.branding.senderName || ''
      primaryColor.value = response.branding.primaryColor || '#D6293E'
      secondaryColor.value = response.branding.secondaryColor || '#2d1818'
      fontFamily.value = response.branding.fontFamily || 'system-ui'
      aiModel.value = response.branding.aiModel || DEFAULT_AI_MODEL
      aiMaxTokens.value = response.branding.aiMaxTokens || DEFAULT_AI_MAX_TOKENS
      pitchMaxTokens.value = response.branding.pitchMaxTokens || DEFAULT_PITCH_MAX_TOKENS
    }
  } catch (error) {
    console.error('Failed to load branding:', error)
  } finally {
    isLoading.value = false
  }
}

// Upload image to ImageKit
async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    toast.add({
      title: 'Invalid file type',
      description: 'Please upload an image file',
      color: 'error'
    })
    return
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.add({
      title: 'File too large',
      description: 'Please upload an image smaller than 5MB',
      color: 'error'
    })
    return
  }

  isUploading.value = true

  try {
    // Get authentication parameters from backend
    const authResponse = await $fetch('/api/imagekit/auth')
    
    // Upload file using ImageKit
    const result = await upload({
      file,
      fileName: `logo-${Date.now()}.${file.name.split('.').pop()}`,
      folder: '/branding',
      useUniqueFileName: true,
      publicKey: config.public.imageKitPublicKey,
      urlEndpoint: config.public.imageKitUrl,
      authenticator: async () => ({
        signature: authResponse.signature,
        expire: authResponse.expire,
        token: authResponse.token
      })
    })

    logoUrl.value = result.url

    toast.add({
      title: 'Image uploaded',
      description: 'Logo uploaded successfully',
      color: 'success'
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image'
    toast.add({
      title: 'Upload failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isUploading.value = false
  }
}

// Save branding settings
async function saveBranding() {
  isSaving.value = true
  try {
    const response = await $fetch('/api/branding', {
      method: 'POST',
      body: {
        companyName: companyName.value,
        tagline: tagline.value,
        logoUrl: logoUrl.value,
        senderEmail: senderEmail.value,
        senderName: senderName.value,
        primaryColor: primaryColor.value,
        secondaryColor: secondaryColor.value,
        fontFamily: fontFamily.value,
        aiModel: aiModel.value,
        aiMaxTokens: aiMaxTokens.value,
        pitchMaxTokens: pitchMaxTokens.value
      }
    })

    toast.add({
      title: 'Settings saved',
      description: response.message,
      color: 'success'
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save settings'
    toast.add({
      title: 'Save failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

const fontOptions = [
  { value: 'system-ui', label: 'System UI' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Verdana', label: 'Verdana' }
]

const modelOptions = STUDIO_AI_MODELS.map(model => ({
  value: model.value,
  label: `${model.label} — ${model.cost}`
}))

const selectedModelHint = computed(() =>
  STUDIO_AI_MODELS.find(model => model.value === aiModel.value)?.hint || ''
)

const tokenOptions = TOKEN_PRESETS.map(preset => ({
  value: preset.value,
  label: preset.label
}))

// Load branding on mount
onMounted(() => {
  loadBranding()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="font-display text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="text-muted">Manage your branding and email appearance</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-primary" />
    </div>

    <!-- Settings Form -->
    <div v-else class="max-w-3xl space-y-6">
      <!-- Account Security -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Account Security</h3>
        </template>

        <div class="space-y-4">
          <UFormField label="Account email" help="Allowlisted Wild Card email. Sign-in uses a 6-digit code sent here — there is no password.">
            <UInput
              :model-value="user?.email || ''"
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
              disabled
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Mockup AI -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Mockup AI</h3>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            Used by Studio when n8n generates HTML, research, and pitch copy. Defaults match the current factory: Fable 5 at 16k tokens for mockups, 1500 tokens for pitches.
          </p>

          <UFormField label="Claude model" :help="selectedModelHint">
            <USelect
              v-model="aiModel"
              :items="modelOptions"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Mockup max tokens" help="HTML generation is the expensive call. Lower this to save money; raise it if pages get cut off.">
            <USelect
              v-model="aiMaxTokens"
              :items="tokenOptions"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Pitch max tokens" help="Pitch emails stay short. Default is 1500, same as the current writer.">
            <UInput
              v-model.number="pitchMaxTokens"
              type="number"
              min="256"
              max="8000"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Company Information -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Company Information</h3>
        </template>

        <div class="space-y-4">
          <UFormField label="Company Name">
            <UInput
              v-model="companyName"
              placeholder="Wild Card Creative Co."
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Tagline">
            <UInput
              v-model="tagline"
              placeholder="Your Ace in Digital Success"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Email Configuration -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Email Configuration</h3>
            <a
              href="https://resend.com/docs/dashboard/emails/send-test-emails"
              target="_blank"
              class="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <UIcon name="i-lucide-external-link" />
              Verify Domain
            </a>
          </div>
        </template>

        <div class="space-y-4">
          <div class="p-4 bg-info/10 rounded-lg text-sm">
            <p class="font-medium mb-2 flex items-center gap-2">
              <UIcon name="i-lucide-info" />
              Important: Verify your email in Resend
            </p>
            <ol class="list-decimal list-inside space-y-1 text-muted">
              <li>Go to <a href="https://resend.com/domains" target="_blank" class="text-primary underline">Resend Domains</a></li>
              <li>Add your domain and verify DNS records</li>
              <li>Or add a single email for testing</li>
              <li>Enter your verified email below</li>
            </ol>
          </div>

          <UFormField label="Sender Name" help="This will appear as the sender name in recipient inboxes">
            <UInput
              v-model="senderName"
              placeholder="Wild Card Creative"
              icon="i-lucide-user"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Sender Email Address" help="Must be verified in Resend dashboard. Format: name@yourdomain.com">
            <UInput
              v-model="senderEmail"
              type="email"
              placeholder="outreach@wildcardcreativeco.com"
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Logo Upload -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Logo</h3>
        </template>

        <div class="space-y-4">
          <!-- Current Logo Preview -->
          <div v-if="logoUrl" class="flex items-center gap-4 p-4 bg-elevated rounded-lg">
            <img
              :src="logoUrl"
              alt="Company Logo"
              class="h-16 w-auto object-contain"
            />
            <div class="flex-1">
              <p class="text-sm font-medium">Current Logo</p>
              <p class="text-xs text-muted">{{ logoUrl }}</p>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="sm"
              @click="logoUrl = ''"
            >
              Remove
            </UButton>
          </div>

          <!-- Upload Button -->
          <div>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              id="logo-upload"
              @change="handleFileUpload"
            />
            <label for="logo-upload">
              <UButton
                icon="i-lucide-upload"
                :loading="isUploading"
                as="span"
                class="cursor-pointer"
              >
                {{ logoUrl ? 'Change Logo' : 'Upload Logo' }}
              </UButton>
            </label>
            <p class="text-xs text-muted mt-2">
              Recommended: PNG or SVG, max 5MB. Will be displayed at 200px width in emails.
            </p>
          </div>
        </div>
      </UCard>

      <!-- Color Scheme -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Color Scheme</h3>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Primary Color" help="Used in outbound emails only — not the dashboard UI">
            <div class="flex gap-2">
              <input
                v-model="primaryColor"
                type="color"
                class="h-10 w-16 rounded cursor-pointer"
              />
              <UInput
                v-model="primaryColor"
                placeholder="#D6293E"
                size="lg"
                class="flex-1"
              />
            </div>
          </UFormField>

          <UFormField label="Secondary Color" help="Email header and footer background">
            <div class="flex gap-2">
              <input
                v-model="secondaryColor"
                type="color"
                class="h-10 w-16 rounded cursor-pointer"
              />
              <UInput
                v-model="secondaryColor"
                placeholder="#2d1818"
                size="lg"
                class="flex-1"
              />
            </div>
          </UFormField>
        </div>
      </UCard>

      <!-- Typography -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Typography</h3>
        </template>

        <UFormField label="Font Family">
          <USelect
            v-model="fontFamily"
            :items="fontOptions"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </UCard>

      <!-- Preview -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Email Preview</h3>
        </template>

        <div class="rounded-lg bg-elevated p-3">
          <p class="eyebrow mb-2">How recipients see it</p>
          <div class="p-6 bg-white rounded-md shadow-inner ring-1 ring-default">
          <div
            class="space-y-4"
            :style="{
              fontFamily: fontFamily
            }"
          >
            <!-- Logo -->
            <div v-if="logoUrl" class="mb-6">
              <img
                :src="logoUrl"
                :alt="companyName"
                class="h-12 w-auto"
              />
            </div>

            <!-- Header -->
            <div
              class="p-6 rounded-lg"
              :style="{
                backgroundColor: secondaryColor,
                color: '#ffffff'
              }"
            >
              <h2 class="text-2xl font-bold mb-2">{{ companyName || 'Your Company Name' }}</h2>
              <p class="text-sm opacity-90">{{ tagline || 'Your tagline here' }}</p>
            </div>

            <!-- Sample Content -->
            <div class="space-y-3 text-gray-800">
              <p>Hello Business Owner,</p>
              <p>
                This is how your emails will appear to recipients. The colors, fonts, and logo will be automatically applied to all AI-generated emails.
              </p>
              <a
                :style="{ color: primaryColor }"
                class="inline-block font-semibold underline"
              >
                Sample Call-to-Action Link
              </a>
            </div>
          </div>
          </div>
        </div>
      </UCard>

      <!-- Save Button -->
      <div class="flex justify-end gap-3">
        <UButton
          variant="outline"
          @click="loadBranding"
          :disabled="isSaving"
        >
          Reset
        </UButton>
        <UButton
          icon="i-lucide-save"
          :loading="isSaving"
          @click="saveBranding"
        >
          Save Settings
        </UButton>
      </div>
    </div>
  </div>
</template>
