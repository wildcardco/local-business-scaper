interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

interface MailgunResponse {
  id: string
  message: string
}

export async function sendEmail(options: EmailOptions): Promise<MailgunResponse> {
  const config = useRuntimeConfig()

  if (!config.mailgunApiKey || !config.mailgunDomain) {
    throw new Error('Mailgun credentials not configured')
  }

  const formData = new FormData()
  formData.append('from', options.from || `Wild Card Creative <outreach@${config.mailgunDomain}>`)
  formData.append('to', options.to)
  formData.append('subject', options.subject)
  formData.append('html', options.html)

  const response = await fetch(
    `https://api.mailgun.net/v3/${config.mailgunDomain}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${config.mailgunApiKey}`).toString('base64')}`
      },
      body: formData
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mailgun API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

// Replace template variables with actual values
export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
}

// Parse issues array for mustache-style loops
export function renderIssuesList(template: string, issues: string[]): string {
  const issuesRegex = /{{#issues}}([\s\S]*?){{\/issues}}/g
  const issueItemRegex = /{{\.}}/g

  return template.replace(issuesRegex, (_, itemTemplate) => {
    return issues.map(issue => itemTemplate.replace(issueItemRegex, issue)).join('')
  })
}

