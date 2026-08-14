import { db, generateId } from '~~/server/utils/db'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { listN8nLeadsByOwner } from '~~/server/utils/n8n'
import { mapMockup } from '~~/server/utils/mockups'

function asString(value: unknown) {
  if (value == null) return null
  return String(value)
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const owner = ownerSlugFromEmail(user.email)
  const rows = await listN8nLeadsByOwner(user.email)

  let imported = 0

  for (const row of rows) {
    const placeId = asString(row.place_id)
    if (!placeId) continue

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
          photo_urls = COALESCE(?, photo_urls), n8n_synced_at = datetime('now'),
          updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
        args: [
          owner, status, mockupUrl, mockupVersion, pitchDraft,
          pitchVersion, lastFeedback, photoUrls,
          existing.rows[0].id, user.id
        ]
      })
    } else {
      const businessName = asString(row.business_name) || 'Imported lead'
      let businessId: string | null = null

      const matched = await db.execute({
        sql: 'SELECT id FROM businesses WHERE user_id = ? AND place_id = ? LIMIT 1',
        args: [user.id, placeId]
      })

      if (matched.rows[0]) {
        businessId = String(matched.rows[0].id)
      } else {
        businessId = generateId()
        await db.execute({
          sql: `INSERT INTO businesses (
            id, user_id, search_id, name, address, phone, website, place_id, category, rating, review_count, status
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
          args: [
            businessId,
            user.id,
            businessName,
            asString(row.address),
            row.phone != null ? String(row.phone) : null,
            asString(row.website),
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
          pitch_draft, pitch_version, last_feedback, photo_urls, n8n_synced_at
        ) VALUES (?, ?, ?, ?, ?, 'digest', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          generateId(), user.id, businessId, placeId, owner, status, mockupUrl,
          mockupVersion, pitchDraft, pitchVersion, lastFeedback, photoUrls
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
    synced: rows.length,
    mockups: list.rows.map((row) => mapMockup(
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
