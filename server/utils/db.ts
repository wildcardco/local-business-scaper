import { createClient } from '@libsql/client'

// Simple database connection using @libsql/client
// Works with both local SQLite (file:local.db) and Turso Cloud (libsql://...)
// https://docs.turso.tech/local-development

// Use local database in development, Turso in production
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

export const db = createClient({
  url: isDevelopment 
    ? (process.env.DATABASE_URL || 'file:dev.db')  // Local development
    : (process.env.TURSO_DB_URL || 'file:dev.db'),  // Production (Vercel)
  authToken: isProduction ? process.env.TURSO_KEY : undefined // Only for Turso
})

console.log(`📊 Database: ${isDevelopment ? 'Local SQLite (dev.db)' : 'Turso Cloud'}`)

// Helper to generate unique IDs (similar to cuid)
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}
