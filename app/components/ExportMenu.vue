<script setup lang="ts">
const toast = useToast()

const props = defineProps<{
  businessIds?: string[]
  category?: string
  status?: string
}>()

const isExporting = ref(false)

async function exportCsv() {
  isExporting.value = true
  try {
    const params = new URLSearchParams()
    if (props.category) params.set('category', props.category)
    if (props.status) params.set('status', props.status)

    const url = `/api/export/csv?${params}`
    window.open(url, '_blank')

    toast.add({
      title: 'Export Started',
      description: 'CSV download should begin shortly',
      color: 'success'
    })
  } finally {
    isExporting.value = false
  }
}

async function exportJson() {
  isExporting.value = true
  try {
    const params = new URLSearchParams()
    if (props.category) params.set('category', props.category)
    if (props.status) params.set('status', props.status)

    const url = `/api/export/json?${params}`
    window.open(url, '_blank')

    toast.add({
      title: 'Export Started',
      description: 'JSON download should begin shortly',
      color: 'success'
    })
  } finally {
    isExporting.value = false
  }
}

async function sendToN8n() {
  if (!props.businessIds || props.businessIds.length === 0) {
    toast.add({
      title: 'No leads selected',
      description: 'Please select leads to send to n8n',
      color: 'warning'
    })
    return
  }

  isExporting.value = true
  try {
    await $fetch('/api/export/n8n', {
      method: 'POST',
      body: {
        businessIds: props.businessIds
      }
    })

    toast.add({
      title: 'Sent to n8n',
      description: `${props.businessIds.length} leads sent to automation workflow`,
      color: 'success'
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send'
    toast.add({
      title: 'Export Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isExporting.value = false
  }
}

// Batch audit report exports
async function exportBatchReport(format: 'json' | 'html' | 'markdown' | 'pdf') {
  if (!props.businessIds || props.businessIds.length === 0) {
    toast.add({
      title: 'No leads selected',
      description: 'Please select leads to export reports',
      color: 'warning'
    })
    return
  }

  isExporting.value = true
  try {
    if (format === 'pdf') {
      // For PDF, get HTML and open in print dialog
      const response = await $fetch<{ html: string }>('/api/report/batch', {
        method: 'POST',
        body: { businessIds: props.businessIds, format: 'pdf' }
      })

      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(response.html)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => printWindow.print(), 500)
      }

      toast.add({
        title: 'PDF Ready',
        description: 'Use browser print dialog to save as PDF',
        color: 'success'
      })
    } else if (format === 'json') {
      const response = await $fetch('/api/report/batch', {
        method: 'POST',
        body: { businessIds: props.businessIds, format: 'json' }
      })
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' })
      downloadBlob(blob, `batch-audit-report-${Date.now()}.json`)
      toast.add({ title: 'JSON Report Downloaded', color: 'success' })
    } else {
      // HTML or Markdown - fetch as text
      const response = await $fetch<string>('/api/report/batch', {
        method: 'POST',
        body: { businessIds: props.businessIds, format }
      })
      const mimeType = format === 'html' ? 'text/html' : 'text/markdown'
      const extension = format === 'html' ? 'html' : 'md'
      const blob = new Blob([response], { type: mimeType })
      downloadBlob(blob, `batch-audit-report-${Date.now()}.${extension}`)
      toast.add({ title: `${format.toUpperCase()} Report Downloaded`, color: 'success' })
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Export failed'
    toast.add({
      title: 'Export Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isExporting.value = false
  }
}

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

const hasSelection = computed(() => props.businessIds && props.businessIds.length > 0)

const menuItems = computed(() => [
  [
    {
      label: 'Export as CSV',
      icon: 'i-lucide-file-spreadsheet',
      click: exportCsv
    },
    {
      label: 'Export as JSON',
      icon: 'i-lucide-file-json',
      click: exportJson
    }
  ],
  [
    {
      label: 'Audit Reports (JSON)',
      icon: 'i-lucide-file-json',
      click: () => exportBatchReport('json'),
      disabled: !hasSelection.value
    },
    {
      label: 'Audit Reports (HTML)',
      icon: 'i-lucide-file-code',
      click: () => exportBatchReport('html'),
      disabled: !hasSelection.value
    },
    {
      label: 'Audit Reports (Markdown)',
      icon: 'i-lucide-file-text',
      click: () => exportBatchReport('markdown'),
      disabled: !hasSelection.value
    },
    {
      label: 'Audit Reports (PDF)',
      icon: 'i-lucide-file-down',
      click: () => exportBatchReport('pdf'),
      disabled: !hasSelection.value
    }
  ],
  [
    {
      label: 'Send to n8n',
      icon: 'i-lucide-workflow',
      click: sendToN8n,
      disabled: !hasSelection.value
    }
  ]
])
</script>

<template>
  <UDropdownMenu :items="menuItems">
    <UButton
      icon="i-lucide-download"
      :loading="isExporting"
      variant="outline"
    >
      Export
    </UButton>
  </UDropdownMenu>
</template>

