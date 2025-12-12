interface AuditState {
  isAuditing: boolean
  businessId: string | null
  businessName: string | null
  website: string | null
  currentStep: number
  steps: {
    label: string
    status: 'pending' | 'active' | 'complete' | 'error'
    detail?: string
  }[]
  error: string | null
  result: {
    performanceScore: number
    seoScore: number
    accessibilityScore: number
    bestPracticesScore?: number
    leadScore: number
    leadCategory: string
  } | null
}

const defaultSteps = () => [
  { label: 'Preparing audit request', status: 'pending' as const },
  { label: 'Connecting to PageSpeed API', status: 'pending' as const },
  { label: 'Analyzing performance', status: 'pending' as const },
  { label: 'Evaluating SEO & accessibility', status: 'pending' as const },
  { label: 'Calculating lead score', status: 'pending' as const },
  { label: 'Saving results', status: 'pending' as const }
]

export function useAudit() {
  const toast = useToast()

  const state = reactive<AuditState>({
    isAuditing: false,
    businessId: null,
    businessName: null,
    website: null,
    currentStep: 0,
    steps: defaultSteps(),
    error: null,
    result: null
  })

  const resetState = () => {
    state.isAuditing = false
    state.businessId = null
    state.businessName = null
    state.website = null
    state.currentStep = 0
    state.steps = defaultSteps()
    state.error = null
    state.result = null
  }

  const setStep = (index: number, status: 'pending' | 'active' | 'complete' | 'error', detail?: string) => {
    if (state.steps[index]) {
      state.steps[index].status = status
      if (detail) {
        state.steps[index].detail = detail
      }
    }
  }

  const progressToStep = async (index: number, detail?: string) => {
    // Complete previous steps
    for (let i = 0; i < index; i++) {
      setStep(i, 'complete')
    }
    // Set current step as active
    setStep(index, 'active', detail)
    state.currentStep = index
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  const runAudit = async (business: {
    id: string
    name: string
    website: string | null
  }): Promise<boolean> => {
    // Reset and initialize
    resetState()
    state.isAuditing = true
    state.businessId = business.id
    state.businessName = business.name
    state.website = business.website

    try {
      // Step 1: Preparing
      await progressToStep(0, `Business: ${business.name}`)

      // Check if business has website
      if (!business.website) {
        // Skip to final step for no-website businesses
        for (let i = 0; i < 5; i++) {
          setStep(i, 'complete')
        }
        await progressToStep(5, 'No website - marking as hot lead')

        const response = await $fetch(`/api/businesses/${business.id}/audit`, {
          method: 'POST'
        })

        setStep(5, 'complete')

        state.result = {
          performanceScore: 0,
          seoScore: 0,
          accessibilityScore: 0,
          leadScore: 95,
          leadCategory: 'hot'
        }

        state.isAuditing = false

        toast.add({
          title: 'Audit Complete',
          description: 'No website - automatically marked as hot lead (95)',
          color: 'success'
        })

        return true
      }

      // Step 2: Connecting
      await progressToStep(1, business.website)

      // Step 3: Start the actual audit request
      await progressToStep(2, 'Running Lighthouse analysis...')

      // Make the API call
      const responsePromise = $fetch(`/api/businesses/${business.id}/audit`, {
        method: 'POST'
      })

      // Simulate progress while waiting (the actual API call takes time)
      const progressInterval = setInterval(() => {
        if (state.currentStep === 2) {
          setStep(2, 'active', 'Measuring load times and Core Web Vitals...')
        }
      }, 2000)

      // Wait a bit then move to step 3
      setTimeout(() => {
        if (state.isAuditing && state.currentStep < 3) {
          progressToStep(3, 'Checking SEO tags and accessibility...')
        }
      }, 4000)

      const response = await responsePromise as {
        success: boolean
        business: {
          leadScore: number
          leadCategory: string
        }
        audit: {
          performanceScore: number
          seoScore: number
          accessibilityScore: number
          bestPracticesScore: number
        }
        scoring: {
          score: number
          category: string
          reasons: string[]
        }
      }

      clearInterval(progressInterval)

      // Step 4: Complete SEO analysis
      await progressToStep(3, 'Analysis complete')
      setStep(3, 'complete')

      // Step 5: Calculate lead score
      await progressToStep(4, `Score: ${response.scoring.score} (${response.scoring.category})`)
      setStep(4, 'complete')

      // Step 6: Save results
      await progressToStep(5, 'Updating database...')
      setStep(5, 'complete')

      // Set result
      state.result = {
        performanceScore: response.audit?.performanceScore || 0,
        seoScore: response.audit?.seoScore || 0,
        accessibilityScore: response.audit?.accessibilityScore || 0,
        bestPracticesScore: response.audit?.bestPracticesScore || 0,
        leadScore: response.scoring.score,
        leadCategory: response.scoring.category
      }

      state.isAuditing = false

      toast.add({
        title: 'Audit Complete',
        description: `Lead score: ${response.scoring.score} (${response.scoring.category})`,
        color: 'success'
      })

      return true
    } catch (error: unknown) {
      console.error('Audit error:', error)

      // Mark current step as error
      if (state.currentStep < state.steps.length) {
        setStep(state.currentStep, 'error')
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      state.error = errorMessage
      state.isAuditing = false

      toast.add({
        title: 'Audit Failed',
        description: errorMessage,
        color: 'error'
      })

      return false
    }
  }

  const closeProgress = () => {
    resetState()
  }

  return {
    state: readonly(state),
    runAudit,
    closeProgress,
    isAuditing: computed(() => state.isAuditing)
  }
}






















