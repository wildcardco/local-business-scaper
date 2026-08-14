import { db } from '~~/server/utils/db'
import {
  clampTokens,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_MODEL,
  DEFAULT_PITCH_MAX_TOKENS,
  isStudioAiModel
} from '~~/shared/studio-ai'

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
        aiModel: isStudioAiModel(branding.ai_model) ? branding.ai_model : DEFAULT_AI_MODEL,
        aiMaxTokens: clampTokens(branding.ai_max_tokens, DEFAULT_AI_MAX_TOKENS),
        pitchMaxTokens: clampTokens(branding.pitch_max_tokens, DEFAULT_PITCH_MAX_TOKENS, 256, 8000),
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
