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
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black">
    <div class="w-full max-w-md px-6">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-500/25">
          W
        </div>
        <h1 class="text-2xl font-bold text-white">Wild Card Lead Gen</h1>
        <p class="text-gray-400 mt-1">Sign in to your account</p>
      </div>

      <!-- Login Form -->
      <UCard class="backdrop-blur-sm bg-gray-900/50 border border-gray-800">
        <form class="space-y-5" @submit.prevent="handleLogin">
          <UFormField label="Username">
            <UInput
              v-model="form.username"
              placeholder="Your username"
              icon="i-lucide-user"
              size="lg"
              autocomplete="username"
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
          <p class="text-gray-400 text-sm">
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








