import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)
  const { ids } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Business IDs array required'
    })
  }

  try {
    // Get businesses owned by this user
    const placeholders = ids.map(() => '?').join(', ')
    const result = await db.execute({
      sql: `SELECT id FROM businesses WHERE id IN (${placeholders}) AND user_id = ?`,
      args: [...ids, user.id]
    })

    const ownedIds = result.rows.map(r => r.id as string)

    if (ownedIds.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No businesses found to delete'
      })
    }

    const ownedPlaceholders = ownedIds.map(() => '?').join(', ')

    // Delete related audits (cascade)
    await db.execute({
      sql: `DELETE FROM audits WHERE business_id IN (${ownedPlaceholders})`,
      args: ownedIds
    })

    // Delete related outreach logs
    await db.execute({
      sql: `DELETE FROM outreach_logs WHERE business_id IN (${ownedPlaceholders})`,
      args: ownedIds
    })

    // Delete businesses
    await db.execute({
      sql: `DELETE FROM businesses WHERE id IN (${ownedPlaceholders})`,
      args: ownedIds
    })

    return {
      success: true,
      deleted: ownedIds.length
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    console.error('Delete businesses error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete businesses'
    })
  }
})
