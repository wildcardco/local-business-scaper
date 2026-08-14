const UNAUTHORIZED_MESSAGE = 'This email is not authorized'

export function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function getAllowedEmails(): string[] {
  const config = useRuntimeConfig()
  const fromEnv = parseAllowedEmails(config.allowedEmails as string | undefined)
  if (fromEnv.length > 0) return fromEnv
  return Object.keys(OWNER_EMAIL_MAP)
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return null
  return trimmed
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowed = getAllowedEmails()
  if (allowed.length === 0) return false
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  return allowed.includes(normalized)
}

export function assertEmailAllowed(email: string | null | undefined) {
  if (!isEmailAllowed(email)) {
    throw createError({
      statusCode: 403,
      message: UNAUTHORIZED_MESSAGE
    })
  }
}

export const OWNER_EMAIL_MAP: Record<string, string> = {
  'ryan@wildcardcreativeco.com': 'ryan',
  'aaron@wildcardcreativeco.com': 'aaron',
  'chase@wildcardcreativeco.com': 'chase'
}

export function ownerSlugFromEmail(email: string | null | undefined): string {
  const normalized = normalizeEmail(email)
  if (!normalized) return 'ryan'
  return OWNER_EMAIL_MAP[normalized] || normalized.split('@')[0] || 'ryan'
}
