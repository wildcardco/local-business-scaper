<script setup lang="ts">
const toast = useToast()
const router = useRouter()
const { state: auditState, runAudit, closeProgress } = useAudit()

const page = ref(1)
const limit = 50
const selectedBusinessIds = ref<string[]>([])
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)
const isProcessing = ref(false)
const businessTableRef = ref<{ clearSelection: () => void } | null>(null)

const { data, pending, refresh } = await useFetch('/api/businesses', {
  query: computed(() => ({
    limit,
    offset: (page.value - 1) * limit,
    sortBy: 'leadScore',
    sortOrder: 'desc'
  })),
  watch: [page]
})

const businesses = computed(() => data.value?.businesses || [])
const pagination = computed(() => data.value?.pagination || { total: 0, hasMore: false })

async function handleAudit(id: string) {
  // Find the business to get name and website
  const business = businesses.value.find((b: { id: string }) => b.id === id)
  if (!business) {
    toast.add({
      title: 'Error',
      description: 'Business not found',
      color: 'error'
    })
    return
  }

  const success = await runAudit({
    id: business.id,
    name: business.name,
    website: business.website
  })

  if (success) {
    await refresh()
  }
}

function handleView(id: string) {
  router.push(`/businesses/${id}`)
}

async function handleApprove(id: string) {
  try {
    await $fetch(`/api/businesses/${id}`, {
      method: 'PATCH',
      body: { status: 'approved' }
    })
    toast.add({ title: 'Lead approved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to approve', color: 'error' })
  }
}

async function handleReject(id: string) {
  try {
    await $fetch(`/api/businesses/${id}`, {
      method: 'PATCH',
      body: { status: 'rejected' }
    })
    toast.add({ title: 'Lead rejected', color: 'warning' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to reject', color: 'error' })
  }
}

function handleSelectionChange(ids: string[]) {
  selectedBusinessIds.value = ids
}

async function handleDeleteSelected() {
  if (selectedBusinessIds.value.length === 0) return

  isDeleting.value = true
  try {
    const result = await $fetch('/api/businesses/delete', {
      method: 'POST',
      body: { ids: selectedBusinessIds.value }
    })

    toast.add({
      title: 'Deleted Successfully',
      description: `${result.deleted} businesses removed`,
      color: 'success'
    })

    selectedBusinessIds.value = []
    businessTableRef.value?.clearSelection()
    showDeleteConfirm.value = false
    await refresh()
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Delete failed'
    toast.add({
      title: 'Delete Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

async function handleBulkApprove() {
  if (selectedBusinessIds.value.length === 0) return

  isProcessing.value = true
  try {
    let approvedCount = 0
    for (const id of selectedBusinessIds.value) {
      try {
        await $fetch(`/api/businesses/${id}`, {
          method: 'PATCH',
          body: { status: 'approved' }
        })
        approvedCount++
      } catch {
        // Continue with others
      }
    }

    toast.add({
      title: 'Bulk Approve Complete',
      description: `${approvedCount} leads approved`,
      color: 'success'
    })

    selectedBusinessIds.value = []
    businessTableRef.value?.clearSelection()
    await refresh()
  } catch {
    toast.add({ title: 'Bulk approve failed', color: 'error' })
  } finally {
    isProcessing.value = false
  }
}

async function handleBulkReject() {
  if (selectedBusinessIds.value.length === 0) return

  isProcessing.value = true
  try {
    let rejectedCount = 0
    for (const id of selectedBusinessIds.value) {
      try {
        await $fetch(`/api/businesses/${id}`, {
          method: 'PATCH',
          body: { status: 'rejected' }
        })
        rejectedCount++
      } catch {
        // Continue with others
      }
    }

    toast.add({
      title: 'Bulk Reject Complete',
      description: `${rejectedCount} leads rejected`,
      color: 'warning'
    })

    selectedBusinessIds.value = []
    businessTableRef.value?.clearSelection()
    await refresh()
  } catch {
    toast.add({ title: 'Bulk reject failed', color: 'error' })
  } finally {
    isProcessing.value = false
  }
}

function clearSelection() {
  selectedBusinessIds.value = []
  businessTableRef.value?.clearSelection()
}
</script>

<template>
  <div class="space-y-6 pb-20">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">All Businesses</h1>
        <p class="text-muted">View and manage all discovered business leads.</p>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="refresh()"
        :loading="pending"
      >
        Refresh
      </UButton>
    </div>

    <UCard>
      <BusinessTable
        ref="businessTableRef"
        :businesses="businesses"
        :loading="pending"
        :selectable="true"
        @audit="handleAudit"
        @view="handleView"
        @approve="handleApprove"
        @reject="handleReject"
        @update:selected="handleSelectionChange"
      />

      <template #footer v-if="pagination.total > limit">
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted">
            Showing {{ (page - 1) * limit + 1 }} to {{ Math.min(page * limit, pagination.total) }} of {{ pagination.total }}
          </p>
          <UPagination
            v-model="page"
            :total="pagination.total"
            :items-per-page="limit"
          />
        </div>
      </template>
    </UCard>

    <!-- Floating Action Toolbar -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div
        v-if="selectedBusinessIds.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div class="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4">
          <!-- Selection count -->
          <div class="flex items-center gap-2 pr-4 border-r border-gray-700">
            <div class="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
              <span class="text-sm font-bold text-primary-400">{{ selectedBusinessIds.length }}</span>
            </div>
            <span class="text-sm text-gray-300">selected</span>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-check"
              color="success"
              variant="soft"
              :loading="isProcessing"
              @click="handleBulkApprove"
            >
              Approve
            </UButton>

            <UButton
              icon="i-lucide-x"
              color="warning"
              variant="soft"
              :loading="isProcessing"
              @click="handleBulkReject"
            >
              Reject
            </UButton>

            <ExportMenu :business-ids="selectedBusinessIds" />

            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="soft"
              @click="showDeleteConfirm = true"
            >
              Delete
            </UButton>
          </div>

          <!-- Clear selection -->
          <div class="pl-4 border-l border-gray-700">
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="clearSelection"
            >
              Clear
            </UButton>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 text-red-500">
              <UIcon name="i-lucide-alert-triangle" class="text-xl" />
              <h3 class="font-semibold">Confirm Delete</h3>
            </div>
          </template>

          <p class="text-muted">
            Are you sure you want to permanently delete
            <strong class="text-foreground">{{ selectedBusinessIds.length }}</strong>
            business{{ selectedBusinessIds.length === 1 ? '' : 'es' }}?
          </p>
          <p class="text-sm text-red-400 mt-2">
            This action cannot be undone. All associated audits and outreach logs will also be deleted.
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                variant="ghost"
                @click="showDeleteConfirm = false"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                icon="i-lucide-trash-2"
                :loading="isDeleting"
                @click="handleDeleteSelected"
              >
                Delete Forever
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Audit Progress Modal -->
    <AuditProgress :state="auditState" @close="closeProgress" />
  </div>
</template>
