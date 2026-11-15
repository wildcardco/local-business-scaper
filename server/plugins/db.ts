import { initializeSchema } from '../utils/schema'
import { ensureSchemaColumns } from '../utils/schema-columns'

export default defineNitroPlugin(async () => {
  // Columns first. initializeSchema can stop early, and a later request retries
  // the same memoized ensure if this attempt fails.
  try {
    await ensureSchemaColumns()
  } catch (error) {
    console.error('[schema] column ensure failed on startup:', error)
  }
  try {
    await initializeSchema()
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
  }
})
