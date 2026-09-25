/**
 * Get today's date in Central Time (America/Chicago) as YYYY-MM-DD string
 * Safe across all local timezones and DST boundaries
 */
export function getTodayCentralTime(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

/**
 * Add or subtract days from a YYYY-MM-DD date string using UTC-based calendar arithmetic
 * @param dateStr YYYY-MM-DD format date string
 * @param days Number of days to add (positive) or subtract (negative)
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * SQLite `datetime('now')` is UTC with no zone (`YYYY-MM-DD HH:MM:SS`).
 * Parse that as UTC and show the clock time in America/Chicago.
 */
export function formatCentralTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return value
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)
  const iso = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const date = new Date(hasZone ? iso : `${iso}Z`)
  if (Number.isNaN(date.getTime())) return value
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
  return `${time} CT`
}
