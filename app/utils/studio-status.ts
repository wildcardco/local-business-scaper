export function studioStatusLabel(status: string) {
  if (status === 'revising') return 'Revision requested, in progress'
  if (status === 'generating') return 'Generation in progress'
  if (status === 'writing_pitch') return 'Pitch in progress'
  if (status === 'enhancing') return 'Building on Vercel'
  return status.replaceAll('_', ' ')
}

export type PhotoSavePhase = 'idle' | 'sending' | 'building' | 'ready' | 'failed'

export function photoSaveStatus(phase: PhotoSavePhase) {
  if (phase === 'sending') return 'Sending to n8n'
  if (phase === 'building') return 'Building on Vercel'
  if (phase === 'ready') return 'Ready'
  if (phase === 'failed') return 'Failed'
  return ''
}
