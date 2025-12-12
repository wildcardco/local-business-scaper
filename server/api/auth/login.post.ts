import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  // Validate input
  if (!username || typeof username !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Username is required'
    })
  }

  if (!password || typeof password !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Password is required'
    })
  }

  // Find user
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username.toLowerCase()]
  })

  const user = result.rows[0]

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Invalid username or password'
    })
  }

  // Verify password
  const isValid = await verifyPassword(user.password_hash as string, password)

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid username or password'
    })
  }

  // Update last login
  await db.execute({
    sql: `UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [user.id]
  })

  // Set session
  await setUserSession(event, {
    user: {
      id: user.id as string,
      username: user.username as string,
      name: user.name as string,
      role: user.role as string
    }
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  }
})
