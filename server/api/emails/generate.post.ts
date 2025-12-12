import { db } from '~~/server/utils/db'
import { generatePersonalizedEmail } from '~~/server/utils/groq'
import { loadBrandGuide, getEmailLogoUrl } from '~~/server/utils/brand-assets'
import { generateEmailHTML } from '~~/server/utils/resend'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)
  const { businessId, templateId, customPrompt } = body

  if (!businessId) {
    throw createError({
      statusCode: 400,
      message: 'businessId is required'
    })
  }

  try {
    // Fetch business with audit data
    const businessResult = await db.execute({
      sql: `
        SELECT b.*, a.performance_score, a.seo_score, a.accessibility_score,
               a.best_practices_score, a.is_mobile_responsive, a.has_ssl, a.detected_platform
        FROM businesses b
        LEFT JOIN audits a ON b.id = a.business_id
        WHERE b.id = ? AND b.user_id = ?
      `,
      args: [businessId, user.id]
    })

    if (businessResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Business not found'
      })
    }

    const business = businessResult.rows[0]

    // Fetch template if provided
    let templateBody: string | undefined
    if (templateId) {
      const templateResult = await db.execute({
        sql: 'SELECT body FROM email_templates WHERE id = ?',
        args: [templateId]
      })
      
      if (templateResult.rows.length > 0) {
        templateBody = templateResult.rows[0].body as string
      }
    }

    // Load brand guide
    const brandGuide = await loadBrandGuide()

    // Load branding settings
    let brandingSettings = null
    try {
      const brandingResult = await db.execute({
        sql: 'SELECT * FROM branding_settings WHERE user_id = ? LIMIT 1',
        args: [user.id]
      })
      
      if (brandingResult.rows.length > 0) {
        const b = brandingResult.rows[0]
        brandingSettings = {
          companyName: b.company_name as string | null,
          tagline: b.tagline as string | null,
          logoUrl: b.logo_url as string | null,
          primaryColor: b.primary_color as string | null,
          secondaryColor: b.secondary_color as string | null,
          fontFamily: b.font_family as string | null
        }
      }
    } catch (e) {
      // Branding settings are optional
      console.log('No branding settings found, using defaults')
    }

    // Prepare business data
    const businessData = {
      id: business.id as string,
      name: business.name as string,
      category: business.category as string | null,
      city: business.city as string | null,
      state: business.state as string | null,
      website: business.website as string | null,
      rating: business.rating as number | null,
      reviewCount: business.review_count as number | null
    }

    // Prepare audit data if available
    const auditData = business.performance_score !== null ? {
      performanceScore: business.performance_score as number,
      seoScore: business.seo_score as number | null,
      accessibilityScore: business.accessibility_score as number | null,
      bestPracticesScore: business.best_practices_score as number | null,
      isMobileResponsive: Boolean(business.is_mobile_responsive),
      hasSSL: Boolean(business.has_ssl),
      detectedPlatform: business.detected_platform as string | null
    } : null

    // Generate personalized email using Groq AI
    const generatedEmail = await generatePersonalizedEmail({
      business: businessData,
      audit: auditData,
      brandGuide,
      branding: brandingSettings,
      templateBody,
      customPrompt
    })

    // Wrap the generated body in branded HTML template
    const logoUrl = brandingSettings?.logoUrl || getEmailLogoUrl()
    const fullHtml = generateEmailHTML({
      businessName: business.name as string,
      body: generatedEmail.bodyHtml,
      logoUrl,
      branding: brandingSettings
    })

    return {
      success: true,
      email: {
        subject: generatedEmail.subject,
        bodyHtml: fullHtml,
        bodyText: generatedEmail.bodyText
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email generation error:', errorMessage)
    
    throw createError({
      statusCode: 500,
      message: `Failed to generate email: ${errorMessage}`
    })
  }
})





