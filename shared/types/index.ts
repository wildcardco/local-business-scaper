// Shared types between app and server

export interface BusinessSearchParams {
  query: string
  location: string
  limit?: number
  lat?: number
  lng?: number
  placeId?: string
}

export interface OpenWebBusiness {
  name: string
  full_address: string
  city: string
  state: string
  postal_code: string
  phone_number: string
  website: string | null
  place_id: string
  google_maps_url: string
  rating: number
  review_count: number
  price_level: string
  types: string[]
}

export interface PageSpeedResult {
  performanceScore: number
  accessibilityScore: number
  bestPracticesScore: number
  seoScore: number
  firstContentfulPaint: string
  largestContentfulPaint: string
  totalBlockingTime: string
  cumulativeLayoutShift: string
  speedIndex: string
  rawJson: string
}

export interface ScoringInput {
  hasWebsite: boolean
  performanceScore?: number
  seoScore?: number
  accessibilityScore?: number
  isMobileResponsive?: boolean
  hasSSL?: boolean
  reviewCount?: number
  rating?: number
}

export interface ScoringResult {
  score: number          // 0-100
  category: 'hot' | 'warm' | 'cold' | 'skip'
  reasons: string[]
}

export interface N8nWebhookPayload {
  action: 'send_outreach'
  leads: Array<{
    id: string
    businessName: string
    email: string
    phone: string | null
    website: string | null
    leadCategory: 'hot' | 'warm' | 'cold'
    leadScore: number
    pitchType: 'new_website' | 'website_improvement'
    issues: string[]
    audit?: {
      performanceScore: number
      seoScore: number
      accessibilityScore: number
    }
  }>
  template: {
    id: string
    subject: string
    body: string
  }
}

export type LeadCategory = 'hot' | 'warm' | 'cold' | 'skip'
export type OutreachStatus = 'new' | 'approved' | 'sent' | 'responded' | 'rejected'
export type EmailStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'

// Audit Report Types
export type ReportFormat = 'json' | 'html' | 'markdown' | 'pdf'

export interface AuditReportData {
  generatedAt: string
  business: {
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
  }
  leadScore: {
    score: number
    category: LeadCategory | null
    reasons: string[]
  }
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
    auditedAt: string | null
  } | null
  recommendations: string[]
  pitchType: 'new_website' | 'website_improvement'
}

export interface N8nReportPayload {
  action: 'send_audit_report'
  report: AuditReportData
  format: ReportFormat
  htmlContent?: string
  markdownContent?: string
}

export interface MailgunReportPayload {
  to: string
  subject: string
  report: AuditReportData
  htmlContent: string
}

