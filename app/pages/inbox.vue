<script setup lang="ts">
const toast = useToast()
const router = useRouter()

// Active tab
const activeTab = ref<'sent' | 'drafts'>('sent')

// Filters
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const repliesFilter = ref<string>('all')

// Pagination
const limit = ref(50)
const offset = ref(0)

// Build query params
const queryParams = computed(() => {
  const params: Record<string, string | number> = {
    limit: limit.value,
    offset: offset.value
  }
  
  if (searchQuery.value) {
    params.search = searchQuery.value
  }
  
  if (statusFilter.value && statusFilter.value !== 'all') {
    params.status = statusFilter.value
  }
  
  if (repliesFilter.value && repliesFilter.value !== 'all') {
    params.hasReplies = repliesFilter.value
  }
  
  return params
})

// Fetch threads
const { data, pending, refresh } = await useFetch('/api/inbox/threads', {
  query: queryParams,
  watch: [queryParams]
})

const threads = computed(() => data.value?.threads || [])
const pagination = computed(() => data.value?.pagination)

// Fetch drafts
const { data: draftsData, pending: draftsPending, refresh: refreshDrafts } = await useFetch('/api/drafts', {
  query: { limit: 50, offset: 0 }
})

const drafts = computed(() => draftsData.value?.drafts || [])
const draftsPagination = computed(() => draftsData.value?.pagination)

// Selected thread for modal
const selectedThreadId = ref<string | null>(null)
const showThreadModal = ref(false)

function openThread(threadId: string) {
  selectedThreadId.value = threadId
  showThreadModal.value = true
}

function closeThreadModal() {
  showThreadModal.value = false
  selectedThreadId.value = null
  refresh()
}

// Draft Editor State
const showDraftEditor = ref(false)
const editorTab = ref<'preview' | 'edit'>('preview')
const currentDraftId = ref<string | null>(null)
const isGenerating = ref(false)
const isSending = ref(false)
const isSavingDraft = ref(false)

const draftSubject = ref('')
const draftBodyText = ref('')
const draftBodyHtml = ref('')
const draftEmailTo = ref('')
const draftCustomPrompt = ref('')
const draftBusinessName = ref('')
const draftBusinessId = ref<string | null>(null)
const draftAiGenerated = ref(false)
const businessData = ref<any>(null)
const auditData = ref<any>(null)

const editedSubject = ref('')
const editedBody = ref('')

const previewFrame = ref<HTMLIFrameElement | null>(null)

function loadPreviewContent() {
  if (!previewFrame.value) {
    console.log('No preview frame ref')
    return
  }
  
  if (!draftBodyHtml.value) {
    console.log('No body HTML')
    return
  }
  
  const doc = previewFrame.value.contentDocument
  if (!doc) {
    console.log('No content document')
    return
  }
  
  console.log('Loading preview content...')
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
      ${draftBodyHtml.value}
    </body>
    </html>
  `)
  doc.close()
  console.log('Preview content loaded')
}

// Load preview when bodyHtml changes
watch(() => draftBodyHtml.value, () => {
  if (editorTab.value === 'preview' && previewFrame.value) {
    setTimeout(() => loadPreviewContent(), 100)
  }
})

// Load preview when switching to preview tab
watch(() => editorTab.value, (newTab) => {
  if (newTab === 'preview') {
    setTimeout(() => loadPreviewContent(), 100)
  }
})

// Watch for when draft editor becomes visible
watch(() => showDraftEditor.value, (isVisible) => {
  if (isVisible && editorTab.value === 'preview' && draftBodyHtml.value) {
    // Wait for iframe to be in DOM
    setTimeout(() => loadPreviewContent(), 300)
  }
})

// Initial load on mount if already in preview
onMounted(() => {
  if (editorTab.value === 'preview' && draftBodyHtml.value) {
    setTimeout(() => loadPreviewContent(), 200)
  }
})

function composenew() {
  // Reset editor state
  currentDraftId.value = null
  draftSubject.value = ''
  draftBodyText.value = ''
  draftBodyHtml.value = ''
  draftEmailTo.value = ''
  draftCustomPrompt.value = ''
  draftBusinessName.value = ''
  draftBusinessId.value = null
  draftAiGenerated.value = false
  businessData.value = null
  auditData.value = null
  editedSubject.value = ''
  editedBody.value = ''
  editorTab.value = 'preview'
  
  showDraftEditor.value = true
  activeTab.value = 'drafts'
}

async function openDraft(draftId: string) {
  try {
    const response = await $fetch(`/api/drafts/${draftId}`)
    if (response.success && response.draft) {
      currentDraftId.value = draftId
      draftSubject.value = response.draft.subject
      draftBodyText.value = response.draft.bodyText
      draftBodyHtml.value = response.draft.bodyHtml || ''
      draftEmailTo.value = response.draft.emailTo || ''
      draftCustomPrompt.value = response.draft.customPrompt || ''
      draftBusinessName.value = response.draft.businessName || ''
      draftBusinessId.value = response.draft.businessId
      draftAiGenerated.value = response.draft.aiGenerated
      
      editedSubject.value = response.draft.subject
      editedBody.value = response.draft.bodyText
      
      // Load business data if available
      if (response.draft.businessId) {
        const businessRes = await $fetch(`/api/businesses/${response.draft.businessId}`)
        if (businessRes.success && businessRes.business) {
          businessData.value = businessRes.business
          auditData.value = businessRes.business.audit
        }
      }
      
      editorTab.value = draftBodyHtml.value ? 'preview' : 'edit'
      showDraftEditor.value = true
    }
  } catch (error) {
    toast.add({
      title: 'Failed to load draft',
      color: 'error'
    })
  }
}

function closeDraftEditor() {
  showDraftEditor.value = false
  currentDraftId.value = null
  refreshDrafts()
}

async function generateWithAI() {
  if (!draftBusinessId.value) {
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
        businessId: draftBusinessId.value,
        customPrompt: draftCustomPrompt.value || undefined
      }
    })

    if (response.success && response.email) {
      draftSubject.value = response.email.subject
      draftBodyText.value = response.email.bodyText
      draftBodyHtml.value = response.email.bodyHtml
      
      editedSubject.value = response.email.subject
      editedBody.value = response.email.bodyText
      
      draftAiGenerated.value = true
      editorTab.value = 'preview'
      
      toast.add({
        title: 'Email Generated',
        description: 'AI has generated a personalized email',
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

async function saveCurrentDraft() {
  const currentSubject = editorTab.value === 'edit' ? editedSubject.value : draftSubject.value
  const currentBody = editorTab.value === 'edit' ? editedBody.value : draftBodyText.value
  
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
    const currentBodyHtml = editorTab.value === 'edit' 
      ? editedBody.value.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')
      : draftBodyHtml.value

    const response = await $fetch('/api/drafts', {
      method: 'POST',
      body: {
        id: currentDraftId.value,
        businessId: draftBusinessId.value,
        emailTo: draftEmailTo.value,
        subject: currentSubject,
        bodyText: currentBody,
        bodyHtml: currentBodyHtml,
        aiGenerated: draftAiGenerated.value,
        customPrompt: draftCustomPrompt.value
      }
    })

    if (response.draftId && !currentDraftId.value) {
      currentDraftId.value = response.draftId
    }

    toast.add({
      title: 'Draft Saved',
      description: response.message,
      color: 'success'
    })
    
    refreshDrafts()
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

async function sendDraftEmail() {
  if (!draftBusinessId.value) {
    toast.add({
      title: 'Cannot send',
      description: 'Business ID is required',
      color: 'warning'
    })
    return
  }

  const currentSubject = editorTab.value === 'edit' ? editedSubject.value : draftSubject.value
  const currentBody = editorTab.value === 'edit' ? editedBody.value : draftBodyText.value
  
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
    const currentBodyHtml = editorTab.value === 'edit' 
      ? editedBody.value.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')
      : draftBodyHtml.value

    await $fetch('/api/outreach/send', {
      method: 'POST',
      body: {
        businessId: draftBusinessId.value,
        generatedBody: currentBodyHtml,
        customSubject: currentSubject,
        aiGenerated: draftAiGenerated.value
      }
    })

    toast.add({
      title: 'Email Sent',
      description: 'Your email has been sent successfully',
      color: 'success'
    })

    // Delete draft if it exists
    if (currentDraftId.value) {
      await $fetch(`/api/drafts/${currentDraftId.value}`, { method: 'DELETE' })
    }

    closeDraftEditor()
    activeTab.value = 'sent'
    refresh()
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

async function deleteDraft(draftId: string, event: Event) {
  event.stopPropagation()
  
  try {
    await $fetch(`/api/drafts/${draftId}`, { method: 'DELETE' })
    toast.add({
      title: 'Draft Deleted',
      color: 'success'
    })
    refreshDrafts()
  } catch (error) {
    toast.add({
      title: 'Failed to delete draft',
      color: 'error'
    })
  }
}

async function deleteCurrentDraft() {
  if (!currentDraftId.value) return
  
  try {
    await $fetch(`/api/drafts/${currentDraftId.value}`, { method: 'DELETE' })
    toast.add({
      title: 'Draft Deleted',
      color: 'success'
    })
    closeDraftEditor()
  } catch (error) {
    toast.add({
      title: 'Failed to delete draft',
      color: 'error'
    })
  }
}

// Format date helper
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

// Status badge color
function getStatusColor(status: string): string {
  switch (status) {
    case 'sent': return 'neutral'
    case 'delivered': return 'primary'
    case 'opened': return 'info'
    case 'clicked': return 'success'
    case 'replied': return 'success'
    case 'bounced': return 'error'
    case 'complained': return 'error'
    default: return 'neutral'
  }
}

// Pagination handlers
function nextPage() {
  if (pagination.value?.hasMore) {
    offset.value += limit.value
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit.value)
  }
}

// Status filter options
const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'replied', label: 'Replied' },
  { value: 'bounced', label: 'Bounced' }
]

const repliesOptions = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Replies' },
  { value: 'false', label: 'No Replies' }
]
</script>

<template>
  <div class="h-full min-h-0 flex flex-col overflow-hidden">
    <!-- Draft Editor (Full Width when open) -->
    <div v-if="showDraftEditor" class="flex-1 flex flex-col overflow-hidden">
      <!-- Editor Header -->
      <div class="border-b border-default bg-muted px-4 sm:px-6 py-4 flex-shrink-0">
        <div class="flex flex-wrap items-center justify-between gap-y-3">
          <div class="flex flex-wrap items-center gap-2 sm:gap-4">
            <UButton
              icon="i-lucide-arrow-left"
              variant="ghost"
              @click="closeDraftEditor"
            >
              Back to Inbox
            </UButton>
            
            <div class="hidden sm:block h-6 w-px bg-default" />
            
            <h1 class="font-display text-xl font-semibold tracking-tight">
              {{ currentDraftId ? 'Edit Draft' : 'Compose Email' }}
            </h1>
            
            <UBadge v-if="draftBusinessName" variant="soft">
              {{ draftBusinessName }}
            </UBadge>
            
            <UBadge v-if="draftAiGenerated" color="primary" variant="soft">
              <UIcon name="i-lucide-sparkles" class="mr-1" />
              AI Generated
            </UBadge>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="currentDraftId"
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              @click="deleteCurrentDraft"
            >
              Delete Draft
            </UButton>

            <UButton
              v-if="draftBusinessId && draftAiGenerated"
              icon="i-lucide-refresh-cw"
              variant="ghost"
              @click="generateWithAI"
              :disabled="isGenerating || isSending"
            >
              Regenerate
            </UButton>

            <UButton
              icon="i-lucide-save"
              variant="outline"
              @click="saveCurrentDraft"
              :loading="isSavingDraft"
              :disabled="isGenerating || isSending"
            >
              Save Draft
            </UButton>

            <UButton
              icon="i-lucide-send"
              color="primary"
              @click="sendDraftEmail"
              :loading="isSending"
              :disabled="isGenerating || !draftBusinessId"
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
          <UCard v-if="draftBusinessId && !draftBodyHtml">
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
                  v-model="draftCustomPrompt"
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
                  {{ draftSubject || draftBodyText ? 'Regenerate with AI' : 'Generate Personalized Email' }}
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- Email Editor -->
          <UCard v-if="draftBodyHtml || editedBody">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-y-2">
                <div class="flex flex-wrap items-center gap-2 sm:gap-4">
                  <h3 class="font-semibold">Email Editor</h3>
                  
                  <!-- Tab Switcher -->
                  <div class="flex gap-1 bg-elevated p-1 rounded-lg">
                    <button
                      @click="editorTab = 'preview'"
                      :class="[
                        'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                        editorTab === 'preview'
                          ? 'bg-accented text-primary'
                          : 'text-muted hover:text-default'
                      ]"
                    >
                      <UIcon name="i-lucide-eye" class="mr-1" />
                      Preview
                    </button>
                    <button
                      @click="editorTab = 'edit'"
                      :class="[
                        'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                        editorTab === 'edit'
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
              <div v-if="draftBusinessId && draftAiGenerated" class="flex items-center gap-2 max-w-lg">
                <UInput
                  v-model="draftCustomPrompt"
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
                  :disabled="!draftCustomPrompt.trim()"
                >
                  Apply
                </UButton>
              </div>
              </div>
            </template>

            <!-- Preview Tab -->
            <div v-if="editorTab === 'preview'" class="space-y-6">
              <!-- Email Metadata -->
              <div class="space-y-3 pb-4 border-b border-default">
                <div class="flex items-center gap-2 text-sm">
                  <span class="font-medium text-muted w-16">To:</span>
                  <span class="font-medium">{{ draftEmailTo || 'No recipient' }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-muted text-sm w-16">Subject:</span>
                  <span class="font-semibold text-lg">{{ draftSubject }}</span>
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
            <div v-if="editorTab === 'edit'" class="space-y-6">
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

    <!-- Inbox View (when editor is closed) -->
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto p-6">
        <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-display text-2xl font-semibold tracking-tight">Inbox</h1>
        <p class="text-muted">Track sent emails, drafts, and replies from businesses</p>
      </div>
      
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-pencil"
          color="primary"
          @click="composenew"
        >
          Compose
        </UButton>
        
        <UButton
          icon="i-lucide-refresh-cw"
          variant="ghost"
          @click="activeTab === 'sent' ? refresh() : refreshDrafts()"
          :disabled="pending || draftsPending"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 border-b border-default">
      <button
        class="px-4 py-3 font-medium transition-colors relative"
        :class="activeTab === 'sent' ? 'text-primary' : 'text-muted hover:text-default'"
        @click="activeTab = 'sent'"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-send" />
          Sent Emails
          <UBadge v-if="pagination" size="xs" variant="soft">
            {{ pagination.total }}
          </UBadge>
        </div>
        <div
          v-if="activeTab === 'sent'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
        />
      </button>
      
      <button
        class="px-4 py-3 font-medium transition-colors relative"
        :class="activeTab === 'drafts' ? 'text-primary' : 'text-muted hover:text-default'"
        @click="activeTab = 'drafts'"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-file-edit" />
          Drafts
          <UBadge v-if="draftsPagination" size="xs" variant="soft">
            {{ draftsPagination.total }}
          </UBadge>
        </div>
        <div
          v-if="activeTab === 'drafts'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
        />
      </button>
    </div>

    <!-- Filters (only for sent emails) -->
    <UCard v-if="activeTab === 'sent'">
      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-62.5">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search by business, subject, or email..."
            size="md"
            class="w-full"
          />
        </div>
        
        <USelect
          v-model="statusFilter"
          :items="statusOptions"
          placeholder="Filter by status"
          size="md"
          class="w-40"
        />
        
        <USelect
          v-model="repliesFilter"
          :items="repliesOptions"
          placeholder="Filter by replies"
          size="md"
          class="w-40"
        />
      </div>
    </UCard>

    <!-- Sent Emails Tab -->
    <div v-if="activeTab === 'sent'">
      <!-- Loading -->
      <div v-if="pending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-primary" />
      </div>

      <!-- Empty State -->
      <UCard v-else-if="threads.length === 0">
      <div class="text-center py-12">
        <UIcon name="i-lucide-inbox" class="text-4xl text-muted mb-3" />
        <h3 class="text-lg font-semibold mb-2">No emails found</h3>
        <p class="text-muted mb-4">
          {{ searchQuery || statusFilter !== 'all' || repliesFilter !== 'all'
            ? 'Try adjusting your filters' 
            : 'Send your first outreach email to see it here' }}
        </p>
        <UButton
          v-if="!searchQuery && statusFilter === 'all' && repliesFilter === 'all'"
          @click="router.push('/businesses')"
        >
          Browse Businesses
        </UButton>
      </div>
    </UCard>

    <!-- Threads List -->
    <div v-else class="space-y-2">
      <UCard
        v-for="thread in threads"
        :key="thread.id"
        class="cursor-pointer hover:bg-elevated/50 transition-colors"
        @click="openThread(thread.id)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="font-semibold truncate">{{ thread.businessName }}</h3>
              <UBadge 
                v-if="thread.aiGenerated" 
                color="primary" 
                variant="soft"
                size="xs"
              >
                <UIcon name="i-lucide-sparkles" class="mr-1" />
                AI
              </UBadge>
              <UBadge 
                :color="getStatusColor(thread.status)" 
                variant="soft"
                size="xs"
              >
                {{ thread.status }}
              </UBadge>
              <UBadge
                v-if="thread.replyCount > 0"
                color="success"
                variant="soft"
                size="xs"
              >
                <UIcon name="i-lucide-reply" class="mr-1" />
                {{ thread.replyCount }}
              </UBadge>
            </div>
            
            <p class="text-sm font-medium text-default mb-1 truncate">
              {{ thread.subject }}
            </p>
            
            <div class="flex items-center gap-3 text-sm text-muted">
              <span>{{ thread.emailTo }}</span>
              <span v-if="thread.businessLocation">•</span>
              <span v-if="thread.businessLocation">{{ thread.businessLocation }}</span>
            </div>
          </div>
          
          <div class="text-sm text-muted whitespace-nowrap">
            {{ formatDate(thread.lastActivityAt) }}
          </div>
        </div>
      </UCard>

      <!-- Pagination -->
      <div v-if="pagination && threads.length > 0" class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">
        Showing {{ offset + 1 }}-{{ Math.min(offset + limit, pagination.total) }} of {{ pagination.total }}
      </p>
      
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          :disabled="offset === 0"
          @click="prevPage"
        >
          Previous
        </UButton>
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          trailing
          :disabled="!pagination.hasMore"
          @click="nextPage"
        >
          Next
        </UButton>
        </div>
      </div>
    </div>
    </div>

    <!-- Drafts Tab -->
    <div v-if="activeTab === 'drafts'">
      <!-- Loading -->
      <div v-if="draftsPending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-primary" />
      </div>

      <!-- Empty State -->
      <UCard v-else-if="drafts.length === 0">
        <div class="text-center py-12">
          <UIcon name="i-lucide-file-edit" class="text-4xl text-muted mb-3" />
          <h3 class="text-lg font-semibold mb-2">No drafts yet</h3>
          <p class="text-muted mb-4">
            Save emails as drafts to continue working on them later
          </p>
          <UButton
            icon="i-lucide-pencil"
            @click="composenew"
          >
            Compose Email
          </UButton>
        </div>
      </UCard>

      <!-- Drafts List -->
      <div v-else class="space-y-2">
        <UCard
          v-for="draft in drafts"
          :key="draft.id"
          class="cursor-pointer hover:bg-elevated/50 transition-colors"
          @click="openDraft(draft.id)"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="font-semibold truncate">
                  {{ draft.businessName || 'No Business' }}
                </h3>
                <UBadge 
                  v-if="draft.aiGenerated" 
                  color="primary" 
                  variant="soft"
                  size="xs"
                >
                  <UIcon name="i-lucide-sparkles" class="mr-1" />
                  AI
                </UBadge>
                <UBadge color="neutral" variant="soft" size="xs">
                  Draft
                </UBadge>
              </div>
              
              <p class="text-sm font-medium text-default mb-1 truncate">
                {{ draft.subject }}
              </p>
              
              <div class="flex items-center gap-3 text-sm text-muted">
                <span v-if="draft.emailTo">{{ draft.emailTo }}</span>
                <span v-if="draft.businessLocation">•</span>
                <span v-if="draft.businessLocation">{{ draft.businessLocation }}</span>
              </div>
            </div>
            
            <div class="flex items-center gap-3">
              <span class="text-sm text-muted whitespace-nowrap">
                {{ formatDate(draft.updatedAt) }}
              </span>
              
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="sm"
                @click="(e: Event) => deleteDraft(draft.id, e)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Thread Modal -->
    <UModal
      v-model:open="showThreadModal"
      title="Email Thread"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <EmailThread
          v-if="selectedThreadId"
          :thread-id="selectedThreadId"
        />
      </template>
    </UModal>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No additional styles needed - iframe handles isolation */
</style>
