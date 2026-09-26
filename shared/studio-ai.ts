export const DEFAULT_AI_MODEL = 'claude-opus-5-5'
export const DEFAULT_AI_MAX_TOKENS = 16000
export const DEFAULT_PITCH_MAX_TOKENS = 1500
export const DEFAULT_RESEARCH_MODEL = 'claude-sonnet-5'

/**
 * Fallback when Anthropic's Models API is unavailable.
 * IDs checked against platform.claude.com/docs/en/about-claude/models/overview on 2026-09-26.
 * Prices are the Claude API base rates from that page.
 */
export const STUDIO_AI_MODELS = [
  {
    value: 'claude-opus-5-5',
    label: 'Opus 5.5',
    hint: 'Claude API id claude-opus-5-5. Anthropic\'s current default for most work. $4 / $20 per million tokens.',
    cost: 'high' as const
  },
  {
    value: 'claude-fable-5-1',
    label: 'Fable 5.1',
    hint: 'Claude API id claude-fable-5-1. Highest capability. $10 / $50 per million tokens.',
    cost: 'highest' as const
  },
  {
    value: 'claude-opus-5',
    label: 'Opus 5',
    hint: 'Claude API id claude-opus-5. Previous Opus. $5 / $25 per million tokens.',
    cost: 'high' as const
  },
  {
    value: 'claude-sonnet-5',
    label: 'Sonnet 5',
    hint: 'Claude API id claude-sonnet-5. Research and pitch default. $2 / $10 per million tokens.',
    cost: 'medium' as const
  },
  {
    value: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    hint: 'Claude API alias claude-haiku-4-5 (canonical id claude-haiku-4-5-20251001). $1 / $5 per million tokens.',
    cost: 'low' as const
  },
  {
    value: 'claude-fable-5',
    label: 'Fable 5',
    hint: 'Claude API id claude-fable-5. Previous HTML default. Still available. $10 / $50 per million tokens.',
    cost: 'highest' as const
  },
  {
    value: 'claude-opus-4-6',
    label: 'Opus 4.6',
    hint: 'Claude API id claude-opus-4-6. Kept so older saved settings still resolve.',
    cost: 'high' as const
  }
] as const

export const TOKEN_PRESETS = [
  { value: 4096, label: '4k — save money' },
  { value: 8192, label: '8k — balanced' },
  { value: 16000, label: '16k — previous factory' },
  { value: 32000, label: '32k — current factory HTML cap' }
] as const

const CLAUDE_MODEL_ID = /^claude-[a-z0-9]+(?:-[a-z0-9]+)*$/

export type StudioAiModel = (typeof STUDIO_AI_MODELS)[number]['value']

export function isStudioAiModel(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80 && CLAUDE_MODEL_ID.test(value)
}

export function clampTokens(value: unknown, fallback: number, min = 256, max = 128000): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}
