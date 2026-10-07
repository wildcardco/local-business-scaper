<script setup lang="ts">
const props = defineProps<{
  lead: {
    score?: number | null
    signals?: Record<string, unknown> | null
    tier?: { slug?: string | null, label?: string | null } | null
    business: {
      id: string
      name?: string | null
      category?: string | null
      city?: string | null
      state?: string | null
      website?: string | null
      lead_category?: string | null
    }
    mockup?: { id: string } | null
  }
  skipping?: boolean
}>()

const emit = defineEmits<{
  generate: [businessId: string]
  skip: [businessId: string]
}>()

const hot = computed(() =>
  props.lead.business.lead_category === 'hot' || Number(props.lead.score || 0) >= 70
)

const noWebsite = computed(() => {
  const site = props.lead.business.website
  if (!site || !String(site).trim()) return true
  return Boolean(props.lead.signals?.no_website)
})

const place = computed(() => {
  const city = props.lead.business.city?.trim()
  const state = props.lead.business.state?.trim()
  return [city, state].filter(Boolean).join(', ')
})
</script>

<template>
  <article class="min-w-0 rounded-xl border border-default bg-default p-3">
    <div class="flex min-w-0 items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <h3 class="line-clamp-2 break-words font-display text-base font-semibold text-highlighted">
          {{ lead.business.name }}
        </h3>
        <p class="mt-0.5 truncate text-sm text-muted">
          {{ lead.business.category || 'Local business' }}
          <span v-if="place"> · {{ place }}</span>
        </p>
      </div>
      <p
        v-if="lead.tier?.label"
        class="max-w-24 shrink-0 text-right text-xs leading-tight text-muted"
      >
        {{ lead.tier.label }}
      </p>
    </div>

    <div
      v-if="hot || noWebsite"
      class="mt-2 flex flex-wrap gap-1.5"
    >
      <UBadge
        v-if="hot"
        color="error"
        variant="soft"
        icon="i-lucide-flame"
      >
        Hot
      </UBadge>
      <UBadge
        v-if="noWebsite"
        color="warning"
        variant="soft"
        icon="i-lucide-globe"
      >
        No website
      </UBadge>
    </div>

    <div class="mt-3 grid grid-cols-3 gap-1.5">
      <UButton
        :to="`/businesses/${lead.business.id}`"
        size="sm"
        variant="soft"
        class="min-h-11 min-w-0 justify-center px-1"
      >
        Review
      </UButton>
      <UButton
        size="sm"
        variant="outline"
        class="min-h-11 min-w-0 justify-center whitespace-normal px-1 text-center text-xs leading-tight"
        @click="emit('generate', lead.business.id)"
      >
        Generate mockup
      </UButton>
      <UButton
        size="sm"
        color="neutral"
        variant="outline"
        class="min-h-11 min-w-0 justify-center px-1"
        :loading="skipping"
        @click="emit('skip', lead.business.id)"
      >
        Skip
      </UButton>
    </div>
  </article>
</template>
