import assert from 'node:assert/strict'
import test from 'node:test'
import { newestStudioBuild, studioBuilds } from './studio-builds.ts'

const onePage = 'https://wildcard-mockup-ryan-leeps-supply-c.vercel.app'
const webStack = 'https://wildcard-webstack-ryan-leeps-supply.vercel.app'

test('both Leeps builds stay available and the later Web Stack is the default', () => {
  const builds = studioBuilds({
    onePageUrl: onePage,
    onePageAt: '2026-11-06 19:30:31',
    webStackUrl: webStack,
    webStackAt: '2026-11-06 21:01:45',
    buildMode: 'html'
  })
  assert.deepEqual(builds.map(build => build.kind), ['one_page', 'web_stack'])
  assert.equal(newestStudioBuild(builds)?.kind, 'web_stack')
  assert.equal(newestStudioBuild(builds)?.url, webStack)
})

test('a one-page lead with no Web Stack URL does not invent a second build', () => {
  const builds = studioBuilds({
    onePageUrl: onePage,
    onePageAt: '2026-11-06 19:30:31',
    buildMode: 'html'
  })
  assert.equal(builds.length, 1)
  assert.equal(builds[0]?.kind, 'one_page')
})

test('a Web Stack row that stored its page on the mockup link still opens as Web Stack', () => {
  const builds = studioBuilds({
    onePageUrl: webStack,
    onePageAt: '2026-11-06 21:01:45',
    buildMode: 'web_stack'
  })
  assert.equal(builds.length, 1)
  assert.equal(builds[0]?.kind, 'web_stack')
  assert.equal(builds[0]?.url, webStack)
})
