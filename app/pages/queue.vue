<script setup lang="ts">
const toast = useToast()
const router = useRouter()

const { data, pending, refresh } = await useFetch('/api/businesses', {
  query: {
    status: 'new',
    sortBy: 'leadScore',
    sortOrder: 'desc',
    limit: 100
  }
})

const businesses = computed(() => data.value?.businesses || [])

const stats = computed(() => ({
  total: businesses.value.length,
  hot: businesses.value.filter((b: { leadCategory: string }) => b.leadCategory === 'hot').length,
  warm: businesses.value.filter((b: { leadCategory: string }) => b.leadCategory === 'warm').length,
  cold: businesses.value.filter((b: { leadCategory: string }) => b.leadCategory === 'cold').length
}))

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

async function handleBulkApprove(ids: string[]) {
  try {
    await Promise.all(
      ids.map(id =>
        $fetch(`/api/businesses/${id}`, {
          method: 'PATCH',
          body: { status: 'approved' }
        })
      )
    )
    toast.add({ title: `${ids.length} leads approved`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Some approvals failed', color: 'error' })
  }
}

async function handleBulkReject(ids: string[]) {
  try {
    await Promise.all(
      ids.map(id =>
        $fetch(`/api/businesses/${id}`, {
          method: 'PATCH',
          body: { status: 'rejected' }
        })
      )
    )
    toast.add({ title: `${ids.length} leads rejected`, color: 'warning' })
    await refresh()
  } catch {
    toast.add({ title: 'Some rejections failed', color: 'error' })
  }
}

function handleView(id: string) {
  router.push(`/businesses/${id}`)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Approval Queue</h1>
        <p class="text-muted">Review and approve leads for outreach.</p>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="outline"
        :loading="pending"
        @click="refresh()"
      >
        Refresh
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <UCard>
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
            <UIcon name="i-lucide-inbox" class="text-primary" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ stats.total }}</p>
            <p class="text-sm text-muted">Pending</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/20">
            <UIcon name="i-lucide-flame" class="text-red-500" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ stats.hot }}</p>
            <p class="text-sm text-muted">Hot Leads</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20">
            <UIcon name="i-lucide-sun" class="text-amber-500" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ stats.warm }}</p>
            <p class="text-sm text-muted">Warm Leads</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-500/20">
            <UIcon name="i-lucide-snowflake" class="text-sky-500" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ stats.cold }}</p>
            <p class="text-sm text-muted">Cold Leads</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Queue -->
    <UCard>
      <ApprovalQueue
        :businesses="businesses"
        :loading="pending"
        @approve="handleApprove"
        @reject="handleReject"
        @view="handleView"
        @bulk-approve="handleBulkApprove"
        @bulk-reject="handleBulkReject"
      />
    </UCard>
  </div>
</template>
