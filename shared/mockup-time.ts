function formatMockupTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function coerceMockupTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return formatMockupTime(date)
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return coerceMockupTime(record.value ?? record.date ?? record.iso ?? null)
  }
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return formatMockupTime(date)
}

function readMockupTime(row: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!row) return null
  for (const key of keys) {
    const parsed = coerceMockupTime(row[key])
    if (parsed) return parsed
  }
  return null
}

/**
 * When the mockup's lead row was created. Never reads updatedAt.
 * A web-stack build can start on an older lead; that start time is the
 * mockup's created time when it is later than the lead row.
 */
export function mockupCreatedTime(row: Record<string, unknown> | null | undefined): string | null {
  const created = readMockupTime(row, ['createdAt', 'created_at'])
  const started = readMockupTime(row, ['web_stack_started_at'])
  if (created && started && started > created) return started
  return created || started
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
