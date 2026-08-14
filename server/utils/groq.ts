import Groq from 'groq-sdk'

interface BusinessData {
  id: string
  name: string
  category?: string | null
  city?: string | null
  state?: string | null
  website?: string | null
  rating?: number | null
  reviewCount?: number | null
}

interface AuditData {
  performanceScore?: number | null
  seoScore?: number | null
  accessibilityScore?: number | null
  bestPracticesScore?: number | null
  isMobileResponsive?: boolean | null
  hasSSL?: boolean | null
  detectedPlatform?: string | null
}

interface BrandingSettings {
  companyName?: string | null
  tagline?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  fontFamily?: string | null
}

interface EmailGenerationInput {
  business: BusinessData
  audit?: AuditData | null
  brandGuide: string
  branding?: BrandingSettings | null
  templateBody?: string
  customPrompt?: string
}

interface GeneratedEmail {
  subject: string
  bodyHtml: string
  bodyText: string
}

let groqClient: Groq | null = null

function getGroqClient(): Groq {
  if (!groqClient) {
    const config = useRuntimeConfig()
    
    if (!config.groqApiKey) {
      throw new Error('GROQ_API is not configured')
    }
    
    groqClient = new Groq({
      apiKey: config.groqApiKey
    })
  }
  
  return groqClient
}

export async function generatePersonalizedEmail(input: EmailGenerationInput): Promise<GeneratedEmail> {
  const client = getGroqClient()
  const { business, audit, brandGuide, branding, templateBody, customPrompt } = input
  
  const companyName = branding?.companyName || 'Wild Card Creative Co.'
  const tagline = branding?.tagline || 'Your Ace in Digital Success'

  // Determine if this is a new website pitch or improvement pitch
  const hasWebsite = !!business.website
  const pitchType = hasWebsite ? 'website_improvement' : 'new_website'

  // Build audit issues list
  const issues: string[] = []
  if (audit) {
    if (audit.performanceScore !== null && audit.performanceScore < 50) {
      issues.push(`Poor website performance (Score: ${audit.performanceScore}/100)`)
    }
    if (audit.seoScore !== null && audit.seoScore < 50) {
      issues.push(`SEO issues detected (Score: ${audit.seoScore}/100)`)
    }
    if (audit.accessibilityScore !== null && audit.accessibilityScore < 50) {
      issues.push(`Accessibility problems (Score: ${audit.accessibilityScore}/100)`)
    }
    if (audit.isMobileResponsive === false) {
      issues.push('Website is not mobile-responsive')
    }
    if (audit.hasSSL === false) {
      issues.push('No SSL certificate (Security risk)')
    }
  }

  // Construct the prompt
  const prompt = `You are a professional email copywriter for ${companyName}, a web design and development agency.

BRAND GUIDE:
${brandGuide}

${branding ? `BRANDING SETTINGS:
- Company Name: ${companyName}
- Tagline: ${tagline}
- Primary Brand Color: ${branding.primaryColor || '#D6293E'}
- Secondary Brand Color: ${branding.secondaryColor || '#2d1818'}
` : ''}

BUSINESS INFORMATION:
- Name: ${business.name}
- Category: ${business.category || 'Local business'}
- Location: ${[business.city, business.state].filter(Boolean).join(', ') || 'Unknown'}
- Website: ${business.website || 'No website'}
- Rating: ${business.rating ? `${business.rating} stars (${business.reviewCount} reviews)` : 'Not rated'}

${audit ? `WEBSITE AUDIT RESULTS:
- Performance Score: ${audit.performanceScore || 'N/A'}/100
- SEO Score: ${audit.seoScore || 'N/A'}/100
- Accessibility Score: ${audit.accessibilityScore || 'N/A'}/100
- Best Practices Score: ${audit.bestPracticesScore || 'N/A'}/100
- Mobile Responsive: ${audit.isMobileResponsive ? 'Yes' : 'No'}
- SSL Certificate: ${audit.hasSSL ? 'Yes' : 'No'}
- Detected Platform: ${audit.detectedPlatform || 'Unknown'}
` : ''}

${issues.length > 0 ? `KEY ISSUES IDENTIFIED:
${issues.map(issue => `- ${issue}`).join('\n')}
` : ''}

${templateBody ? `TEMPLATE TO ENHANCE:
${templateBody}

Please use this template as a starting point and enhance it with specific details about the business and audit results.
` : ''}

${customPrompt ? `SPECIAL INSTRUCTIONS FROM USER:
${customPrompt}

Please incorporate these specific instructions and preferences into the email generation.
` : ''}

TASK:
Write a ${pitchType === 'new_website' ? 'compelling outreach email offering to build a professional website' : 'professional outreach email addressing the identified website issues'} for ${business.name}.

REQUIREMENTS:
1. Use a professional yet approachable tone (as per brand voice)
2. Be solution-oriented and confident
3. Personalize based on the business name, location, and category
${audit ? '4. Mention 1-2 specific audit findings naturally in the email' : '4. Focus on the opportunity of having a professional online presence'}
5. Include a clear call-to-action (schedule a free consultation)
6. Keep email concise (200-300 words)
7. Use the tagline "${tagline}" subtly if appropriate
8. DO NOT include any HTML tags or formatting - just plain text
9. Start with a friendly greeting addressing the business owner/manager
10. Sign off as "The ${companyName} Team"

Generate both:
1. A compelling subject line (50-60 characters)
2. The email body text

Return in this exact JSON format:
{
  "subject": "Your subject line here",
  "bodyText": "Full email body as plain text with \\n for line breaks"
}

DO NOT include any markdown formatting, code blocks, or explanations. Return ONLY the JSON object.`

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email copywriter specializing in B2B outreach for web design services. Return only valid JSON responses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from Groq API')
    }

    const parsed = JSON.parse(content)
    
    if (!parsed.subject || !parsed.bodyText) {
      throw new Error('Invalid response format from Groq API')
    }

    // Convert plain text to HTML
    const bodyHtml = parsed.bodyText
      .split('\n\n')
      .map((paragraph: string) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('\n')

    return {
      subject: parsed.subject,
      bodyHtml,
      bodyText: parsed.bodyText
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to generate email: ${errorMessage}`)
  }
}





