export const DEFAULT_AI_MODEL = 'claude-fable-5'
export const DEFAULT_AI_MAX_TOKENS = 16000
export const DEFAULT_PITCH_MAX_TOKENS = 1500
export const DEFAULT_RESEARCH_MODEL = 'claude-sonnet-5'

export const STUDIO_AI_MODELS = [
  {
    value: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    hint: 'Cheapest and fastest. Best when you want to save money on drafts.',
    cost: 'low' as const
  },
  {
    value: 'claude-sonnet-5',
    label: 'Sonnet 5',
    hint: 'Current pitch and research default. Solid quality at mid cost.',
    cost: 'medium' as const
  },
  {
    value: 'claude-fable-5',
    label: 'Fable 5',
    hint: 'Current mockup HTML default. Highest design quality of the factory today.',
    cost: 'high' as const
  },
  {
    value: 'claude-opus-4-6',
    label: 'Opus 4.6',
    hint: 'Most expensive. Use only when a mockup really needs extra polish.',
    cost: 'highest' as const
  }
] as const

export const TOKEN_PRESETS = [
  { value: 4096, label: '4k — save money' },
  { value: 8192, label: '8k — balanced' },
  { value: 16000, label: '16k — current factory' }
] as const

export type StudioAiModel = (typeof STUDIO_AI_MODELS)[number]['value']

export function isStudioAiModel(value: unknown): value is StudioAiModel {
  return typeof value === 'string' && STUDIO_AI_MODELS.some(model => model.value === value)
}

export function clampTokens(value: unknown, fallback: number, min = 256, max = 32000): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}
