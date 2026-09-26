export const STUDIO_OWNERS = [
  { slug: 'ryan', email: 'ryan@wildcardcreativeco.com', label: 'Ryan' },
  { slug: 'chase', email: 'chase@wildcardcreativeco.com', label: 'Chase' },
  { slug: 'aaron', email: 'aaron@wildcardcreativeco.com', label: 'Aaron' }
] as const

export type StudioOwnerSlug = (typeof STUDIO_OWNERS)[number]['slug']

export function studioOwnerBySlug(slug: string | null | undefined) {
  if (!slug) return null
  return STUDIO_OWNERS.find(owner => owner.slug === slug) || null
}
