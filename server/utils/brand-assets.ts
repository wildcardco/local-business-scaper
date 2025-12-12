import { readFile } from 'fs/promises'
import { join } from 'path'

// Cache brand guide in memory to avoid repeated file reads
let brandGuideCache: string | null = null

/**
 * Load and return the Wild Card Creative brand guide content
 */
export async function loadBrandGuide(): Promise<string> {
  if (brandGuideCache) {
    return brandGuideCache
  }

  try {
    // In Nuxt, public files are accessed differently in dev vs production
    // For server-side access, we need to read from the file system
    const publicDir = join(process.cwd(), 'public')
    const brandGuidePath = join(publicDir, 'brand-assets', 'Wild-Card-Creative-Brand-Guide.md')
    
    brandGuideCache = await readFile(brandGuidePath, 'utf-8')
    return brandGuideCache
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to load brand guide:', errorMessage)
    
    // Return a fallback minimal brand guide if file cannot be read
    return getFallbackBrandGuide()
  }
}

/**
 * Get the URL or base64 for email logo
 * In production, this should be a hosted URL
 * For development, can use base64 or local URL
 */
export function getEmailLogoUrl(): string {
  // In production, use your actual hosted logo URL
  // For now, return path that can be converted to hosted URL
  return 'https://www.wildcardcreativeco.com/brand-assets/logos/WCLogoWBackground.png'
}

/**
 * Generate HTML email signature with Wild Card Creative branding
 */
export function getEmailSignature(): string {
  return `
<div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #2d1818;">
  <p style="margin: 0; font-weight: bold; color: #2d1818;">The Wild Card Creative Team</p>
  <p style="margin: 5px 0; color: #666;">
    <a href="https://www.wildcardcreativeco.com" style="color: #2d1818; text-decoration: none;">www.wildcardcreativeco.com</a>
  </p>
  <p style="margin: 5px 0; color: #666; font-size: 14px;">
    <em>"Your Ace in Digital Success"</em>
  </p>
  <p style="margin: 5px 0; color: #666; font-size: 12px;">
    Chicago, Illinois | Expert web design, development & SEO services
  </p>
</div>
  `.trim()
}

/**
 * Format issues list with brand styling for HTML emails
 */
export function formatIssuesListHTML(issues: string[]): string {
  if (issues.length === 0) {
    return ''
  }

  return `
<div style="background-color: #f8f8f8; border-left: 4px solid #2d1818; padding: 15px 20px; margin: 20px 0;">
  <h3 style="margin: 0 0 10px 0; color: #2d1818; font-size: 16px;">Key Issues We Found:</h3>
  <ul style="margin: 0; padding-left: 20px;">
    ${issues.map(issue => `<li style="margin: 5px 0; color: #333;">${issue}</li>`).join('\n    ')}
  </ul>
</div>
  `.trim()
}

/**
 * Fallback brand guide if file cannot be loaded
 */
function getFallbackBrandGuide(): string {
  return `
# Wild Card Creative Co. Brand Guide

## Company Information
- Name: Wild Card Creative Co.
- Tagline: "Your Ace in Digital Success"
- Location: Chicago, Illinois
- Website: https://www.wildcardcreativeco.com
- Email: dev@wildcardcreativeco.com

## Brand Voice
- Professional yet Approachable
- Confident & Knowledgeable
- Solution-Oriented
- Creative & Innovative

## Brand Personality
- Innovative: Cutting-edge solutions and modern approaches
- Professional: High-quality work with attention to detail
- Approachable: Friendly, collaborative, and easy to work with
- Reliable: Consistent delivery and dependable service
- Creative: Unique, custom solutions tailored to each client

## Target Audience
- Small to medium-sized businesses
- Entrepreneurs and startups
- Established companies seeking digital transformation
- Local businesses in Chicagoland area
- Businesses across Illinois, Indiana, and nationwide

## Services
- Expert web design and development
- SEO optimization
- Digital transformation
- Custom websites and digital solutions

## Brand Colors
- Deep Burgundy/Maroon: #2d1818 (Primary)
- Rich Burgundy: #3a1818 (Secondary)
- Pure White: #ffffff (Text and contrast)

## Typography
- Primary Font: ITC Avant Garde Gothic Pro
- Modern, professional, distinctive

## Tone Guidelines
- Confident and results-focused
- Collaborative and supportive
- Transparent and clear
- Action-oriented with benefit-driven messaging
  `.trim()
}






