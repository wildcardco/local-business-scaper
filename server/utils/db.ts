import { createClient } from '@libsql/client'

// Simple database connection using @libsql/client
// Works with both local SQLite (file:local.db) and Turso Cloud (libsql://...)
// https://docs.turso.tech/local-development

export const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_KEY // Only needed for Turso Cloud
})

// Helper to generate unique IDs (similar to cuid)
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}





