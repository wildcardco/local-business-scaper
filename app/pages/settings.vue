<script setup lang="ts">
import { upload } from '@imagekit/vue'

const toast = useToast()
const config = useRuntimeConfig()

// Form state
const companyName = ref('')
const tagline = ref('')
const logoUrl = ref('')
const senderEmail = ref('')
const senderName = ref('')
const primaryColor = ref('#8b5cf6')
const secondaryColor = ref('#3b1f5c')
const fontFamily = ref('system-ui')

const isLoading = ref(false)
const isSaving = ref(false)
const isUploading = ref(false)
const isChangingPassword = ref(false)

// Password change form
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

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
      primaryColor.value = response.branding.primaryColor || '#8b5cf6'
      secondaryColor.value = response.branding.secondaryColor || '#3b1f5c'
      fontFamily.value = response.branding.fontFamily || 'system-ui'
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
        fontFamily: fontFamily.value
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

// Change password
async function changePassword() {
  // Validate passwords
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'All password fields are required',
      color: 'error'
    })
    return
  }

  if (newPassword.value.length < 8) {
    toast.add({
      title: 'Validation Error',
      description: 'New password must be at least 8 characters',
      color: 'error'
    })
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'New passwords do not match',
      color: 'error'
    })
    return
  }

  isChangingPassword.value = true
  try {
    const response = await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      }
    })

    toast.add({
      title: 'Password changed',
      description: response.message,
      color: 'success'
    })

    // Clear form
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error: any) {
    const errorMessage = error?.data?.message || error?.message || 'Failed to change password'
    toast.add({
      title: 'Password change failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isChangingPassword.value = false
  }
}

// Load branding on mount
onMounted(() => {
  loadBranding()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">Settings</h1>
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
          <div>
            <label class="text-sm font-medium mb-2 block">Current Password</label>
            <UInput
              v-model="currentPassword"
              type="password"
              placeholder="Enter current password"
              size="lg"
              autocomplete="current-password"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-2 block">New Password</label>
            <UInput
              v-model="newPassword"
              type="password"
              placeholder="Enter new password (min 8 characters)"
              size="lg"
              autocomplete="new-password"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-2 block">Confirm New Password</label>
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              size="lg"
              autocomplete="new-password"
            />
          </div>

          <div class="flex justify-end">
            <UButton
              icon="i-lucide-key"
              :loading="isChangingPassword"
              @click="changePassword"
            >
              Change Password
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Company Information -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Company Information</h3>
        </template>

        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-2 block">Company Name</label>
            <UInput
              v-model="companyName"
              placeholder="Wild Card Creative Co."
              size="lg"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-2 block">Tagline</label>
            <UInput
              v-model="tagline"
              placeholder="Your Ace in Digital Success"
              size="lg"
            />
          </div>
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

          <div>
            <label class="text-sm font-medium mb-2 block">
              <UIcon name="i-lucide-user" class="inline mr-1" />
              Sender Name
            </label>
            <UInput
              v-model="senderName"
              placeholder="Wild Card Creative"
              size="lg"
            />
            <p class="text-xs text-muted mt-1">
              This will appear as the sender name in recipient inboxes
            </p>
          </div>

          <div>
            <label class="text-sm font-medium mb-2 block">
              <UIcon name="i-lucide-mail" class="inline mr-1" />
              Sender Email Address
            </label>
            <UInput
              v-model="senderEmail"
              type="email"
              placeholder="outreach@wildcardcreativeco.com"
              size="lg"
            />
            <p class="text-xs text-muted mt-1">
              Must be verified in Resend dashboard. Format: name@yourdomain.com
            </p>
          </div>
        </div>
      </UCard>

      <!-- Logo Upload -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Logo</h3>
        </template>

        <div class="space-y-4">
          <!-- Current Logo Preview -->
          <div v-if="logoUrl" class="flex items-center gap-4 p-4 bg-surface-muted rounded-lg">
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

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-medium mb-2 block">Primary Color</label>
            <div class="flex gap-2">
              <input
                v-model="primaryColor"
                type="color"
                class="h-10 w-16 rounded cursor-pointer"
              />
              <UInput
                v-model="primaryColor"
                placeholder="#8b5cf6"
                class="flex-1"
              />
            </div>
          </div>

          <div>
            <label class="text-sm font-medium mb-2 block">Secondary Color</label>
            <div class="flex gap-2">
              <input
                v-model="secondaryColor"
                type="color"
                class="h-10 w-16 rounded cursor-pointer"
              />
              <UInput
                v-model="secondaryColor"
                placeholder="#3b1f5c"
                class="flex-1"
              />
            </div>
          </div>
        </div>
      </UCard>

      <!-- Typography -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Typography</h3>
        </template>

        <div>
          <label class="text-sm font-medium mb-2 block">Font Family</label>
          <USelect
            v-model="fontFamily"
            :options="fontOptions"
            size="lg"
          />
        </div>
      </UCard>

      <!-- Preview -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Email Preview</h3>
        </template>

        <div class="p-6 bg-white rounded-lg border border-default">
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
