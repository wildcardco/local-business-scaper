import { MOCKUP_GITHUB_OWNER } from '~~/shared/mockup-repo'

const GITHUB_API = 'https://api.github.com'

export function parseMockupRepo(repo: string | null | undefined): { owner: string, name: string } | null {
  const value = repo?.trim() || ''
  const match = value.match(/^([A-Za-z0-9.-]+)\/([A-Za-z0-9._-]+)$/)
  if (!match) return null
  const owner = match[1]
  const name = match[2]
  if (!owner || !name) return null
  if (owner !== MOCKUP_GITHUB_OWNER) return null
  if (!name.startsWith('wildcard-mockup-')) return null
  return { owner, name }
}

function githubHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'wildcard-studio'
  }
}

function tokenOrThrow(): string {
  const token = String(useRuntimeConfig().githubToken || '')
  if (!token) {
    throw createError({
      statusCode: 500,
      message: 'GITHUB_TOKEN is not configured. Saving photo slots commits index.html on that mockup’s GitHub repo. The token needs Contents: write on wildcardco/wildcard-mockup-* (a fine-grained token with Contents read and write is enough).'
    })
  }
  return token
}

export async function commitMockupIndex(repo: string, html: string, message: string): Promise<{ commit: string | null }> {
  const parsed = parseMockupRepo(repo)
  if (!parsed) {
    throw createError({
      statusCode: 400,
      message: 'Refusing to commit. The repo must be wildcardco/wildcard-mockup-*.'
    })
  }

  const token = tokenOrThrow()
  const url = `${GITHUB_API}/repos/${parsed.owner}/${parsed.name}/contents/index.html`
  const headers = githubHeaders(token)
  const current = await fetch(`${url}?ref=main`, { headers })
  let sha = ''
  if (current.status === 404) {
    sha = ''
  } else if (!current.ok) {
    const detail = (await current.text()).slice(0, 240)
    throw createError({
      statusCode: 502,
      message: `GitHub could not read index.html (${current.status}): ${detail}`
    })
  } else {
    const body = await current.json() as { sha?: string }
    sha = typeof body.sha === 'string' ? body.sha : ''
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(html, 'utf8').toString('base64'),
      branch: 'main',
      ...(sha ? { sha } : {})
    })
  })

  const text = await response.text()
  if (response.status === 404) {
    throw createError({
      statusCode: 404,
      message: 'That GitHub repo is already gone, so the page was not changed.'
    })
  }
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: `GitHub did not save index.html (${response.status}): ${text.slice(0, 240)}`
    })
  }

  let commit: string | null = null
  try {
    const body = JSON.parse(text) as { commit?: { sha?: string } }
    commit = body.commit?.sha || null
  } catch {
    commit = null
  }
  return { commit }
}
