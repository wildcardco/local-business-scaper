<script setup lang="ts">
const props = defineProps<{
  lead: {
    score?: number | null
    angle?: string | null
    note?: string | null
    signals?: Record<string, unknown> | null
    tier?: { slug?: string | null, label?: string | null } | null
    business: {
      id: string
      name?: string | null
      category?: string | null
      rating?: number | null
      review_count?: number | null
      city?: string | null
      phone?: string | null
      website?: string | null
    }
    mockup?: {
      id: string
      status?: string | null
      url?: string | null
    } | null
  }
  tierSlug: string
}>()

const emit = defineEmits<{
  generateMockup: [businessId: string]
}>()

const tierColors: Record<string, { bg: string, text: string, border: string }> = {
  call_first: { bg: 'bg-wcRed-500/20', text: 'text-wcRed-400', border: 'border-wcRed-500/30' },
  good: { bg: 'bg-wcGold-400/20', text: 'text-wcGold-400', border: 'border-wcGold-400/30' },
  worth_a_look: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  long_shot: { bg: 'bg-neutral-500/20', text: 'text-neutral-400', border: 'border-neutral-500/30' },
  skip: { bg: 'bg-neutral-600/20', text: 'text-neutral-500', border: 'border-neutral-600/30' }
}

const colors = computed(() => tierColors[props.tierSlug] || tierColors.skip)

const signalTags = computed(() => {
  const signals = props.lead.signals
  if (!signals) return []
  return Object.entries(signals)
    .map(([key, value]) => signalLabel(key, value))
    .filter(Boolean)
})

function signalLabel(key: string, value: unknown): string {
  if (key === 'no_website' && value) return 'No website'
  if (key === 'agency_credit' && value) return `Agency: ${value}`
  if (key === 'copyright_year' && value) return `© ${value}`
  return ''
}
</script>

<template>
  <UCard class="overflow-hidden">
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h3 class="font-display font-semibold text-highlighted text-lg mb-1">
            {{ lead.business.name }}
          </h3>
          <p v-if="lead.business.category" class="text-sm text-muted mb-2">
            {{ lead.business.category }}
          </p>
        </div>
        <div
          :class="[
            'px-3 py-1 rounded-full border text-xs font-medium whitespace-nowrap',
            colors.bg,
            colors.text,
            colors.border
          ]"
        >
          {{ lead.tier?.label || 'Skip' }}
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div v-if="lead.score" class="flex items-center gap-1">
          <UIcon name="i-lucide-target" class="text-primary-500" />
          <span class="font-medium text-highlighted">{{ lead.score }}</span>
        </div>
        <div v-if="lead.business.rating" class="flex items-center gap-1">
          <UIcon name="i-lucide-star" class="text-wcGold-400" />
          <span class="text-highlighted">{{ lead.business.rating }}</span>
          <span class="text-muted">({{ lead.business.review_count || 0 }})</span>
        </div>
        <div v-if="lead.business.city" class="flex items-center gap-1">
          <UIcon name="i-lucide-map-pin" class="text-muted" />
          <span class="text-muted">{{ lead.business.city }}</span>
        </div>
      </div>

      <div v-if="lead.angle || lead.note" class="space-y-2 text-sm">
        <div v-if="lead.angle" class="flex items-start gap-2">
          <UIcon name="i-lucide-lightbulb" class="text-wcGold-400 mt-0.5 shrink-0" />
          <p class="text-muted">{{ lead.angle }}</p>
        </div>
        <div v-if="lead.note" class="flex items-start gap-2">
          <UIcon name="i-lucide-sticky-note" class="text-blue-400 mt-0.5 shrink-0" />
          <p class="text-muted">{{ lead.note }}</p>
        </div>
      </div>

      <div v-if="signalTags.length" class="flex flex-wrap gap-2">
        <span
          v-for="tag in signalTags"
          :key="tag"
          class="px-2 py-1 rounded text-xs bg-neutral-500/20 text-neutral-400 border border-neutral-500/30"
        >
          {{ tag }}
        </span>
      </div>

      <div class="flex flex-wrap gap-2 pt-2 border-t border-default">
        <UButton
          v-if="lead.business.phone"
          :to="`tel:${lead.business.phone}`"
          size="sm"
          variant="outline"
          icon="i-lucide-phone"
        >
          Call
        </UButton>
        <UButton
          v-if="lead.business.website"
          :to="lead.business.website"
          target="_blank"
          size="sm"
          variant="outline"
          icon="i-lucide-globe"
          trailing-icon="i-lucide-external-link"
        >
          Website
        </UButton>
        <UButton
          :to="`/businesses/${lead.business.id}`"
          size="sm"
          variant="outline"
          icon="i-lucide-info"
        >
          Details
        </UButton>
      </div>

      <div v-if="lead.mockup" class="rounded-lg border border-default bg-muted p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-highlighted mb-1">Mockup</p>
            <p class="text-xs text-muted capitalize">{{ String(lead.mockup.status || '').replace(/_/g, ' ') }}</p>
          </div>
          <UButton
            :to="`/studio/${lead.mockup.id}`"
            size="xs"
            variant="soft"
            trailing-icon="i-lucide-arrow-right"
          >
            View
          </UButton>
        </div>
        <UButton
          v-if="lead.mockup.url"
          :to="lead.mockup.url"
          target="_blank"
          size="xs"
          variant="ghost"
          color="neutral"
          trailing-icon="i-lucide-external-link"
          class="mt-2"
        >
          Live mockup
        </UButton>
      </div>
      <div v-else>
        <UButton
          size="sm"
          icon="i-lucide-palette"
          block
          @click="emit('generateMockup', lead.business.id)"
        >
          Generate mockup
        </UButton>
      </div>
    </div>
  </UCard>
</template>
