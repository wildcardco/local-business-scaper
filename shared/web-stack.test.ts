import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUILD_MODE_HTML,
  BUILD_MODE_WEB_STACK,
  WEB_STACK_SECRET_HEADER,
  cursorAgentUrl,
  isWebStackCallback,
  leadPayloadForBuild,
  parseBuildMode,
  readWebStackWebhook,
  webStackJobView,
  webStackSecretHeader,
  webStackStatusLabel,
  webStackWebhookUrl
} from './web-stack.ts'

test('plain HTML is the default and does not change the lead payload', () => {
  const payload = { action: 'generate_mockup', business_name: 'Acme', model: 'claude-fable-5' }
  assert.equal(parseBuildMode(undefined), BUILD_MODE_HTML)
  assert.equal(parseBuildMode(''), BUILD_MODE_HTML)
  assert.equal(parseBuildMode('web-stack'), BUILD_MODE_HTML)
  assert.equal(leadPayloadForBuild(payload, 'html'), payload)
  assert.equal(leadPayloadForBuild(payload, undefined), payload)
  assert.equal('build_mode' in payload, false)
})

test('web stack keeps the lead payload and adds the build contract', () => {
  const payload = {
    action: 'generate_mockup',
    business_name: 'Leeps Supply Company',
    website: 'https://www.leeps.com/',
    phone: '219-696-1000',
    address: '100 Washington St, Lowell, IN 46356',
    model: 'claude-fable-5',
    mockup_id: 'm1'
  }
  const sent = leadPayloadForBuild(payload, BUILD_MODE_WEB_STACK)
  assert.notEqual(sent, payload)
  if (!('build_mode' in sent)) assert.fail('web stack fields were not added')
  assert.equal(sent.action, 'generate_mockup')
  assert.equal(sent.business_name, 'Leeps Supply Company')
  assert.equal(sent.website, 'https://www.leeps.com/')
  assert.equal(sent.phone, '219-696-1000')
  assert.equal(sent.address, '100 Washington St, Lowell, IN 46356')
  assert.equal(sent.model, 'claude-fable-5')
  assert.equal(sent.mockup_id, 'm1')
  assert.equal(sent.build_mode, 'web_stack')
  assert.equal(sent.stack, 'react-vite-tailwind')
  assert.equal(sent.agent_model, 'grok-4.7')
  assert.equal(sent.on_demand_fallback, false)
})

test('the webhook URL is required and a secret is never embedded in it', () => {
  const missing = webStackWebhookUrl('  ')
  assert.equal(missing.ok, false)
  if (!missing.ok) {
    assert.match(missing.message, /N8N_WEB_STACK_WEBHOOK_URL/)
    assert.match(missing.message, /does not fall back/)
    assert.doesNotMatch(missing.message, /webhook\/[A-Za-z0-9]{8,}/)
  }
  assert.equal(webStackWebhookUrl('file:///tmp/hook').ok, false)
  assert.equal(webStackWebhookUrl('https://user:secret@n8n.example/hook').ok, false)
  const ok = webStackWebhookUrl('https://n8n.example/webhook/web-stack')
  assert.deepEqual(ok, { ok: true, url: 'https://n8n.example/webhook/web-stack' })
})

test('the secret header is omitted when the env var is empty', () => {
  assert.equal(WEB_STACK_SECRET_HEADER, 'X-Web-Stack-Secret')
  assert.equal(webStackSecretHeader(''), null)
  assert.equal(webStackSecretHeader('   '), null)
  assert.equal(webStackSecretHeader(undefined), null)
  assert.equal(webStackSecretHeader('  local-only  '), 'local-only')
})

test('n8n result fields become status, preview, and a cursor.com agent link', () => {
  const parsed = readWebStackWebhook({
    agent_id: 'bc-abc_1',
    agent_url: 'https://evil.example/agents/nope',
    preview_url: 'https://preview.example.com/site',
    status: 'building',
    error: ''
  })
  assert.equal(parsed.agentId, 'bc-abc_1')
  assert.equal(parsed.agentUrl, 'https://cursor.com/agents/bc-abc_1')
  assert.equal(parsed.previewUrl, 'https://preview.example.com/site')
  assert.equal(parsed.rawStatus, 'building')
  assert.equal(parsed.status, 'generating')
  assert.equal(parsed.error, null)
  assert.equal(webStackStatusLabel(parsed.status, parsed.rawStatus), 'Building')
})

test('an agent id is taken from a cursor.com agent URL when agent_id is absent', () => {
  const parsed = readWebStackWebhook({
    agent_url: 'https://cursor.com/agents/bc-from-url?share=1',
    status: 'ready',
    preview_url: 'http://127.0.0.1:4173/'
  })
  assert.equal(parsed.agentId, 'bc-from-url')
  assert.equal(parsed.agentUrl, 'https://cursor.com/agents/bc-from-url')
  assert.equal(parsed.previewUrl, 'http://127.0.0.1:4173/')
  assert.equal(parsed.status, 'mockup_ready')
})

test('unsafe agent and preview values are dropped', () => {
  assert.equal(cursorAgentUrl('../admin'), null)
  assert.equal(cursorAgentUrl('bc id'), null)
  const parsed = readWebStackWebhook({
    agent_id: 'not an id',
    agent_url: 'https://cursor.com.evil.com/agents/abc',
    preview_url: 'javascript:alert(1)',
    status: 'failed',
    error: { message: 'the agent stopped' }
  })
  assert.equal(parsed.agentId, null)
  assert.equal(parsed.agentUrl, null)
  assert.equal(parsed.previewUrl, null)
  assert.equal(parsed.status, 'failed')
  assert.equal(parsed.error, 'the agent stopped')
  assert.equal(readWebStackWebhook({ preview_url: 'https://user:pass@example.com/p' }).previewUrl, null)
})

test('a plain HTML callback is not treated as a web stack result', () => {
  const html = {
    status: 'mockup_ready',
    mockup_url: 'https://demo.vercel.app',
    mockup_id: 'm1'
  }
  assert.equal(isWebStackCallback(html), false)
  assert.equal(isWebStackCallback({ build_mode: 'web_stack', status: 'queued' }), true)
  const wrapped = readWebStackWebhook([{
    json: {
      agent_id: 'agent-1',
      status: 'completed',
      preview_url: 'https://preview.example/app',
      error: null
    }
  }])
  assert.equal(wrapped.agentUrl, 'https://cursor.com/agents/agent-1')
  assert.equal(wrapped.status, 'mockup_ready')
  assert.equal(wrapped.previewUrl, 'https://preview.example/app')

  const outer = readWebStackWebhook({
    agent_id: 'outer-id',
    status: 'building',
    preview_url: 'https://preview.example/outer',
    data: { status: 'failed', agent_id: 'inner-id' }
  })
  assert.equal(outer.agentId, 'outer-id')
  assert.equal(outer.previewUrl, 'https://preview.example/outer')
  assert.equal(outer.status, 'generating')
})

test('an error without a running status fails, and a ready status keeps the preview', () => {
  assert.equal(readWebStackWebhook({ error: 'missing lead' }).status, 'failed')
  const ready = readWebStackWebhook({ status: 'success', error: 'warning only', preview_url: 'https://preview.example/ok' })
  assert.equal(ready.status, 'mockup_ready')
  assert.equal(ready.error, 'warning only')
  assert.equal(ready.previewUrl, 'https://preview.example/ok')
  assert.equal(readWebStackWebhook({ status: 'in progress' }).status, 'generating')
  assert.equal(webStackStatusLabel('generating', 'in_progress'), 'In progress')
})

test('web stack job copy names the cloud agent and does not describe the HTML factory', () => {
  const building = webStackJobView({ posting: false, status: 'generating' })
  assert.equal(building.phase, 'building')
  assert.match(building.detail, /grok-4\.7/)
  assert.match(building.detail, /no on-demand fallback/i)
  assert.doesNotMatch(building.detail, /Vercel/)
  assert.equal(webStackJobView({ posting: true, status: 'draft' }).phase, 'sending')
  assert.equal(webStackJobView({ posting: false, status: 'failed', error: 'n8n rejected it' }).detail, 'n8n rejected it')
  assert.equal(webStackJobView({ posting: false, status: 'mockup_ready' }).phase, 'ready')
})
