import { db, generateId } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)
  
  const { companyName, tagline, logoUrl, senderEmail, senderName, primaryColor, secondaryColor, fontFamily } = body

  try {
    // Check if branding settings exist
    const existing = await db.execute({
      sql: 'SELECT id FROM branding_settings WHERE user_id = ? LIMIT 1',
      args: [user.id]
    })

    if (existing.rows.length > 0) {
      // Update existing
      await db.execute({
        sql: `UPDATE branding_settings 
              SET company_name = ?, tagline = ?, logo_url = ?, sender_email = ?, sender_name = ?,
                  primary_color = ?, secondary_color = ?, font_family = ?,
                  updated_at = datetime('now')
              WHERE user_id = ?`,
        args: [companyName, tagline, logoUrl, senderEmail, senderName, primaryColor, secondaryColor, fontFamily, user.id]
      })

      return { success: true, message: 'Branding settings updated' }
    } else {
      // Create new
      const id = generateId()
      await db.execute({
        sql: `INSERT INTO branding_settings 
              (id, user_id, company_name, tagline, logo_url, sender_email, sender_name, primary_color, secondary_color, font_family)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, user.id, companyName, tagline, logoUrl, senderEmail, senderName, primaryColor, secondaryColor, fontFamily]
      })

      return { success: true, message: 'Branding settings created' }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to save branding settings: ${errorMessage}`
    })
  }
})

