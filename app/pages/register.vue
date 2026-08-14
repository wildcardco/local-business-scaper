<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const toast = useToast()
const router = useRouter()
const { fetch: refreshSession } = useUserSession()

const isLoading = ref(false)
const form = ref({
  name: '',
  username: '',
  password: '',
  confirmPassword: ''
})

async function handleRegister() {
  if (!form.value.name || !form.value.username || !form.value.password) {
    toast.add({
      title: 'Missing fields',
      description: 'Please fill in all fields',
      color: 'error'
    })
    return
  }

  if (form.value.username.length < 3) {
    toast.add({
      title: 'Username too short',
      description: 'Username must be at least 3 characters',
      color: 'error'
    })
    return
  }

  if (form.value.password !== form.value.confirmPassword) {
    toast.add({
      title: 'Passwords do not match',
      description: 'Please make sure both passwords match',
      color: 'error'
    })
    return
  }

  if (form.value.password.length < 8) {
    toast.add({
      title: 'Password too short',
      description: 'Password must be at least 8 characters',
      color: 'error'
    })
    return
  }

  isLoading.value = true

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        name: form.value.name,
        username: form.value.username,
        password: form.value.password
      }
    })

    await refreshSession()

    toast.add({
      title: 'Account created!',
      description: 'Welcome to Wild Card Lead Gen',
      color: 'success'
    })

    router.push('/')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Registration failed',
      description: err.data?.message || 'Could not create account',
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
        <h1 class="font-display text-2xl font-semibold tracking-tight text-highlighted">Create Account</h1>
        <p class="text-muted mt-1">Start generating leads today</p>
      </div>

      <!-- Register Form -->
      <UCard>
        <form class="space-y-5" @submit.prevent="handleRegister">
          <UFormField label="Name">
            <UInput
              v-model="form.name"
              placeholder="Your name"
              icon="i-lucide-user"
              size="lg"
              autocomplete="name"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Username">
            <UInput
              v-model="form.username"
              placeholder="Choose a username"
              icon="i-lucide-at-sign"
              size="lg"
              autocomplete="username"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="form.password"
              type="password"
              placeholder="At least 8 characters"
              icon="i-lucide-lock"
              size="lg"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Confirm Password">
            <UInput
              v-model="form.confirmPassword"
              type="password"
              placeholder="Confirm your password"
              icon="i-lucide-lock"
              size="lg"
              autocomplete="new-password"
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
              <UIcon v-if="!isLoading" name="i-lucide-user-plus" />
            </template>
            Create Account
          </UButton>
        </form>

        <div class="mt-6 text-center">
          <p class="text-muted text-sm">
            Already have an account?
            <NuxtLink to="/login" class="text-primary-400 hover:text-primary-300 font-medium">
              Sign in
            </NuxtLink>
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>








