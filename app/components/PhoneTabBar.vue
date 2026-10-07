<script setup lang="ts">
const route = useRoute()

const tabs = [
  { label: 'Home', to: '/', icon: 'i-lucide-house', match: 'home' },
  { label: 'Leads', to: '/businesses', icon: 'i-lucide-building-2', match: 'leads' },
  { label: 'Studio', to: '/studio', icon: 'i-lucide-palette', match: 'studio' },
  { label: 'Search', to: '/?focus=search', icon: 'i-lucide-search', match: 'search' }
] as const

function active(match: string) {
  const path = route.path
  const searching = route.query.focus === 'search'
  if (match === 'search') return path === '/' && searching
  if (match === 'home') return path === '/' && !searching
  if (match === 'leads') return path.startsWith('/businesses') || path.startsWith('/leads')
  if (match === 'studio') return path.startsWith('/studio')
  return false
}
</script>

<template>
  <nav
    id="phone-tab-bar"
    class="phone-tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-default bg-default md:hidden"
    aria-label="Primary"
  >
    <div class="grid grid-cols-4">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.match"
        :to="tab.to"
        class="flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium"
        :class="active(tab.match) ? 'text-primary' : 'text-muted'"
        :aria-current="active(tab.match) ? 'page' : undefined"
      >
        <UIcon
          :name="tab.icon"
          class="size-5 shrink-0"
        />
        <span class="truncate">{{ tab.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
