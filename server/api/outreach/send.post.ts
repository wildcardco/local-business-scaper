import { db, generateId } from '~~/server/utils/db'
import { sendEmail } from '~~/server/utils/resend'
import { generateEmailHTML } from '~~/server/utils/resend'
import { getEmailLogoUrl } from '~~/server/utils/brand-assets'

// Keep legacy template rendering functions for template-based emails
function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
}

function renderIssuesList(template: string, issues: string[]): string {
  const issuesRegex = /{{#issues}}([\s\S]*?){{\/issues}}/g
  const issueItemRegex = /{{\.}}/g

  return template.replace(issuesRegex, (_, itemTemplate) => {
    return issues.map(issue => itemTemplate.replace(issueItemRegex, issue)).join('')
  })
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)
  const { businessId, templateId, generatedBody, customSubject, aiGenerated = false } = body

  if (!businessId || (!templateId && !generatedBody)) {
    throw createError({
      statusCode: 400,
      message: 'businessId and either templateId or generatedBody are required'
    })
  }

  try {
    // Fetch business with audit
    const businessResult = await db.execute({
      sql: `
        SELECT b.*, a.performance_score, a.seo_score, a.accessibility_score
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

    // Load branding settings for sender email
    let senderEmail = 'outreach@wildcardcreativeco.com'
    let senderName = 'Wild Card Creative'
    try {
      const brandingResult = await db.execute({
        sql: 'SELECT sender_email, sender_name FROM branding_settings WHERE user_id = ? LIMIT 1',
        args: [user.id]
      })
      
      if (brandingResult.rows.length > 0 && brandingResult.rows[0].sender_email) {
        senderEmail = brandingResult.rows[0].sender_email as string
        senderName = (brandingResult.rows[0].sender_name as string) || 'Wild Card Creative'
      }
    } catch (e) {
      // Use defaults if branding not configured
      console.log('Using default sender email')
    }

    if (!business.email) {
      throw createError({
        statusCode: 400,
        message: 'Business does not have an email address'
      })
    }

    if (business.status !== 'approved') {
      throw createError({
        statusCode: 400,
        message: 'Business must be approved before sending outreach'
      })
    }

    let emailSubject: string
    let emailBody: string
    let emailHtml: string

    // Handle AI-generated email or template-based email
    if (generatedBody) {
      // AI-generated email
      emailSubject = customSubject || 'Website Services from Wild Card Creative'
      emailBody = generatedBody
      emailHtml = generatedBody // Already includes HTML wrapper from generation
    } else {
      // Template-based email
      const templateResult = await db.execute({
        sql: 'SELECT * FROM email_templates WHERE id = ?',
        args: [templateId]
      })

      if (templateResult.rows.length === 0) {
        throw createError({
          statusCode: 404,
          message: 'Template not found'
        })
      }

      const template = templateResult.rows[0]

      // Build issues list
      const issues: string[] = []
      if (!business.website) {
        issues.push('No website')
      } else {
        if (business.performance_score !== null && Number(business.performance_score) < 50) {
          issues.push(`Performance score: ${business.performance_score}/100`)
        }
        if (business.seo_score !== null && Number(business.seo_score) < 50) {
          issues.push(`SEO score: ${business.seo_score}/100`)
        }
        if (business.accessibility_score !== null && Number(business.accessibility_score) < 50) {
          issues.push(`Accessibility score: ${business.accessibility_score}/100`)
        }
      }

      // Build variables
      const variables: Record<string, string> = {
        businessName: business.name as string,
        category: (business.category as string) || 'local',
        city: (business.city as string) || '',
        state: (business.state as string) || '',
        performanceScore: String(business.performance_score || 0),
        seoScore: String(business.seo_score || 0),
        accessibilityScore: String(business.accessibility_score || 0)
      }

      // Render template
      emailBody = renderTemplate(template.body as string, variables)
      emailBody = renderIssuesList(emailBody, issues)
      emailSubject = renderTemplate(template.subject as string, variables)

      // Wrap in branded HTML
      const logoUrl = getEmailLogoUrl()
      emailHtml = generateEmailHTML({
        businessName: business.name as string,
        body: emailBody.replace(/\n/g, '<br>'),
        logoUrl
      })
    }

    // Send email via Resend
    const result = await sendEmail({
      to: business.email as string,
      subject: emailSubject,
      html: emailHtml,
      from: `${senderName} <${senderEmail}>`,
      replyTo: senderEmail
    })

    // Log outreach
    const logId = generateId()
    await db.execute({
      sql: `INSERT INTO outreach_logs 
            (id, user_id, business_id, template_id, email_to, subject, status, message_id, generated_body, ai_generated)
            VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?)`,
      args: [
        logId,
        user.id,
        businessId,
        templateId || '',
        business.email,
        emailSubject,
        result.id,
        generatedBody || null,
        aiGenerated ? 1 : 0
      ]
    })

    // Update business status
    await db.execute({
      sql: `UPDATE businesses SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      args: [businessId]
    })

    return {
      success: true,
      message: 'Email sent successfully',
      messageId: result.id
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to send email: ${errorMessage}`
    })
  }
})
