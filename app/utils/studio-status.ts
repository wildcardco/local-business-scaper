export function studioStatusLabel(status: string) {
  if (status === 'revising') return 'Revision requested, in progress'
  if (status === 'generating') return 'Generation in progress'
  if (status === 'writing_pitch') return 'Pitch in progress'
  if (status === 'enhancing') return 'Photos in progress'
  return status.replaceAll('_', ' ')
}
