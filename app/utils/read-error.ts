export function readError(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback
  const err = error as {
    data?: { message?: string, statusMessage?: string }
    message?: string
    statusMessage?: string
  }
  const candidates = [
    err.data?.message,
    err.data?.statusMessage,
    err.statusMessage,
    err.message
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    if (candidate === 'Server Error') continue
    if (candidate.startsWith('[POST]') || candidate.startsWith('[GET]')) continue
    return candidate
  }
  return fallback
}
