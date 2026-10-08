import type { MockupDeletePlan } from '~~/shared/mockup-repo'

export const VERCEL_MOCKUP_TEAM_ID = 'team_TVfcpvfjBCdDcwwQuuEXyNqF'

const GITHUB_MISSING = 'GITHUB_TOKEN is not configured. Deleting a mockup removes that one wildcardco/wildcard-mockup-* repository. The token needs the delete_repo scope, or a fine-grained token with Administration: write on those repos.'
const VERCEL_MISSING = `VERCEL_TOKEN is not configured. Deleting a mockup removes its Vercel project on team ${VERCEL_MOCKUP_TEAM_ID}. The token needs permission to delete projects on that team.`

export function mockupDeleteTokens() {
  const config = useRuntimeConfig()
  const githubToken = String(config.githubToken || '').trim()
  const vercelToken = String(config.vercelToken || '').trim()
  const missing = [
    !githubToken ? GITHUB_MISSING : '',
    !vercelToken ? VERCEL_MISSING : ''
  ].filter(Boolean)
  if (missing.length) {
    throw createError({
      statusCode: 500,
      message: missing.join(' ')
    })
  }
  return { githubToken, vercelToken }
}

export async function deleteMockupRemotes(plan: MockupDeletePlan, input: {
  githubToken: string
  vercelToken: string
}) {
  if (plan.vercelProject) {
    await deleteVercelProject(plan.vercelProject, input.vercelToken)
  }
  await deleteGithubRepo(plan.repo.owner, plan.repo.name, input.githubToken)
  return plan
}

async function deleteVercelProject(name: string, token: string) {
  const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(name)}`)
  url.searchParams.set('teamId', VERCEL_MOCKUP_TEAM_ID)
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (response.status === 404) return
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw createError({
      statusCode: 502,
      message: detail
        ? `Vercel did not delete ${name} (${response.status}): ${detail} The Studio row was kept.`
        : `Vercel did not delete ${name} (${response.status}). The Studio row was kept.`
    })
  }
}

async function deleteGithubRepo(owner: string, name: string, token: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'wildcard-lead-gen'
    }
  })
  if (response.status === 404) return
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw createError({
      statusCode: 502,
      message: detail
        ? `GitHub did not delete ${owner}/${name} (${response.status}): ${detail} The Studio row was kept so you can retry. A Vercel 404 on retry means that project is already gone.`
        : `GitHub did not delete ${owner}/${name} (${response.status}). The Studio row was kept so you can retry. A Vercel 404 on retry means that project is already gone.`
    })
  }
}
