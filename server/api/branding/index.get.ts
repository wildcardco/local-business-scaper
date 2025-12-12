import { db } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM branding_settings WHERE user_id = ? LIMIT 1',
      args: [user.id]
    })

    if (result.rows.length === 0) {
      return {
        success: true,
        branding: null
      }
    }

    const branding = result.rows[0]
    return {
      success: true,
      branding: {
        id: branding.id,
        companyName: branding.company_name,
        tagline: branding.tagline,
        logoUrl: branding.logo_url,
        senderEmail: branding.sender_email,
        senderName: branding.sender_name,
        primaryColor: branding.primary_color,
        secondaryColor: branding.secondary_color,
        fontFamily: branding.font_family,
        createdAt: branding.created_at,
        updatedAt: branding.updated_at
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to fetch branding settings: ${errorMessage}`
    })
  }
})

