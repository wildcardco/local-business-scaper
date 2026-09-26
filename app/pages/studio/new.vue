<script setup lang="ts">
const toast = useToast()
const router = useRouter()
const isSaving = ref(false)

const form = ref({
  name: '',
  category: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  generateNow: true
})

async function submit() {
  if (!form.value.name.trim()) {
    toast.add({
      title: 'Name required',
      description: 'Enter the business name',
      color: 'error'
    })
    return
  }

  isSaving.value = true
  try {
    const created = await $fetch('/api/businesses/manual', {
      method: 'POST',
      body: form.value
    })

    if (form.value.generateNow && created.mockup?.id) {
      await $fetch('/api/mockups/generate', {
        method: 'POST',
        body: { mockupId: created.mockup.id }
      })
    }

    toast.add({
      title: form.value.generateNow ? 'Mockup started' : 'Business saved',
      color: 'success'
    })
    router.push(`/studio/${created.mockup.id}`)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Could not create mockup',
      description: err.data?.message || 'Try again',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-28 sm:pb-6">
    <div>
      <p class="eyebrow">Studio</p>
      <h1 class="font-display text-2xl font-semibold tracking-tight">New mockup</h1>
      <p class="text-muted">Manual intake for a business that is not in search results yet.</p>
    </div>

    <UCard class="max-w-2xl">
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Business name">
          <UInput v-model="form.name" size="lg" class="w-full" icon="i-lucide-building-2" />
        </UFormField>
        <UFormField label="Category">
          <UInput v-model="form.category" size="lg" class="w-full" placeholder="plumber, salon, gym…" />
        </UFormField>
        <UFormField label="Website">
          <UInput v-model="form.website" size="lg" class="w-full" icon="i-lucide-globe" placeholder="https://" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Phone">
            <UInput v-model="form.phone" size="lg" class="w-full" icon="i-lucide-phone" />
          </UFormField>
          <UFormField label="Email">
            <UInput v-model="form.email" type="email" size="lg" class="w-full" icon="i-lucide-mail" />
          </UFormField>
        </div>
        <UFormField label="Street address">
          <UInput v-model="form.address" size="lg" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="City">
            <UInput v-model="form.city" size="lg" class="w-full" />
          </UFormField>
          <UFormField label="State">
            <UInput v-model="form.state" size="lg" class="w-full" />
          </UFormField>
        </div>
        <UCheckbox v-model="form.generateNow" label="Generate mockup now" />
      </form>
    </UCard>

    <div
      class="fixed bottom-0 inset-x-0 sm:static z-20 flex justify-center sm:justify-start p-4 sm:p-0"
    >
      <UButton
        class="min-h-11 w-full sm:w-auto"
        size="lg"
        :loading="isSaving"
        :style="{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }"
        @click="submit"
      >
        {{ form.generateNow ? 'Generate mockup' : 'Save business' }}
      </UButton>
    </div>
  </div>
</template>
