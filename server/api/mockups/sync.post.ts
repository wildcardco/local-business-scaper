import { db, generateId } from '~~/server/utils/db'
import { ownerSlugFromEmail } from '~~/server/utils/allowlist'
import { listN8nLeadPage } from '~~/server/utils/n8n'
import { isPlaceId, parseUsCityState } from '~~/shared/studio-location'
import { mockupGithubRepo } from '~~/shared/mockup-repo'

type SqlArg = string | number | bigint | null

interface Statement {
  sql: string
  args: SqlArg[]
}

function asString(value: unknown) {
  if (value == null || value === '') return null
  return String(value)
}

function asNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function locationPatch(current: {
  city?: unknown
  state?: unknown
  address?: unknown
  email?: unknown
  category?: unknown
}, input: {
  address: string | null
  city: string | null
  state: string | null
  row: Record<string, unknown>
}) {
  const city = asString(current.city)
  const state = asString(current.state)
  const address = asString(current.address)
  const email = asString(current.email)
  const category = asString(current.category)
  const nextCity = !city || isPlaceId(city) ? input.city : city
  const nextState = !state || isPlaceId(state) ? input.state : state
  const nextAddress = address || input.address
  const nextEmail = email || asString(input.row.email)
  const nextCategory = category || asString(input.row.category)
  const unchanged = nextCity === city
    && nextState === state
    && nextAddress === address
    && nextEmail === email
    && nextCategory === category
  if (unchanged) return null
  return { nextCity, nextState, nextAddress, nextEmail, nextCategory }
}

function businessUpdate(businessId: string, userId: string, patch: NonNullable<ReturnType<typeof locationPatch>>): Statement {
  return {
    sql: `UPDATE businesses SET
      city = ?, state = ?, address = ?, email = ?, category = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
    args: [patch.nextCity, patch.nextState, patch.nextAddress, patch.nextEmail, patch.nextCategory, businessId, userId]
  }
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const owner = ownerSlugFromEmail(user.email)
  const body = await readBody(event).catch(() => null)
  const requestedCursor = body && typeof body.cursor === 'string' ? body.cursor.trim() : ''
  if (requestedCursor.length > 512) {
    throw createError({ statusCode: 400, message: 'Sync cursor is not valid.' })
  }

  const page = await listN8nLeadPage(user.email, {
    cursor: requestedCursor || null,
    unsorted: Boolean(body && body.unsorted === true)
  })

  const byPlace = new Map<string, Record<string, unknown>>()
  for (const row of page.rows) {
    const placeId = asString(row.place_id)
    if (placeId) byPlace.set(placeId, row)
  }

  let imported = 0
  let updated = 0
  const writes: Statement[] = []
  const placeIds = [...byPlace.keys()]

  if (placeIds.length > 0) {
    const marks = placeIds.map(() => '?').join(', ')
    const [mockupResult, businessResult] = await db.batch([
      {
        sql: `SELECT m.id, m.place_id, m.business_id, b.city as b_city, b.state as b_state,
            b.address as b_address, b.email as b_email, b.category as b_category
          FROM mockups m
          LEFT JOIN businesses b ON b.id = m.business_id
          WHERE m.user_id = ? AND m.place_id IN (${marks})`,
        args: [user.id, ...placeIds]
      },
      {
        sql: `SELECT id, place_id, city, state, address, email, category
          FROM businesses
          WHERE user_id = ? AND place_id IN (${marks})`,
        args: [user.id, ...placeIds]
      }
    ], 'read')

    const mockupsByPlace = new Map(mockupResult.rows.map(row => [String(row.place_id || ''), row]))
    const businessesByPlace = new Map(businessResult.rows.map(row => [String(row.place_id || ''), row]))

    for (const [placeId, row] of byPlace) {
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
      const phone = row.phone != null ? String(row.phone) : null
      const existing = mockupsByPlace.get(placeId)

      if (existing?.id) {
        writes.push({
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
            String(existing.id), user.id
          ]
        })
        updated++
        if (existing.business_id) {
          const patch = locationPatch({
            city: existing.b_city,
            state: existing.b_state,
            address: existing.b_address,
            email: existing.b_email,
            category: existing.b_category
          }, { address, city, state, row })
          if (patch) writes.push(businessUpdate(String(existing.business_id), user.id, patch))
        }
        continue
      }

      const matched = businessesByPlace.get(placeId)
      let businessId = matched?.id ? String(matched.id) : ''
      if (businessId) {
        const patch = locationPatch(matched, { address, city, state, row })
        if (patch) writes.push(businessUpdate(businessId, user.id, patch))
      } else {
        businessId = generateId()
        writes.push({
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
            phone,
            asString(row.website),
            asString(row.email),
            placeId,
            asString(row.category),
            asNumber(row.rating),
            asNumber(row.review_count)
          ]
        })
      }

      writes.push({
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

  if (writes.length > 0) {
    await db.batch(writes, 'write')
  }

  return {
    success: true,
    imported,
    updated,
    synced: page.rows.length,
    owner,
    nextCursor: page.nextCursor,
    unsorted: page.unsorted
  }
})
