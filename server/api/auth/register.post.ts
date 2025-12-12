import { db, generateId } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, name } = body

  // Validate input
  if (!username || typeof username !== 'string' || username.length < 3) {
    throw createError({
      statusCode: 400,
      message: 'Username must be at least 3 characters'
    })
  }

  if (!name || typeof name !== 'string' || name.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Name must be at least 2 characters'
    })
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 8 characters'
    })
  }

  // Check if user already exists
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [username.toLowerCase()]
  })

  if (existing.rows.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Username already taken'
    })
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password)
  const userId = generateId()

  await db.execute({
    sql: `INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    args: [userId, username.toLowerCase(), name, passwordHash, 'user']
  })

  // Set session
  await setUserSession(event, {
    user: {
      id: userId,
      username: username.toLowerCase(),
      name,
      role: 'user'
    }
  })

  return {
    success: true,
    user: {
      id: userId,
      username: username.toLowerCase(),
      name,
      role: 'user'
    }
  }
})
