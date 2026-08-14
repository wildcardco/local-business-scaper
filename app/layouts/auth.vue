<script setup lang="ts">
// Auth layout - minimal layout for login/register pages
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
</script>

<template>
  <UApp>
    <slot />
    <UToaster />
  </UApp>
</template>








