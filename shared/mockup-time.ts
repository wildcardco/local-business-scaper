/** n8n data-table rows carry updatedAt / createdAt. That is when the lead, including its mockup, last changed. */
export function mockupActivityTime(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null
  for (const key of ['updatedAt', 'updated_at', 'createdAt', 'created_at']) {
    const value = row[key]
    if (value == null || value === '') continue
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) continue
    return date.toISOString().slice(0, 19).replace('T', ' ')
  }
  return null
}
