<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { loggedIn, user, clear: logout, fetch: refreshSession } = useUserSession()
const toast = useToast()
const router = useRouter()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en',
    class: 'dark'
  }
})

const title = 'Wild Card Lead Gen'
const description = 'Local business lead generation and website auditing tool for Wild Card Creative Co.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const navigation: NavigationMenuItem[][] = [[
  {
    label: 'Dashboard',
    to: '/',
    icon: 'i-lucide-layout-dashboard'
  },
  {
    label: 'Businesses',
    to: '/businesses',
    icon: 'i-lucide-building-2'
  },
  {
    label: 'Approval Queue',
    to: '/queue',
    icon: 'i-lucide-check-square'
  },
  {
    label: 'Inbox',
    to: '/inbox',
    icon: 'i-lucide-inbox'
  },
  {
    label: 'Templates',
    to: '/templates',
    icon: 'i-lucide-mail'
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: 'i-lucide-settings'
  }
]]

async function handleLogout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await logout()
    toast.add({
      title: 'Logged out',
      description: 'You have been logged out successfully',
      color: 'info'
    })
    router.push('/login')
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to log out',
      color: 'error'
    })
  }
}

// Ensure session is loaded
onMounted(() => {
  refreshSession()
})
</script>

<template>
  <NuxtLayout>
    <UApp v-if="loggedIn">
      <UDashboardGroup>
        <UDashboardSidebar
          collapsible
          resizable
          :menu="{ title: 'Navigation', description: 'Wild Card Lead Gen navigation' }"
        >
          <template #header="{ collapsed }">
            <div class="flex items-center gap-3">
              <UIcon name="i-wc-mark" class="size-9 text-white shrink-0" />
              <div v-if="!collapsed" class="flex flex-col">
                <span class="font-display font-semibold text-sm tracking-tight">Wild Card</span>
                <span class="eyebrow mb-0! text-[0.6rem]">Lead Gen</span>
              </div>
            </div>
          </template>

          <template #default="{ collapsed }">
            <UNavigationMenu
              :collapsed="collapsed"
              :items="navigation[0]"
              orientation="vertical"
            />
          </template>

          <template #footer="{ collapsed }">
            <div class="space-y-2">
              <!-- User Info -->
              <div v-if="!collapsed" class="px-3 py-2 border-t border-default">
                <div class="flex items-center gap-3">
                  <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 font-medium text-sm">
                    {{ user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U' }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ user?.name || 'User' }}</p>
                    <p class="text-xs text-muted truncate">{{ user?.email }}</p>
                  </div>
                </div>
              </div>

              <div class="flex items-center" :class="collapsed ? 'justify-center' : 'gap-2 px-3'">
                <UButton
                  v-if="!collapsed"
                  icon="i-lucide-log-out"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="handleLogout"
                >
                  Logout
                </UButton>
                <UButton
                  v-else
                  icon="i-lucide-log-out"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="handleLogout"
                />
              </div>
            </div>
          </template>
        </UDashboardSidebar>

        <UDashboardPanel>
          <template #header>
            <UDashboardNavbar>
              <template #leading>
                <UDashboardSidebarCollapse />
              </template>

              <template #trailing>
                <div class="flex items-center gap-2">
                  <span class="text-sm text-muted hidden sm:block">
                    {{ user?.name || user?.email }}
                  </span>
                  <UDropdownMenu
                    :items="[[
                      { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
                      { label: 'Logout', icon: 'i-lucide-log-out', click: handleLogout }
                    ]]"
                  >
                    <UButton
                      icon="i-lucide-user"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                    />
                  </UDropdownMenu>
                </div>
              </template>
            </UDashboardNavbar>
          </template>

          <template #body>
            <NuxtPage />
          </template>
        </UDashboardPanel>
      </UDashboardGroup>

      <UToaster />

      <!-- Debug Panel for API logging (toggle with Ctrl+Shift+D) -->
      <ClientOnly>
        <DebugPanel />
      </ClientOnly>
    </UApp>

    <!-- Show NuxtPage for auth pages when not logged in -->
    <NuxtPage v-else />
  </NuxtLayout>
</template>
