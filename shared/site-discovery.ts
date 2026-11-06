import { studioLeadWebsite } from './studio-site-payload.ts'

/**
 * Current-site discovery for one-page and multi-page generation.
 * Lists are copied only from a lead or an earlier inspection. A missing
 * list stays null. Home, About, Services, and Contact are not assumed.
 */

export interface SitePage {
  name: string
  path: string | null
}

export interface SiteDiscovery {
  status: 'observed' | 'unavailable'
  navigation: string[] | null
  footer: string[] | null
  pages: SitePage[] | null
  content: string | null
}

export interface LeadSite {
  website: string | null
  discovery: SiteDiscovery
}

const EMPTY_DISCOVERY: SiteDiscovery = {
  status: 'unavailable',
  navigation: null,
  footer: null,
  pages: null,
  content: null
}

function text(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function parsedJson(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function labels(value: unknown) {
  const source = parsedJson(value)
  if (!Array.isArray(source)) return null
  const seen = new Set<string>()
  const found: string[] = []
  for (const item of source) {
    const label = text(item)
      || text((item as { name?: unknown } | null)?.name)
      || text((item as { label?: unknown } | null)?.label)
      || text((item as { title?: unknown } | null)?.title)
      || text((item as { text?: unknown } | null)?.text)
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    found.push(label)
  }
  return found.length ? found : null
}

function pages(value: unknown): SitePage[] | null {
  const source = parsedJson(value)
  if (!Array.isArray(source)) return null
  const seen = new Set<string>()
  const found: SitePage[] = []
  for (const item of source) {
    if (!item || typeof item !== 'object') {
      const name = text(item)
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      found.push({ name, path: null })
      continue
    }
    const row = item as Record<string, unknown>
    const name = text(row.name) || text(row.title) || text(row.label) || text(row.text)
    const path = text(row.path) || text(row.url) || text(row.href) || null
    const key = `${name.toLowerCase()}|${path || ''}`
    if ((!name && !path) || seen.has(key)) continue
    seen.add(key)
    found.push({ name: name || path || '', path })
  }
  return found.length ? found : null
}

function content(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  return raw.slice(0, 8000)
}

function discoveryFromRecord(record: Record<string, unknown>): SiteDiscovery {
  const nested = parsedJson(record.site_discovery ?? record.site_inspection)
  const source = nested && typeof nested === 'object' && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : record
  const navigation = labels(source.navigation ?? source.site_navigation ?? source.nav_items ?? source.nav)
  const footer = labels(source.footer ?? source.site_footer ?? source.footer_links)
  const foundPages = pages(source.pages ?? source.site_pages ?? source.page_structure)
  const foundContent = content(source.content ?? source.site_content ?? source.page_content ?? source.content_notes)
  if (!navigation && !footer && !foundPages && !foundContent) return { ...EMPTY_DISCOVERY }
  return {
    status: 'observed',
    navigation,
    footer,
    pages: foundPages,
    content: foundContent
  }
}

export function readLeadSite(row: Record<string, unknown> | null | undefined): LeadSite {
  if (!row) return { website: null, discovery: { ...EMPTY_DISCOVERY } }
  const website = studioLeadWebsite(row.website)
    || studioLeadWebsite(row.site_url)
    || studioLeadWebsite(row.existing_website)
    || studioLeadWebsite(row.current_website)
  return { website, discovery: discoveryFromRecord(row) }
}

export function parseStoredDiscovery(value: unknown): SiteDiscovery {
  const parsed = parsedJson(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...EMPTY_DISCOVERY }
  return discoveryFromRecord({ site_discovery: parsed })
}

const WEBSITE_KEYS = ['website', 'site_url', 'existing_website', 'current_website'] as const

function rawWebsite(row: Record<string, unknown>) {
  for (const key of WEBSITE_KEYS) {
    const value = text(row[key])
    if (value) return value
  }
  return null
}

/** Normalized URL when it parses. Otherwise the raw lead value, so a sync does not drop it. */
export function leadWebsiteValue(row: Record<string, unknown> | null | undefined) {
  if (!row) return null
  return readLeadSite(row).website || rawWebsite(row)
}

function nextStoredDiscovery(current: string | null, incoming: SiteDiscovery) {
  if (parseStoredDiscovery(current).status === 'observed') return current
  if (incoming.status !== 'observed') return current
  return JSON.stringify(incoming)
}

/**
 * Fill a blank website from the lead. Keep a website that is already stored.
 * Copy discovery only when this record does not already have an observed one.
 */
export function nextBusinessSite(
  current: { website?: unknown, siteDiscovery?: unknown },
  row: Record<string, unknown>
) {
  const website = text(current.website) || null
  const siteDiscovery = text(current.siteDiscovery) || null
  const nextWebsite = website || leadWebsiteValue(row)
  const nextDiscovery = nextStoredDiscovery(siteDiscovery, readLeadSite(row).discovery)
  return {
    nextWebsite,
    nextDiscovery,
    changed: nextWebsite !== website || nextDiscovery !== siteDiscovery
  }
}

/** Keep a website and observed discovery from either row. Do not invent pages. */
export function mergeLeadSite<T extends Record<string, unknown>>(primary: T, secondary: Record<string, unknown>): T {
  const first = readLeadSite(primary)
  const second = readLeadSite(secondary)
  const website = first.website || second.website
  const discovery = first.discovery.status === 'observed' ? first.discovery : second.discovery
  return {
    ...primary,
    website: website ?? (text(primary.website) || null),
    site_discovery: discovery
  }
}

export function siteContract(input: { website?: string | null, stored?: unknown }) {
  return {
    website: studioLeadWebsite(input.website),
    site_discovery: parseStoredDiscovery(input.stored)
  }
}
