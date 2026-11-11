export type StudioBuildKind = 'one_page' | 'web_stack'

export interface StudioBuild {
  kind: StudioBuildKind
  label: 'One Page' | 'Web Stack'
  url: string
  at: string | null
}

function cleanUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return raw
  } catch {
    return null
  }
}

function timeMs(value: string | null) {
  if (!value) return null
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = Date.parse(hasZone ? iso : `${iso}Z`)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * One Page lives on mockup_url. Web Stack lives on preview_url.
 * A single URL stored as the mockup link stays a web stack build when that row's mode says so.
 */
export function studioBuilds(input: {
  onePageUrl?: string | null
  onePageAt?: string | null
  webStackUrl?: string | null
  webStackAt?: string | null
  buildMode?: string | null
}): StudioBuild[] {
  const one = cleanUrl(input.onePageUrl)
  const stack = cleanUrl(input.webStackUrl)
  if (one && stack && one !== stack) {
    return [
      { kind: 'one_page', label: 'One Page', url: one, at: input.onePageAt || null },
      { kind: 'web_stack', label: 'Web Stack', url: stack, at: input.webStackAt || null }
    ]
  }
  if (stack || (input.buildMode === 'web_stack' && one)) {
    return [{
      kind: 'web_stack',
      label: 'Web Stack',
      url: (stack || one) as string,
      at: input.webStackAt || input.onePageAt || null
    }]
  }
  if (one) return [{ kind: 'one_page', label: 'One Page', url: one, at: input.onePageAt || null }]
  return []
}

/** Later timestamp wins. A build with no time loses to one that has a time. */
export function newestStudioBuild(builds: StudioBuild[]): StudioBuild | null {
  if (!builds.length) return null
  return [...builds].sort((left, right) => {
    const leftMs = timeMs(left.at)
    const rightMs = timeMs(right.at)
    if (leftMs == null && rightMs == null) return left.kind === 'web_stack' ? -1 : 1
    if (leftMs == null) return 1
    if (rightMs == null) return -1
    return rightMs - leftMs
  })[0] || null
}
