import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  RESEARCH_CALLBACK_WAIT_MS,
  RESEARCH_CONFIRM_COPY,
  RESEARCH_NEEDS_LISTING,
  RESEARCH_PENDING_MESSAGE,
  RESEARCH_SENT_LABEL,
  RESEARCH_STUDIO_WEBHOOK_PATH,
  RESEARCH_WEB_STACK_WEBHOOK_PATH,
  parseResearchCallback,
  researchReportPayload,
  researchRequestBlock,
  researchRequestedAtMs,
  researchStatusFrom,
  researchView
} from './research-report.ts'

const placeId = 'ChIJleepsExact0001'

test('research report body is the studio contract and not a web stack build', () => {
  const result = researchReportPayload({
    owner: 'Ryan',
    placeId,
    callbackUrl: 'https://app.example/api/research-report/webhook'
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.body, {
    action: 'research_report',
    owner: 'ryan',
    place_id: placeId,
    callback_url: 'https://app.example/api/research-report/webhook'
  })
  assert.deepEqual(Object.keys(result.body).sort(), ['action', 'callback_url', 'owner', 'place_id'])
  assert.equal(result.target.path, RESEARCH_STUDIO_WEBHOOK_PATH)
  assert.equal(result.target.path, '/webhook/studio')
  assert.equal(result.target.header, 'X-Studio-Secret')
  assert.equal(result.target.path.includes('web-stack'), false)
  assert.notEqual(result.target.path, RESEARCH_WEB_STACK_WEBHOOK_PATH)
  assert.equal('build_mode' in result.body, false)
  assert.equal('page_intent' in result.body, false)
  assert.match(RESEARCH_CONFIRM_COPY, /costs money/)
  assert.match(RESEARCH_CONFIRM_COPY, /emailed to Ryan/)
  assert.match(RESEARCH_CONFIRM_COPY, /Sent - check email/)
  assert.equal(RESEARCH_CONFIRM_COPY.includes('lead\'s owner'), false)
})

test('notes are optional and omitted when blank', () => {
  const blank = researchReportPayload({ owner: 'chase@wildcardcreativeco.com', placeId, notes: '   ' })
  assert.equal(blank.ok, true)
  if (!blank.ok) return
  assert.equal('notes' in blank.body, false)
  assert.equal(blank.body.owner, 'chase')

  const noted = researchReportPayload({ owner: 'aaron', placeId, notes: '  Mention the yard.  ' })
  assert.equal(noted.ok, true)
  if (!noted.ok) return
  assert.equal(noted.body.notes, 'Mention the yard.')
  assert.equal('callback_url' in noted.body, false)
})

test('a missing or synthetic place id is refused before any request', () => {
  const missing = researchReportPayload({ owner: 'ryan', placeId: '' })
  assert.equal(missing.ok, false)
  if (missing.ok) return
  assert.equal(missing.reason, 'place')
  assert.equal(missing.message, RESEARCH_NEEDS_LISTING)

  const synthetic = researchReportPayload({ owner: 'ryan', placeId: 'studio_user_mock' })
  assert.equal(synthetic.ok, false)
  if (synthetic.ok) return
  assert.equal(synthetic.reason, 'place')
})

test('owner must be a studio slug and a pending request stays blocked', () => {
  const owner = researchReportPayload({ owner: 'sam', placeId })
  assert.equal(owner.ok, false)
  if (owner.ok) return
  assert.equal(owner.reason, 'owner')

  assert.equal(researchStatusFrom('requested'), 'requested')
  assert.equal(researchStatusFrom('complete'), 'complete')
  assert.equal(researchStatusFrom('generating'), null)
  const requestedAt = '2026-11-11 21:00:00'
  const at = researchRequestedAtMs(requestedAt)
  assert.equal(typeof at, 'number')
  assert.equal(researchView('requested', requestedAt, (at || 0) + RESEARCH_CALLBACK_WAIT_MS - 1), 'requested')
  assert.equal(researchView('requested', requestedAt, (at || 0) + RESEARCH_CALLBACK_WAIT_MS), 'sent')
  assert.equal(researchView('requested', null, (at || 0) + RESEARCH_CALLBACK_WAIT_MS), 'requested')
  assert.equal(researchView('complete', requestedAt, (at || 0) + RESEARCH_CALLBACK_WAIT_MS), 'complete')
  assert.equal(researchRequestBlock('requested', requestedAt, (at || 0) + 1000), RESEARCH_PENDING_MESSAGE)
  assert.equal(researchRequestBlock('requested', requestedAt, (at || 0) + RESEARCH_CALLBACK_WAIT_MS), null)
  assert.equal(researchRequestBlock('requested'), RESEARCH_PENDING_MESSAGE)
  assert.equal(researchRequestBlock('complete'), null)
  assert.equal(researchRequestBlock(null), null)
  assert.equal(RESEARCH_SENT_LABEL, 'Sent - check email')
})

test('the callback marks a Google place complete and ignores other actions', () => {
  const parsed = parseResearchCallback({
    ok: true,
    action: 'research_report',
    place_id: placeId,
    research_status: 'complete'
  })
  assert.deepEqual(parsed, { ok: true, placeId })

  assert.equal(parseResearchCallback({
    ok: true,
    action: 'generate_mockup',
    place_id: placeId,
    research_status: 'complete'
  }).ok, false)
  assert.equal(parseResearchCallback({
    ok: false,
    action: 'research_report',
    place_id: placeId,
    research_status: 'complete'
  }).ok, false)
  assert.equal(parseResearchCallback({
    ok: true,
    action: 'research_report',
    place_id: 'studio_user_mock',
    research_status: 'complete'
  }).ok, false)
})

test('fireResearchReport posts the studio webhook and does not call web stack', () => {
  const source = readFileSync(new URL('../server/utils/n8n.ts', import.meta.url), 'utf8')
  const start = source.indexOf('export async function fireResearchReport')
  assert.notEqual(start, -1)
  const next = source.indexOf('\nexport async function ', start + 10)
  const fn = source.slice(start, next === -1 ? undefined : next)
  assert.match(fn, /studioWebhookUrl/)
  assert.match(fn, /X-Studio-Secret/)
  assert.match(fn, /web-stack/)
  assert.doesNotMatch(fn, /fireWebStackAction|n8nWebStackWebhookUrl|leadPayloadForBuild/)
})
