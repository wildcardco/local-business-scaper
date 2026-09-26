import { STUDIO_AI_MODELS } from '~~/shared/studio-ai'

export interface StudioModelChoice {
  value: string
  label: string
  hint: string
  cost?: 'low' | 'medium' | 'high' | 'highest'
}

export function useStudioModels() {
  const { data } = useFetch('/api/studio/models', {
    default: () => ({
      source: 'fallback' as const,
      models: STUDIO_AI_MODELS.map(model => ({
        value: model.value,
        label: model.label,
        hint: model.hint,
        cost: model.cost
      }))
    })
  })

  const models = computed<StudioModelChoice[]>(() => {
    const live = data.value?.models
    if (live?.length) return live
    return STUDIO_AI_MODELS.map(model => ({
      value: model.value,
      label: model.label,
      hint: model.hint,
      cost: model.cost
    }))
  })

  const source = computed(() => data.value?.source || 'fallback')

  function optionsFor(selected?: string) {
    const items = models.value.map(model => ({
      value: model.value,
      label: model.cost ? `${model.label} — ${model.cost}` : model.label
    }))
    if (selected && !items.some(item => item.value === selected)) {
      items.unshift({ value: selected, label: selected })
    }
    return items
  }

  function hintFor(value: string) {
    return models.value.find(model => model.value === value)?.hint || ''
  }

  return { models, source, optionsFor, hintFor }
}
