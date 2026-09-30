import { db } from '~~/server/utils/db'
import { githubRepoForMockup, mockupGithubUrl } from '~~/shared/mockup-repo'

export type LinkState = 'live' | 'missing' | 'unknown'

const CHECK_TTL_SQL = `datetime('now', '-6 hours')`
const BUSY = `('generating', 'writing_pitch', 'enhancing', 'revising')`

let columnsReady: Promise<void> | null = null

export function ensureMockupLinkColumns() {
  if (!columnsReady) {
    columnsReady = (async () => {
      for (const sql of [
        `ALTER TABLE mockups ADD COLUMN deployment_missing INTEGER DEFAULT 0`,
        `ALTER TABLE mockups ADD COLUMN github_missing INTEGER DEFAULT 0`,
        `ALTER TABLE mockups ADD COLUMN links_checked_at TEXT`,
        `ALTER TABLE mockups ADD COLUMN made_at TEXT`,
        `ALTER TABLE mockups ADD COLUMN n8n_created_at TEXT`,
        `ALTER TABLE mockups ADD COLUMN n8n_updated_at TEXT`
      ]) {
        try {
          await db.execute(sql)
        } catch {
          // Column already exists.
        }
      }
    })().catch((error: unknown) => {
      columnsReady = null
      throw error
    })
  }
  return columnsReady
}

/** HEAD the URL. A removed Vercel project is HTTP 404 with x-vercel-error DEPLOYMENT_NOT_FOUND. */
export async function probeLink(url: string): Promise<LinkState> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'user-agent': 'wildcard-studio-check' }
    })
    if (response.status === 404 || response.status === 410) return 'missing'
    if (response.status === 429 || response.status >= 500) return 'unknown'
    return 'live'
  } catch {
    return 'unknown'
  }
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      await worker(items[index]!)
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => run()))
}

interface StoredLinkRow {
  id: string
  mockupUrl: string
  githubUrl: string | null
  githubRepo: string | null
}

export async function inspectMockupTarget(input: {
  vercelUrl: string
  githubUrl: string | null
  githubRepo: string | null
}): Promise<{ deployment: LinkState, githubMissing: boolean, githubRepo: string | null }> {
  const deployment = await probeLink(input.vercelUrl)
  if (deployment !== 'live') {
    return { deployment, githubMissing: false, githubRepo: input.githubRepo }
  }
  if (!input.githubUrl) {
    return { deployment, githubMissing: false, githubRepo: null }
  }
  const github = await probeLink(input.githubUrl)
  if (github === 'missing') {
    return { deployment, githubMissing: true, githubRepo: null }
  }
  return { deployment, githubMissing: false, githubRepo: input.githubRepo }
}

/**
 * Mark rows whose Vercel deployment 404s so Studio stops listing them.
 * A live deployment with a deleted GitHub repo keeps the mockup and drops the repo link.
 * Timeouts stay listed and are tried again on the next load.
 */
export async function checkUserMockupLinks(userId: string, mockupId?: string) {
  await ensureMockupLinkColumns()
  const result = await db.execute({
    sql: `SELECT m.id, m.mockup_url, m.github_repo, m.owner, m.place_id, b.name as business_name
          FROM mockups m
          LEFT JOIN businesses b ON b.id = m.business_id
          WHERE m.user_id = ?
            ${mockupId ? 'AND m.id = ?' : ''}
            AND m.status NOT IN ${BUSY}
            AND (
              lower(trim(COALESCE(m.mockup_url, ''))) LIKE 'https://%.vercel.app%'
              OR lower(trim(COALESCE(m.mockup_url, ''))) LIKE 'http://%.vercel.app%'
            )
            AND (
              m.links_checked_at IS NULL
              OR m.links_checked_at < ${CHECK_TTL_SQL}
            )`,
    args: mockupId ? [userId, mockupId] : [userId]
  })

  const rows: StoredLinkRow[] = result.rows.map((row) => {
    const mockupUrl = String(row.mockup_url || '')
    const repo = githubRepoForMockup({
      owner: (row.owner as string) || null,
      businessName: (row.business_name as string) || null,
      placeId: (row.place_id as string) || null,
      stored: (row.github_repo as string) || null,
      vercelUrl: mockupUrl
    })
    return {
      id: String(row.id),
      mockupUrl,
      githubUrl: mockupGithubUrl(repo),
      githubRepo: repo
    }
  })

  const writes: { sql: string, args: (string | number | null)[] }[] = []
  await mapPool(rows, 12, async (row) => {
    const inspected = await inspectMockupTarget({
      vercelUrl: row.mockupUrl,
      githubUrl: row.githubUrl,
      githubRepo: row.githubRepo
    })
    if (inspected.deployment === 'unknown') return
    if (inspected.deployment === 'missing') {
      writes.push({
        sql: `UPDATE mockups
              SET deployment_missing = 1, links_checked_at = datetime('now')
              WHERE id = ? AND user_id = ?`,
        args: [row.id, userId]
      })
      return
    }
    writes.push({
      sql: `UPDATE mockups
            SET deployment_missing = 0,
                github_missing = ?,
                github_repo = ?,
                links_checked_at = datetime('now')
            WHERE id = ? AND user_id = ?`,
      args: [inspected.githubMissing ? 1 : 0, inspected.githubRepo, row.id, userId]
    })
  })

  if (writes.length > 0) await db.batch(writes, 'write')
  return { checked: rows.length, updated: writes.length }
}
