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

export function mockupGithubRepo(input: {
  owner?: string | null
  businessName?: string | null
  placeId?: string | null
  stored?: string | null
}): string | null {
  const stored = input.stored?.trim()
  if (stored && /^[\w.-]+\/[\w.-]+$/.test(stored)) return stored
  const name = mockupRepoName(input)
  return name ? `${MOCKUP_GITHUB_OWNER}/${name}` : null
}

export function mockupGithubUrl(repo: string | null): string | null {
  if (!repo) return null
  return `https://github.com/${repo}`
}
