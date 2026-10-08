import { mockupDeleteRepo, planMockupDelete } from '~~/shared/mockup-repo'
import { db } from '~~/server/utils/db'
import { deleteMockupRemotes, mockupDeleteTokens } from '~~/server/utils/mockup-delete'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Mockup ID is required' })
  }

  const result = await db.execute({
    sql: `SELECT m.github_repo, m.mockup_url, m.owner, m.place_id, b.name AS business_name, b.place_id AS business_place_id
          FROM mockups m
          LEFT JOIN businesses b ON m.business_id = b.id AND b.user_id = m.user_id
          WHERE m.id = ? AND m.user_id = ?`,
    args: [id, String(user.id)]
  })
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, message: 'Mockup not found' })
  }

  const body = await readBody(event)
  const repo = mockupDeleteRepo({
    owner: (row.owner as string) || null,
    businessName: (row.business_name as string) || null,
    placeId: (row.place_id as string) || (row.business_place_id as string) || null,
    stored: (row.github_repo as string) || null
  })

  const plan = planMockupDelete({
    confirm: body?.confirm,
    repo,
    mockupUrl: (row.mockup_url as string) || null
  })
  if ('error' in plan) {
    throw createError({ statusCode: 400, message: plan.error })
  }

  const tokens = mockupDeleteTokens()
  await deleteMockupRemotes(plan, tokens)

  const removed = await db.execute({
    sql: 'DELETE FROM mockups WHERE id = ? AND user_id = ?',
    args: [id, String(user.id)]
  })
  if (Number(removed.rowsAffected || 0) < 1) {
    throw createError({
      statusCode: 500,
      message: 'The GitHub repo and Vercel project were removed, but the Studio row was still there. Refresh and try again.'
    })
  }

  return { ok: true }
})
