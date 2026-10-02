<script setup lang="ts">
const props = defineProps<{
  mockupId: string
  mockupUrl: string | null
  activeIndex: number | null
  assignments: Record<number, string>
  armed: boolean
}>()

const emit = defineEmits<{
  pick: [index: number]
  drop: [payload: { index: number, url: string }]
}>()

const frame = ref<HTMLIFrameElement | null>(null)
const src = computed(() => props.mockupUrl ? `/api/mockups/${props.mockupId}/preview` : '')

function paint() {
  const win = frame.value?.contentWindow
  if (!win) return
  win.postMessage({
    source: 'studio-parent',
    type: 'paint',
    activeIndex: props.activeIndex,
    assignments: props.assignments,
    armed: props.armed
  }, '*')
}

watch(() => [props.activeIndex, props.assignments, props.armed, props.mockupUrl], () => {
  paint()
}, { deep: true })

function onMessage(event: MessageEvent) {
  if (event.source !== frame.value?.contentWindow) return
  const data = event.data as { source?: string, type?: string, index?: number, url?: string } | null
  if (!data || data.source !== 'studio-preview') return
  if (data.type === 'pick' && typeof data.index === 'number') emit('pick', data.index)
  if (data.type === 'drop' && typeof data.index === 'number') {
    emit('drop', { index: data.index, url: String(data.url || '') })
  }
  if (data.type === 'slots') paint()
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-2xl border border-default bg-elevated">
    <div class="flex items-center justify-between gap-3 border-b border-default px-4 py-3">
      <h2 class="font-semibold">
        Live mockup
      </h2>
      <UButton
        v-if="mockupUrl"
        :to="mockupUrl"
        target="_blank"
        variant="ghost"
        size="sm"
        icon="i-lucide-external-link"
      >
        Open
      </UButton>
    </div>
    <iframe
      v-if="src"
      ref="frame"
      :src="src"
      class="h-[70vh] min-h-112 w-full bg-white lg:h-[78vh]"
      title="Live mockup"
      sandbox="allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
      @load="paint"
    />
    <p
      v-else
      class="px-4 py-16 text-sm text-muted"
    >
      No live mockup yet. Generate one and the page will open here.
    </p>
  </section>
</template>
