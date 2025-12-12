import { db, generateId } from '~~/server/utils/db'

const defaultTemplates = [
  {
    name: 'no_website',
    subject: "Quick question about {{businessName}}'s online presence",
    body: `Hi there,

I was looking for {{category}} businesses in {{city}} and came across {{businessName}}. I noticed you don't currently have a website, and I wanted to reach out because I help local businesses like yours get online.

A simple, professional website can help you:
- Show up when people search for "{{category}} in {{city}}"
- Give customers a way to learn about your services 24/7
- Build credibility with reviews and photos

I'm Ryan with Wild Card Creative, a local web design company. I'd love to chat for 15 minutes about what a website could do for your business - no pressure, just an honest conversation.

Would you be open to a quick call this week?

Best,
Ryan
Wild Card Creative Co.
https://www.wildcardcreativeco.com/`
  },
  {
    name: 'poor_performance',
    subject: 'Your website might be losing you customers',
    body: `Hi,

I recently came across {{businessName}}'s website and noticed a few things that might be hurting your business:

{{#issues}}
- {{.}}
{{/issues}}

These issues can cause visitors to leave before they even see what you offer. In fact, {{performanceScore}}% performance means your site loads slower than most websites.

I'm Ryan with Wild Card Creative, and I specialize in helping local businesses fix exactly these problems. I'd be happy to put together a quick report showing what's slowing things down and how to fix it - completely free.

Interested?

Best,
Ryan
Wild Card Creative Co.
https://www.wildcardcreativeco.com/`
  },
  {
    name: 'poor_seo',
    subject: "{{businessName}} isn't showing up in Google searches",
    body: `Hi,

I was researching {{category}} businesses in {{city}} and noticed that {{businessName}} isn't ranking as well as it could be in Google searches.

Your website's SEO score is {{seoScore}}/100, which means potential customers searching for services like yours might not be finding you.

A few quick improvements could help you:
- Show up higher in local search results
- Get more organic traffic (free visitors!)
- Beat competitors who are ranking above you

I'm Ryan with Wild Card Creative. I help local businesses improve their online visibility. Would you be interested in a free, no-obligation review of your website's SEO?

Best,
Ryan
Wild Card Creative Co.
https://www.wildcardcreativeco.com/`
  }
]

export default defineEventHandler(async () => {
  try {
    // Check if templates already exist
    const existing = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM email_templates',
      args: []
    })

    if (Number(existing.rows[0]?.count) > 0) {
      return {
        success: false,
        message: 'Templates already exist. Delete existing templates to re-seed.'
      }
    }

    // Create default templates
    for (const template of defaultTemplates) {
      const templateId = generateId()
      await db.execute({
        sql: `INSERT INTO email_templates (id, name, subject, body, is_active) VALUES (?, ?, ?, ?, 1)`,
        args: [templateId, template.name, template.subject, template.body]
      })
    }

    return {
      success: true,
      message: `Created ${defaultTemplates.length} default templates`
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to seed templates: ${errorMessage}`
    })
  }
})
