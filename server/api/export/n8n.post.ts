import { db } from '~~/server/utils/db'
import type { N8nWebhookPayload } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { businessIds, templateId } = body

  if (!config.n8nWebhookUrl) {
    throw createError({
      statusCode: 400,
      message: 'n8n webhook URL is not configured'
    })
  }

  if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'businessIds array is required'
    })
  }

  try {
    // Fetch approved businesses owned by user
    const placeholders = businessIds.map(() => '?').join(', ')
    const businessResult = await db.execute({
      sql: `
        SELECT b.*, a.performance_score, a.seo_score, a.accessibility_score, a.has_ssl
        FROM businesses b
        LEFT JOIN audits a ON b.id = a.business_id
        WHERE b.id IN (${placeholders}) AND b.user_id = ? AND b.status = 'approved'
      `,
      args: [...businessIds, user.id]
    })

    if (businessResult.rows.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No approved businesses found with the provided IDs'
      })
    }

    // Fetch template if provided
    let template = null
    if (templateId) {
      const templateResult = await db.execute({
        sql: 'SELECT * FROM email_templates WHERE id = ?',
        args: [templateId]
      })
      if (templateResult.rows.length > 0) {
        template = templateResult.rows[0]
      }
    }

    // Build payload
    const payload: N8nWebhookPayload = {
      action: 'send_outreach',
      leads: businessResult.rows.map(b => {
        const issues: string[] = []
        if (!b.website) {
          issues.push('No website')
        } else {
          if (b.performance_score !== null && Number(b.performance_score) < 50) {
            issues.push(`Poor performance: ${b.performance_score}/100`)
          }
          if (b.seo_score !== null && Number(b.seo_score) < 50) {
            issues.push(`Poor SEO: ${b.seo_score}/100`)
          }
          if (b.accessibility_score !== null && Number(b.accessibility_score) < 50) {
            issues.push(`Poor accessibility: ${b.accessibility_score}/100`)
          }
          if (b.has_ssl === 0) {
            issues.push('No SSL certificate')
          }
        }

        return {
          id: b.id as string,
          businessName: b.name as string,
          email: (b.email as string) || '',
          phone: b.phone as string | undefined,
          website: b.website as string | undefined,
          leadCategory: b.lead_category as 'hot' | 'warm' | 'cold',
          leadScore: b.lead_score as number,
          pitchType: b.website ? 'website_improvement' : 'new_website',
          issues,
          audit: b.performance_score !== null ? {
            performanceScore: b.performance_score as number,
            seoScore: b.seo_score as number,
            accessibilityScore: b.accessibility_score as number
          } : undefined
        }
      }),
      template: template ? {
        id: template.id as string,
        subject: template.subject as string,
        body: template.body as string
      } : {
        id: 'default',
        subject: 'Website Improvement Opportunity',
        body: 'Default template - please configure templates in the app.'
      }
    }

    // Send to n8n webhook
    const response = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`n8n webhook error: ${response.status} - ${errorText}`)
    }

    // Update business statuses
    await db.execute({
      sql: `UPDATE businesses SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') 
            WHERE id IN (${placeholders}) AND user_id = ?`,
      args: [...businessIds, user.id]
    })

    return {
      success: true,
      message: `Sent ${businessResult.rows.length} leads to n8n webhook`,
      leadsSent: businessResult.rows.length
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to send to n8n: ${errorMessage}`
    })
  }
})
