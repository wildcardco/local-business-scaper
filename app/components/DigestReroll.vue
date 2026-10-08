<script setup lang="ts">
import type { InputMenuItem } from '@nuxt/ui'
import {
  businessCategories,
  categoryDisplayLabel,
  categoryGroups,
  categoryIconForGroup,
  CLOSE_CATEGORY_MATCH_SCORE,
  resolveCategoryQuery
} from '~/data/business-categories'
import { getTodayCentralTime } from '~~/shared/date-utils'
import {
  digestStampChanged,
  digestStampFrom,
  nextRerollPollDelay,
  type DigestStamp
} from '~~/shared/digest-reroll'
import { suggestGoogleCategories } from '~~/shared/utils/google-categories'

const props = defineProps<{
  rerollCount?: number
}>()

const emit = defineEmits<{
  done: []
}>()

const randomMode = ref(true)
const selectedCategory = ref('')
const categorySearchTerm = ref('')
const confirmOpen = ref(false)
const running = ref(false)
const acknowledgeCost = ref(false)
const shownCount = ref(0)
const errorMessage = ref('')
const rebuilding = ref(false)
const rebuildTimedOut = ref(false)
const refreshing = ref(false)
const refreshError = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollBaseline: DigestStamp = { id: null, updatedAt: null }

onUnmounted(stopPoll)

function categoryMenuItem(cat: { label: string, value: string, group?: string }): InputMenuItem {
  return {
    label: cat.label,
    value: cat.value,
    icon: categoryIconForGroup(cat.group)
  }
}

const categoryItems = computed<InputMenuItem[]>(() => {
  const raw = categorySearchTerm.value
  const term = raw.trim()
  if (!term) {
    const items: InputMenuItem[] = [
      { label: 'Random', value: 'random', icon: 'i-lucide-shuffle' },
      { type: 'separator' }
    ]
    categoryGroups.forEach((group) => {
      items.push({ type: 'label', label: group })
      businessCategories
        .filter(cat => cat.group === group)
        .forEach(cat => items.push(categoryMenuItem(cat)))
      items.push({ type: 'separator' })
    })
    return items
  }

  const suggestions = suggestGoogleCategories(term)
  const presetItems = suggestions.map(row => categoryMenuItem(row))
  const best = suggestions[0]
  const exact: InputMenuItem = {
    label: raw,
    value: raw.trim(),
    icon: 'i-lucide-search'
  }
  const alreadyListed = presetItems.some(item =>
    typeof item === 'object' && item !== null && 'label' in item && item.label === raw
  )
  if (best && best.score >= CLOSE_CATEGORY_MATCH_SCORE) {
    const [match, ...rest] = presetItems
    if (!match || alreadyListed) return presetItems
    return [match, exact, ...rest]
  }
  if (alreadyListed) return presetItems
  return [exact, ...presetItems]
})

const categoryQuery = computed(() =>
  resolveCategoryQuery(selectedCategory.value || categorySearchTerm.value)
)

const categoryLabel = computed(() => {
  if (randomMode.value) return 'Random'
  return categoryDisplayLabel(categoryQuery.value)
})

const needsCostWarning = computed(() => shownCount.value >= 1)

const canConfirm = computed(() => !needsCostWarning.value || acknowledgeCost.value)

watch(selectedCategory, (value) => {
  const trimmed = value.trim()
  if (!trimmed) return
  if (trimmed.toLowerCase() === 'random') {
    randomMode.value = true
    selectedCategory.value = ''
    categorySearchTerm.value = ''
    return
  }
  randomMode.value = false
})

function chooseRandom() {
  randomMode.value = true
  selectedCategory.value = ''
  categorySearchTerm.value = ''
}

function commitTypedCategory() {
  const typed = categorySearchTerm.value.trim()
  if (!typed || selectedCategory.value.trim()) return
  if (typed.toLowerCase() === 'random') {
    chooseRandom()
    return
  }
  selectedCategory.value = typed
  randomMode.value = false
}

function openConfirm() {
  commitTypedCategory()
  if (!randomMode.value && !categoryQuery.value) return
  shownCount.value = Math.max(shownCount.value, Number(props.rerollCount || 0))
  acknowledgeCost.value = false
  errorMessage.value = ''
  confirmOpen.value = true
}

function readError(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const data = 'data' in error ? error.data : undefined
    if (data && typeof data === 'object' && data && 'message' in data && typeof data.message === 'string' && data.message) {
      return data.message
    }
    if ('message' in error && typeof error.message === 'string' && error.message) {
      return error.message
    }
  }
  return fallback
}

function isCostBlock(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const statusCode = 'statusCode' in error ? Number(error.statusCode) : 0
  const status = 'status' in error ? Number(error.status) : 0
  if (statusCode === 409 || status === 409) return true
  const data = 'data' in error ? error.data : undefined
  return Boolean(data && typeof data === 'object' && 'needsCostWarning' in data && data.needsCostWarning)
}

async function readDigestStamp(): Promise<DigestStamp> {
  const result = await $fetch<{ digest?: { id?: unknown, updated_at?: unknown } | null }>('/api/digests', {
    query: { date: getTodayCentralTime() }
  })
  return digestStampFrom(result.digest)
}

function stopPoll() {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}

function startPolling(before: DigestStamp) {
  stopPoll()
  pollBaseline = before
  rebuilding.value = true
  rebuildTimedOut.value = false
  refreshError.value = ''
  const started = Date.now()

  const tick = async () => {
    pollTimer = null
    let changed = false
    try {
      changed = digestStampChanged(before, await readDigestStamp())
    } catch {
      changed = false
    }
    if (changed) {
      rebuilding.value = false
      rebuildTimedOut.value = false
      emit('done')
      return
    }
    const delay = nextRerollPollDelay(Date.now() - started)
    if (delay == null) {
      rebuilding.value = false
      rebuildTimedOut.value = true
      return
    }
    pollTimer = setTimeout(tick, delay)
  }

  const initialDelay = nextRerollPollDelay(0)
  if (initialDelay == null) return
  pollTimer = setTimeout(tick, initialDelay)
}

async function refreshAfterWait() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const changed = digestStampChanged(pollBaseline, await readDigestStamp())
    if (changed) {
      rebuildTimedOut.value = false
      rebuilding.value = false
    }
    emit('done')
  } catch (error: unknown) {
    refreshError.value = readError(error, 'Could not refresh today\'s leads.')
  } finally {
    refreshing.value = false
  }
}

async function confirmReroll() {
  if (!canConfirm.value || running.value) return
  running.value = true
  errorMessage.value = ''
  try {
    const before = await readDigestStamp()
    const result = await $fetch<{ rerollCount?: number }>('/api/digests/reroll', {
      method: 'POST',
      body: {
        random: randomMode.value,
        category: randomMode.value ? 'random' : categoryQuery.value,
        acknowledgeCost: acknowledgeCost.value
      }
    })
    shownCount.value = Math.max(shownCount.value, Number(result?.rerollCount || shownCount.value + 1))
    confirmOpen.value = false
    startPolling(before)
  } catch (error: unknown) {
    if (isCostBlock(error)) {
      shownCount.value = Math.max(shownCount.value, 1)
      errorMessage.value = readError(error, 'Confirm the extra API cost before re-rolling again.')
      return
    }
    errorMessage.value = readError(error, 'Could not start the re-roll.')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-2">
    <div class="flex min-w-0 items-center gap-2">
      <UButton
        size="md"
        color="neutral"
        :variant="randomMode ? 'solid' : 'outline'"
        icon="i-lucide-shuffle"
        class="shrink-0"
        @click="chooseRandom"
      >
        Random
      </UButton>
      <UInputMenu
        v-model="selectedCategory"
        v-model:search-term="categorySearchTerm"
        :items="categoryItems"
        value-key="label"
        mode="autocomplete"
        ignore-filter
        create-item
        placeholder="Or pick a category"
        icon="i-lucide-store"
        size="md"
        open-on-focus
        class="min-w-0 flex-1"
        @blur="commitTypedCategory"
      />
    </div>
    <UButton
      block
      size="md"
      color="neutral"
      variant="outline"
      icon="i-lucide-refresh-cw"
      data-reroll-open
      @click="openConfirm"
    >
      Re-roll today's leads
    </UButton>

    <div
      v-if="rebuilding"
      data-reroll-rebuilding
      class="flex min-w-0 gap-2 rounded-lg border border-default bg-muted p-3 text-sm text-highlighted"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="mt-0.5 size-4 shrink-0 animate-spin text-primary"
      />
      <p>Rebuilding today's leads, about a minute.</p>
    </div>
    <div
      v-else-if="rebuildTimedOut"
      data-reroll-timeout
      class="min-w-0 space-y-2 rounded-lg border border-default bg-muted p-3"
    >
      <p class="text-sm text-highlighted">
        Today's leads are still rebuilding. Give it a moment, then refresh.
      </p>
      <p
        v-if="refreshError"
        class="text-sm text-error"
      >
        {{ refreshError }}
      </p>
      <UButton
        size="sm"
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="refreshing"
        @click="refreshAfterWait"
      >
        Refresh
      </UButton>
    </div>

    <UModal
      v-model:open="confirmOpen"
      title="Re-roll today's leads?"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-md' }"
    >
      <template #body>
        <div class="min-w-0 space-y-3">
          <p class="text-sm text-muted">
            This replaces today's list for you with a new search for
            <span class="font-medium text-highlighted">{{ categoryLabel }}</span>.
            The morning digest email is not sent again.
          </p>
          <div
            v-if="needsCostWarning"
            data-reroll-cost-warning
            class="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-highlighted"
          >
            <UIcon
              name="i-lucide-alert-triangle"
              class="mt-0.5 size-4 shrink-0 text-warning"
            />
            <p>
              You've already re-rolled today. Another search spends RapidAPI and scoring credits.
            </p>
          </div>
          <UCheckbox
            v-if="needsCostWarning"
            v-model="acknowledgeCost"
            label="I understand this spends more API credits"
          />
          <p
            v-if="errorMessage"
            class="text-sm text-error"
          >
            {{ errorMessage }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="running"
            @click="confirmOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            data-reroll-confirm
            :color="needsCostWarning ? 'warning' : 'primary'"
            :disabled="!canConfirm"
            :loading="running"
            @click="confirmReroll"
          >
            {{ needsCostWarning ? 'Re-roll anyway' : 'Re-roll now' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
