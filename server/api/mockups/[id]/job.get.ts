import { plainFailure } from '~~/shared/studio-job'
import { markMockupFailed, getMockupForUser } from '~~/server/utils/mockups'
import { N8N_WF_ENHANCER, N8N_WF_PITCH, inspectStudioRun } from '~~/server/utils/n8n'

function startedMs(value: string | null | undefined): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? ms : 0
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  if (!user) throw createError({ statusCode: 401, message: 'Sign in required' })
  if (!id) throw createError({ statusCode: 400, message: 'Mockup ID is required' })

  const mockup = await getMockupForUser(id, user.id)
  if (!mockup) throw createError({ statusCode: 404, message: 'Mockup not found' })

  const workflowId = mockup.status === 'writing_pitch'
    ? N8N_WF_PITCH
    : mockup.status === 'enhancing'
      ? N8N_WF_ENHANCER
      : ''

  if (!workflowId) {
    return { node: null, executionStatus: null, failed: false, detail: '' }
  }

  const run = await inspectStudioRun({
    workflowId,
    needles: [mockup.placeId || '', mockup.id].filter(Boolean),
    sinceMs: startedMs(mockup.updatedAt)
  })

  if (!run) return { node: null, executionStatus: null, failed: false, detail: '' }

  const failed = run.status === 'error' || run.status === 'crashed' || run.status === 'canceled'
  const detail = failed ? plainFailure(run.error) : ''
  if (failed) {
    await markMockupFailed(mockup.id, user.id, detail)
  }

  return {
    node: run.node,
    executionStatus: run.status,
    failed,
    detail
  }
})
