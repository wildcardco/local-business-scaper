import { db } from '~~/server/utils/db'
import { businessCategoryFromListing } from '~~/server/utils/openweb-ninja'

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function socialUrl(value: unknown): string | null {
  return firstString(value)
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    })
  }

  try {
    const config = useRuntimeConfig()

    if (!config.rapidApiKey) {
      throw new Error('RAPIDAPI_KEY is not configured')
    }

    const businessResult = await db.execute({
      sql: 'SELECT * FROM businesses WHERE id = ? AND user_id = ?',
      args: [id, user.id]
    })

    if (businessResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Business not found'
      })
    }

    const business = businessResult.rows[0]
    const placeId = business.place_id as string

    if (!placeId) {
      throw createError({
        statusCode: 400,
        message: 'No Google listing on file for this business'
      })
    }

    const detailsUrl = new URLSearchParams({
      business_id: placeId,
      extract_emails_and_contacts: 'true',
      extract_share_link: 'false',
      region: 'us',
      language: 'en'
    })

    const response = await fetch(
      `https://${config.rapidApiHost}/business-details?${detailsUrl}`,
      {
        headers: {
          'X-RapidAPI-Key': config.rapidApiKey,
          'X-RapidAPI-Host': config.rapidApiHost
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    if (!data.data || data.data.length === 0) {
      throw new Error('No business data returned from API')
    }

    const listing = data.data[0]
    const contacts = listing.emails_and_contacts || {}
    const emails = Array.isArray(contacts.emails) ? contacts.emails : []
    const extraPhones = Array.isArray(contacts.phone_numbers) ? contacts.phone_numbers : []

    const name = firstString(listing.name) || (business.name as string)
    const website = firstString(listing.website) || (business.website as string | null)
    const phone = firstString(listing.phone_number, extraPhones[0]) || (business.phone as string | null)
    const email = firstString(emails[0]) || (business.email as string | null)
    const address = firstString(listing.full_address) || (business.address as string | null)
    const city = firstString(listing.city) || (business.city as string | null)
    const state = firstString(listing.state) || (business.state as string | null)
    const zipCode = firstString(listing.postal_code) || (business.zip_code as string | null)
    const category = businessCategoryFromListing(listing) || (business.category as string | null)
    const googleMapsUrl = firstString(listing.google_maps_url) || (business.google_maps_url as string | null)

    const facebook = socialUrl(contacts.facebook)
    const instagram = socialUrl(contacts.instagram)
    const twitter = socialUrl(contacts.twitter)
    const linkedin = socialUrl(contacts.linkedin)
    const youtube = socialUrl(contacts.youtube)
    const tiktok = socialUrl(contacts.tiktok)
    const yelp = socialUrl(contacts.yelp)

    const contactsData = Object.keys(contacts).length ? JSON.stringify(contacts) : (business.contacts_data as string | null)

    try {
      await db.execute({
        sql: `UPDATE businesses
              SET name = ?, website = ?, phone = ?, email = ?, address = ?, city = ?, state = ?, zip_code = ?,
                  category = ?, google_maps_url = ?, contacts_data = ?,
                  facebook = ?, instagram = ?, twitter = ?, linkedin = ?,
                  youtube = ?, tiktok = ?, yelp = ?,
                  updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
        args: [
          name, website, phone, email, address, city, state, zipCode,
          category, googleMapsUrl, contactsData,
          facebook, instagram, twitter, linkedin, youtube, tiktok, yelp,
          id, user.id
        ]
      })
    } catch {
      await db.execute({
        sql: `UPDATE businesses
              SET name = ?, website = ?, phone = ?, email = ?, address = ?, city = ?, state = ?,
                  category = ?, contacts_data = ?, updated_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
        args: [name, website, phone, email, address, city, state, category, contactsData, id, user.id]
      })
    }

    const socialMedia = { facebook, instagram, twitter, linkedin, youtube, tiktok, yelp }
    const foundBits = [
      email && `email ${email}`,
      phone && `phone ${phone}`,
      facebook && 'Facebook',
      instagram && 'Instagram'
    ].filter(Boolean)

    return {
      success: true,
      message: foundBits.length
        ? `Updated from Google listing: ${foundBits.join(', ')}`
        : 'Google listing refreshed, no extra contacts found',
      business: {
        name,
        website,
        phone,
        email,
        address,
        city,
        state,
        zipCode,
        category,
        googleMapsUrl,
        contactsData: contacts,
        facebook,
        instagram,
        twitter,
        linkedin,
        youtube,
        tiktok,
        yelp
      },
      contactsFound: {
        email,
        phone,
        emailsCount: emails.length,
        phonesCount: extraPhones.length,
        socialMedia
      }
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to scrape contacts: ${errorMessage}`
    })
  }
})
