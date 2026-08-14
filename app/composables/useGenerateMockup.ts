export async function postGenerateMockup(body: Record<string, unknown>) {
  const run = (force = false) => $fetch('/api/mockups/generate', {
    method: 'POST',
    body: force ? { ...body, force: true } : body
  })

  try {
    return await run()
  } catch (error: unknown) {
    const err = error as { statusCode?: number, status?: number, data?: { statusCode?: number, message?: string } }
    const status = err.statusCode || err.status || err.data?.statusCode
    if (status === 409 && import.meta.client) {
      const message = err.data?.message || 'A mockup factory job is already running for this listing.'
      const ok = window.confirm(`${message}\n\nStart another job anyway?`)
      if (!ok) return null
      return await run(true)
    }
    throw error
  }
}

export function useGenerateMockup() {
  const businessId = useState<string | null>('generate-mockup-business-id', () => null)

  function open(id: string) {
    businessId.value = id
  }

  function close() {
    businessId.value = null
  }

  return { businessId, open, close, postGenerateMockup }
}
