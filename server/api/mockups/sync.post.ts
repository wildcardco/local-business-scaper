import { db, generateId } from '~~/server/utils/db'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { listN8nLeadsByOwner } from '~~/server/utils/n8n'
import { mapMockup } from '~~/server/utils/mockups'
import { isPlaceId, parseUsCityState } from '~~/shared/studio-location'
import { mockupGithubRepo } from '~~/shared/mockup-repo'

function asString(value: unknown) {
  if (value == null) return null
  return String(value)
}

async function fillBusinessLocation(userId: string, businessId: string, input: {
  address: string | null
  city: string | null
  state: string | null
  businessName: string
  row: Record<string, unknown>
}) {
  const current = await db.execute({
    sql: 'SELECT city, state, address, email, category FROM businesses WHERE id = ? AND user_id = ?',
    args: [businessId, userId]
  })
  const business = current.rows[0]
  if (!business) return

  const nextCity = !business.city || isPlaceId(business.city) ? input.city : String(business.city)
  const nextState = !business.state || isPlaceId(business.state) ? input.state : String(business.state)
  const nextAddress = business.address ? String(business.address) : input.address
  const nextEmail = business.email ? String(business.email) : asString(input.row.email)
  const nextCategory = business.category ? String(business.category) : asString(input.row.category)
  const unchanged = nextCity === (business.city || null)
    && nextState === (business.state || null)
    && nextAddress === (business.address || null)
    && nextEmail === (business.email || null)
    && nextCategory === (business.category || null)
  if (unchanged) return

  await db.execute({
    sql: `UPDATE businesses SET
      city = ?, state = ?, address = ?, email = ?, category = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [nextCity, nextState, nextAddress, nextEmail, nextCategory, businessId, userId]
  })
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const owner = ownerSlugFromEmail(user.email)
  const rows = await listN8nLeadsByOwner(user.email)

  let imported = 0
  let updated = 0

  for (const row of rows) {
    const placeId = asString(row.place_id)
    if (!placeId) continue
    const businessName = asString(row.business_name) || 'Imported lead'
    const address = asString(row.address)
    const parsedLocation = parseUsCityState(address)
    const city = parsedLocation.city
    const state = parsedLocation.state
    const githubRepo = mockupGithubRepo({
      owner,
      businessName,
      placeId,
      stored: asString(row.github_repo) || asString(row.repo_full_name)
    })

    const existing = await db.execute({
      sql: 'SELECT id FROM mockups WHERE user_id = ? AND place_id = ? LIMIT 1',
      args: [user.id, placeId]
    })

    const mockupUrl = asString(row.mockup_url)
    const pitchDraft = asString(row.pitch_draft)
    const status = asString(row.status) || (mockupUrl ? 'mockup_ready' : 'draft')
    const mockupVersion = Number(row.mockup_version || 0)
    const pitchVersion = Number(row.pitch_version || 0)
    const lastFeedback = asString(row.last_feedback)
    const photoUrls = typeof row.photo_urls === 'string'
      ? row.photo_urls
      : Array.isArray(row.photo_urls)
        ? JSON.stringify(row.photo_urls)
        : null

    if (existing.rows[0]) {
      await db.execute({
        sql: `UPDATE mockups SET
          owner = ?, status = ?, mockup_url = COALESCE(?, mockup_url),
          mockup_version = ?, pitch_draft = COALESCE(?, pitch_draft),
          pitch_version = ?, last_feedback = COALESCE(?, last_feedback),
          photo_urls = COALESCE(?, photo_urls),
          github_repo = COALESCE(github_repo, ?),
          n8n_synced_at = datetime('now'),
          updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
        args: [
          owner, status, mockupUrl, mockupVersion, pitchDraft,
          pitchVersion, lastFeedback, photoUrls, githubRepo,
          existing.rows[0].id, user.id
        ]
      })
      updated++

      const linked = await db.execute({
        sql: 'SELECT business_id FROM mockups WHERE id = ? AND user_id = ?',
        args: [existing.rows[0].id, user.id]
      })
      const linkedBusinessId = linked.rows[0]?.business_id ? String(linked.rows[0].business_id) : ''
      if (linkedBusinessId) {
        await fillBusinessLocation(user.id, linkedBusinessId, { address, city, state, businessName, row })
      }
    } else {
      let businessId: string | null = null

      const matched = await db.execute({
        sql: 'SELECT id FROM businesses WHERE user_id = ? AND place_id = ? LIMIT 1',
        args: [user.id, placeId]
      })

      if (matched.rows[0]) {
        businessId = String(matched.rows[0].id)
        await fillBusinessLocation(user.id, businessId, { address, city, state, businessName, row })
      } else {
        businessId = generateId()
        await db.execute({
          sql: `INSERT INTO businesses (
            id, user_id, search_id, name, address, city, state, phone, website, email, place_id, category, rating, review_count, status
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
          args: [
            businessId,
            user.id,
            businessName,
            address,
            city,
            state,
            row.phone != null ? String(row.phone) : null,
            asString(row.website),
            asString(row.email),
            placeId,
            asString(row.category),
            row.rating ?? null,
            row.review_count ?? null
          ]
        })
      }

      await db.execute({
        sql: `INSERT INTO mockups (
          id, user_id, business_id, place_id, owner, source, status, mockup_url, mockup_version,
          pitch_draft, pitch_version, last_feedback, photo_urls, github_repo, n8n_synced_at
        ) VALUES (?, ?, ?, ?, ?, 'digest', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          generateId(), user.id, businessId, placeId, owner, status, mockupUrl,
          mockupVersion, pitchDraft, pitchVersion, lastFeedback, photoUrls, githubRepo
        ]
      })
      imported++
    }
  }

  const list = await db.execute({
    sql: `
      SELECT m.*, b.name as b_name, b.website as b_website, b.phone as b_phone, b.email as b_email,
        b.address as b_address, b.city as b_city, b.state as b_state, b.category as b_category,
        b.rating as b_rating, b.review_count as b_review_count, b.place_id as b_place_id, b.id as b_id
      FROM mockups m
      LEFT JOIN businesses b ON m.business_id = b.id
      WHERE m.user_id = ?
      ORDER BY m.updated_at DESC
    `,
    args: [user.id]
  })

  return {
    success: true,
    imported,
    updated,
    synced: rows.length,
    owner,
    mockups: list.rows.map(row => mapMockup(
      row as Record<string, unknown>,
      row.b_id
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
          } as Record<string, unknown>
        : null
    ))
  }
})
