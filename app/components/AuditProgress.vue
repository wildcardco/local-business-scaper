<script setup lang="ts">
interface AuditState {
  isAuditing: boolean
  businessId: string | null
  businessName: string | null
  website: string | null
  currentStep: number
  steps: {
    label: string
    status: 'pending' | 'active' | 'complete' | 'error'
    detail?: string
  }[]
  error: string | null
  result: {
    performanceScore: number
    seoScore: number
    accessibilityScore: number
    leadScore: number
    leadCategory: string
  } | null
}

const props = defineProps<{
  state: AuditState
}>()

const emit = defineEmits<{
  close: []
}>()

const progressPercent = computed(() => {
  if (!props.state.isAuditing) return 0
  const completed = props.state.steps.filter(s => s.status === 'complete').length
  const active = props.state.steps.filter(s => s.status === 'active').length
  return Math.round(((completed + active * 0.5) / props.state.steps.length) * 100)
})

const getStepIcon = (status: string) => {
  switch (status) {
    case 'complete': return 'i-lucide-check-circle'
    case 'active': return 'i-lucide-loader-2'
    case 'error': return 'i-lucide-x-circle'
    default: return 'i-lucide-circle'
  }
}

const getStepColor = (status: string) => {
  switch (status) {
    case 'complete': return 'text-success-400'
    case 'active': return 'text-primary-400'
    case 'error': return 'text-error-400'
    default: return 'text-dimmed'
  }
}

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-success-400'
  if (score >= 50) return 'text-warning-400'
  return 'text-error-400'
}

const isOpen = computed({
  get: () => props.state.isAuditing || !!props.state.result || !!props.state.error,
  set: (value: boolean) => {
    if (!value && !props.state.isAuditing) emit('close')
  }
})

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'hot': return 'error'
    case 'warm': return 'warning'
    case 'cold': return 'info'
    default: return 'neutral'
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :dismissible="!state.isAuditing"
    :close="false"
    :ui="{ content: 'max-w-md' }"
  >
    <template #content>
      <div class="overflow-hidden">
        <!-- Header -->
        <div class="bg-elevated px-6 py-4 border-b border-default">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center"
                :class="state.error ? 'bg-error-500/15' : state.result ? 'bg-success-500/15' : 'bg-primary-500/15'"
              >
                <UIcon
                  :name="state.error ? 'i-lucide-alert-triangle' : state.result ? 'i-lucide-check-circle' : 'i-lucide-scan'"
                  :class="state.error ? 'text-error-400' : state.result ? 'text-success-400' : 'text-primary-400'"
                  class="text-xl"
                />
              </div>
              <div>
                <h3 class="font-display font-semibold">
                  {{ state.error ? 'Audit Failed' : state.result ? 'Audit Complete' : 'Running Audit' }}
                </h3>
                <p class="text-sm text-muted truncate max-w-[250px]" :title="state.businessName || ''">
                  {{ state.businessName || 'Unknown Business' }}
                </p>
              </div>
            </div>
            <UButton
              v-if="!state.isAuditing"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="emit('close')"
            />
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="state.isAuditing" class="h-1 bg-elevated">
          <div
            class="h-full bg-primary-500 transition-all duration-500 ease-out"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>

        <!-- Content -->
        <div class="p-6">
            <!-- Website being audited -->
            <div v-if="state.website && state.isAuditing" class="mb-4 text-center">
              <p class="text-sm text-muted">Analyzing</p>
              <p class="text-primary-400 font-mono text-sm truncate" :title="state.website">
                {{ state.website }}
              </p>
            </div>

            <!-- Steps (during audit) -->
            <div v-if="state.isAuditing" class="space-y-3">
              <div
                v-for="(step, index) in state.steps"
                :key="index"
                class="flex items-start gap-3"
              >
                <UIcon
                  :name="getStepIcon(step.status)"
                  :class="[
                    getStepColor(step.status),
                    step.status === 'active' ? 'animate-spin' : ''
                  ]"
                  class="mt-0.5"
                />
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium"
                    :class="step.status === 'pending' ? 'text-dimmed' : 'text-highlighted'"
                  >
                    {{ step.label }}
                  </p>
                  <p v-if="step.detail" class="text-xs text-muted truncate">
                    {{ step.detail }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Error State -->
            <div v-else-if="state.error" class="text-center py-4">
              <UIcon name="i-lucide-alert-triangle" class="text-4xl text-error-400 mb-3" />
              <p class="text-error-400 mb-2">{{ state.error }}</p>
              <p class="text-sm text-muted">Please try again or check the website URL.</p>
            </div>

            <!-- Results -->
            <div v-else-if="state.result" class="space-y-6">
              <!-- Scores Grid -->
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-elevated rounded-xl p-4 text-center">
                  <div
                    class="text-3xl font-bold mb-1"
                    :class="getScoreColor(state.result.performanceScore)"
                  >
                    {{ state.result.performanceScore }}
                  </div>
                  <div class="text-xs text-muted">Performance</div>
                </div>
                <div class="bg-elevated rounded-xl p-4 text-center">
                  <div
                    class="text-3xl font-bold mb-1"
                    :class="getScoreColor(state.result.seoScore)"
                  >
                    {{ state.result.seoScore }}
                  </div>
                  <div class="text-xs text-muted">SEO</div>
                </div>
                <div class="bg-elevated rounded-xl p-4 text-center">
                  <div
                    class="text-3xl font-bold mb-1"
                    :class="getScoreColor(state.result.accessibilityScore)"
                  >
                    {{ state.result.accessibilityScore }}
                  </div>
                  <div class="text-xs text-muted">Accessibility</div>
                </div>
                <div class="bg-elevated rounded-xl p-4 text-center">
                  <div class="text-3xl font-bold mb-1 text-primary-400">
                    {{ state.result.leadScore }}
                  </div>
                  <div class="text-xs text-muted">Lead Score</div>
                </div>
              </div>

              <!-- Lead Category -->
              <div class="flex items-center justify-center gap-3">
                <span class="text-muted">Lead Category:</span>
                <UBadge
                  :color="getCategoryColor(state.result.leadCategory)"
                  variant="solid"
                  size="lg"
                  class="capitalize"
                >
                  {{ state.result.leadCategory }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="!state.isAuditing" class="px-6 py-4 border-t border-default bg-elevated/50">
            <UButton
              block
              :color="state.error ? 'error' : 'primary'"
              @click="emit('close')"
            >
              {{ state.error ? 'Close' : 'Done' }}
            </UButton>
          </div>
      </div>
    </template>
  </UModal>
</template>






















