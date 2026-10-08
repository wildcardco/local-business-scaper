import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMockupRepo, planMockupDelete, vercelProjectNameFromMockupUrl } from './mockup-repo.ts'

const repo = 'wildcardco/wildcard-mockup-ryan-timberwerks-li-abc123'

test('only a wildcardco mockup repo parses', () => {
  assert.deepEqual(parseMockupRepo(repo), {
    owner: 'wildcardco',
    name: 'wildcard-mockup-ryan-timberwerks-li-abc123'
  })
  assert.equal(parseMockupRepo('other/wildcard-mockup-ryan-x'), null)
  assert.equal(parseMockupRepo('wildcardco/local-business-scaper'), null)
  assert.equal(parseMockupRepo('wildcardco/wildcard-mockup-'), null)
})

test('the Vercel project is the mockup host, not some other project', () => {
  assert.equal(
    vercelProjectNameFromMockupUrl('https://wildcard-mockup-chase-two-brothers.vercel.app'),
    'wildcard-mockup-chase-two-brothers'
  )
  assert.equal(vercelProjectNameFromMockupUrl('https://wc-scaper.vercel.app'), null)
  assert.equal(vercelProjectNameFromMockupUrl('https://example.com'), null)
  assert.equal(vercelProjectNameFromMockupUrl(''), null)
})

test('the typed name must match this mockup and a foreign URL blocks the delete', () => {
  assert.equal('error' in planMockupDelete({
    confirm: 'wildcardco/wildcard-mockup-other',
    repo,
    mockupUrl: 'https://wildcard-mockup-ryan-timberwerks.vercel.app'
  }), true)

  const planned = planMockupDelete({
    confirm: repo,
    repo,
    mockupUrl: 'https://wildcard-mockup-ryan-timberwerks.vercel.app'
  })
  assert.equal('error' in planned, false)
  if ('error' in planned) return
  assert.equal(planned.vercelProject, 'wildcard-mockup-ryan-timberwerks')

  const blocked = planMockupDelete({
    confirm: repo,
    repo,
    mockupUrl: 'https://wc-scaper.vercel.app'
  })
  assert.equal('error' in blocked, true)
})
