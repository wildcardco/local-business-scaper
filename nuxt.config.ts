// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // Dark-only — official Wild Card brand is dark-first with no light theme
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: ''
  },

  fonts: {
    families: [
      { name: 'Outfit', provider: 'google', weights: [300, 400, 500, 600, 700] },
      { name: 'Inter', provider: 'google', weights: [400, 500, 600] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500] }
    ]
  },

  icon: {
    customCollections: [
      { prefix: 'wc', dir: './app/assets/icons/wc' }
    ]
  },

  routeRules: {
    '/': { prerender: false }
  },

  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    // Database (Turso)
    tursoDbUrl: process.env.TURSO_DB_URL,
    tursoKey: process.env.TURSO_KEY,

    // APIs
    rapidApiKey: process.env.RAPIDAPI_KEY,
    rapidApiHost: process.env.RAPIDAPI_HOST || 'local-business-data.p.rapidapi.com',
    googlePageSpeedApiKey: process.env.GOOGLE_PAGESPEED_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    groqApiKey: process.env.GROQ_API,
    n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
    
    // ImageKit
    imageKitUrl: process.env.IMAGE_KIT_URL,
    imageKitPublicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
    imageKitPrivateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
    
    public: {
      imageKitUrl: process.env.IMAGE_KIT_URL,
      imageKitPublicKey: process.env.IMAGE_KIT_PUBLIC_KEY
    },

    // Auth session (nuxt-auth-utils)
    // NUXT_SESSION_PASSWORD auto-generated in dev, required in production
    session: {
      maxAge: 60 * 60 * 24 * 7 // 7 days
    } as any
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
