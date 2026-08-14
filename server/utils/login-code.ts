import { randomInt } from 'node:crypto'
import { db, generateId } from '~~/server/utils/db'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { sendEmail } from '~~/server/utils/resend'

const CODE_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 30
const MAX_ATTEMPTS = 5

function displayNameFromEmail(email: string) {
  const slug = ownerSlugFromEmail(email)
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

export async function issueLoginCode(email: string) {
  const recent = await db.execute({
    sql: `SELECT id FROM login_codes
          WHERE email = ? AND created_at > datetime('now', '-${RESEND_COOLDOWN_SECONDS} seconds')
          LIMIT 1`,
    args: [email]
  })

  if (recent.rows.length > 0) {
    throw createError({
      statusCode: 429,
      message: 'Wait a few seconds before requesting another code'
    })
  }

  await db.execute({
    sql: 'DELETE FROM login_codes WHERE email = ?',
    args: [email]
  })

  const code = String(randomInt(100000, 1000000))
  const codeHash = await hashPassword(code)
  const id = generateId()

  await db.execute({
    sql: `INSERT INTO login_codes (id, email, code_hash, expires_at)
          VALUES (?, ?, ?, datetime('now', '+${CODE_TTL_MINUTES} minutes'))`,
    args: [id, email, codeHash]
  })

  if (import.meta.dev) {
    console.log(`[login-code] ${email} → ${code}`)
  }

  try {
    await sendEmail({
      to: email,
      subject: 'Your Wild Card Lead Gen code',
      html: loginCodeHtml(code)
    })
  } catch (error) {
    if (!import.meta.dev) {
      await db.execute({ sql: 'DELETE FROM login_codes WHERE id = ?', args: [id] })
      const message = error instanceof Error ? error.message : 'Could not send email'
      throw createError({
        statusCode: 500,
        message: `Could not send login code: ${message}`
      })
    }
    console.warn('[login-code] Resend failed in dev; use the code printed above.', error)
  }

  return { expiresInMinutes: CODE_TTL_MINUTES }
}

export async function consumeLoginCode(email: string, code: string) {
  const normalized = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) {
    throw createError({
      statusCode: 400,
      message: 'Enter the 6-digit code'
    })
  }

  const result = await db.execute({
    sql: `SELECT * FROM login_codes
          WHERE email = ? AND datetime(expires_at) > datetime('now')
          ORDER BY created_at DESC LIMIT 1`,
    args: [email]
  })

  const row = result.rows[0]
  if (!row) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired code'
    })
  }

  const attempts = Number(row.attempts || 0)
  if (attempts >= MAX_ATTEMPTS) {
    await db.execute({ sql: 'DELETE FROM login_codes WHERE id = ?', args: [row.id] })
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired code'
    })
  }

  const valid = await verifyPassword(row.code_hash as string, normalized)
  if (!valid) {
    await db.execute({
      sql: 'UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?',
      args: [row.id]
    })
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired code'
    })
  }

  await db.execute({ sql: 'DELETE FROM login_codes WHERE email = ?', args: [email] })
}

export async function findOrCreateUserByEmail(email: string) {
  const existing = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
    args: [email]
  })

  if (existing.rows[0]) {
    const user = existing.rows[0]
    await db.execute({
      sql: `UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      args: [user.id]
    })
    return {
      id: user.id as string,
      username: user.username as string,
      name: user.name as string,
      email,
      role: (user.role as string) || 'user'
    }
  }

  let username = ownerSlugFromEmail(email)
  const taken = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [username]
  })
  if (taken.rows.length > 0) {
    username = `${username}_${generateId().slice(-6)}`
  }

  const userId = generateId()
  const unusedHash = await hashPassword(`otp:${userId}:${Date.now()}`)
  const name = displayNameFromEmail(email)

  await db.execute({
    sql: `INSERT INTO users (id, username, name, email, password_hash, role, last_login_at)
          VALUES (?, ?, ?, ?, ?, 'user', datetime('now'))`,
    args: [userId, username, name, email, unusedHash]
  })

  return {
    id: userId,
    username,
    name,
    email,
    role: 'user'
  }
}

function loginCodeHtml(code: string) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px 20px;background:#111;font-family:Inter,system-ui,sans-serif;color:#f5f5f5">
  <div style="max-width:420px;margin:0 auto;text-align:center">
    <p style="letter-spacing:0.2em;text-transform:uppercase;font-size:11px;color:#c4a574;margin:0 0 16px">Wild Card Lead Gen</p>
    <p style="margin:0 0 8px;font-size:16px">Your sign-in code</p>
    <p style="margin:24px 0;font-size:36px;letter-spacing:0.35em;font-weight:700;color:#D6293E;font-family:ui-monospace,monospace">${code}</p>
    <p style="margin:0;font-size:13px;color:#a3a3a3">Expires in ${CODE_TTL_MINUTES} minutes. If you did not request this, ignore it.</p>
  </div>
</body>
</html>`
}
