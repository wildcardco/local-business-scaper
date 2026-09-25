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
