import { storedRerollLead, type StoredRerollLead } from '~~/shared/digest-reroll'
import { db, generateId } from '~~/server/utils/db'
import { ensureDigestTables } from '~~/server/utils/digest-schema'
import { OWNER_EMAIL_MAP, normalizeEmail } from '~~/server/utils/allowlist'
import { callbackUrlFromEvent } from '~~/server/utils/n8n'
import { saveRerollResults } from '~~/server/utils/reroll-results'
import { digestLeadFields, normalizeDigestTier } from '~~/shared/digest-ingest'

interface IngestLead {
  place_id: string
  name: string
  address?: string
  city?: string
  state?: string
  phone?: string
  website?: string
  category?: string
  rating?: number
  review_count?: number
  score?: number
  tier?: string
  rank?: number
  angle?: string
  note?: string
  signals?: Record<string, unknown>
}

interface IngestPayload {
  owner: string
  date: string
  search: {
    category: string
    location: string
  }
  leads: IngestLead[]
  reroll?: boolean | string
  reroll_id?: string
  source?: string
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export default defineEventHandler(async (event) => {
  await ensureDigestTables()

  const config = useRuntimeConfig()
  const secret = config.digestIngestSecret as string | undefined

  if (!secret) {
    throw createError({
      statusCode: 500,
      message: 'DIGEST_INGEST_SECRET is not configured'
    })
  }

  const authHeader = getHeader(event, 'x-digest-secret') || getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')

  if (!authHeader || !constantTimeCompare(authHeader, secret)) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody<IngestPayload>(event)

  if (!body.owner || typeof body.owner !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid field: owner'
    })
  }

  if (!body.date || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid field: date (must be YYYY-MM-DD)'
    })
  }

  if (!body.search || typeof body.search !== 'object' || !body.search.category || !body.search.location) {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid field: search (must have category and location)'
    })
  }

  if (!Array.isArray(body.leads)) {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid field: leads (must be an array)'
    })
  }

  const ownerSlug = body.owner.trim().toLowerCase()
  const ownerEmail = Object.keys(OWNER_EMAIL_MAP).find(
    email => OWNER_EMAIL_MAP[email] === ownerSlug
  )

  if (!ownerEmail) {
    throw createError({
      statusCode: 404,
      message: `Owner "${body.owner}" has no Studio account yet`
    })
  }

  const userResult = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
    args: [normalizeEmail(ownerEmail)]
  })

  const user = userResult.rows[0]
  if (!user || !user.id) {
    throw createError({
      statusCode: 404,
      message: `Owner "${body.owner}" has no Studio account yet`
    })
  }

  const userId = String(user.id)

  const searchResult = await db.execute({
    sql: `INSERT INTO searches (id, user_id, query, location, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT DO NOTHING
          RETURNING id`,
    args: [generateId(), userId, body.search.category, body.search.location]
  })

  let searchId: string
  if (searchResult.rows.length > 0 && searchResult.rows[0]?.id) {
    searchId = String(searchResult.rows[0].id)
  } else {
    const existingSearch = await db.execute({
      sql: 'SELECT id FROM searches WHERE user_id = ? AND query = ? AND location = ? ORDER BY created_at DESC LIMIT 1',
      args: [userId, body.search.category, body.search.location]
    })
    searchId = String(existingSearch.rows[0]?.id || generateId())
  }

  const digestId = generateId()
  await db.execute({
    sql: `INSERT INTO digests (id, user_id, digest_date, search_category, search_location, lead_count, received_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT (user_id, digest_date) DO UPDATE SET
            search_category = excluded.search_category,
            search_location = excluded.search_location,
            lead_count = excluded.lead_count,
            updated_at = datetime('now')
          RETURNING id`,
    args: [digestId, userId, body.date, body.search.category, body.search.location, body.leads.length]
  })

  const finalDigestResult = await db.execute({
    sql: 'SELECT id FROM digests WHERE user_id = ? AND digest_date = ? LIMIT 1',
    args: [userId, body.date]
  })
  const finalDigestId = String(finalDigestResult.rows[0]?.id || digestId)

  await db.execute({
    sql: 'DELETE FROM digest_leads WHERE digest_id = ?',
    args: [finalDigestId]
  })

  const savedLeads: StoredRerollLead[] = []

  for (const lead of body.leads) {
    const placeId = typeof lead.place_id === 'string' ? lead.place_id.trim() : ''
    if (!placeId) continue
    const name = typeof lead.name === 'string' && lead.name.trim() ? lead.name.trim() : '(name unavailable)'

    const tier = normalizeDigestTier(lead.tier)
    const score = typeof lead.score === 'number' ? lead.score : 0
    const rawLead = lead as unknown as Record<string, unknown>

    const existingBusiness = await db.execute({
      sql: 'SELECT id, email, contacts_data FROM businesses WHERE user_id = ? AND place_id = ? LIMIT 1',
      args: [userId, placeId]
    })

    let businessId: string
    const existing = existingBusiness.rows[0]
    const fields = digestLeadFields(rawLead, existing
      ? { email: existing.email, contacts_data: existing.contacts_data }
      : undefined)

    if (existing) {
      businessId = String(existing.id)
      const assignments = [
        'name = ?',
        'address = ?',
        'city = ?',
        'state = ?',
        'phone = ?',
        'website = ?',
        'category = ?',
        'rating = ?',
        'review_count = ?',
        'lead_score = ?',
        'lead_category = ?',
        'email = ?'
      ]
      const args: Array<string | number | null> = [
        name,
        lead.address || null,
        lead.city || null,
        lead.state || null,
        lead.phone || null,
        lead.website || null,
        lead.category || null,
        lead.rating || null,
        lead.review_count || null,
        score,
        tier?.slug || null,
        fields.email
      ]
      if (fields.contactsData !== null) {
        assignments.push('contacts_data = ?')
        args.push(fields.contactsData)
      }
      if (fields.photoCount !== null) {
        assignments.push('photo_count = ?')
        args.push(fields.photoCount)
      }
      if (fields.gbpPhotos !== null) {
        assignments.push('gbp_photos = ?')
        args.push(fields.gbpPhotos)
      }
      assignments.push('updated_at = datetime(\'now\')')
      args.push(businessId, userId)
      await db.execute({
        sql: `UPDATE businesses SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
        args
      })
    } else {
      businessId = generateId()
      await db.execute({
        sql: `INSERT INTO businesses (
          id, user_id, search_id, name, address, city, state, phone, website, email,
          category, rating, review_count, place_id, lead_score, lead_category,
          contacts_data, photo_count, gbp_photos,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'))`,
        args: [
          businessId, userId, searchId, name,
          lead.address || null,
          lead.city || null,
          lead.state || null,
          lead.phone || null,
          lead.website || null,
          fields.email,
          lead.category || null,
          lead.rating || null,
          lead.review_count || null,
          placeId,
          score,
          tier?.slug || null,
          fields.contactsData,
          fields.photoCount,
          fields.gbpPhotos
        ]
      })
    }

    await db.execute({
      sql: `INSERT INTO digest_leads (
        id, digest_id, business_id, place_id, rank, score, tier_slug, tier_label,
        angle, note, signals, lead_group, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        generateId(),
        finalDigestId,
        businessId,
        placeId,
        lead.rank || null,
        score,
        tier?.slug || null,
        tier?.label || null,
        lead.angle || null,
        lead.note || null,
        lead.signals ? JSON.stringify(lead.signals) : null,
        fields.leadGroup
      ]
    })

    const stored = storedRerollLead({
      businessId,
      placeId,
      name,
      address: lead.address || null,
      city: lead.city || null,
      state: lead.state || null,
      phone: lead.phone || null,
      website: lead.website || null,
      category: lead.category || null,
      rating: typeof lead.rating === 'number' ? lead.rating : null,
      reviewCount: typeof lead.review_count === 'number' ? lead.review_count : null,
      score,
      tierSlug: tier?.slug || null,
      tierLabel: tier?.label || null,
      rank: typeof lead.rank === 'number' ? lead.rank : null,
      angle: lead.angle || null,
      note: lead.note || null,
      signals: lead.signals && typeof lead.signals === 'object' ? lead.signals : null,
      leadGroup: fields.leadGroup
    })
    if (stored) savedLeads.push(stored)
  }

  await db.execute({
    sql: 'UPDATE digests SET lead_count = ? WHERE id = ?',
    args: [savedLeads.length, finalDigestId]
  })

  const rerollFlag = body.reroll === true || body.reroll === 'true' || body.source === 'reroll'
  await saveRerollResults({
    userId,
    date: body.date,
    requestedId: typeof body.reroll_id === 'string' ? body.reroll_id : '',
    rerollFlag,
    digestId: finalDigestId,
    category: body.search.category,
    location: body.search.location,
    leads: savedLeads
  })

  const origin = callbackUrlFromEvent(event).replace(/\/api\/mockups\/webhook$/, '')
  const url = `${origin}/leads/today?date=${body.date}`

  return {
    success: true,
    digest_id: finalDigestId,
    lead_count: savedLeads.length,
    url
  }
})
