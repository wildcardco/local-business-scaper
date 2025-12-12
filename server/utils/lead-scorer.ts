import type { ScoringInput, ScoringResult } from '~~/shared/types'

export function calculateLeadScore(input: ScoringInput): ScoringResult {
  let score = 0
  const reasons: string[] = []

  // NO WEBSITE = Hottest lead
  if (!input.hasWebsite) {
    score = 95
    reasons.push('No website - needs new site')
    return { score, category: 'hot', reasons }
  }

  // Has website - score based on quality
  let websiteScore = 0

  // Performance (weight: 30%)
  if (input.performanceScore !== undefined) {
    if (input.performanceScore < 50) {
      websiteScore += 30
      reasons.push(`Poor performance score: ${input.performanceScore}`)
    } else if (input.performanceScore < 70) {
      websiteScore += 15
      reasons.push(`Mediocre performance: ${input.performanceScore}`)
    }
  }

  // SEO (weight: 30%)
  if (input.seoScore !== undefined) {
    if (input.seoScore < 50) {
      websiteScore += 30
      reasons.push(`Poor SEO score: ${input.seoScore}`)
    } else if (input.seoScore < 70) {
      websiteScore += 15
      reasons.push(`Mediocre SEO: ${input.seoScore}`)
    }
  }

  // Mobile (weight: 20%)
  if (input.isMobileResponsive === false) {
    websiteScore += 20
    reasons.push('Not mobile responsive')
  }

  // SSL (weight: 10%)
  if (input.hasSSL === false) {
    websiteScore += 10
    reasons.push('No SSL certificate')
  }

  // Accessibility (weight: 10%)
  if (input.accessibilityScore !== undefined && input.accessibilityScore < 50) {
    websiteScore += 10
    reasons.push(`Poor accessibility: ${input.accessibilityScore}`)
  }

  // Business credibility bonus (good reviews = worth pursuing)
  if (input.reviewCount && input.reviewCount > 20 && input.rating && input.rating >= 4) {
    websiteScore += 10
    reasons.push('Established business with good reviews')
  }

  score = Math.min(websiteScore, 90) // Cap at 90 for businesses with websites

  // Categorize
  let category: 'hot' | 'warm' | 'cold' | 'skip'
  if (score >= 70) {
    category = 'hot'
  } else if (score >= 40) {
    category = 'warm'
  } else if (score >= 20) {
    category = 'cold'
  } else {
    category = 'skip'
    reasons.push('Website is decent - low priority')
  }

  return { score, category, reasons }
}

// Score a business based on having a website or not (no audit data)
export function calculateInitialScore(hasWebsite: boolean, reviewCount?: number, rating?: number): ScoringResult {
  return calculateLeadScore({
    hasWebsite,
    reviewCount,
    rating
  })
}

// Update score after audit
export function calculateAuditScore(
  performanceScore: number,
  seoScore: number,
  accessibilityScore: number,
  hasSSL: boolean,
  reviewCount?: number,
  rating?: number
): ScoringResult {
  return calculateLeadScore({
    hasWebsite: true,
    performanceScore,
    seoScore,
    accessibilityScore,
    hasSSL,
    reviewCount,
    rating
  })
}

