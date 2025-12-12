<script setup lang="ts">
const props = defineProps<{
  threadId: string
}>()

const { data, pending, refresh } = await useFetch(`/api/inbox/${props.threadId}`)
const thread = computed(() => data.value?.thread)

// Format date helper
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

// Status badge color
function getStatusColor(status: string): string {
  switch (status) {
    case 'sent': return 'neutral'
    case 'delivered': return 'primary'
    case 'opened': return 'info'
    case 'clicked': return 'success'
    case 'replied': return 'success'
    case 'bounced': return 'error'
    case 'complained': return 'error'
    default: return 'neutral'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="pending" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-primary" />
    </div>

    <!-- Thread Content -->
    <div v-else-if="thread" class="space-y-6">
      <!-- Thread Header -->
      <div class="border-b border-default pb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 class="text-2xl font-bold mb-2">{{ thread.subject }}</h2>
            <div class="flex items-center gap-3 text-sm text-muted">
              <div class="flex items-center gap-1">
                <UIcon name="i-lucide-building-2" />
                <span>{{ thread.businessName }}</span>
              </div>
              <span>•</span>
              <div class="flex items-center gap-1">
                <UIcon name="i-lucide-mail" />
                <span>{{ thread.emailTo }}</span>
              </div>
              <span v-if="thread.businessLocation">•</span>
              <span v-if="thread.businessLocation">{{ thread.businessLocation }}</span>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <UBadge v-if="thread.aiGenerated" color="primary" variant="soft">
              <UIcon name="i-lucide-sparkles" class="mr-1" />
              AI Generated
            </UBadge>
            <UBadge :color="getStatusColor(thread.status)" variant="soft">
              {{ thread.status }}
            </UBadge>
          </div>
        </div>

        <!-- Business Quick Info -->
        <div class="flex gap-4 text-sm">
          <a
            v-if="thread.businessWebsite"
            :href="thread.businessWebsite.startsWith('http') ? thread.businessWebsite : `https://${thread.businessWebsite}`"
            target="_blank"
            class="flex items-center gap-1 text-primary hover:underline"
          >
            <UIcon name="i-lucide-external-link" />
            Visit Website
          </a>
          <a
            v-if="thread.businessPhone"
            :href="`tel:${thread.businessPhone}`"
            class="flex items-center gap-1 text-primary hover:underline"
          >
            <UIcon name="i-lucide-phone" />
            {{ thread.businessPhone }}
          </a>
          <NuxtLink
            :to="`/businesses/${thread.businessId}`"
            class="flex items-center gap-1 text-primary hover:underline"
          >
            <UIcon name="i-lucide-arrow-right" />
            View Business Details
          </NuxtLink>
        </div>
      </div>

      <!-- Sent Email -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              WC
            </div>
            <div>
              <p class="font-semibold">Wild Card Creative</p>
              <p class="text-sm text-muted">to {{ thread.emailTo }}</p>
            </div>
          </div>
          <div class="text-sm text-muted">
            {{ formatDate(thread.sentAt) }}
          </div>
        </div>

        <UCard>
          <div 
            v-if="thread.generatedBody"
            class="prose prose-sm max-w-none"
            v-html="thread.generatedBody"
          />
          <p v-else class="text-muted italic">
            Email content not available
          </p>
        </UCard>
      </div>

      <!-- Replies -->
      <div v-if="thread.replies.length > 0" class="space-y-4">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-reply" />
          Replies ({{ thread.replies.length }})
        </h3>

        <div
          v-for="reply in thread.replies"
          :key="reply.id"
          class="space-y-3 pl-6 border-l-2 border-primary"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-surface border-2 border-default flex items-center justify-center font-semibold text-sm">
                {{ reply.fromEmail.charAt(0).toUpperCase() }}
              </div>
              <div>
                <p class="font-semibold">{{ reply.fromEmail }}</p>
                <p class="text-sm text-muted">{{ reply.subject }}</p>
              </div>
            </div>
            <div class="text-sm text-muted">
              {{ formatDate(reply.receivedAt) }}
            </div>
          </div>

          <UCard>
            <div 
              v-if="reply.bodyHtml"
              class="prose prose-sm max-w-none"
              v-html="reply.bodyHtml"
            />
            <pre v-else-if="reply.bodyText" class="whitespace-pre-wrap text-sm">{{ reply.bodyText }}</pre>
            <p v-else class="text-muted italic">
              No content
            </p>
          </UCard>
        </div>
      </div>

      <!-- No Replies State -->
      <div v-else class="text-center py-8 border-2 border-dashed border-default rounded-lg">
        <UIcon name="i-lucide-inbox" class="text-4xl text-muted mb-3" />
        <p class="text-muted">No replies yet</p>
        <p class="text-sm text-muted mt-1">
          When {{ thread.businessName }} replies, their message will appear here
        </p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else class="text-center py-12">
      <UIcon name="i-lucide-alert-circle" class="text-4xl text-error mb-3" />
      <p class="text-lg font-semibold">Thread not found</p>
    </div>
  </div>
</template>






