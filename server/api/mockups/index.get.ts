import { db } from '~~/server/utils/db'
import { expireStaleMockups, mapMockup, removeDigestLeadsWithoutMockups } from '~~/server/utils/mockups'
import { checkUserMockupLinks, ensureMockupLinkColumns } from '~~/server/utils/mockup-links'
import { mockupListQuery, parseMockupSort } from '~~/server/utils/mockup-list'
import { applyN8nLeadToMockup } from '~~/server/utils/n8n'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { STUDIO_OWNERS, studioOwnerBySlug } from '~~/shared/studio-owners'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''
  const requestedOwner = typeof query.owner === 'string' ? query.owner : ''
  const search = typeof query.q === 'string' ? query.q : ''
  const sort = parseMockupSort(query.sort)
  const limit = typeof query.limit === 'string' ? Number(query.limit) : 0
  const offset = typeof query.offset === 'string' ? Number(query.offset) : 0
  const viewerOwner = ownerSlugFromEmail(user.email)
  const teammate = requestedOwner && requestedOwner !== 'mine' && requestedOwner !== viewerOwner
    ? studioOwnerBySlug(requestedOwner)
    : null

  if (requestedOwner && requestedOwner !== 'mine' && requestedOwner !== viewerOwner && !teammate) {
    throw createError({ statusCode: 400, message: 'Unknown owner. Use mine, ryan, chase, or aaron.' })
  }

  await ensureMockupLinkColumns()

  let teammateId = ''
  await removeDigestLeadsWithoutMockups(user.id)
  if (teammate) {
    const teammateUser = await db.execute({
      sql: 'SELECT id FROM users WHERE lower(email) = ? LIMIT 1',
      args: [teammate.email]
    })
    teammateId = String(teammateUser.rows[0]?.id || '')
    if (teammateId && teammateId !== user.id) {
      await removeDigestLeadsWithoutMockups(teammateId)
    }
  }

  const pending = await db.execute({
    sql: `SELECT id, place_id, status FROM mockups
          WHERE user_id = ?
            AND status IN ('generating', 'writing_pitch', 'enhancing', 'revising')
            AND place_id IS NOT NULL
            AND place_id != ''`,
    args: [user.id]
  })
  await Promise.all(pending.rows.map(row =>
    applyN8nLeadToMockup(user.id, String(row.id), String(row.place_id))
  ))

  await expireStaleMockups(user.id)
  await checkUserMockupLinks(user.id)
  if (teammateId && teammateId !== user.id) {
    await checkUserMockupLinks(teammateId)
  }

  const mine = mockupListQuery({
    scope: 'user',
    scopeValue: user.id,
    sort: 'newest'
  })
  const mineCount = await db.execute({ sql: mine.countSql, args: mine.countArgs })

  const listed = teammate
    ? mockupListQuery({
        scope: 'email',
        scopeValue: teammate.email,
        sort,
        search,
        limit,
        offset
      })
    : mockupListQuery({
        scope: 'user',
        scopeValue: user.id,
        sort,
        businessId,
        search,
        limit,
        offset
      })

  const result = await db.execute({ sql: listed.listSql, args: listed.listArgs })
  const filteredCount = await db.execute({ sql: listed.countSql, args: listed.countArgs })

  const mockups = result.rows.map((row) => {
    const business = row.b_id
      ? {
          id: row.b_id,
          name: row.b_name,
          website: row.b_website,
          phone: row.b_phone,
          email: row.b_email,
          address: row.b_address,
          city: row.b_city,
          state: row.b_state,
          category: row.b_category,
          rating: row.b_rating,
          review_count: row.b_review_count,
          place_id: row.b_place_id
        }
      : null
    return mapMockup(row as Record<string, unknown>, business as Record<string, unknown> | null)
  })

  const showing = Number(filteredCount.rows[0]?.count || 0)

  return {
    success: true,
    mockups,
    viewerOwner,
    scope: teammate ? teammate.slug : 'mine',
    sort,
    owners: STUDIO_OWNERS.map(owner => ({
      slug: owner.slug,
      label: owner.label,
      isViewer: owner.slug === viewerOwner
    })),
    counts: {
      mine: Number(mineCount.rows[0]?.count || 0),
      showing: limit > 0 ? showing : mockups.length
    }
  }
})
