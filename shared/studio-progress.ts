/**
 * WF-7 returns 200 {ok:true} immediately and never calls callback_url.
 * The lead row keeps the previous URL and version until the factory finishes,
 * so that unchanged row is still in progress.
 */
export function leadAdvancedWhileBusy(input: {
  localStatus: string
  localUrl: string | null
  localVersion: number
  localPitchVersion: number
  localPitchDraft: string | null
  n8nStatus: string | null
  n8nUrl: string | null
  n8nVersion: number
  n8nPitchVersion: number
  n8nPitchDraft: string | null
}): 'failed' | 'ready' | 'wait' {
  if (input.n8nStatus === 'failed') return 'failed'
  if (input.localStatus === 'writing_pitch') {
    const draft = input.n8nPitchDraft
    const pitchAdvanced = Boolean(draft)
      && (input.n8nPitchVersion > input.localPitchVersion || draft !== input.localPitchDraft)
      && input.n8nStatus === 'pitch_ready'
    return pitchAdvanced ? 'ready' : 'wait'
  }
  const versionAdvanced = input.n8nVersion > input.localVersion
  const urlAdvanced = Boolean(input.n8nUrl) && input.n8nUrl !== input.localUrl
  const ready = input.n8nStatus === 'mockup_ready' || input.n8nStatus === 'pitch_ready'
  if (!input.n8nUrl || !ready || (!versionAdvanced && !urlAdvanced)) return 'wait'
  return 'ready'
}
