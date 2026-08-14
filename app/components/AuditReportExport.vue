<script setup lang="ts">
interface Props {
  businessId: string
  businessName: string
  hasAudit: boolean
  hasWebsite: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  exported: [format: string]
}>()

const toast = useToast()
const isExporting = ref(false)
const exportFormat = ref<string | null>(null)
const showEmailModal = ref(false)
const emailAddress = ref('')
const isSendingEmail = ref(false)

// Export as JSON (download)
async function exportJson() {
  exportFormat.value = 'json'
  isExporting.value = true
  try {
    const response = await $fetch(`/api/report/${props.businessId}?format=json`)
    const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `audit-report-${props.businessName.replace(/[^a-z0-9]/gi, '-')}.json`)
    toast.add({ title: 'JSON Report Downloaded', color: 'success' })
    emit('exported', 'json')
  } catch (error) {
    toast.add({ title: 'Export Failed', description: 'Could not export JSON report', color: 'error' })
  } finally {
    isExporting.value = false
    exportFormat.value = null
  }
}

// Export as HTML (download)
async function exportHtml() {
  exportFormat.value = 'html'
  isExporting.value = true
  try {
    const html = await $fetch<string>(`/api/report/${props.businessId}?format=html`)
    const blob = new Blob([html], { type: 'text/html' })
    downloadBlob(blob, `audit-report-${props.businessName.replace(/[^a-z0-9]/gi, '-')}.html`)
    toast.add({ title: 'HTML Report Downloaded', color: 'success' })
    emit('exported', 'html')
  } catch (error) {
    toast.add({ title: 'Export Failed', description: 'Could not export HTML report', color: 'error' })
  } finally {
    isExporting.value = false
    exportFormat.value = null
  }
}

// Export as Markdown (download)
async function exportMarkdown() {
  exportFormat.value = 'markdown'
  isExporting.value = true
  try {
    const markdown = await $fetch<string>(`/api/report/${props.businessId}?format=markdown`)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    downloadBlob(blob, `audit-report-${props.businessName.replace(/[^a-z0-9]/gi, '-')}.md`)
    toast.add({ title: 'Markdown Report Downloaded', color: 'success' })
    emit('exported', 'markdown')
  } catch (error) {
    toast.add({ title: 'Export Failed', description: 'Could not export Markdown report', color: 'error' })
  } finally {
    isExporting.value = false
    exportFormat.value = null
  }
}

// Export as PDF (client-side generation)
async function exportPdf() {
  exportFormat.value = 'pdf'
  isExporting.value = true
  try {
    const response = await $fetch<{ html: string; filename: string }>(`/api/report/${props.businessId}?format=pdf`)

    // Open HTML in new window for printing
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(response.html)
      printWindow.document.close()
      printWindow.focus()

      // Add print styles and trigger print dialog
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }

    toast.add({ title: 'PDF Ready', description: 'Use browser print dialog to save as PDF', color: 'success' })
    emit('exported', 'pdf')
  } catch (error) {
    toast.add({ title: 'Export Failed', description: 'Could not generate PDF report', color: 'error' })
  } finally {
    isExporting.value = false
    exportFormat.value = null
  }
}

// Send to n8n webhook
async function sendToN8n() {
  exportFormat.value = 'n8n'
  isExporting.value = true
  try {
    await $fetch('/api/report/n8n', {
      method: 'POST',
      body: { businessId: props.businessId, format: 'json' }
    })
    toast.add({ title: 'Sent to n8n', description: 'Report sent to automation workflow', color: 'success' })
    emit('exported', 'n8n')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not send to n8n'
    toast.add({ title: 'Send Failed', description: message, color: 'error' })
  } finally {
    isExporting.value = false
    exportFormat.value = null
  }
}

// Send report via email
async function sendEmail() {
  if (!emailAddress.value) {
    toast.add({ title: 'Email Required', description: 'Please enter a recipient email', color: 'warning' })
    return
  }

  isSendingEmail.value = true
  try {
    await $fetch('/api/report/email', {
      method: 'POST',
      body: {
        businessId: props.businessId,
        recipientEmail: emailAddress.value
      }
    })
    toast.add({ title: 'Email Sent', description: `Report sent to ${emailAddress.value}`, color: 'success' })
    showEmailModal.value = false
    emailAddress.value = ''
    emit('exported', 'email')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not send email'
    toast.add({ title: 'Send Failed', description: message, color: 'error' })
  } finally {
    isSendingEmail.value = false
  }
}

// Helper to download a blob
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Export menu items
const exportItems = computed(() => [
  [
    {
      label: 'Download JSON',
      icon: 'i-lucide-file-json',
      click: exportJson,
      disabled: isExporting.value
    },
    {
      label: 'Download HTML',
      icon: 'i-lucide-file-code',
      click: exportHtml,
      disabled: isExporting.value
    },
    {
      label: 'Download Markdown',
      icon: 'i-lucide-file-text',
      click: exportMarkdown,
      disabled: isExporting.value
    },
    {
      label: 'Save as PDF',
      icon: 'i-lucide-file-down',
      click: exportPdf,
      disabled: isExporting.value
    }
  ],
  [
    {
      label: 'Send to n8n',
      icon: 'i-lucide-workflow',
      click: sendToN8n,
      disabled: isExporting.value
    },
    {
      label: 'Email Report',
      icon: 'i-lucide-mail',
      click: () => { showEmailModal.value = true },
      disabled: isExporting.value
    }
  ]
])
</script>

<template>
  <div>
    <UDropdownMenu :items="exportItems">
      <UButton
        icon="i-lucide-download"
        :loading="isExporting"
        variant="soft"
      >
        Export Report
        <template #trailing>
          <UIcon name="i-lucide-chevron-down" />
        </template>
      </UButton>
    </UDropdownMenu>

    <!-- Email Modal -->
    <UModal
      v-model:open="showEmailModal"
      title="Email Audit Report"
      description="Send the report to an email address"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Recipient Email" required>
            <UInput
              v-model="emailAddress"
              type="email"
              placeholder="client@example.com"
              icon="i-lucide-mail"
              class="w-full"
            />
          </UFormField>

          <div class="p-3 bg-elevated rounded-lg">
            <p class="text-sm text-muted">
              The audit report for <strong>{{ businessName }}</strong> will be sent as a formatted HTML email.
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showEmailModal = false"
          >
            Cancel
          </UButton>
          <UButton
            icon="i-lucide-send"
            :loading="isSendingEmail"
            @click="sendEmail"
          >
            Send Report
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

