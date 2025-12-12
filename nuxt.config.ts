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
