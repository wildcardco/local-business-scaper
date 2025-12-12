<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const toast = useToast()

const id = route.params.id as string

const { data, pending, refresh } = await useFetch(`/api/businesses/${id}`)
const business = computed(() => data.value?.business)

const isAuditing = ref(false)

async function runAudit() {
  if (!business.value?.website) {
    toast.add({
      title: 'Cannot audit',
      description: 'This business has no website',
      color: 'warning'
    })
    return
  }

  isAuditing.value = true
  try {
    await $fetch(`/api/businesses/${id}/audit`, { method: 'POST' })
    toast.add({
      title: 'Audit Complete',
      color: 'success'
    })
    await refresh()
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Audit failed'
    toast.add({
      title: 'Audit Failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    isAuditing.value = false
  }
}

async function updateStatus(status: string) {
  try {
    await $fetch(`/api/businesses/${id}`, {
      method: 'PATCH',
      body: { status }
    })
    toast.add({
      title: `Status updated to ${status}`,
      color: 'success'
    })
    await refresh()
  } catch {
    toast.add({
      title: 'Failed to update status',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ business?.name || 'Loading...' }}</h1>
        <p class="text-muted">{{ business?.category || '' }}</p>
      </div>
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        @click="router.back()"
      >
        Back
      </UButton>
    </div>

    <div v-if="pending" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-primary" />
    </div>

    <div v-else-if="business" class="space-y-6">
      <!-- Business Info Card -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Business Details</h2>
              <div class="flex items-center gap-2">
                <LeadScoreBadge
                  :score="business.leadScore"
                  :category="business.leadCategory"
                  show-score
                />
                <StatusBadge :status="business.status" />
              </div>
            </div>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-3">
              <div>
                <p class="text-sm text-muted">Address</p>
                <p class="font-medium">
                  {{ business.address || '—' }}
                </p>
                <p v-if="business.city || business.state" class="text-sm text-muted">
                  {{ [business.city, business.state, business.zipCode].filter(Boolean).join(', ') }}
                </p>
              </div>

              <div>
                <p class="text-sm text-muted">Phone</p>
                <p class="font-medium">
                  <a
                    v-if="business.phone"
                    :href="`tel:${business.phone}`"
                    class="text-primary hover:underline"
                  >
                    {{ business.phone }}
                  </a>
                  <span v-else class="text-dimmed">—</span>
                </p>
              </div>

              <div>
                <p class="text-sm text-muted">Email</p>
                <p class="font-medium">
                  <a
                    v-if="business.email"
                    :href="`mailto:${business.email}`"
                    class="text-primary hover:underline"
                  >
                    {{ business.email }}
                  </a>
                  <span v-else class="text-dimmed italic">Not available</span>
                </p>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <p class="text-sm text-muted">Website</p>
                <p class="font-medium">
                  <a
                    v-if="business.website"
                    :href="business.website.startsWith('http') ? business.website : `https://${business.website}`"
                    target="_blank"
                    class="text-primary hover:underline flex items-center gap-1"
                  >
                    {{ business.website }}
                    <UIcon name="i-lucide-external-link" class="text-xs" />
                  </a>
                  <UBadge v-else color="error" variant="soft">
                    No Website
                  </UBadge>
                </p>
              </div>

              <div v-if="business.rating">
                <p class="text-sm text-muted">Rating</p>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-star" class="text-amber-500" />
                  <span class="font-medium">{{ business.rating }}</span>
                  <span class="text-muted">({{ business.reviewCount }} reviews)</span>
                </div>
              </div>

              <div v-if="business.googleMapsUrl">
                <p class="text-sm text-muted">Google Maps</p>
                <a
                  :href="business.googleMapsUrl"
                  target="_blank"
                  class="text-primary hover:underline flex items-center gap-1"
                >
                  View on Maps
                  <UIcon name="i-lucide-external-link" class="text-xs" />
                </a>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="business.website"
                icon="i-lucide-scan"
                :loading="isAuditing"
                @click="runAudit"
              >
                {{ business.audit ? 'Re-run Audit' : 'Run Audit' }}
              </UButton>

              <!-- Export Report Button -->
              <AuditReportExport
                v-if="business.audit || !business.website"
                :business-id="business.id"
                :business-name="business.name"
                :has-audit="!!business.audit"
                :has-website="!!business.website"
              />

              <UButton
                v-if="business.status === 'new'"
                icon="i-lucide-check"
                color="success"
                variant="soft"
                @click="updateStatus('approved')"
              >
                Approve
              </UButton>

              <UButton
                v-if="business.status === 'new'"
                icon="i-lucide-x"
                color="error"
                variant="soft"
                @click="updateStatus('rejected')"
              >
                Reject
              </UButton>
            </div>
          </template>
        </UCard>

        <!-- Lead Score Card -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Lead Score</h3>
          </template>

          <div class="flex flex-col items-center py-4">
            <div class="relative w-32 h-32 mb-4">
              <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke-width="12"
                  class="stroke-default"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke-width="12"
                  stroke-linecap="round"
                  :class="{
                    'stroke-red-500': business.leadCategory === 'hot',
                    'stroke-amber-500': business.leadCategory === 'warm',
                    'stroke-sky-500': business.leadCategory === 'cold',
                    'stroke-neutral-400': business.leadCategory === 'skip' || !business.leadCategory
                  }"
                  :stroke-dasharray="251.2"
                  :stroke-dashoffset="251.2 - (business.leadScore / 100) * 251.2"
                  style="transition: stroke-dashoffset 0.5s ease"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-3xl font-bold">{{ business.leadScore }}</span>
              </div>
            </div>

            <LeadScoreBadge
              :score="business.leadScore"
              :category="business.leadCategory"
            />

            <p class="text-sm text-muted text-center mt-4">
              <template v-if="!business.website">
                No website - excellent opportunity for new site pitch
              </template>
              <template v-else-if="business.leadCategory === 'hot'">
                Website has significant issues - great opportunity
              </template>
              <template v-else-if="business.leadCategory === 'warm'">
                Website could use improvements
              </template>
              <template v-else-if="business.leadCategory === 'cold'">
                Website is decent but may have some issues
              </template>
              <template v-else>
                Website is in good shape - low priority
              </template>
            </p>
          </div>
        </UCard>
      </div>

      <!-- Audit Report -->
      <AuditReport
        :audit="business.audit"
        :website-url="business.website"
      />
    </div>

    <div v-else class="text-center py-12">
      <UIcon name="i-lucide-alert-circle" class="text-4xl text-muted mb-3" />
      <p class="text-muted">Business not found</p>
      <UButton
        class="mt-4"
        @click="router.push('/businesses')"
      >
        Back to Businesses
      </UButton>
    </div>
  </div>
</template>
