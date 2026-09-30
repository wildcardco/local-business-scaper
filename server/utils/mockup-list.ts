import { visibleMockupSql } from '~~/server/utils/mockups'

export type MockupSort = 'created' | 'oldest' | 'updated' | 'name'

const MOCKUP_COLUMNS = `
  m.*, b.name as b_name, b.website as b_website, b.phone as b_phone, b.email as b_email,
  b.address as b_address, b.city as b_city, b.state as b_state, b.category as b_category,
  b.rating as b_rating, b.review_count as b_review_count, b.place_id as b_place_id, b.id as b_id
`

/** n8n created time only. Studio's row insert time (created_at) must not decide this order. */
const CREATED_TIME = 'n8n_created_at'
/** n8n updated time, then the stored made_at fallback when the row has no updatedAt. */
const UPDATED_TIME = 'COALESCE(n8n_updated_at, made_at)'

export function parseMockupSort(value: unknown): MockupSort {
  if (value === 'oldest' || value === 'updated' || value === 'name' || value === 'created') return value
  if (value === 'newest') return 'created'
  return 'created'
}

export function parseMockupCategory(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'all') return ''
  return trimmed
}

function orderSql(sort: MockupSort) {
  if (sort === 'oldest') return `${CREATED_TIME} IS NULL, ${CREATED_TIME} ASC, id ASC`
  if (sort === 'updated') return `${UPDATED_TIME} IS NULL, ${UPDATED_TIME} DESC, id DESC`
  if (sort === 'name') return `lower(COALESCE(b_name, '')) ASC, ${CREATED_TIME} IS NULL, ${CREATED_TIME} DESC, id DESC`
  return `${CREATED_TIME} IS NULL, ${CREATED_TIME} DESC, id DESC`
}

/**
 * One row per business name in a town. A revision in progress wins, then the
 * highest mockup_version, then the n8n updated time (made_at if that is missing). ORDER BY runs after that
 * pick, and LIMIT/OFFSET run after ORDER BY.
 */
export function mockupListQuery(options: {
  scope: 'user' | 'email'
  scopeValue: string
  sort: MockupSort
  businessId?: string
  search?: string
  category?: string
  limit?: number
  offset?: number
}) {
  const args: Array<string | number> = [options.scopeValue]
  const scopeSql = options.scope === 'email'
    ? 'lower(u.email) = ?'
    : 'm.user_id = ?'
  const filters = [
    scopeSql,
    visibleMockupSql('m')
  ]
  if (options.businessId) {
    filters.push('m.business_id = ?')
    args.push(options.businessId)
  }
  const search = options.search?.trim().toLowerCase() || ''
  if (search) {
    const like = `%${search.replace(/[%_]/g, '')}%`
    filters.push(`(
      lower(COALESCE(b.name, '')) LIKE ?
      OR lower(COALESCE(b.city, '')) LIKE ?
      OR lower(COALESCE(b.state, '')) LIKE ?
      OR lower(COALESCE(b.address, '')) LIKE ?
      OR lower(COALESCE(b.category, '')) LIKE ?
    )`)
    args.push(like, like, like, like, like)
  }
  const category = options.category?.trim().toLowerCase() || ''
  if (category) {
    filters.push(`lower(trim(COALESCE(b.category, ''))) = ?`)
    args.push(category)
  }

  const joinUser = options.scope === 'email'
    ? 'JOIN users u ON u.id = m.user_id'
    : ''

  const inner = `
    SELECT ${MOCKUP_COLUMNS},
      ROW_NUMBER() OVER (
        PARTITION BY CASE
          WHEN trim(COALESCE(b.name, '')) != '' THEN 'name:' || lower(trim(b.name)) || '|' || lower(trim(COALESCE(b.city, '')))
          WHEN trim(COALESCE(m.place_id, '')) != '' THEN 'place:' || m.place_id
          ELSE 'id:' || m.id
        END
        ORDER BY
          CASE WHEN m.status IN ('generating', 'writing_pitch', 'enhancing', 'revising') THEN 0 ELSE 1 END,
          COALESCE(m.mockup_version, 0) DESC,
          COALESCE(m.n8n_updated_at, m.made_at) DESC,
          m.id DESC
      ) AS row_rank
    FROM mockups m
    LEFT JOIN businesses b ON b.id = m.business_id
    ${joinUser}
    WHERE ${filters.join(' AND ')}
  `

  const limitSql = options.limit && options.limit > 0
    ? ' LIMIT ? OFFSET ?'
    : ''
  if (options.limit && options.limit > 0) {
    args.push(Math.min(options.limit, 200), Math.max(options.offset || 0, 0))
  }

  return {
    listSql: `SELECT * FROM (${inner}) ranked WHERE row_rank = 1 ORDER BY ${orderSql(options.sort)}${limitSql}`,
    countSql: `SELECT COUNT(*) AS count FROM (${inner}) ranked WHERE row_rank = 1`,
    listArgs: args,
    countArgs: options.limit && options.limit > 0 ? args.slice(0, -2) : args
  }
}

/** Distinct business categories among visible mockups for one owner. Ignores search and the category filter. */
export function mockupCategoryQuery(options: {
  scope: 'user' | 'email'
  scopeValue: string
}) {
  const scopeSql = options.scope === 'email'
    ? 'lower(u.email) = ?'
    : 'm.user_id = ?'
  const joinUser = options.scope === 'email'
    ? 'JOIN users u ON u.id = m.user_id'
    : ''
  return {
    sql: `
      SELECT MIN(trim(b.category)) AS category
      FROM mockups m
      LEFT JOIN businesses b ON b.id = m.business_id
      ${joinUser}
      WHERE ${scopeSql}
        AND ${visibleMockupSql('m')}
        AND trim(COALESCE(b.category, '')) != ''
      GROUP BY lower(trim(b.category))
      ORDER BY lower(trim(b.category)) ASC
    `,
    args: [options.scopeValue]
  }
}
