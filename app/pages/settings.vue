<script setup lang="ts">
const toast = useToast()

// Fetch stats for dashboard
const { data: statsData, refresh: refreshStats } = await useFetch('/api/businesses', {
  query: { limit: 1000 },
  transform: (data) => {
    const businesses = data.businesses || []
    return {
      total: businesses.length,
      withWebsite: businesses.filter((b: { website: string | null }) => b.website).length,
      withoutWebsite: businesses.filter((b: { website: string | null }) => !b.website).length,
      audited: businesses.filter((b: { audit: unknown }) => b.audit).length,
      hot: businesses.filter((b: { leadCategory: string }) => b.leadCategory === 'hot').length,
      warm: businesses.filter((b: { leadCategory: string }) => b.leadCategory === 'warm').length,
      cold: businesses.filter((b: { leadCategory: string }) => b.leadCategory === 'cold').length,
      approved: businesses.filter((b: { status: string }) => b.status === 'approved').length,
      sent: businesses.filter((b: { status: string }) => b.status === 'sent').length
    }
  }
})

const { data: templateData } = await useFetch('/api/templates')
const templateCount = computed(() => templateData.value?.templates?.length || 0)

// Note: These can only be configured via .env file on the server
const configSections = [
  {
    title: 'RapidAPI (Local Business Data)',
    description: 'Used for searching local businesses. Get your key at rapidapi.com',
    envVar: 'RAPIDAPI_KEY'
  },
  {
    title: 'Google PageSpeed Insights',
    description: 'Used for website audits. Works without key (rate limited)',
    envVar: 'GOOGLE_PAGESPEED_API_KEY'
  },
  {
    title: 'Mailgun',
    description: 'Used for sending outreach emails',
    envVar: 'MAILGUN_API_KEY'
  },
  {
    title: 'n8n Webhook',
    description: 'Used for automation workflows',
    envVar: 'N8N_WEBHOOK_URL'
  }
]

async function clearAllData() {
  if (!confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
    return
  }

  toast.add({
    title: 'Feature not implemented',
    description: 'Use Prisma CLI to reset database: npx prisma db push --force-reset',
    color: 'warning'
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">Settings</h1>
      <p class="text-muted">Configure API keys and view system status.</p>
    </div>

    <!-- Statistics Overview -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-bar-chart-3" class="text-primary" />
          <h2 class="font-semibold">Database Statistics</h2>
        </div>
      </template>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-lg bg-elevated">
          <p class="text-2xl font-bold">{{ statsData?.total || 0 }}</p>
          <p class="text-sm text-muted">Total Businesses</p>
        </div>
        <div class="p-4 rounded-lg bg-elevated">
          <p class="text-2xl font-bold">{{ statsData?.audited || 0 }}</p>
          <p class="text-sm text-muted">Audited</p>
        </div>
        <div class="p-4 rounded-lg bg-elevated">
          <p class="text-2xl font-bold">{{ statsData?.hot || 0 }}</p>
          <p class="text-sm text-muted">Hot Leads</p>
        </div>
        <div class="p-4 rounded-lg bg-elevated">
          <p class="text-2xl font-bold">{{ statsData?.sent || 0 }}</p>
          <p class="text-sm text-muted">Emails Sent</p>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div class="flex justify-between">
          <span class="text-muted">With Website:</span>
          <span class="font-medium">{{ statsData?.withWebsite || 0 }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Without Website:</span>
          <span class="font-medium">{{ statsData?.withoutWebsite || 0 }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Email Templates:</span>
          <span class="font-medium">{{ templateCount }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Warm Leads:</span>
          <span class="font-medium">{{ statsData?.warm || 0 }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Cold Leads:</span>
          <span class="font-medium">{{ statsData?.cold || 0 }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Approved:</span>
          <span class="font-medium">{{ statsData?.approved || 0 }}</span>
        </div>
      </div>

      <template #footer>
        <UButton
          icon="i-lucide-refresh-cw"
          variant="ghost"
          size="sm"
          @click="refreshStats()"
        >
          Refresh Stats
        </UButton>
      </template>
    </UCard>

    <!-- API Configuration -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-key" class="text-primary" />
          <h2 class="font-semibold">API Configuration</h2>
        </div>
      </template>

      <UAlert
        color="info"
        icon="i-lucide-info"
        title="Server-side Configuration"
        class="mb-4"
      >
        <template #description>
          API keys are configured via environment variables in the <code class="px-1 py-0.5 rounded bg-accented">.env</code> file. Restart the server after making changes.
        </template>
      </UAlert>

      <div class="space-y-4">
        <div
          v-for="config in configSections"
          :key="config.title"
          class="flex items-center justify-between p-4 rounded-lg border border-default bg-elevated"
        >
          <div>
            <h3 class="font-medium">{{ config.title }}</h3>
            <p class="text-sm text-muted">{{ config.description }}</p>
            <code class="text-xs px-1 py-0.5 rounded bg-accented mt-1 inline-block">
              {{ config.envVar }}
            </code>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Quick Links -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-link" class="text-primary" />
          <h2 class="font-semibold">Quick Links</h2>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <UButton
          to="https://rapidapi.com/letscrape-6bRBa3QguO5/api/local-business-data"
          target="_blank"
          variant="outline"
          block
        >
          <UIcon name="i-lucide-external-link" class="mr-2" />
          RapidAPI Dashboard
        </UButton>

        <UButton
          to="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          variant="outline"
          block
        >
          <UIcon name="i-lucide-external-link" class="mr-2" />
          Google Cloud Console
        </UButton>

        <UButton
          to="https://app.mailgun.com/"
          target="_blank"
          variant="outline"
          block
        >
          <UIcon name="i-lucide-external-link" class="mr-2" />
          Mailgun Dashboard
        </UButton>

        <UButton
          to="https://www.wildcardcreativeco.com/"
          target="_blank"
          variant="outline"
          block
        >
          <UIcon name="i-lucide-external-link" class="mr-2" />
          Wild Card Creative
        </UButton>
      </div>
    </UCard>

    <!-- Danger Zone -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-alert-triangle" class="text-error" />
          <h2 class="font-semibold text-error">Danger Zone</h2>
        </div>
      </template>

      <div class="flex items-center justify-between p-4 rounded-lg border border-error/30 bg-error/10">
        <div>
          <h3 class="font-medium">Clear All Data</h3>
          <p class="text-sm text-muted">
            Delete all businesses, audits, and outreach logs. This cannot be undone.
          </p>
        </div>
        <UButton
          color="error"
          variant="soft"
          @click="clearAllData"
        >
          Clear Data
        </UButton>
      </div>
    </UCard>

    <!-- About -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-info" class="text-primary" />
          <h2 class="font-semibold">About</h2>
        </div>
      </template>

      <div class="text-sm space-y-2">
        <p>
          <strong>Wild Card Lead Gen</strong> is a lead generation and website auditing tool
          built for Wild Card Creative Co. It helps find local businesses that need websites
          or have poorly performing ones, then automates personalized outreach.
        </p>
        <p class="text-muted">
          Built with Nuxt 4, Nuxt UI v4, Prisma, and SQLite.
        </p>
      </div>
    </UCard>
  </div>
</template>
