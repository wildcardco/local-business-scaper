export const MOCKUP_GITHUB_OWNER = 'wildcardco'

export function slugifyMockupPart(value: string | null | undefined): string {
  const slug = String(value || 'business')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'business'
}

/** Same 32-bit hash WF-2 Prepare uses: `((h << 5) - h + char) | 0`, then base36. */
export function mockupShortHash(value: string): string {
  let hash = 0
  const text = String(value)
  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return (hash >>> 0).toString(36).slice(0, 6)
}

export function mockupRepoName(input: {
  owner?: string | null
  businessName?: string | null
  placeId?: string | null
}): string | null {
  const placeId = input.placeId?.trim()
  const businessName = input.businessName?.trim()
  if (!placeId || !businessName) return null
  const owner = slugifyMockupPart(input.owner || 'wc')
  const slug = slugifyMockupPart(businessName)
  return `wildcard-mockup-${owner}-${slug}-${mockupShortHash(placeId)}`
}

export function storedGithubRepo(stored: string | null | undefined): string | null {
  const value = stored?.trim()
  if (value && /^[\w.-]+\/[\w.-]+$/.test(value)) return value
  return null
}

/** A finished mockup is a Vercel deployment URL written by WF-2 Update Lead. */
export function isVercelMockupUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    const host = url.hostname.toLowerCase()
    return host === 'vercel.app' || host.endsWith('.vercel.app')
  } catch {
    return false
  }
}

export function mockupGithubRepo(input: {
  owner?: string | null
  businessName?: string | null
  placeId?: string | null
  stored?: string | null
}): string | null {
  const stored = storedGithubRepo(input.stored)
  if (stored) return stored
  const name = mockupRepoName(input)
  return name ? `${MOCKUP_GITHUB_OWNER}/${name}` : null
}

/**
 * Show a GitHub link only after a Vercel deployment exists.
 * WF-2 creates the repo in that same run. Sync never creates repos, and the
 * leads table does not store a GitHub column, so a name without a deployment
 * is only a guess.
 */
export function githubRepoForMockup(input: {
  owner?: string | null
  businessName?: string | null
  placeId?: string | null
  stored?: string | null
  vercelUrl?: string | null
}): string | null {
  if (!isVercelMockupUrl(input.vercelUrl)) return null
  return mockupGithubRepo(input)
}

export function mockupGithubUrl(repo: string | null): string | null {
  if (!repo) return null
  return `https://github.com/${repo}`
}

/** Only wildcardco/wildcard-mockup-* repos can be deleted from Studio. */
export function parseMockupRepo(value: string | null | undefined): { owner: string, name: string } | null {
  const trimmed = String(value || '').trim().toLowerCase()
  const match = /^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)\/(wildcard-mockup-[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/.exec(trimmed)
  if (!match?.[1] || match[1] !== MOCKUP_GITHUB_OWNER || !match[2]) return null
  return { owner: match[1], name: match[2] }
}

/** Repo the delete confirm must match, even when the live GitHub link is hidden. */
export function mockupDeleteRepo(input: {
  owner?: string | null
  businessName?: string | null
  placeId?: string | null
  stored?: string | null
}): string | null {
  const parsed = parseMockupRepo(mockupGithubRepo(input))
  return parsed ? `${parsed.owner}/${parsed.name}` : null
}

/**
 * Vercel project name is the `*.vercel.app` host. Anything else is refused
 * so a bad URL cannot delete a different project.
 */
export function vercelProjectNameFromMockupUrl(value: string | null | undefined): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  let host = ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    host = url.hostname.toLowerCase()
  } catch {
    return null
  }
  if (!host.endsWith('.vercel.app') || host === 'vercel.app') return null
  const name = host.slice(0, -'.vercel.app'.length)
  if (!name.startsWith('wildcard-mockup-') || !/^[a-z0-9-]+$/.test(name)) return null
  return name
}

export interface MockupDeletePlan {
  repo: { owner: string, name: string }
  confirm: string
  vercelProject: string | null
}

/**
 * Decide what one delete is allowed to touch. A mismatch or a non-mockup URL
 * returns an error and the caller must keep the Studio row.
 */
export function planMockupDelete(input: {
  confirm: unknown
  repo: string | null
  mockupUrl: string | null
}): MockupDeletePlan | { error: string } {
  const parsed = parseMockupRepo(input.repo)
  if (!parsed) {
    return { error: 'This mockup has no wildcardco/wildcard-mockup repo on file, so it was not deleted.' }
  }
  const confirm = `${parsed.owner}/${parsed.name}`
  const typed = typeof input.confirm === 'string' ? input.confirm.trim().toLowerCase() : ''
  if (typed !== confirm) {
    return { error: `Type ${confirm} exactly to delete this mockup.` }
  }

  const url = String(input.mockupUrl || '').trim()
  if (url && !vercelProjectNameFromMockupUrl(url)) {
    return { error: 'This mockup URL is not a wildcard-mockup Vercel project, so nothing was deleted.' }
  }

  return {
    repo: parsed,
    confirm,
    vercelProject: vercelProjectNameFromMockupUrl(url)
  }
}
