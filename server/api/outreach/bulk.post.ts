import { db, generateId } from '~~/server/utils/db'
import { sendEmail, generateEmailHTML } from '~~/server/utils/resend'
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
  const { businessIds, templateId, delayMs = 1000 } = body

  if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'businessIds array is required'
    })
  }

  if (!templateId) {
    throw createError({
      statusCode: 400,
      message: 'templateId is required'
    })
  }

  if (businessIds.length > 50) {
    throw createError({
      statusCode: 400,
      message: 'Maximum batch size is 50 emails'
    })
  }

  try {
    // Fetch template
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

    const results: Array<{
      businessId: string
      businessName: string
      success: boolean
      error?: string
    }> = []

    for (const businessId of businessIds) {
      try {
        // Fetch business
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
          results.push({
            businessId,
            businessName: 'Unknown',
            success: false,
            error: 'Business not found'
          })
          continue
        }

        const business = businessResult.rows[0]

        if (!business.email) {
          results.push({
            businessId,
            businessName: business.name as string,
            success: false,
            error: 'No email address'
          })
          continue
        }

        if (business.status !== 'approved') {
          results.push({
            businessId,
            businessName: business.name as string,
            success: false,
            error: 'Not approved'
          })
          continue
        }

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

        // Render and send
        let emailBody = renderTemplate(template.body as string, variables)
        emailBody = renderIssuesList(emailBody, issues)
        const emailSubject = renderTemplate(template.subject as string, variables)

        // Wrap in branded HTML
        const logoUrl = getEmailLogoUrl()
        const emailHtml = generateEmailHTML({
          businessName: business.name as string,
          body: emailBody.replace(/\n/g, '<br>'),
          logoUrl
        })

        const result = await sendEmail({
          to: business.email as string,
          subject: emailSubject,
          html: emailHtml,
          replyTo: 'dev@wildcardcreativeco.com'
        })

        // Log outreach
        const logId = generateId()
        await db.execute({
          sql: `INSERT INTO outreach_logs 
                (id, user_id, business_id, template_id, email_to, subject, status, message_id, ai_generated)
                VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, 0)`,
          args: [logId, user.id, businessId, templateId, business.email, emailSubject, result.id]
        })

        // Update business status
        await db.execute({
          sql: `UPDATE businesses SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
          args: [businessId]
        })

        results.push({
          businessId,
          businessName: business.name as string,
          success: true
        })

        // Rate limiting delay
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          businessId,
          businessName: 'Unknown',
          success: false,
          error: errorMessage
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    return {
      success: true,
      summary: {
        total: businessIds.length,
        succeeded: successCount,
        failed: failedCount
      },
      results
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to send bulk emails: ${errorMessage}`
    })
  }
})
