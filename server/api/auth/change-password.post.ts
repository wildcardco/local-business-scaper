import { db } from '~~/server/utils/db'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Ensure user is authenticated
  const user = await requireAuth(event)

  const body = await readBody(event)
  const { currentPassword, newPassword } = body

  // Validate input
  if (!currentPassword || typeof currentPassword !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Current password is required'
    })
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'New password must be at least 8 characters'
    })
  }

  // Get current user data
  const result = await db.execute({
    sql: 'SELECT password_hash FROM users WHERE id = ?',
    args: [user.id]
  })

  const userData = result.rows[0]

  if (!userData) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  // Verify current password
  const isValid = await verifyPassword(userData.password_hash as string, currentPassword)

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Current password is incorrect'
    })
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword)

  // Update password
  await db.execute({
    sql: `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [newPasswordHash, user.id]
  })

  return {
    success: true,
    message: 'Password updated successfully'
  }
})

