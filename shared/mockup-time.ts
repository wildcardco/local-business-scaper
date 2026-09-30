function readMockupTime(row: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (value == null || value === '') continue
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) continue
    return date.toISOString().slice(0, 19).replace('T', ' ')
  }
  return null
}

/** When the n8n lead row was created. Never reads updatedAt. */
export function mockupCreatedTime(row: Record<string, unknown> | null | undefined): string | null {
  return readMockupTime(row, ['createdAt', 'created_at'])
}

/** When the n8n lead row last changed. Never reads createdAt. */
export function mockupUpdatedTime(row: Record<string, unknown> | null | undefined): string | null {
  return readMockupTime(row, ['updatedAt', 'updated_at'])
}

/**
 * Combined stamp used only to fill mockups.made_at.
 * Updated time wins, then created time, so a row with no updatedAt still has a fallback
 * and existing cards are not blank. Do not use this as the created time.
 */
export function mockupActivityTime(row: Record<string, unknown> | null | undefined): string | null {
  return mockupUpdatedTime(row) || mockupCreatedTime(row)
}
