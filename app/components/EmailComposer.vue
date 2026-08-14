<script setup lang="ts">
const props = defineProps<{
  businessId: string
  templateId?: string
  mode?: 'ai' | 'template'
}>()

const emit = defineEmits<{
  close: []
  sent: []
}>()

const toast = useToast()

const activeTab = ref<'preview' | 'edit'>('preview')
const isGenerating = ref(false)
const isSending = ref(false)
const isSavingDraft = ref(false)
const customPrompt = ref('')
const draftId = ref<string | undefined>()

const email = ref<{
  subject: string
  bodyHtml: string
  bodyText: string
} | null>(null)

const editedSubject = ref('')
const editedBody = ref('')

// Generate AI email on mount if mode is AI
onMounted(async () => {
  if (props.mode === 'ai') {
    await generateEmail()
  }
})

async function generateEmail() {
  isGenerating.value = true
  try {
    const response = await $fetch('/api/emails/generate', {
      method: 'POST',
      body: {
        businessId: props.businessId,
        templateId: props.templateId,
        customPrompt: customPrompt.value || undefined
      }
    })

    if (response.success && response.email) {
      email.value = response.email
      editedSubject.value = response.email.subject
      editedBody.value = response.email.bodyText || ''
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate email'
    toast.add({
      title: 'Generation Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isGenerating.value = false
  }
}

async function sendEmail() {
  if (!email.value) return

  isSending.value = true
  try {
    // Use edited content if on edit tab, otherwise use generated
    const bodyToSend = activeTab.value === 'edit' 
      ? editedBody.value.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')
      : email.value.bodyHtml

    await $fetch('/api/outreach/send', {
      method: 'POST',
      body: {
        businessId: props.businessId,
        templateId: props.templateId,
        generatedBody: bodyToSend,
        customSubject: activeTab.value === 'edit' ? editedSubject.value : email.value.subject,
        aiGenerated: props.mode === 'ai'
      }
    })

    toast.add({
      title: 'Email Sent',
      description: 'Your email has been sent successfully',
      color: 'success'
    })

    emit('sent')
    emit('close')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send email'
    toast.add({
      title: 'Send Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isSending.value = false
  }
}

function regenerateEmail() {
  generateEmail()
}

async function saveAsDraft() {
  if (!email.value && !editedSubject.value) return

  isSavingDraft.value = true
  try {
    // Get business email if businessId is provided
    let emailTo: string | undefined
    if (props.businessId) {
      const businessRes = await $fetch(`/api/businesses/${props.businessId}`)
      emailTo = businessRes.business?.email
    }

    const response = await $fetch('/api/drafts', {
      method: 'POST',
      body: {
        id: draftId.value,
        businessId: props.businessId,
        emailTo,
        subject: activeTab.value === 'edit' ? editedSubject.value : email.value?.subject,
        bodyText: activeTab.value === 'edit' ? editedBody.value : email.value?.bodyText,
        bodyHtml: activeTab.value === 'edit' 
          ? editedBody.value.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')
          : email.value?.bodyHtml,
        aiGenerated: props.mode === 'ai',
        customPrompt: customPrompt.value
      }
    })

    if (response.draftId) {
      draftId.value = response.draftId
    }

    toast.add({
      title: 'Draft Saved',
      description: response.message,
      color: 'success'
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save draft'
    toast.add({
      title: 'Save Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isSavingDraft.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Generating State -->
    <div v-if="isGenerating" class="flex flex-col items-center justify-center py-12">
      <UIcon name="i-lucide-sparkles" class="text-4xl text-primary animate-pulse mb-4" />
      <p class="text-lg font-semibold">Generating personalized email...</p>
      <p class="text-sm text-muted">Using AI to craft the perfect message</p>
    </div>

    <!-- Generated Email -->
    <div v-else-if="email" class="space-y-4">
      <!-- Custom Prompt for Regeneration -->
      <div v-if="mode === 'ai'" class="space-y-2">
        <label class="text-sm font-medium text-muted flex items-center gap-2">
          <UIcon name="i-lucide-wand-2" class="text-primary" />
          Customize Email Generation (Optional)
        </label>
        <UTextarea
          v-model="customPrompt"
          placeholder="e.g., 'Make it more casual', 'Focus on mobile responsiveness', 'Mention their recent reviews'..."
          :rows="2"
          class="w-full text-sm"
        />
        <p class="text-xs text-muted">
          Provide specific instructions to improve the email. Leave empty for standard generation.
        </p>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 border-b border-default">
        <button
          class="px-4 py-2 font-medium transition-colors"
          :class="activeTab === 'preview' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-default'"
          @click="activeTab = 'preview'"
        >
          <UIcon name="i-lucide-eye" class="mr-2" />
          Preview
        </button>
        <button
          class="px-4 py-2 font-medium transition-colors"
          :class="activeTab === 'edit' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-default'"
          @click="activeTab = 'edit'"
        >
          <UIcon name="i-lucide-pencil" class="mr-2" />
          Edit
        </button>
      </div>

      <!-- Preview Tab -->
      <div v-if="activeTab === 'preview'" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-muted">Subject</label>
          <p class="text-lg font-semibold mt-1">{{ email.subject }}</p>
        </div>

        <div>
          <label class="text-sm font-medium text-muted mb-2 block">Email Preview</label>
          <div 
            class="border border-default rounded-lg p-6 max-h-96 overflow-y-auto email-preview"
            v-html="email.bodyHtml"
          />
        </div>
      </div>

      <!-- Edit Tab -->
      <div v-if="activeTab === 'edit'" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-muted mb-1 block">Subject</label>
          <UInput
            v-model="editedSubject"
            placeholder="Email subject"
            class="w-full"
          />
        </div>

        <div>
          <label class="text-sm font-medium text-muted mb-1 block">Email Body (Plain Text)</label>
          <UTextarea
            v-model="editedBody"
            placeholder="Email body"
            :rows="12"
            class="w-full font-mono text-sm"
          />
          <p class="text-xs text-muted mt-1">
            Paragraphs separated by blank lines will be formatted automatically
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-4 border-t border-default">
        <div class="flex gap-2">
          <UButton
            v-if="mode === 'ai'"
            icon="i-lucide-refresh-cw"
            variant="ghost"
            @click="regenerateEmail"
            :disabled="isGenerating || isSending"
          >
            Regenerate
          </UButton>
          
          <UButton
            icon="i-lucide-save"
            variant="outline"
            @click="saveAsDraft"
            :loading="isSavingDraft"
            :disabled="isGenerating || isSending"
          >
            Save as Draft
          </UButton>
        </div>
        
        <div class="flex gap-2">
          <UButton
            variant="ghost"
            @click="emit('close')"
            :disabled="isSending"
          >
            Cancel
          </UButton>
          <UButton
            icon="i-lucide-send"
            :loading="isSending"
            @click="sendEmail"
          >
            Send Email
          </UButton>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else class="flex flex-col items-center justify-center py-12">
      <UIcon name="i-lucide-alert-circle" class="text-4xl text-error mb-4" />
      <p class="text-lg font-semibold">Failed to generate email</p>
      <UButton
        class="mt-4"
        @click="generateEmail"
      >
        Try Again
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.email-preview {
  background: transparent;
  color: inherit;
}

.email-preview :deep(p) {
  margin-bottom: 1rem;
  color: inherit;
}

.email-preview :deep(a) {
  color: var(--ui-primary);
}
</style>

