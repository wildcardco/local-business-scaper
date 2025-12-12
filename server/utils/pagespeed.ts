import type { PageSpeedResult } from '~~/shared/types'

// Simple logger for API calls
function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const prefix = `[PageSpeed API ${timestamp}]`

  switch (level) {
    case 'info':
      console.log(`${prefix} ℹ️ ${message}`, data !== undefined ? data : '')
      break
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`, data !== undefined ? data : '')
      break
    case 'error':
      console.error(`${prefix} ❌ ${message}`, data !== undefined ? data : '')
      break
    case 'debug':
      console.log(`${prefix} 🔍 ${message}`, data !== undefined ? data : '')
      break
  }
}

export async function auditWebsite(url: string): Promise<PageSpeedResult> {
  log('info', `Starting audit for URL: ${url}`)

  // Ensure URL has protocol
  let fullUrl = url
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = `https://${fullUrl}`
    log('debug', `Added https:// protocol. Full URL: ${fullUrl}`)
  }

  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  apiUrl.searchParams.set('url', fullUrl)
  apiUrl.searchParams.append('category', 'performance')
  apiUrl.searchParams.append('category', 'accessibility')
  apiUrl.searchParams.append('category', 'best-practices')
  apiUrl.searchParams.append('category', 'seo')
  apiUrl.searchParams.set('strategy', 'mobile') // Mobile-first

  const config = useRuntimeConfig()
  const hasApiKey = !!config.googlePageSpeedApiKey
  if (hasApiKey) {
    apiUrl.searchParams.set('key', config.googlePageSpeedApiKey)
    log('debug', 'API key configured ✓')
  } else {
    log('warn', 'No API key configured - using public rate limits')
  }

  const requestUrl = apiUrl.toString()
  // Log URL without the API key for security
  const safeUrl = requestUrl.replace(/key=[^&]+/, 'key=***REDACTED***')
  log('info', `Making PageSpeed API request: ${safeUrl}`)

  const startTime = Date.now()
  const response = await fetch(requestUrl)
  const duration = Date.now() - startTime

  log('info', `PageSpeed API responded in ${duration}ms with status: ${response.status}`)

  if (!response.ok) {
    const errorText = await response.text()
    log('error', `PageSpeed API error: ${response.status}`, errorText)
    throw new Error(`PageSpeed API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  log('debug', 'PageSpeed API response received', {
    lighthouseVersion: data.lighthouseResult?.lighthouseVersion,
    fetchTime: data.lighthouseResult?.fetchTime,
    finalUrl: data.lighthouseResult?.finalUrl
  })
  const lighthouse = data.lighthouseResult
  const categories = lighthouse?.categories || {}
  const audits = lighthouse?.audits || {}

  const result = {
    performanceScore: Math.round((categories.performance?.score || 0) * 100),
    accessibilityScore: Math.round((categories.accessibility?.score || 0) * 100),
    bestPracticesScore: Math.round((categories['best-practices']?.score || 0) * 100),
    seoScore: Math.round((categories.seo?.score || 0) * 100),
    firstContentfulPaint: audits['first-contentful-paint']?.displayValue || 'N/A',
    largestContentfulPaint: audits['largest-contentful-paint']?.displayValue || 'N/A',
    totalBlockingTime: audits['total-blocking-time']?.displayValue || 'N/A',
    cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue || 'N/A',
    speedIndex: audits['speed-index']?.displayValue || 'N/A',
    rawJson: JSON.stringify(data)
  }

  log('info', `Audit complete for ${fullUrl}`, {
    performanceScore: result.performanceScore,
    accessibilityScore: result.accessibilityScore,
    bestPracticesScore: result.bestPracticesScore,
    seoScore: result.seoScore,
    fcp: result.firstContentfulPaint,
    lcp: result.largestContentfulPaint
  })

  return result
}

// Detect website platform from Lighthouse audit
export function detectPlatform(rawJson: string): string | null {
  try {
    const data = JSON.parse(rawJson)
    const technologies = data.lighthouseResult?.audits?.['detected-technologies']?.details?.items || []

    // Check for common platforms
    const platformMap: Record<string, string> = {
      'WordPress': 'WordPress',
      'Wix': 'Wix',
      'Squarespace': 'Squarespace',
      'Shopify': 'Shopify',
      'Webflow': 'Webflow',
      'GoDaddy': 'GoDaddy',
      'Weebly': 'Weebly',
      'Drupal': 'Drupal',
      'Joomla': 'Joomla'
    }

    for (const tech of technologies) {
      const techName = tech.name || tech
      for (const [key, platform] of Object.entries(platformMap)) {
        if (typeof techName === 'string' && techName.toLowerCase().includes(key.toLowerCase())) {
          return platform
        }
      }
    }

    return 'Custom'
  } catch {
    return null
  }
}

// Check SSL from URL
export function hasSSL(url: string): boolean {
  return url.startsWith('https://')
}

