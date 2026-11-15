<script setup lang="ts">
import { webStackStatusLabel } from '~~/shared/web-stack'

const props = defineProps<{
  lead: {
    score?: number | null
    angle?: string | null
    note?: string | null
    signals?: Record<string, unknown> | null
    lead_group?: string | null
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
      state?: string | null
      address?: string | null
      emails?: string[] | null
      photo_count?: number | null
      gbp_photos?: unknown
      placeId?: string | null
      researchStatus?: string | null
      researchRequestedAt?: string | null
    }
    mockup?: {
      id: string
      status?: string | null
      url?: string | null
      buildMode?: string | null
      previewUrl?: string | null
      agentUrl?: string | null
      buildStatus?: string | null
      buildError?: string | null
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

const siteCheck = computed(() => {
  const value = props.lead.signals?.site_check
  return typeof value === 'string' ? value : null
})

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

      <LeadContextBlock
        :score="lead.score"
        :category="lead.business.category"
        :lead-group="lead.lead_group"
        :website="lead.business.website"
        :site-check="siteCheck"
        :rating="lead.business.rating"
        :review-count="lead.business.review_count"
        :phone="lead.business.phone"
        :address="lead.business.address"
        :city="lead.business.city"
        :state="lead.business.state"
        :angle="lead.angle"
        :photo-count="lead.business.photo_count"
        :photos="lead.business.gbp_photos"
        :emails="lead.business.emails"
      />

      <div
        v-if="lead.note"
        class="flex items-start gap-2 text-sm"
      >
        <UIcon
          name="i-lucide-sticky-note"
          class="mt-0.5 shrink-0 text-blue-400"
        />
        <p class="min-w-0 break-words text-muted">
          {{ lead.note }}
        </p>
      </div>

      <div
        v-if="signalTags.length"
        class="flex flex-wrap gap-2"
      >
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
      <ResearchReportButton
        :business-id="lead.business.id"
        :place-id="lead.business.placeId"
        :research-status="lead.business.researchStatus"
        :research-requested-at="lead.business.researchRequestedAt"
        :name="lead.business.name"
        :city="lead.business.city"
        :website="lead.business.website"
        :phone="lead.business.phone"
        :address="lead.business.address"
      />

      <div
        v-if="lead.mockup"
        class="rounded-lg border border-default bg-muted p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-highlighted mb-1">
              Mockup
            </p>
            <p class="text-xs text-muted capitalize">
              {{ lead.mockup.buildMode === 'web_stack'
                ? webStackStatusLabel(String(lead.mockup.status || ''), lead.mockup.buildStatus)
                : String(lead.mockup.status || '').replace(/_/g, ' ') }}
            </p>
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
        <WebStackStatus
          v-if="lead.mockup.buildMode === 'web_stack'"
          class="mt-2"
          :preview-url="lead.mockup.previewUrl"
          :agent-url="lead.mockup.agentUrl"
          :error="lead.mockup.buildError"
        />
        <UButton
          v-else-if="lead.mockup.url"
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
