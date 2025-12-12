import { Resend } from 'resend'

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

interface ResendResponse {
  id: string
  message?: string
}

let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (!resendClient) {
    const config = useRuntimeConfig()
    
    if (!config.resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    
    resendClient = new Resend(config.resendApiKey)
  }
  
  return resendClient
}

export async function sendEmail(options: EmailOptions): Promise<ResendResponse> {
  const client = getResendClient()
  
  const response = await client.emails.send({
    from: options.from || 'Wild Card Creative <outreach@wildcardcreativeco.com>',
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo
  })

  if (response.error) {
    throw new Error(`Resend API error: ${response.error.message}`)
  }

  return {
    id: response.data?.id || '',
    message: 'Email sent successfully'
  }
}

interface BrandingSettings {
  companyName?: string | null
  tagline?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  fontFamily?: string | null
}

// Helper function to generate branded email HTML
export function generateEmailHTML(content: {
  businessName: string
  body: string
  logoUrl?: string
  branding?: BrandingSettings | null
}): string {
  const { businessName, body, logoUrl, branding } = content
  
  const companyName = branding?.companyName || 'Wild Card Creative Co.'
  const tagline = branding?.tagline || 'Your Ace in Digital Success'
  const primaryColor = branding?.primaryColor || '#8b5cf6'
  const secondaryColor = branding?.secondaryColor || '#2d1818'
  const fontFamily = branding?.fontFamily || 'system-ui, -apple-system, sans-serif'
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email from Wild Card Creative</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: ${fontFamily};
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: ${secondaryColor};
      padding: 30px 20px;
      text-align: center;
    }
    .email-logo {
      max-width: 200px;
      height: auto;
    }
    .email-body {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .email-body p {
      margin: 0 0 15px 0;
    }
    .email-body a {
      color: ${primaryColor};
      text-decoration: underline;
    }
    .email-body strong {
      color: ${primaryColor};
    }
    .email-footer {
      background-color: ${secondaryColor};
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
      font-size: 14px;
    }
    .email-footer a {
      color: #ffffff;
      text-decoration: none;
    }
    .tagline {
      color: #ffffff;
      font-size: 16px;
      margin-top: 10px;
      font-style: italic;
    }
    .issues-list {
      background-color: #f8f8f8;
      border-left: 4px solid ${primaryColor};
      padding: 15px 20px;
      margin: 20px 0;
    }
    .issues-list h3 {
      margin: 0 0 10px 0;
      color: ${secondaryColor};
    }
    .issues-list ul {
      margin: 0;
      padding-left: 20px;
    }
    .issues-list li {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="email-logo" />` : `<h1 style="color: #ffffff; margin: 0;">${companyName}</h1>`}
      <p class="tagline">"${tagline}"</p>
    </div>
    
    <div class="email-body">
      ${body}
    </div>
    
    <div class="email-footer">
      <p><strong>${companyName}</strong></p>
      <p>Chicago, Illinois</p>
      <p>
        <a href="https://www.wildcardcreativeco.com">www.wildcardcreativeco.com</a><br />
        <a href="mailto:dev@wildcardcreativeco.com">dev@wildcardcreativeco.com</a>
      </p>
      <p style="margin-top: 20px; font-size: 12px; opacity: 0.8;">
        Expert web design, development & SEO services
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}






