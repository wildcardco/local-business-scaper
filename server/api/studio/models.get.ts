import { STUDIO_AI_MODELS } from '~~/shared/studio-ai'

interface StudioModelOption {
  value: string
  label: string
  hint: string
  cost?: 'low' | 'medium' | 'high' | 'highest'
}

function fallbackModels(): StudioModelOption[] {
  return STUDIO_AI_MODELS.map(model => ({
    value: model.value,
    label: model.label,
    hint: model.hint,
    cost: model.cost
  }))
}

function hintFor(id: string, displayName: string) {
  const known = STUDIO_AI_MODELS.find(model => model.value === id)
  if (known) return known.hint
  return `${displayName} (${id}), listed by the Anthropic Models API.`
}

async function listAnthropicModels(apiKey: string): Promise<StudioModelOption[]> {
  const models: StudioModelOption[] = []
  let afterId = ''

  for (let page = 0; page < 10; page++) {
    const url = new URL('https://api.anthropic.com/v1/models')
    url.searchParams.set('limit', '100')
    if (afterId) url.searchParams.set('after_id', afterId)

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    })
    if (!response.ok) {
      throw new Error(`Anthropic models API returned ${response.status}`)
    }

    const json = await response.json() as {
      data?: Array<{ id?: string, display_name?: string }>
      has_more?: boolean
      last_id?: string | null
    }

    for (const item of json.data || []) {
      if (!item.id || !item.id.startsWith('claude-')) continue
      const known = STUDIO_AI_MODELS.find(model => model.value === item.id)
      models.push({
        value: item.id,
        label: item.display_name || known?.label || item.id,
        hint: hintFor(item.id, item.display_name || item.id),
        cost: known?.cost
      })
    }

    if (!json.has_more || !json.last_id) break
    afterId = json.last_id
  }

  return models
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiKey = String(config.anthropicApiKey || '')
  if (!apiKey) {
    return { source: 'fallback' as const, models: fallbackModels() }
  }

  try {
    const models = await listAnthropicModels(apiKey)
    if (!models.length) {
      return { source: 'fallback' as const, models: fallbackModels() }
    }
    return { source: 'anthropic' as const, models }
  } catch {
    return { source: 'fallback' as const, models: fallbackModels() }
  }
})
