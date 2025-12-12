// Type augmentation for nuxt-auth-utils
// https://github.com/atinux/nuxt-auth-utils#typescript

declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    name: string
    role: string
  }

  interface UserSession {
    user: User
    loggedInAt?: Date
  }
}

// Type augmentation for H3 event context
declare module 'h3' {
  interface H3EventContext {
    user?: {
      id: string
      username: string
      name: string
      role: string
    }
  }
}

export {}
