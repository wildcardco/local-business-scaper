<script setup lang="ts">
interface Audit {
  performanceScore: number | null
  accessibilityScore: number | null
  bestPracticesScore: number | null
  seoScore: number | null
  firstContentfulPaint: string | null
  largestContentfulPaint: string | null
  totalBlockingTime: string | null
  cumulativeLayoutShift: string | null
  speedIndex: string | null
  hasSSL: boolean | null
  detectedPlatform: string | null
  auditedAt: string
}

const props = defineProps<{
  audit: Audit | null
  websiteUrl?: string | null
  businessId?: string
  businessName?: string
  showExport?: boolean
}>()

const webVitals = computed(() => {
  if (!props.audit) return []
  return [
    { label: 'First Contentful Paint', value: props.audit.firstContentfulPaint, icon: 'i-lucide-zap' },
    { label: 'Largest Contentful Paint', value: props.audit.largestContentfulPaint, icon: 'i-lucide-image' },
    { label: 'Total Blocking Time', value: props.audit.totalBlockingTime, icon: 'i-lucide-clock' },
    { label: 'Cumulative Layout Shift', value: props.audit.cumulativeLayoutShift, icon: 'i-lucide-move' },
    { label: 'Speed Index', value: props.audit.speedIndex, icon: 'i-lucide-gauge' }
  ]
})

const issues = computed(() => {
  if (!props.audit) return []
  const result: string[] = []

  if (props.audit.performanceScore !== null && props.audit.performanceScore < 50) {
    result.push(`Poor performance score: ${props.audit.performanceScore}/100`)
  }
  if (props.audit.seoScore !== null && props.audit.seoScore < 50) {
    result.push(`Poor SEO score: ${props.audit.seoScore}/100`)
  }
  if (props.audit.accessibilityScore !== null && props.audit.accessibilityScore < 50) {
    result.push(`Poor accessibility score: ${props.audit.accessibilityScore}/100`)
  }
  if (props.audit.hasSSL === false) {
    result.push('No SSL certificate (not secure)')
  }

  return result
})
</script>

<template>
  <div class="space-y-6">
    <!-- No Audit State -->
    <div v-if="!audit" class="text-center py-8">
      <UIcon name="i-lucide-file-search" class="text-4xl text-muted mb-3" />
      <p class="text-muted">No audit data available</p>
      <p v-if="!websiteUrl" class="text-sm text-muted mt-1">
        This business doesn't have a website
      </p>
    </div>

    <template v-else>
      <!-- Score Gauges -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Lighthouse Scores</h3>
            <span class="text-xs text-muted">
              Audited {{ new Date(audit.auditedAt).toLocaleDateString() }}
            </span>
          </div>
        </template>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <AuditGauge
            :score="audit.performanceScore"
            label="Performance"
          />
          <AuditGauge
            :score="audit.seoScore"
            label="SEO"
          />
          <AuditGauge
            :score="audit.accessibilityScore"
            label="Accessibility"
          />
          <AuditGauge
            :score="audit.bestPracticesScore"
            label="Best Practices"
          />
        </div>
      </UCard>

      <!-- Issues Alert -->
      <UAlert
        v-if="issues.length > 0"
        color="amber"
        icon="i-lucide-alert-triangle"
        title="Issues Found"
      >
        <ul class="list-disc list-inside space-y-1 mt-2">
          <li v-for="issue in issues" :key="issue" class="text-sm">
            {{ issue }}
          </li>
        </ul>
      </UAlert>

      <!-- Core Web Vitals -->
      <UCard>
        <template #header>
          <h3 class="font-semibold">Core Web Vitals</h3>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div
            v-for="vital in webVitals"
            :key="vital.label"
            class="flex items-center gap-3 p-3 rounded-lg bg-elevated"
          >
            <UIcon :name="vital.icon" class="text-lg text-primary-500" />
            <div>
              <p class="text-xs text-muted">{{ vital.label }}</p>
              <p class="font-semibold">{{ vital.value || '—' }}</p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Technical Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UCard>
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-500/15">
              <UIcon name="i-lucide-code" class="text-primary-400" />
            </div>
            <div>
              <p class="text-sm text-muted">Detected Platform</p>
              <p class="font-semibold">{{ audit.detectedPlatform || 'Unknown' }}</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <div
              class="flex items-center justify-center w-10 h-10 rounded-lg"
              :class="audit.hasSSL ? 'bg-success-500/15' : 'bg-error-500/15'"
            >
              <UIcon
                :name="audit.hasSSL ? 'i-lucide-lock' : 'i-lucide-lock-open'"
                :class="audit.hasSSL ? 'text-success-400' : 'text-error-400'"
              />
            </div>
            <div>
              <p class="text-sm text-muted">SSL Certificate</p>
              <p class="font-semibold">{{ audit.hasSSL ? 'Secure' : 'Not Secure' }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Export Section -->
      <UCard v-if="showExport && businessId && businessName">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Export Report</h3>
          </div>
        </template>
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p class="text-sm text-muted">
            Download or share this audit report in multiple formats, or send it directly via email or n8n workflow.
          </p>
          <AuditReportExport
            :business-id="businessId"
            :business-name="businessName"
            :has-audit="!!audit"
            :has-website="!!websiteUrl"
          />
        </div>
      </UCard>
    </template>
  </div>
</template>

