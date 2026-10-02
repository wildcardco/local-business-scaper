export type JobPhase = 'idle' | 'sending' | 'building' | 'writing' | 'ready' | 'failed'

export interface JobView {
  phase: JobPhase
  label: string
  detail: string
}

const PITCH_SEND_NODES = new Set(['Build Pitch Email', 'Send Pitch Email'])
const PITCH_BUILD_NODES = new Set(['Build Pitch Preview', 'Update Lead'])

export function notesAreWebhookError(notes: string) {
  return /Studio webhook failed|N8N_STUDIO_SECRET|N8N_API_KEY|X-Studio-Secret|n8n API \d/.test(notes)
}

export function plainFailure(notes: string | null | undefined): string {
  const text = (notes || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'The work stopped before it finished.'
  if (/N8N_STUDIO_SECRET|X-Studio-Secret|not configured/i.test(text)) {
    return 'Studio could not reach n8n because the studio secret is missing or does not match.'
  }
  if (/did not answer|timeout|within 12 minutes|did not move/i.test(text)) {
    return 'This took too long and stopped. The live mockup did not update in time.'
  }
  if (/Claude returned nothing|did not return a full page|not in the expected format/i.test(text)) {
    return 'The writer finished without a usable result.'
  }
  if (/webhook failed/i.test(text)) return 'n8n did not accept the job.'
  const cleaned = text.replace(/^\[[^\]]+\]\s*/, '')
  if (cleaned.length > 280) return `${cleaned.slice(0, 277)}...`
  return cleaned
}

export function failureDetail(status: string, notes: string | null | undefined): string {
  if (status !== 'failed') return ''
  const text = (notes || '').trim()
  if (!text) return 'The work stopped before a mockup or pitch came back. You can try again.'
  if (notesAreWebhookError(text)) return plainFailure(text)
  if (!/failed|error|n8n|claude|timeout|webhook/i.test(text)) {
    return 'The live mockup did not update in time. Your notes are still saved.'
  }
  return plainFailure(text)
}

export function pitchJobFromNode(node: string | null, executionStatus: string | null): JobPhase {
  const status = (executionStatus || '').toLowerCase()
  if (status === 'error' || status === 'crashed' || status === 'canceled') return 'failed'
  if (status === 'success') return 'ready'
  if (node && PITCH_SEND_NODES.has(node)) return 'sending'
  if (node && PITCH_BUILD_NODES.has(node)) return 'building'
  return 'writing'
}

export function pageJob(input: {
  posting: boolean
  status: string
}): JobView {
  if (input.posting) {
    return {
      phase: 'sending',
      label: 'Sending to n8n',
      detail: 'This request is on its way to n8n.'
    }
  }
  if (input.status === 'enhancing' || input.status === 'generating' || input.status === 'revising') {
    return {
      phase: 'building',
      label: 'Building on Vercel',
      detail: 'n8n is updating the live mockup. This page stays on this step until the new page is up.'
    }
  }
  if (input.status === 'writing_pitch') {
    return {
      phase: 'writing',
      label: 'Writing the pitch',
      detail: 'The pitch writer is working. This page stays on this step until the draft is saved.'
    }
  }
  if (input.status === 'failed') {
    return {
      phase: 'failed',
      label: 'Failed',
      detail: ''
    }
  }
  if (input.status === 'mockup_ready' || input.status === 'pitch_ready') {
    return {
      phase: 'ready',
      label: 'Ready',
      detail: 'The latest studio step finished.'
    }
  }
  return {
    phase: 'idle',
    label: '',
    detail: ''
  }
}

export function pitchJobView(input: {
  posting: boolean
  status: string
  node: string | null
  executionStatus: string | null
  focused: boolean
  error: string
}): JobView {
  if (input.error) {
    return { phase: 'failed', label: 'Failed', detail: input.error }
  }
  if (input.posting) {
    return {
      phase: 'sending',
      label: 'Sending to n8n',
      detail: 'The pitch request is going to n8n.'
    }
  }
  if (input.status === 'writing_pitch') {
    const phase = pitchJobFromNode(input.node, input.executionStatus)
    if (phase === 'failed') {
      return { phase: 'failed', label: 'Failed', detail: 'The pitch writer stopped.' }
    }
    if (phase === 'sending') {
      return {
        phase: 'sending',
        label: 'Sending the pitch',
        detail: 'The draft is being emailed for review.'
      }
    }
    if (phase === 'building') {
      return {
        phase: 'building',
        label: 'Building the preview',
        detail: 'A preview of the sample site is being built for the pitch.'
      }
    }
    if (phase === 'ready') {
      return { phase: 'ready', label: 'Ready', detail: 'The pitch draft is saved.' }
    }
    return {
      phase: 'writing',
      label: 'Writing the pitch',
      detail: 'The pitch writer is drafting the email.'
    }
  }
  if (input.focused && input.status === 'failed') {
    return { phase: 'failed', label: 'Failed', detail: '' }
  }
  if (input.focused && input.status === 'pitch_ready') {
    return { phase: 'ready', label: 'Ready', detail: 'The pitch draft is saved.' }
  }
  return { phase: 'idle', label: '', detail: '' }
}

export function photoJobView(input: {
  posting: boolean
  status: string
  focused: boolean
  error: string
}): JobView {
  if (input.error) return { phase: 'failed', label: 'Failed', detail: input.error }
  if (input.posting) {
    return {
      phase: 'sending',
      label: 'Sending to n8n',
      detail: 'The photo URLs are going to n8n in slot order. The hero is first.'
    }
  }
  if (input.status === 'enhancing') {
    return {
      phase: 'building',
      label: 'Building on Vercel',
      detail: 'n8n has the photos. This card stays on this step until the live mockup updates.'
    }
  }
  if (input.focused && input.status === 'failed') {
    return { phase: 'failed', label: 'Failed', detail: '' }
  }
  if (input.focused && (input.status === 'mockup_ready' || input.status === 'pitch_ready')) {
    return { phase: 'ready', label: 'Ready', detail: 'The live mockup has the photos you assigned.' }
  }
  return { phase: 'idle', label: '', detail: '' }
}

export function feedbackJobView(input: {
  posting: boolean
  status: string
  focused: boolean
  error: string
}): JobView {
  if (input.error) return { phase: 'failed', label: 'Failed', detail: input.error }
  if (input.posting) {
    return {
      phase: 'sending',
      label: 'Sending to n8n',
      detail: 'The revision notes are going to n8n.'
    }
  }
  if (input.status === 'revising') {
    return {
      phase: 'building',
      label: 'Building on Vercel',
      detail: 'n8n accepted the notes. This page stays here until the live mockup URL and version both move.'
    }
  }
  if (input.focused && input.status === 'failed') {
    return { phase: 'failed', label: 'Failed', detail: '' }
  }
  if (input.focused && (input.status === 'mockup_ready' || input.status === 'pitch_ready')) {
    return { phase: 'ready', label: 'Ready', detail: 'The revised mockup is live.' }
  }
  return { phase: 'idle', label: '', detail: '' }
}
