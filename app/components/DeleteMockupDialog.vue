<script setup lang="ts">
const props = defineProps<{
  mockupId: string
  repo: string | null
}>()

const router = useRouter()
const toast = useToast()

const open = ref(false)
const typed = ref('')
const running = ref(false)
const errorMessage = ref('')

const matches = computed(() => typed.value.trim().toLowerCase() === (props.repo || '').toLowerCase())

function show() {
  typed.value = ''
  errorMessage.value = ''
  open.value = true
}

function readError(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' && data.message) {
      return data.message
    }
  }
  if (error instanceof Error && error.message) return error.message
  return 'Could not delete this mockup.'
}

async function confirmDelete() {
  if (!props.repo || !matches.value || running.value) return
  running.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/mockups/${props.mockupId}/delete`, {
      method: 'POST',
      body: { confirm: typed.value.trim() }
    })
    open.value = false
    toast.add({
      title: 'Mockup deleted',
      description: 'That Studio record, its Vercel project, and its GitHub repo are gone.',
      color: 'success'
    })
    await router.push('/studio')
  } catch (error: unknown) {
    errorMessage.value = readError(error)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="min-w-0">
    <UButton
      class="min-h-11 w-full justify-center sm:w-auto"
      color="error"
      variant="outline"
      icon="i-lucide-trash-2"
      data-delete-mockup
      :disabled="!repo"
      @click="show"
    >
      Delete mockup
    </UButton>

    <UModal
      v-model:open="open"
      title="Delete this mockup?"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-md' }"
    >
      <template #body>
        <div class="min-w-0 space-y-3">
          <p
            v-if="repo"
            class="text-sm text-muted"
          >
            This removes only this Studio record, its Vercel project, and the GitHub repo
            <span class="break-words font-mono text-xs font-medium text-highlighted">{{ repo }}</span>.
            Other mockups stay.
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            This mockup has no wildcardco/wildcard-mockup repo on file, so it cannot be deleted from here.
          </p>
          <UFormField
            v-if="repo"
            label="Type the repo name to confirm"
          >
            <UInput
              v-model="typed"
              data-delete-confirm-input
              class="w-full"
              size="md"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :placeholder="repo"
            />
          </UFormField>
          <p
            v-if="errorMessage"
            class="break-words text-sm text-error"
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
            @click="open = false"
          >
            Cancel
          </UButton>
          <UButton
            data-delete-confirm
            color="error"
            :disabled="!matches"
            :loading="running"
            @click="confirmDelete"
          >
            Delete this mockup
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
