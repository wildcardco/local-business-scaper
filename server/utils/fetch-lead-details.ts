import { db, generateId } from '~~/server/utils/db'
import { ensureDigestTables } from '~~/server/utils/digest-schema'
import { requestStudioWebhook } from '~~/server/utils/n8n'
import { normalizeGbpPhotos } from '~~/shared/digest-ingest'
import { leadEmails } from '~~/shared/lead-context'
import {
  LEAD_DETAILS_NOT_FOUND,
  LEAD_DETAILS_NO_PLACE,
  LEAD_DETAILS_SECRET,
  LEAD_DETAILS_TIMEOUT_MS,
  LEAD_DETAILS_UNAVAILABLE,
  interpretLeadDetailsHttp,
  leadDetailsRequest,
  mergeLeadDetails,
  type LeadDetailsMerge
} from '~~/shared/lead-details'

const PAST_DETAILS_DATE = '1970-01-01'

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function integer(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

async function latestDigestLead(userId: string, businessId: string, placeId: string) {
  const result = await db.execute({
    sql: `
      SELECT dl.id, dl.angle, dl.score, dl.tier_label, dl.lead_group, dl.signals
      FROM digest_leads dl
      INNER JOIN digests d ON d.id = dl.digest_id
      WHERE d.user_id = ?
        AND (dl.business_id = ? OR dl.place_id = ?)
      ORDER BY d.digest_date DESC, dl.created_at DESC
      LIMIT 1
    `,
    args: [userId, businessId, placeId]
  })
  return result.rows[0] || null
}

async function saveDigestContext(
  userId: string,
  businessId: string,
  placeId: string,
  merged: LeadDetailsMerge
) {
  const hasContext = Boolean(
    merged.angle
    || merged.score !== null
    || merged.tier
    || merged.leadGroup
    || merged.signals
  )
  if (!hasContext) return

  const latest = await latestDigestLead(userId, businessId, placeId)
  if (latest) {
    const assignments: string[] = []
    const args: Array<string | number | null> = []
    if (merged.angle) {
      assignments.push('angle = ?')
      args.push(merged.angle)
    }
    if (merged.score !== null) {
      assignments.push('score = ?')
      args.push(merged.score)
    }
    if (merged.tier) {
      assignments.push('tier_slug = ?', 'tier_label = ?')
      args.push(merged.tier.slug, merged.tier.label)
    }
    if (merged.leadGroup) {
      assignments.push('lead_group = ?')
      args.push(merged.leadGroup)
    }
    if (merged.signals) {
      assignments.push('signals = ?')
      args.push(merged.signals)
    }
    args.push(String(latest.id))
    await db.execute({
      sql: `UPDATE digest_leads SET ${assignments.join(', ')} WHERE id = ?`,
      args
    })
    return
  }

  await db.execute({
    sql: `INSERT INTO digests (
            id, user_id, digest_date, search_category, search_location, lead_count, received_at, updated_at
          ) VALUES (?, ?, ?, 'Past details', 'Lookup', 1, datetime('now'), datetime('now'))
          ON CONFLICT (user_id, digest_date) DO UPDATE SET
            lead_count = lead_count + 1,
            updated_at = datetime('now')`,
    args: [generateId(), userId, PAST_DETAILS_DATE]
  })
  const digest = await db.execute({
    sql: 'SELECT id FROM digests WHERE user_id = ? AND digest_date = ? LIMIT 1',
    args: [userId, PAST_DETAILS_DATE]
  })
  const digestId = digest.rows[0]?.id
  if (!digestId) return
  await db.execute({
    sql: `INSERT INTO digest_leads (
            id, digest_id, business_id, place_id, rank, score, tier_slug, tier_label,
            angle, note, signals, lead_group, created_at
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, datetime('now'))`,
    args: [
      generateId(),
      String(digestId),
      businessId,
      placeId,
      merged.score,
      merged.tier?.slug || null,
      merged.tier?.label || null,
      merged.angle,
      merged.signals,
      merged.leadGroup
    ]
  })
}

export async function fetchPastLeadDetails(user: { id: string, email: string }, businessId: string) {
  const result = await db.execute({
    sql: `SELECT id, place_id, email, phone, contacts_data, photo_count, gbp_photos, lead_score
          FROM businesses
          WHERE id = ? AND user_id = ?
          LIMIT 1`,
    args: [businessId, user.id]
  })
  const business = result.rows[0]
  if (!business) throw createError({ statusCode: 404, message: 'Business not found' })

  const request = leadDetailsRequest({ owner: user.email, placeId: business.place_id })
  if (!request.ok) throw createError({ statusCode: 400, message: LEAD_DETAILS_NO_PLACE })

  await ensureDigestTables()
  const latest = await latestDigestLead(user.id, businessId, request.body.place_id)
  const http = await requestStudioWebhook(request.body, LEAD_DETAILS_TIMEOUT_MS)
  const outcome = interpretLeadDetailsHttp(http.status, http.body)

  if (outcome.kind === 'missing') {
    return {
      ok: true as const,
      found: false as const,
      place_id: request.body.place_id,
      message: LEAD_DETAILS_NOT_FOUND
    }
  }
  if (outcome.kind === 'secret') throw createError({ statusCode: 502, message: LEAD_DETAILS_SECRET })
  if (outcome.kind === 'unavailable') throw createError({ statusCode: 503, message: LEAD_DETAILS_UNAVAILABLE })
  if (outcome.kind === 'error') throw createError({ statusCode: 502, message: outcome.message })

  const merged = mergeLeadDetails({
    email: business.email,
    phone: business.phone,
    contacts_data: business.contacts_data,
    photo_count: business.photo_count,
    gbp_photos: business.gbp_photos,
    signals: latest?.signals
  }, outcome.details)

  const assignments: string[] = []
  const args: Array<string | number | null> = []
  if (merged.email) {
    assignments.push('email = ?')
    args.push(merged.email)
  }
  if (merged.phone) {
    assignments.push('phone = ?')
    args.push(merged.phone)
  }
  if (merged.contactsData !== null) {
    assignments.push('contacts_data = ?')
    args.push(merged.contactsData)
  }
  if (merged.photoCount !== null) {
    assignments.push('photo_count = ?')
    args.push(merged.photoCount)
  }
  if (merged.gbpPhotos !== null) {
    assignments.push('gbp_photos = ?')
    args.push(merged.gbpPhotos)
  }
  if (merged.score !== null) {
    assignments.push('lead_score = ?')
    args.push(merged.score)
  }
  if (merged.tier) {
    assignments.push('lead_category = ?')
    args.push(merged.tier.slug)
  }
  if (assignments.length) {
    assignments.push('updated_at = datetime(\'now\')')
    args.push(businessId, user.id)
    await db.execute({
      sql: `UPDATE businesses SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
      args
    })
  }

  await saveDigestContext(user.id, businessId, request.body.place_id, merged)

  const email = merged.email || text(business.email)
  const contacts = merged.contactsData ?? business.contacts_data
  const photos = merged.gbpPhotos ?? business.gbp_photos
  const phone = merged.phone || text(business.phone)
  const siteCheck = siteCheckFrom(merged.signals) || siteCheckFrom(latest?.signals)

  return {
    ok: true as const,
    found: true as const,
    place_id: request.body.place_id,
    email,
    emails: leadEmails(email, contacts),
    photo_count: merged.photoCount ?? integer(business.photo_count),
    gbp_photos: normalizeGbpPhotos(photos) || [],
    phone,
    lead_group: merged.leadGroup || text(latest?.lead_group),
    angle: merged.angle || text(latest?.angle),
    score: merged.score ?? integer(latest?.score) ?? integer(business.lead_score),
    tier: merged.tier?.label || text(latest?.tier_label),
    site_check: siteCheck
  }
}

function siteCheckFrom(value: unknown): string | null {
  if (typeof value === 'string') {
    try {
      return siteCheckFrom(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const check = (value as { site_check?: unknown }).site_check
  return typeof check === 'string' && check.trim() ? check.trim() : null
}
