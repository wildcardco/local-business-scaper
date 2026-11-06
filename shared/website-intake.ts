import { websiteHost } from './intake-lookup.ts'
import { studioLeadWebsite, studioSiteResearch, type StudioSiteResearch, type StudioSiteSource } from './studio-site-payload.ts'
import { BUILD_MODE_WEB_STACK, leadPayloadForBuild, parseBuildMode } from './web-stack.ts'

/**
 * Website-first intake for a one-page rebuild.
 *
 * The app can validate the URL and match a Google listing by host through the
 * existing Local Business Data search. It cannot preview navigation or images.
 * POST /webhook/studio answers immediately and does not return a site profile.
 * WF-2 already builds one HTML page when `website` is present. It does not read
 * `page_intent` until Normalize copies that field. A plain GET can also stop on
 * a Cloudflare challenge. This module does not fetch the page.
 */

export const ONE_PAGE_INTENT = 'one_page' as const

export const SITE_PROFILE_UNAVAILABLE
  = 'Navigation, images, and page copy are not loaded here. The studio webhook starts the one-page mockup and does not send a site profile back. A live-page check can also stop on a Cloudflare challenge before those assets are available.'

export interface ParsedWebsiteUrl {
  ok: true
  url: string
  host: string
}

export interface RejectedWebsiteUrl {
  ok: false
  message: string
}

export function parseWebsiteIntakeUrl(value: unknown): ParsedWebsiteUrl | RejectedWebsiteUrl {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    return { ok: false, message: 'Enter the current website URL. Nothing was filled in.' }
  }
  const url = studioLeadWebsite(raw)
  const host = websiteHost(raw)
  if (!url || !host || host === 'localhost' || host.endsWith('.local')) {
    return {
      ok: false,
      message: 'That is not a website URL. Use an address like https://www.leeps.com/. Nothing was filled in.'
    }
  }
  return { ok: true, url, host }
}

export interface WebsiteListing {
  placeId: string
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  website?: string | null
  phone?: string | null
  category?: string | null
}

export interface WebsiteIntakeMatch extends WebsiteListing {
  websiteMatch: true
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

/** Listings whose website is this host. A similar name on another site is left out. */
export function websiteIntakeMatches(host: string, listings: WebsiteListing[]): WebsiteIntakeMatch[] {
  const wanted = websiteHost(host)
  if (!wanted) return []
  const seen = new Set<string>()
  const matches: WebsiteIntakeMatch[] = []
  for (const listing of listings) {
    const placeId = clean(listing.placeId)
    const name = clean(listing.name)
    if (!placeId || !name || seen.has(placeId)) continue
    if (websiteHost(clean(listing.website)) !== wanted) continue
    seen.add(placeId)
    matches.push({
      placeId,
      name,
      address: clean(listing.address) || null,
      city: clean(listing.city) || null,
      state: clean(listing.state) || null,
      website: clean(listing.website) || null,
      phone: clean(listing.phone) || null,
      category: clean(listing.category) || null,
      websiteMatch: true
    })
  }
  return matches.slice(0, 5)
}

export function confirmedWebsiteMatch(matches: WebsiteIntakeMatch[], placeId: string | null | undefined) {
  const id = clean(placeId)
  if (!id) return null
  return matches.find(match => match.placeId === id) || null
}

export type WebsiteListingStatus = 'matches' | 'none' | 'lookup-failed'

export interface WebsiteInspection {
  url: string
  host: string
  matches: WebsiteIntakeMatch[]
  listingStatus: WebsiteListingStatus
  siteProfile: 'unavailable'
  siteProfileReason: string
  message: string
}

export function websiteInspection(input: {
  url: string
  host: string
  matches: WebsiteIntakeMatch[]
  lookupFailed?: boolean
}): WebsiteInspection {
  const matches = input.lookupFailed ? [] : input.matches
  const listingStatus: WebsiteListingStatus = input.lookupFailed
    ? 'lookup-failed'
    : matches.length
      ? 'matches'
      : 'none'
  const message = listingStatus === 'matches'
    ? 'This website matched a Google listing. Choose it to fill the business details. Nothing is filled in until you do.'
    : listingStatus === 'lookup-failed'
      ? 'This website is valid, but the listing search did not answer. Nothing was filled in. You can still generate the one-page mockup from the URL.'
      : 'No Google listing uses this website. Nothing was filled in. You can still generate the one-page mockup from the URL, or type the business details.'
  return {
    url: input.url,
    host: input.host,
    matches,
    listingStatus,
    siteProfile: 'unavailable',
    siteProfileReason: SITE_PROFILE_UNAVAILABLE,
    message
  }
}

export function withOnePageIntent<T extends { website?: string | null }>(payload: T, pageIntent: unknown): T | (T & { page_intent: typeof ONE_PAGE_INTENT }) {
  if (pageIntent !== ONE_PAGE_INTENT) return payload
  if (!payload.website) return payload
  return { ...payload, page_intent: ONE_PAGE_INTENT }
}

/**
 * HTML generation may carry `page_intent: one_page`. Web stack never does.
 * WF-2 already returns one HTML page; it ignores this field until n8n copies it.
 */
export function outboundLeadPayload<T extends { website?: string | null }>(
  payload: T,
  opts: { pageIntent?: unknown, buildMode?: unknown }
): T | (T & { page_intent: typeof ONE_PAGE_INTENT }) {
  if (parseBuildMode(opts.buildMode) === BUILD_MODE_WEB_STACK) return payload
  return withOnePageIntent(payload, opts.pageIntent)
}

export function onePageSiteFields(source: StudioSiteSource, pageIntent: unknown): StudioSiteResearch | (StudioSiteResearch & { page_intent: typeof ONE_PAGE_INTENT }) {
  return outboundLeadPayload(studioSiteResearch(source), { pageIntent, buildMode: 'html' })
}

/** One HTML page, or the existing multi-page Web Stack. These are different webhooks. */
export const PAGE_CHOICE_ONE = 'one_page' as const
export const PAGE_CHOICE_MULTI = 'multi_page' as const
export type PageChoice = typeof PAGE_CHOICE_ONE | typeof PAGE_CHOICE_MULTI

export function parsePageChoice(value: unknown): PageChoice {
  return value === PAGE_CHOICE_MULTI ? PAGE_CHOICE_MULTI : PAGE_CHOICE_ONE
}

export interface PageChoiceRequest {
  pageIntent?: typeof ONE_PAGE_INTENT
  buildMode?: typeof BUILD_MODE_WEB_STACK
}

/**
 * One-page posts `page_intent` to the HTML studio webhook.
 * Multi-page posts `build_mode: web_stack` to the Web Stack webhook and omits `page_intent`.
 * An unknown choice stays one-page. There is no HTML fallback for multi-page.
 */
export function pageChoiceRequest(choice: unknown): PageChoiceRequest {
  if (parsePageChoice(choice) === PAGE_CHOICE_MULTI) return { buildMode: BUILD_MODE_WEB_STACK }
  return { pageIntent: ONE_PAGE_INTENT }
}

export function pageChoiceLead<T extends { website?: string | null }>(payload: T, choice: unknown) {
  const request = pageChoiceRequest(choice)
  const outbound = outboundLeadPayload(payload, request)
  if (request.buildMode !== BUILD_MODE_WEB_STACK) return outbound
  return leadPayloadForBuild(outbound, BUILD_MODE_WEB_STACK)
}
