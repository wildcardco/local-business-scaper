<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const toast = useToast()
const router = useRouter()
const route = useRoute()
const { fetch: refreshSession } = useUserSession()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const isSending = ref(false)
const isVerifying = ref(false)

const redirectTo = computed(() => {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    // Reject URLs with backslashes or schemes (e.g. /\evil.com, /%5Cevil.com)
    const decoded = decodeURIComponent(redirect)
    if (decoded.includes('\\') || decoded.includes(':')) {
      return '/'
    }
    return redirect
  }
  return '/'
})

async function sendCode() {
  if (!email.value.trim() || !email.value.includes('@')) {
    toast.add({
      title: 'Email required',
      description: 'Enter your Wild Card email',
      color: 'error'
    })
    return
  }

  isSending.value = true
  try {
    await $fetch('/api/auth/request-code', {
      method: 'POST',
      body: { email: email.value }
    })
    step.value = 'code'
    code.value = ''
    toast.add({
      title: 'Code sent',
      description: 'Check your inbox for a 6-digit code',
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Could not send code',
      description: err.data?.message || 'Try again',
      color: 'error'
    })
  } finally {
    isSending.value = false
  }
}

async function verifyCode() {
  if (!/^\d{6}$/.test(code.value.trim())) {
    toast.add({
      title: 'Enter the 6-digit code',
      color: 'error'
    })
    return
  }

  isVerifying.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        code: code.value
      }
    })

    await refreshSession()
    toast.add({
      title: 'Welcome back!',
      color: 'success'
    })
    router.push(redirectTo.value)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Sign-in failed',
      description: err.data?.message || 'Invalid or expired code',
      color: 'error'
    })
  } finally {
    isVerifying.value = false
  }
}

function useDifferentEmail() {
  step.value = 'email'
  code.value = ''
}
</script>

<template>
  <div class="relative min-h-screen flex items-center justify-center bg-default overflow-hidden">
    <div class="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-140 rounded-full blur-[60px]" style="background: radial-gradient(circle, rgba(214, 41, 62, 0.13), transparent 65%)" />
    <div class="pointer-events-none absolute bottom-0 right-0 size-105 rounded-full blur-[60px]" style="background: radial-gradient(circle, rgba(214, 41, 62, 0.08), transparent 65%)" />

    <div class="relative w-full max-w-md px-6">
      <div class="text-center mb-8">
        <UIcon name="i-wc-mark" class="size-16 text-white mb-4" />
        <h1 class="font-display text-2xl font-semibold tracking-tight text-highlighted">Wild Card Lead Gen</h1>
        <p class="text-muted mt-1">
          {{ step === 'email' ? 'Sign in with your email' : 'Enter the code we sent you' }}
        </p>
      </div>

      <UCard>
        <form v-if="step === 'email'" class="space-y-5" @submit.prevent="sendCode">
          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@wildcardcreativeco.com"
              icon="i-lucide-mail"
              size="lg"
              autocomplete="email"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="isSending"
            class="mt-6"
          >
            <template #leading>
              <UIcon v-if="!isSending" name="i-lucide-mail" />
            </template>
            Send code
          </UButton>
        </form>

        <form v-else class="space-y-5" @submit.prevent="verifyCode">
          <p class="text-sm text-muted">
            We sent a 6-digit code to <span class="text-highlighted">{{ email }}</span>.
          </p>

          <UFormField label="Code">
            <UInput
              v-model="code"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              placeholder="000000"
              icon="i-lucide-key-round"
              size="lg"
              autocomplete="one-time-code"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="isVerifying"
            class="mt-6"
          >
            <template #leading>
              <UIcon v-if="!isVerifying" name="i-lucide-log-in" />
            </template>
            Sign in
          </UButton>

          <div class="flex flex-wrap justify-between gap-2 text-sm">
            <UButton
              variant="ghost"
              color="neutral"
              :loading="isSending"
              @click="sendCode"
            >
              Resend code
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              @click="useDifferentEmail"
            >
              Use a different email
            </UButton>
          </div>
        </form>
      </UCard>
    </div>
  </div>
</template>
