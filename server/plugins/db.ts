import { initializeSchema } from '../utils/schema'

export default defineNitroPlugin(async () => {
  // Initialize database schema on server startup
  try {
    await initializeSchema()
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
  }
})










