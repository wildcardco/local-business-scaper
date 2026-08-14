import type { AuditReportData, LeadCategory } from '~~/shared/types'

interface BusinessWithAudit {
  id: string
  name: string
  category: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  phone: string | null
  email: string | null
  website: string | null
  googleMapsUrl: string | null
  rating: number | null
  reviewCount: number | null
  leadScore: number
  leadCategory: string | null
  audit: {
    performanceScore: number | null
    accessibilityScore: number | null
    bestPracticesScore: number | null
    seoScore: number | null
    firstContentfulPaint: string | null
    largestContentfulPaint: string | null
    totalBlockingTime: string | null
    cumulativeLayoutShift: string | null
    speedIndex: string | null
    hasSSL: boolean | null
    detectedPlatform: string | null
    auditedAt: Date | null
  } | null
}

// Generate recommendations based on audit data
function generateRecommendations(business: BusinessWithAudit): string[] {
  const recommendations: string[] = []

  if (!business.website) {
    recommendations.push('Build a professional website to establish online presence')
    recommendations.push('Set up Google Business Profile optimization')
    recommendations.push('Implement local SEO strategy from the start')
    recommendations.push('Consider mobile-first design approach')
    return recommendations
  }

  const audit = business.audit
  if (!audit) {
    recommendations.push('Run a comprehensive website audit to identify issues')
    return recommendations
  }

  // Performance recommendations
  if (audit.performanceScore !== null && audit.performanceScore < 50) {
    recommendations.push('Optimize images and enable lazy loading to improve load times')
    recommendations.push('Minimize JavaScript and CSS bundles')
    recommendations.push('Implement browser caching strategies')
    recommendations.push('Consider using a CDN for faster content delivery')
  } else if (audit.performanceScore !== null && audit.performanceScore < 70) {
    recommendations.push('Fine-tune performance with image optimization')
    recommendations.push('Review and optimize third-party scripts')
  }

  // SEO recommendations
  if (audit.seoScore !== null && audit.seoScore < 50) {
    recommendations.push('Add proper meta titles and descriptions to all pages')
    recommendations.push('Implement structured data (Schema.org markup)')
    recommendations.push('Create an XML sitemap and submit to search engines')
    recommendations.push('Optimize heading structure (H1, H2, H3)')
  } else if (audit.seoScore !== null && audit.seoScore < 70) {
    recommendations.push('Enhance meta descriptions for better click-through rates')
    recommendations.push('Add alt text to all images')
  }

  // Accessibility recommendations
  if (audit.accessibilityScore !== null && audit.accessibilityScore < 50) {
    recommendations.push('Improve color contrast for better readability')
    recommendations.push('Add ARIA labels to interactive elements')
    recommendations.push('Ensure all form fields have proper labels')
    recommendations.push('Make the site keyboard-navigable')
  } else if (audit.accessibilityScore !== null && audit.accessibilityScore < 70) {
    recommendations.push('Review and improve color contrast in some areas')
    recommendations.push('Add missing alt text to images')
  }

  // SSL recommendation
  if (audit.hasSSL === false) {
    recommendations.push('Install an SSL certificate to secure the website (critical for SEO and trust)')
  }

  // Best practices
  if (audit.bestPracticesScore !== null && audit.bestPracticesScore < 50) {
    recommendations.push('Update to HTTPS if not already secure')
    recommendations.push('Fix console errors and warnings')
    recommendations.push('Ensure proper image aspect ratios')
  }

  // Platform-specific recommendations
  if (audit.detectedPlatform === 'WordPress') {
    recommendations.push('Update WordPress core, themes, and plugins regularly')
    recommendations.push('Consider using a caching plugin for better performance')
  } else if (audit.detectedPlatform === 'Wix' || audit.detectedPlatform === 'Squarespace') {
    recommendations.push('Consider migrating to a more flexible platform for better optimization control')
  }

  // If website is actually good, give maintenance recommendations
  if (recommendations.length === 0) {
    recommendations.push('Website is performing well - focus on content updates')
    recommendations.push('Monitor Core Web Vitals regularly')
    recommendations.push('Continue building quality backlinks')
  }

  return recommendations.slice(0, 6) // Limit to 6 recommendations
}

// Build the report data structure
export function buildReportData(business: BusinessWithAudit): AuditReportData {
  const reasons: string[] = []

  if (!business.website) {
    reasons.push('No website - needs new site')
  } else if (business.audit) {
    const audit = business.audit
    if (audit.performanceScore !== null && audit.performanceScore < 50) {
      reasons.push(`Poor performance score: ${audit.performanceScore}/100`)
    }
    if (audit.seoScore !== null && audit.seoScore < 50) {
      reasons.push(`Poor SEO score: ${audit.seoScore}/100`)
    }
    if (audit.accessibilityScore !== null && audit.accessibilityScore < 50) {
      reasons.push(`Poor accessibility: ${audit.accessibilityScore}/100`)
    }
    if (audit.hasSSL === false) {
      reasons.push('No SSL certificate')
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    business: {
      id: business.id,
      name: business.name,
      category: business.category,
      address: business.address,
      city: business.city,
      state: business.state,
      zipCode: business.zipCode,
      phone: business.phone,
      email: business.email,
      website: business.website,
      googleMapsUrl: business.googleMapsUrl,
      rating: business.rating,
      reviewCount: business.reviewCount
    },
    leadScore: {
      score: business.leadScore,
      category: business.leadCategory as LeadCategory | null,
      reasons
    },
    audit: business.audit ? {
      performanceScore: business.audit.performanceScore,
      accessibilityScore: business.audit.accessibilityScore,
      bestPracticesScore: business.audit.bestPracticesScore,
      seoScore: business.audit.seoScore,
      firstContentfulPaint: business.audit.firstContentfulPaint,
      largestContentfulPaint: business.audit.largestContentfulPaint,
      totalBlockingTime: business.audit.totalBlockingTime,
      cumulativeLayoutShift: business.audit.cumulativeLayoutShift,
      speedIndex: business.audit.speedIndex,
      hasSSL: business.audit.hasSSL,
      detectedPlatform: business.audit.detectedPlatform,
      auditedAt: business.audit.auditedAt?.toISOString() || null
    } : null,
    recommendations: generateRecommendations(business),
    pitchType: business.website ? 'website_improvement' : 'new_website'
  }
}

// Generate score color for HTML
function getScoreColor(score: number | null): string {
  if (score === null) return '#9ca3af'
  if (score >= 90) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

// Generate score label
function getScoreLabel(score: number | null): string {
  if (score === null) return 'N/A'
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Needs Work'
  return 'Poor'
}

// Generate category badge style
function getCategoryStyle(category: string | null): { bg: string; text: string; label: string } {
  switch (category) {
    case 'hot':
      return { bg: '#fef2f2', text: '#dc2626', label: '🔥 Hot Lead' }
    case 'warm':
      return { bg: '#fffbeb', text: '#d97706', label: '⚡ Warm Lead' }
    case 'cold':
      return { bg: '#eff6ff', text: '#2563eb', label: '❄️ Cold Lead' }
    default:
      return { bg: '#f3f4f6', text: '#6b7280', label: 'Not Scored' }
  }
}

// Generate HTML report
export function generateHtmlReport(data: AuditReportData): string {
  const categoryStyle = getCategoryStyle(data.leadScore.category)

  const scoreCard = (label: string, score: number | null) => `
    <div style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
      <div style="font-size: 32px; font-weight: bold; color: ${getScoreColor(score)};">
        ${score !== null ? score : '—'}
      </div>
      <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${label}</div>
      <div style="font-size: 11px; color: ${getScoreColor(score)}; margin-top: 2px;">${getScoreLabel(score)}</div>
    </div>
  `

  const webVitalRow = (label: string, value: string | null) => value ? `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${label}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${value}</td>
    </tr>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Audit Report - ${data.business.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 800px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #2d1818 0%, #D6293E 100%); color: white; padding: 40px; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { padding: 40px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
    .info-item { margin-bottom: 12px; }
    .info-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 500; margin-top: 4px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; }
    .recommendation { padding: 12px 16px; background: #f0fdf4; border-left: 4px solid #22c55e; margin-bottom: 8px; border-radius: 0 8px 8px 0; }
    .issue { padding: 12px 16px; background: #fef2f2; border-left: 4px solid #ef4444; margin-bottom: 8px; border-radius: 0 8px 8px 0; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; color: #6b7280; font-size: 13px; }
    @media (max-width: 600px) {
      .score-grid { grid-template-columns: repeat(2, 1fr); }
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Website Audit Report</h1>
      <p>${data.business.name}</p>
    </div>
    
    <div class="content">
      <!-- Lead Score Section -->
      <div class="section">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="font-size: 14px; color: #6b7280;">Lead Score</div>
            <div style="font-size: 48px; font-weight: bold; color: ${categoryStyle.text};">${data.leadScore.score}</div>
          </div>
          <div class="badge" style="background: ${categoryStyle.bg}; color: ${categoryStyle.text};">
            ${categoryStyle.label}
          </div>
        </div>
      </div>

      <!-- Business Info -->
      <div class="section">
        <div class="section-title">Business Information</div>
        <div class="info-grid">
          <div>
            <div class="info-item">
              <div class="info-label">Category</div>
              <div class="info-value">${data.business.category || 'Not specified'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Address</div>
              <div class="info-value">${data.business.address || 'Not available'}</div>
              ${data.business.city ? `<div class="info-value" style="color: #6b7280; font-weight: normal;">${[data.business.city, data.business.state, data.business.zipCode].filter(Boolean).join(', ')}</div>` : ''}
            </div>
            <div class="info-item">
              <div class="info-label">Phone</div>
              <div class="info-value">${data.business.phone || 'Not available'}</div>
            </div>
          </div>
          <div>
            <div class="info-item">
              <div class="info-label">Website</div>
              <div class="info-value">${data.business.website ? `<a href="${data.business.website.startsWith('http') ? data.business.website : 'https://' + data.business.website}" style="color: #2563eb;">${data.business.website}</a>` : '<span style="color: #ef4444;">No Website</span>'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Email</div>
              <div class="info-value">${data.business.email || 'Not available'}</div>
            </div>
            ${data.business.rating ? `
            <div class="info-item">
              <div class="info-label">Rating</div>
              <div class="info-value">⭐ ${data.business.rating} (${data.business.reviewCount || 0} reviews)</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${data.audit ? `
      <!-- Lighthouse Scores -->
      <div class="section">
        <div class="section-title">Lighthouse Scores</div>
        <div class="score-grid">
          ${scoreCard('Performance', data.audit.performanceScore)}
          ${scoreCard('SEO', data.audit.seoScore)}
          ${scoreCard('Accessibility', data.audit.accessibilityScore)}
          ${scoreCard('Best Practices', data.audit.bestPracticesScore)}
        </div>
      </div>

      <!-- Core Web Vitals -->
      <div class="section">
        <div class="section-title">Core Web Vitals</div>
        <table style="width: 100%; border-collapse: collapse;">
          ${webVitalRow('First Contentful Paint', data.audit.firstContentfulPaint)}
          ${webVitalRow('Largest Contentful Paint', data.audit.largestContentfulPaint)}
          ${webVitalRow('Total Blocking Time', data.audit.totalBlockingTime)}
          ${webVitalRow('Cumulative Layout Shift', data.audit.cumulativeLayoutShift)}
          ${webVitalRow('Speed Index', data.audit.speedIndex)}
        </table>
      </div>

      <!-- Technical Details -->
      <div class="section">
        <div class="section-title">Technical Details</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Detected Platform</div>
            <div class="info-value">${data.audit.detectedPlatform || 'Unknown'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">SSL Certificate</div>
            <div class="info-value" style="color: ${data.audit.hasSSL ? '#22c55e' : '#ef4444'};">
              ${data.audit.hasSSL ? '✓ Secure (HTTPS)' : '✗ Not Secure'}
            </div>
          </div>
        </div>
      </div>
      ` : `
      <div class="section">
        <div class="section-title">Website Status</div>
        <div class="issue">
          <strong>No Website Found</strong><br>
          This business does not have a website, representing an excellent opportunity for a new website project.
        </div>
      </div>
      `}

      <!-- Issues Found -->
      ${data.leadScore.reasons.length > 0 ? `
      <div class="section">
        <div class="section-title">Issues Identified</div>
        ${data.leadScore.reasons.map(reason => `<div class="issue">${reason}</div>`).join('')}
      </div>
      ` : ''}

      <!-- Recommendations -->
      <div class="section">
        <div class="section-title">Recommendations</div>
        ${data.recommendations.map((rec, i) => `<div class="recommendation"><strong>${i + 1}.</strong> ${rec}</div>`).join('')}
      </div>
    </div>

    <div class="footer">
      <p>Report generated on ${new Date(data.generatedAt).toLocaleString()}</p>
      <p style="margin-top: 8px;">Powered by Wild Card Creative Lead Generator</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// Generate Markdown report
export function generateMarkdownReport(data: AuditReportData): string {
  const categoryEmoji = {
    hot: '🔥',
    warm: '⚡',
    cold: '❄️',
    skip: '⏭️'
  }

  let md = `# Website Audit Report
## ${data.business.name}

---

### Lead Score: **${data.leadScore.score}**/100 ${categoryEmoji[data.leadScore.category || 'skip'] || ''} ${data.leadScore.category?.toUpperCase() || 'NOT SCORED'}

---

## Business Information

| Field | Value |
|-------|-------|
| **Category** | ${data.business.category || 'N/A'} |
| **Address** | ${data.business.address || 'N/A'} |
| **City** | ${[data.business.city, data.business.state, data.business.zipCode].filter(Boolean).join(', ') || 'N/A'} |
| **Phone** | ${data.business.phone || 'N/A'} |
| **Email** | ${data.business.email || 'N/A'} |
| **Website** | ${data.business.website || '❌ No Website'} |
${data.business.rating ? `| **Rating** | ⭐ ${data.business.rating} (${data.business.reviewCount || 0} reviews) |` : ''}

`

  if (data.audit) {
    md += `---

## Lighthouse Scores

| Category | Score | Status |
|----------|-------|--------|
| Performance | ${data.audit.performanceScore ?? 'N/A'} | ${getScoreLabel(data.audit.performanceScore)} |
| SEO | ${data.audit.seoScore ?? 'N/A'} | ${getScoreLabel(data.audit.seoScore)} |
| Accessibility | ${data.audit.accessibilityScore ?? 'N/A'} | ${getScoreLabel(data.audit.accessibilityScore)} |
| Best Practices | ${data.audit.bestPracticesScore ?? 'N/A'} | ${getScoreLabel(data.audit.bestPracticesScore)} |

---

## Core Web Vitals

| Metric | Value |
|--------|-------|
| First Contentful Paint | ${data.audit.firstContentfulPaint || 'N/A'} |
| Largest Contentful Paint | ${data.audit.largestContentfulPaint || 'N/A'} |
| Total Blocking Time | ${data.audit.totalBlockingTime || 'N/A'} |
| Cumulative Layout Shift | ${data.audit.cumulativeLayoutShift || 'N/A'} |
| Speed Index | ${data.audit.speedIndex || 'N/A'} |

---

## Technical Details

- **Platform**: ${data.audit.detectedPlatform || 'Unknown'}
- **SSL**: ${data.audit.hasSSL ? '✅ Secure (HTTPS)' : '❌ Not Secure'}
- **Audited**: ${data.audit.auditedAt ? new Date(data.audit.auditedAt).toLocaleDateString() : 'N/A'}

`
  } else {
    md += `---

## Website Status

⚠️ **No Website Found**

This business does not have a website, representing an excellent opportunity for a new website project.

`
  }

  if (data.leadScore.reasons.length > 0) {
    md += `---

## Issues Identified

${data.leadScore.reasons.map(r => `- ❗ ${r}`).join('\n')}

`
  }

  md += `---

## Recommendations

${data.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

*Report generated: ${new Date(data.generatedAt).toLocaleString()}*

*Powered by Wild Card Creative Lead Generator*
`

  return md
}

// Generate plain text summary (for email subject/preview)
export function generateSummary(data: AuditReportData): string {
  if (!data.business.website) {
    return `${data.business.name} has no website - hot lead opportunity (Score: ${data.leadScore.score})`
  }

  if (data.audit) {
    const issues: string[] = []
    if (data.audit.performanceScore !== null && data.audit.performanceScore < 50) issues.push('performance')
    if (data.audit.seoScore !== null && data.audit.seoScore < 50) issues.push('SEO')
    if (data.audit.accessibilityScore !== null && data.audit.accessibilityScore < 50) issues.push('accessibility')
    if (data.audit.hasSSL === false) issues.push('security')

    if (issues.length > 0) {
      return `${data.business.name} needs ${issues.join(', ')} improvements (Score: ${data.leadScore.score})`
    }
  }

  return `${data.business.name} audit complete - Lead Score: ${data.leadScore.score}`
}

