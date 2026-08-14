<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const toast = useToast()
const router = useRouter()
const { fetch: refreshSession } = useUserSession()

const isLoading = ref(false)
const form = ref({
  username: '',
  password: ''
})

async function handleLogin() {
  if (!form.value.username || !form.value.password) {
    toast.add({
      title: 'Missing fields',
      description: 'Please fill in all fields',
      color: 'error'
    })
    return
  }

  isLoading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: form.value
    })

    await refreshSession()

    toast.add({
      title: 'Welcome back!',
      description: 'You have been logged in successfully',
      color: 'success'
    })

    router.push('/')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Login failed',
      description: err.data?.message || 'Invalid credentials',
      color: 'error'
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen flex items-center justify-center bg-default overflow-hidden">
    <!-- Red radial atmosphere (official hero treatment, restrained) -->
    <div class="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-140 rounded-full blur-[60px]" style="background: radial-gradient(circle, rgba(214, 41, 62, 0.13), transparent 65%)" />
    <div class="pointer-events-none absolute bottom-0 right-0 size-105 rounded-full blur-[60px]" style="background: radial-gradient(circle, rgba(214, 41, 62, 0.08), transparent 65%)" />

    <div class="relative w-full max-w-md px-6">
      <!-- Logo -->
      <div class="text-center mb-8">
        <UIcon name="i-wc-mark" class="size-16 text-white mb-4" />
        <h1 class="font-display text-2xl font-semibold tracking-tight text-highlighted">Wild Card Lead Gen</h1>
        <p class="text-muted mt-1">Sign in to your account</p>
      </div>

      <!-- Login Form -->
      <UCard>
        <form class="space-y-5" @submit.prevent="handleLogin">
          <UFormField label="Username">
            <UInput
              v-model="form.username"
              placeholder="Your username"
              icon="i-lucide-user"
              size="lg"
              autocomplete="username"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              icon="i-lucide-lock"
              size="lg"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="isLoading"
            class="mt-6"
          >
            <template #leading>
              <UIcon v-if="!isLoading" name="i-lucide-log-in" />
            </template>
            Sign In
          </UButton>
        </form>

        <div class="mt-6 text-center">
          <p class="text-muted text-sm">
            Don't have an account?
            <NuxtLink to="/register" class="text-primary-400 hover:text-primary-300 font-medium">
              Create one
            </NuxtLink>
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>








