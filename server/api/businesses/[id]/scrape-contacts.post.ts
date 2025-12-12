import { db } from '~~/server/utils/db'

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

    // Fetch business to get place_id
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
        message: 'Business has no place_id to fetch details'
      })
    }

    // Fetch detailed business info from RapidAPI
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
    console.log('✅ RapidAPI response received:', { hasData: !!data.data, dataLength: data.data?.length })
    
    // data.data is an array, get first business
    if (!data.data || data.data.length === 0) {
      throw new Error('No business data returned from API')
    }
    
    const businessData = data.data[0]

    // Extract email and contacts
    const email = businessData.emails_and_contacts?.emails?.[0] || null
    const phoneNumbers = businessData.emails_and_contacts?.phone_numbers || []
    const phone = phoneNumbers[0] || business.phone

    // Store full contacts data as JSON for display
    const contactsData = businessData.emails_and_contacts ? JSON.stringify(businessData.emails_and_contacts) : null

    // Extract social media links
    const facebook = businessData.emails_and_contacts?.facebook || null
    const instagram = businessData.emails_and_contacts?.instagram || null
    const twitter = businessData.emails_and_contacts?.twitter || null
    const linkedin = businessData.emails_and_contacts?.linkedin || null
    const youtube = businessData.emails_and_contacts?.youtube || null
    const tiktok = businessData.emails_and_contacts?.tiktok || null
    const yelp = businessData.emails_and_contacts?.yelp || null

    console.log('📧 Extracted contact data:', { email, phone, hasContactsData: !!contactsData })

    // Update business record with new contact info
    // Try to update with social media columns, fall back if they don't exist
    console.log('💾 Updating database...')
    try {
      await db.execute({
        sql: `UPDATE businesses 
              SET email = ?, phone = ?, contacts_data = ?,
                  facebook = ?, instagram = ?, twitter = ?, linkedin = ?,
                  youtube = ?, tiktok = ?, yelp = ?,
                  updated_at = datetime('now')
              WHERE id = ?`,
        args: [email, phone, contactsData, facebook, instagram, twitter, linkedin, youtube, tiktok, yelp, id]
      })
      console.log('✅ Database updated with social media fields')
    } catch (dbError) {
      console.warn('⚠️ Could not update social media fields, trying without them:', dbError)
      // Fall back to updating just the core fields if social media columns don't exist yet
      await db.execute({
        sql: `UPDATE businesses 
              SET email = ?, phone = ?, contacts_data = ?, updated_at = datetime('now')
              WHERE id = ?`,
        args: [email, phone, contactsData, id]
      })
      console.log('✅ Database updated with core fields only')
    }

    return {
      success: true,
      message: email 
        ? `Found email: ${email}` 
        : 'No email found, but business updated',
      contactsFound: {
        email,
        phone,
        emailsCount: businessData.emails_and_contacts?.emails?.length || 0,
        phonesCount: phoneNumbers.length,
        socialMedia: {
          facebook,
          instagram,
          twitter,
          linkedin,
          youtube,
          tiktok,
          yelp
        }
      }
    }
  } catch (error: unknown) {
    console.error('❌ Scrape contacts error:', error)
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack })
    throw createError({
      statusCode: 500,
      message: `Failed to scrape contacts: ${errorMessage}`
    })
  }
})

