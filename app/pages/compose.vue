<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const toast = useToast()

const draftId = route.query.draft as string | undefined
const businessId = route.query.business as string | undefined

const isGenerating = ref(false)
const isSending = ref(false)
const isSavingDraft = ref(false)

const activeTab = ref<'preview' | 'edit'>('preview')
const subject = ref('')
const bodyText = ref('')
const bodyHtml = ref('')
const emailTo = ref('')
const customPrompt = ref('')
const businessName = ref('')
const businessData = ref<any>(null)
const auditData = ref<any>(null)
const aiGenerated = ref(false)

const editedSubject = ref('')
const editedBody = ref('')

const previewFrame = ref<HTMLIFrameElement | null>(null)

function loadPreviewContent() {
  if (!previewFrame.value) return
  if (!bodyHtml.value) return
  
  const doc = previewFrame.value.contentDocument
  if (!doc) return
  
  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #1a1a1a;
          background: #ffffff;
          padding: 2rem;
          margin: 0;
        }
        p { margin-bottom: 1rem; }
        strong { font-weight: 600; }
        a { color: #8b5cf6; text-decoration: underline; }
        ul, ol { margin-left: 1.5rem; margin-bottom: 1rem; }
        li { margin-bottom: 0.5rem; }
        h1, h2, h3, h4, h5, h6 { font-weight: 600; margin-bottom: 0.5rem; }
      </style>
    </head>
    <body>
      ${bodyHtml.value}
    </body>
    </html>
  `)
  doc.close()
}

// Load preview when bodyHtml changes
watch(() => bodyHtml.value, () => {
  if (activeTab.value === 'preview' && previewFrame.value) {
    setTimeout(() => loadPreviewContent(), 100)
  }
})

// Load preview when switching to preview tab
watch(() => activeTab.value, (newTab) => {
  if (newTab === 'preview') {
    setTimeout(() => loadPreviewContent(), 100)
  }
})

// Initial load on mount if already in preview
onMounted(() => {
  if (activeTab.value === 'preview' && bodyHtml.value) {
    setTimeout(() => loadPreviewContent(), 200)
  }
})

// Load draft if draftId is provided
onMounted(async () => {
  if (draftId) {
    await loadDraft()
  } else if (businessId) {
    await loadBusiness()
  }
})

async function loadDraft() {
  try {
    const response = await $fetch(`/api/drafts/${draftId}`)
    if (response.success && response.draft) {
      subject.value = response.draft.subject
      bodyText.value = response.draft.bodyText
      bodyHtml.value = response.draft.bodyHtml || ''
      emailTo.value = response.draft.emailTo || ''
      customPrompt.value = response.draft.customPrompt || ''
      businessName.value = response.draft.businessName || ''
      aiGenerated.value = response.draft.aiGenerated
      
      // Initialize edited versions
      editedSubject.value = response.draft.subject
      editedBody.value = response.draft.bodyText
      
      // If there's content, show preview
      if (bodyHtml.value) {
        activeTab.value = 'preview'
      }
    }
  } catch (error) {
    toast.add({
      title: 'Failed to load draft',
      color: 'error'
    })
  }
}

async function loadBusiness() {
  try {
    const response = await $fetch(`/api/businesses/${businessId}`)
    if (response.success && response.business) {
      emailTo.value = response.business.email || ''
      businessName.value = response.business.name
      businessData.value = response.business
      
      // Load audit data if available
      if (response.business.audit) {
        auditData.value = response.business.audit
      }
    }
  } catch (error) {
    toast.add({
      title: 'Failed to load business',
      color: 'error'
    })
  }
}

async function generateWithAI() {
  if (!businessId) {
    toast.add({
      title: 'Cannot generate',
      description: 'Business ID is required for AI generation',
      color: 'warning'
    })
    return
  }

  isGenerating.value = true
  try {
    const response = await $fetch('/api/emails/generate', {
      method: 'POST',
      body: {
        businessId,
        customPrompt: customPrompt.value || undefined
      }
    })

    if (response.success && response.email) {
      subject.value = response.email.subject
      bodyText.value = response.email.bodyText
      bodyHtml.value = response.email.bodyHtml
      
      // Initialize edited versions
      editedSubject.value = response.email.subject
      editedBody.value = response.email.bodyText
      
      aiGenerated.value = true
      activeTab.value = 'preview'
      
      toast.add({
        title: 'Email Generated',
        description: 'AI has generated a personalized email for you',
        color: 'success'
      })
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

function regenerateEmail() {
  generateWithAI()
}

async function saveAsDraft() {
  const currentSubject = activeTab.value === 'edit' ? editedSubject.value : subject.value
  const currentBody = activeTab.value === 'edit' ? editedBody.value : bodyText.value
  
  if (!currentSubject || !currentBody) {
    toast.add({
      title: 'Cannot save',
      description: 'Subject and body are required',
      color: 'warning'
    })
    return
  }

  isSavingDraft.value = true
  try {
    const currentBodyHtml = activeTab.value === 'edit' 
      ? editedBody.value.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')
      : bodyHtml.value

    const response = await $fetch('/api/drafts', {
      method: 'POST',
      body: {
        id: draftId,
        businessId,
        emailTo: emailTo.value,
        subject: currentSubject,
        bodyText: currentBody,
        bodyHtml: currentBodyHtml,
        aiGenerated: aiGenerated.value,
        customPrompt: customPrompt.value
      }
    })

    toast.add({
      title: 'Draft Saved',
      description: response.message,
      color: 'success'
    })

    // Update URL with draft ID if it's a new draft
    if (response.draftId && !draftId) {
      router.replace({ query: { ...route.query, draft: response.draftId } })
    }
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

async function sendEmail() {
  if (!businessId) {
    toast.add({
      title: 'Cannot send',
      description: 'Business ID is required',
      color: 'warning'
    })
    return
  }

  const currentSubject = activeTab.value === 'edit' ? editedSubject.value : subject.value
  const currentBody = activeTab.value === 'edit' ? editedBody.value : bodyText.value
  
  if (!currentSubject || !currentBody) {
    toast.add({
      title: 'Cannot send',
      description: 'Subject and body are required',
      color: 'warning'
    })
    return
  }

  isSending.value = true
  try {
    const currentBodyHtml = activeTab.value === 'edit' 
      ? editedBody.value.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')
      : bodyHtml.value

    await $fetch('/api/outreach/send', {
      method: 'POST',
      body: {
        businessId,
        generatedBody: currentBodyHtml,
        customSubject: currentSubject,
        aiGenerated: aiGenerated.value
      }
    })

    toast.add({
      title: 'Email Sent',
      description: 'Your email has been sent successfully',
      color: 'success'
    })

    // Delete draft if it exists
    if (draftId) {
      await $fetch(`/api/drafts/${draftId}`, { method: 'DELETE' })
    }

    router.push('/inbox')
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

async function deleteDraft() {
  if (!draftId) return

  try {
    await $fetch(`/api/drafts/${draftId}`, { method: 'DELETE' })
    toast.add({
      title: 'Draft Deleted',
      color: 'success'
    })
    router.push('/inbox')
  } catch (error) {
    toast.add({
      title: 'Failed to delete draft',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="h-full min-h-0 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="border-b border-default bg-muted px-4 sm:px-6 py-4 flex-shrink-0">
      <div class="flex flex-wrap items-center justify-between gap-y-3">
        <div class="flex flex-wrap items-center gap-2 sm:gap-4">
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            @click="router.push('/inbox')"
          >
            Back to Inbox
          </UButton>
          
          <div class="hidden sm:block h-6 w-px bg-default" />
          
          <h1 class="font-display text-xl font-semibold tracking-tight">
            {{ draftId ? 'Edit Draft' : 'Compose Email' }}
          </h1>
          
          <UBadge v-if="businessName" variant="soft">
            {{ businessName }}
          </UBadge>
          
          <UBadge v-if="aiGenerated" color="primary" variant="soft">
            <UIcon name="i-lucide-sparkles" class="mr-1" />
            AI Generated
          </UBadge>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="draftId"
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            @click="deleteDraft"
          >
            Delete Draft
          </UButton>

          <UButton
            v-if="businessId && aiGenerated"
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
            Save Draft
          </UButton>

          <UButton
            icon="i-lucide-send"
            color="primary"
            @click="sendEmail"
            :loading="isSending"
            :disabled="isGenerating || !businessId"
          >
            Send Email
          </UButton>
        </div>
      </div>
    </div>

    <!-- Editor Body -->
    <div class="flex-1 overflow-y-auto bg-default">
      <div class="max-w-6xl mx-auto py-6 px-4 sm:py-8 sm:px-6 space-y-6">
        <!-- AI Generation Section -->
        <UCard v-if="businessId && !bodyHtml">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-sparkles" class="text-primary text-xl" />
              <h3 class="font-semibold">AI Email Generator</h3>
            </div>
          </template>

          <div class="space-y-4">
            <div class="p-4 bg-primary/10 rounded-lg">
              <p class="text-sm">
                <UIcon name="i-lucide-info" class="inline mr-1" />
                Generate a personalized, professional email based on the business's website audit and information.
              </p>
            </div>

            <div>
              <label class="text-sm font-medium mb-2 block">
                <UIcon name="i-lucide-message-square" class="inline mr-1" />
                Custom Instructions (Optional)
              </label>
              <UTextarea
                v-model="customPrompt"
                placeholder="e.g., 'Make it more casual and friendly', 'Focus on mobile performance issues', 'Emphasize their good reviews', 'Keep it brief and to the point'..."
                :rows="3"
                class="w-full"
              />
              <p class="text-xs text-muted mt-2">
                Give the AI specific directions to customize the tone, focus, or style of the email.
              </p>
            </div>

            <div class="flex gap-3">
              <UButton
                icon="i-lucide-wand-2"
                size="lg"
                @click="generateWithAI"
                :loading="isGenerating"
                :disabled="isSending"
              >
                {{ subject || bodyText ? 'Regenerate with AI' : 'Generate Personalized Email' }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Email Editor -->
        <UCard v-if="bodyHtml || editedBody">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-y-2">
              <div class="flex flex-wrap items-center gap-2 sm:gap-4">
                <h3 class="font-semibold">Email Editor</h3>
                
                <!-- Tab Switcher -->
                <div class="flex gap-1 bg-elevated p-1 rounded-lg">
                  <button
                    @click="activeTab = 'preview'"
                    :class="[
                      'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                      activeTab === 'preview'
                        ? 'bg-accented text-primary'
                        : 'text-muted hover:text-default'
                    ]"
                  >
                    <UIcon name="i-lucide-eye" class="mr-1" />
                    Preview
                  </button>
                  <button
                    @click="activeTab = 'edit'"
                    :class="[
                      'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                      activeTab === 'edit'
                        ? 'bg-accented text-primary'
                        : 'text-muted hover:text-default'
                    ]"
                  >
                    <UIcon name="i-lucide-pencil" class="mr-1" />
                    Edit
                  </button>
                </div>
              </div>

                <!-- Prompt Input (in header for easy access) -->
                <div v-if="businessId && aiGenerated" class="flex items-center gap-2 max-w-lg">
                  <UInput
                    v-model="customPrompt"
                    placeholder="Suggest changes to AI..."
                    class="text-sm flex-1"
                    size="sm"
                    @keyup.enter="generateWithAI"
                  />
                  <UButton
                    icon="i-lucide-wand-2"
                    size="sm"
                    color="primary"
                    @click="generateWithAI"
                    :loading="isGenerating"
                    :disabled="!customPrompt.trim()"
                  >
                    Apply
                  </UButton>
                </div>
            </div>
          </template>

          <!-- Preview Tab -->
          <div v-if="activeTab === 'preview'" class="space-y-6">
            <!-- Email Metadata -->
            <div class="space-y-3 pb-4 border-b border-default">
              <div class="flex items-center gap-2 text-sm">
                <span class="font-medium text-muted w-16">To:</span>
                <span class="font-medium">{{ emailTo || 'No recipient' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-muted text-sm w-16">Subject:</span>
                <span class="font-semibold text-lg">{{ subject }}</span>
              </div>
            </div>

            <!-- Email Preview (white document inside dark chrome) -->
            <div class="rounded-lg bg-elevated p-3">
              <p class="eyebrow mb-2">Email Preview</p>
              <div class="rounded-md overflow-hidden bg-white shadow-inner ring-1 ring-default">
                <iframe
                  ref="previewFrame"
                  class="w-full border-0"
                  style="min-height: 600px;"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            <!-- Audit Summary (if available) -->
            <div v-if="auditData" class="p-4 bg-elevated rounded-lg">
              <h4 class="text-sm font-semibold mb-3 flex items-center gap-2">
                <UIcon name="i-lucide-gauge" />
                Website Audit Scores Referenced
              </h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold" :class="auditData.performance_score >= 90 ? 'text-success' : auditData.performance_score >= 50 ? 'text-warning' : 'text-error'">
                    {{ auditData.performance_score }}
                  </div>
                  <div class="text-xs text-muted">Performance</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold" :class="auditData.accessibility_score >= 90 ? 'text-success' : auditData.accessibility_score >= 50 ? 'text-warning' : 'text-error'">
                    {{ auditData.accessibility_score }}
                  </div>
                  <div class="text-xs text-muted">Accessibility</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold" :class="auditData.best_practices_score >= 90 ? 'text-success' : auditData.best_practices_score >= 50 ? 'text-warning' : 'text-error'">
                    {{ auditData.best_practices_score }}
                  </div>
                  <div class="text-xs text-muted">Best Practices</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold" :class="auditData.seo_score >= 90 ? 'text-success' : auditData.seo_score >= 50 ? 'text-warning' : 'text-error'">
                    {{ auditData.seo_score }}
                  </div>
                  <div class="text-xs text-muted">SEO</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Edit Tab -->
          <div v-if="activeTab === 'edit'" class="space-y-6">
            <div>
              <label class="text-sm font-medium text-muted mb-2 block">
                <UIcon name="i-lucide-text-cursor" class="inline mr-1" />
                Subject Line
              </label>
              <UInput
                v-model="editedSubject"
                placeholder="Email subject"
                class="w-full text-lg"
                size="lg"
              />
            </div>

            <div>
              <label class="text-sm font-medium text-muted mb-2 block">
                <UIcon name="i-lucide-file-text" class="inline mr-1" />
                Email Body
              </label>
              <UTextarea
                v-model="editedBody"
                placeholder="Write your email message here..."
                :rows="24"
                class="w-full font-sans"
              />
              <p class="text-xs text-muted mt-2 flex items-center gap-1">
                <UIcon name="i-lucide-info" class="inline" />
                Use double line breaks for paragraphs. Plain text will be automatically formatted to HTML.
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No additional styles needed - iframe handles isolation */
</style>


