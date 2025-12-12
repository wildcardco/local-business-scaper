<script setup lang="ts">
interface LogEntry {
  id: string
  timestamp: Date
  type: 'request' | 'response' | 'error' | 'info'
  method?: string
  url?: string
  status?: number
  duration?: number
  message?: string
  data?: unknown
}

const isOpen = ref(false)
const isMinimized = ref(false)
const logs = ref<LogEntry[]>([])
const maxLogs = 50

// Provide a global function to add logs
const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
  const newEntry: LogEntry = {
    ...entry,
    id: Math.random().toString(36).substring(7),
    timestamp: new Date()
  }
  logs.value.unshift(newEntry)
  if (logs.value.length > maxLogs) {
    logs.value.pop()
  }
}

// Expose to parent components
defineExpose({ addLog, logs })

// Provide globally via composable pattern
provide('debugPanel', { addLog, logs, isOpen })

function clearLogs() {
  logs.value = []
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

function getTypeColor(type: LogEntry['type']) {
  switch (type) {
    case 'request': return 'text-blue-400'
    case 'response': return 'text-green-400'
    case 'error': return 'text-red-400'
    case 'info': return 'text-gray-400'
    default: return 'text-gray-400'
  }
}

function getTypeIcon(type: LogEntry['type']) {
  switch (type) {
    case 'request': return 'i-lucide-arrow-up-right'
    case 'response': return 'i-lucide-arrow-down-left'
    case 'error': return 'i-lucide-alert-circle'
    case 'info': return 'i-lucide-info'
    default: return 'i-lucide-circle'
  }
}

function getStatusColor(status?: number) {
  if (!status) return ''
  if (status >= 200 && status < 300) return 'text-green-400'
  if (status >= 300 && status < 400) return 'text-yellow-400'
  if (status >= 400 && status < 500) return 'text-orange-400'
  if (status >= 500) return 'text-red-400'
  return ''
}

// Intercept fetch to log API calls
const originalFetch = globalThis.fetch
globalThis.fetch = async (...args) => {
  const [input, init] = args
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
  const method = init?.method || 'GET'

  // Only log API calls (not assets)
  const isApiCall = url.includes('/api/') || url.includes('googleapis.com') || url.includes('rapidapi.com')

  if (isApiCall) {
    const requestId = Math.random().toString(36).substring(7)
    const startTime = Date.now()

    addLog({
      type: 'request',
      method,
      url: url.length > 100 ? url.substring(0, 100) + '...' : url,
      message: `${method} ${url.split('?')[0].split('/').slice(-2).join('/')}`
    })

    try {
      const response = await originalFetch(...args)
      const duration = Date.now() - startTime

      addLog({
        type: response.ok ? 'response' : 'error',
        method,
        url: url.length > 100 ? url.substring(0, 100) + '...' : url,
        status: response.status,
        duration,
        message: `${response.status} ${response.statusText} (${duration}ms)`
      })

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      addLog({
        type: 'error',
        method,
        url: url.length > 100 ? url.substring(0, 100) + '...' : url,
        duration,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  return originalFetch(...args)
}

// Keyboard shortcut to toggle
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      isOpen.value = !isOpen.value
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <!-- Toggle Button -->
  <button
    class="fixed bottom-4 right-4 z-[60] p-3 rounded-full bg-gray-800 border border-gray-700 shadow-lg hover:bg-gray-700 transition-colors"
    :class="{ 'ring-2 ring-primary-500': logs.length > 0 && !isOpen }"
    @click="isOpen = !isOpen"
    title="Toggle Debug Panel (Ctrl+Shift+D)"
  >
    <UIcon name="i-lucide-terminal" class="text-lg text-gray-300" />
    <span
      v-if="logs.length > 0 && !isOpen"
      class="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center"
    >
      {{ logs.length > 9 ? '9+' : logs.length }}
    </span>
  </button>

  <!-- Debug Panel -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed bottom-0 right-0 z-50 w-full md:w-[600px] bg-gray-900 border-t md:border-l border-gray-700 shadow-2xl font-mono text-sm"
      :class="isMinimized ? 'h-12' : 'h-80 md:h-96'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-terminal" class="text-primary-500" />
          <span class="font-semibold text-gray-200">API Debug Console</span>
          <UBadge color="neutral" variant="soft" size="xs">
            {{ logs.length }} logs
          </UBadge>
        </div>
        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="clearLogs"
            title="Clear logs"
          />
          <UButton
            :icon="isMinimized ? 'i-lucide-maximize-2' : 'i-lucide-minimize-2'"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="isMinimized = !isMinimized"
            title="Minimize/Maximize"
          />
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="isOpen = false"
            title="Close"
          />
        </div>
      </div>

      <!-- Logs -->
      <div v-if="!isMinimized" class="h-[calc(100%-48px)] overflow-y-auto p-2 space-y-1">
        <div v-if="logs.length === 0" class="text-center py-8 text-gray-500">
          <UIcon name="i-lucide-radio" class="text-2xl mb-2" />
          <p>No API activity yet</p>
          <p class="text-xs mt-1">API calls will appear here</p>
        </div>

        <div
          v-for="log in logs"
          :key="log.id"
          class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-800/50 group"
        >
          <span class="text-gray-500 text-xs shrink-0 mt-0.5">
            {{ formatTime(log.timestamp) }}
          </span>
          <UIcon
            :name="getTypeIcon(log.type)"
            :class="getTypeColor(log.type)"
            class="shrink-0 mt-0.5"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span
                v-if="log.method"
                class="px-1.5 py-0.5 rounded text-xs font-medium"
                :class="{
                  'bg-blue-500/20 text-blue-400': log.method === 'GET',
                  'bg-green-500/20 text-green-400': log.method === 'POST',
                  'bg-yellow-500/20 text-yellow-400': log.method === 'PATCH',
                  'bg-red-500/20 text-red-400': log.method === 'DELETE'
                }"
              >
                {{ log.method }}
              </span>
              <span
                v-if="log.status"
                class="text-xs font-medium"
                :class="getStatusColor(log.status)"
              >
                {{ log.status }}
              </span>
              <span v-if="log.duration" class="text-xs text-gray-500">
                {{ log.duration }}ms
              </span>
            </div>
            <p class="text-gray-300 text-xs mt-0.5 truncate" :title="log.url">
              {{ log.message || log.url }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>






















