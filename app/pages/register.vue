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
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black">
    <div class="w-full max-w-md px-6">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-500/25">
          W
        </div>
        <h1 class="text-2xl font-bold text-white">Create Account</h1>
        <p class="text-gray-400 mt-1">Start generating leads today</p>
      </div>

      <!-- Register Form -->
      <UCard class="backdrop-blur-sm bg-gray-900/50 border border-gray-800">
        <form class="space-y-5" @submit.prevent="handleRegister">
          <UFormField label="Name">
            <UInput
              v-model="form.name"
              placeholder="Your name"
              icon="i-lucide-user"
              size="lg"
              autocomplete="name"
            />
          </UFormField>

          <UFormField label="Username">
            <UInput
              v-model="form.username"
              placeholder="Choose a username"
              icon="i-lucide-at-sign"
              size="lg"
              autocomplete="username"
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
          <p class="text-gray-400 text-sm">
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








