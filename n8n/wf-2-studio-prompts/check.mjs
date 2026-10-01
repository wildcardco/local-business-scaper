// Local check for the pasteable WF-2 scripts. Not an n8n node.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const models = [
  'claude-opus-5-5',
  'claude-fable-5-1',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-haiku-4-5',
  'claude-fable-5',
  'claude-opus-4-6'
]

function read(name) {
  return fs.readFileSync(path.join(dir, name), 'utf8')
}

function loadPrompts() {
  const code = read('build-generate-request.js')
  const cut = code.slice(0, code.indexOf('const DEFAULT_HTML_MODEL'))
  return new Function(`${cut}\nreturn SYSTEM_PROMPTS;`)()
}

function loadVisualSystem() {
  const code = read('build-visual-reference-request.js')
  const cut = code.slice(0, code.indexOf('const d = $input'))
  return new Function(`${cut}\nreturn VISUAL_SYSTEM;`)()
}

function runNode(file, input, nodes) {
  const code = read(file)
  const dollar = (name) => {
    if (!nodes[name]) throw new Error(`node not run: ${name}`)
    return { first: () => ({ json: nodes[name] }) }
  }
  const fn = new Function('$input', '$', 'Buffer', code)
  const inputApi = { first: () => ({ json: input }) }
  return fn(inputApi, dollar, Buffer)
}

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const prompts = loadPrompts()
const year = String(new Date().getFullYear())
const bans = [
  'checkered or gingham border',
  'repeating diagonal stripe as a divider',
  'grain overlay',
  'custom cursor'
]
const hard = [
  'One file.',
  'Do not fabricate awards, testimonials, or phone numbers.',
  'Do not invent an image URL.',
  'Website sample by Wild Card Creative Co',
  '<meta name="robots" content="noindex, nofollow">',
  'The response is the raw HTML document.',
  '__CURRENT_YEAR__'
]

for (const model of models) {
  const txt = read(`system/${model}.txt`).trim()
  assert(prompts[model] === txt, `${model} txt drifted from build-generate-request.js`)
  for (const phrase of bans.concat(hard)) {
    assert(prompts[model].includes(phrase), `${model} missing: ${phrase}`)
  }
  assert(!prompts[model].includes('tactile micro-details'), `${model} still has the house style`)
  assert(!prompts[model].includes('grain/texture'), `${model} still recommends grain`)
  assert(!prompts[model].includes('unusual dividers'), `${model} still recommends unusual dividers`)
  assert(!/double-check|re-verify|verification step/i.test(prompts[model]), `${model} asks for verification`)
  assert(!prompts[model].includes('tool call'), `${model} mentions tool calls`)
}

assert(!prompts['claude-opus-5-5'].includes('frontend_aesthetics'), 'opus 5.5 uses the general aesthetics block')
assert(!prompts['claude-opus-5-5'].includes('AI slop'), 'opus 5.5 uses a general slop instruction')
assert(!/avoid a generic/i.test(prompts['claude-opus-5-5']), 'opus 5.5 uses a general avoid-generic line')
for (const phrase of [
  'cream or off-white background',
  'italic accent words in headlines',
  'numbered "01/02/03" section labels',
  'monospace labels',
  'pill-shaped buttons'
]) {
  assert(prompts['claude-opus-5-5'].includes(phrase), `opus 5.5 missing named default: ${phrase}`)
}

assert(prompts['claude-fable-5'].includes('With that in mind:'), 'fable 5 missing the reason')
assert(prompts['claude-fable-5'].includes("A one-shot operation usually doesn't need a helper."), 'fable 5 missing scope line')
assert(!prompts['claude-fable-5'].includes('Please remove all mannered prose.'), 'mannered-prose line is only for fable 5.1')
assert(!prompts['claude-fable-5'].includes('not watching in real time'), 'autonomous line is only for fable 5.1')

assert(prompts['claude-fable-5-1'].includes('Please remove all mannered prose.'), 'fable 5.1 missing mannered prose')
assert(prompts['claude-fable-5-1'].includes('The user is not watching in real time'), 'fable 5.1 missing autonomous line')
assert(prompts['claude-fable-5-1'].includes('Want me to…?'), 'fable 5.1 autonomous sentence was rewritten')

assert(prompts['claude-opus-5'].includes('Deliver what was asked, at the scope intended.'), 'opus 5 missing scope')
assert(prompts['claude-opus-5'].includes('do not pad with filler sections, redundant summaries, or boilerplate.'), 'opus 5 missing length')
assert(!prompts['claude-opus-5'].includes('say so in a sentence'), 'opus 5 would add a sentence before the HTML')

assert(prompts['claude-sonnet-5'].includes('every section of the page, not only the first screen'), 'sonnet 5 scope is not explicit')
assert(prompts['claude-sonnet-5'].includes('<frontend_aesthetics>'), 'sonnet 5 missing its aesthetics snippet')
assert(prompts['claude-sonnet-5'].includes('purple gradients on white or dark backgrounds'), 'sonnet 5 snippet drifted')

assert(!prompts['claude-haiku-4-5'].includes('<frontend_aesthetics>'), 'haiku picked up another model snippet')
assert(prompts['claude-haiku-4-5'].includes('You are writing one HTML document.'), 'haiku missing its role')

assert(prompts['claude-opus-4-6'].includes('Space Grotesk'), 'opus 4.6 missing the best-practices snippet')
assert(prompts['claude-opus-4-6'].includes('not a checkered or gingham border'), 'opus 4.6 geometric line can still mean checkers')

const visualTxt = read('system/visual-reference.txt').trim()
assert(loadVisualSystem() === visualTxt, 'visual-reference.txt drifted')
assert(visualTxt.includes('"Modern and clean"'), 'chooser still allows a vague name')
assert(visualTxt.includes('Return one reference, not a list.'), 'chooser can ask for a menu of looks')
assert(visualTxt.includes('repeating diagonal stripe'), 'chooser can still ask for stripe dividers')

const lead = {
  business_name: 'Harbor Bait',
  category: 'bait shop',
  phone: '555-0100',
  address: '12 Dock St, Biloxi, MS 39530',
  website: 'https://example.test',
  rating: 4.6,
  review_count: 18,
  _brief: {
    summary: 'A bait shop on the Biloxi dock.',
    design_direction: 'modern and clean',
    palette_mood: 'shrimp-boat green',
    location_context: 'Biloxi, Mississippi'
  },
  _site_images: ['https://images.example.test/shrimp.jpg'],
  _site_html: '<p>Live shrimp</p>',
  _visual_reference: {
    reference_name: 'the painted metal menu boards at a Biloxi shrimp house',
    tied_to: 'A bait shop on the Biloxi dock, not a downtown studio.',
    page_spec: 'Background is sun-faded white enamel. Type is a condensed sign-painter sans. Layout is a stacked menu board, not three cards.'
  }
}

const nodes = { 'When Called by WF-1': { model: 'claude-sonnet-5', research_model: 'claude-sonnet-5' } }
const fresh = runNode('build-generate-request.js', lead, nodes)[0].json
assert(fresh._html_model === 'claude-sonnet-5', 'model did not follow the trigger')
assert(fresh._html_model_fallback === false, 'known model was marked fallback')
assert(fresh._system.includes(year), 'year was not injected')
assert(!fresh._system.includes('__CURRENT_YEAR__'), 'year token left in the prompt')
assert(fresh._system.includes('not only the first screen'), 'sonnet system was not selected')
assert(fresh._user.includes('painted metal menu boards at a Biloxi shrimp house'), 'user prompt dropped the reference')
assert(fresh._user.includes('https://images.example.test/shrimp.jpg'), 'real image URL was dropped')
assert(fresh._user.includes('555-0100'), 'phone fact was dropped')
assert(!fresh._user.includes('Name: modern and clean'), 'vague brief name replaced the reference')
assert(!fresh._system.includes('tactile micro-details'), 'house style survived')

const opusNodes = { 'When Called by WF-1': { model: 'claude-opus-5-5' } }
const opus = runNode('build-generate-request.js', lead, opusNodes)[0].json
assert(opus._system.includes('pill-shaped buttons'), 'opus 5.5 prompt was not selected')
assert(!opus._system.includes('<frontend_aesthetics>'), 'opus 5.5 got another model block')

const unknown = runNode('build-generate-request.js', lead, {
  'When Called by WF-1': { model: 'claude-not-a-studio-model' }
})[0].json
assert(unknown._html_model === 'claude-opus-5-5', 'unknown model did not fall back to opus 5.5')
assert(unknown._html_model_fallback === true, 'unknown model was not flagged')

const pinned = runNode('build-generate-request.js', { ...lead, model: '' }, {
  'When Called by WF-1': {}
})[0].json
assert(pinned._html_model === 'claude-opus-5-5', 'missing model did not match the live pin')
assert(pinned._html_model_fallback === false, 'missing model should not look like a mismatch')

const noImages = runNode('build-generate-request.js', { ...lead, _site_images: [] }, opusNodes)[0].json
assert(noImages._user.includes('Do not invent an image URL.'), 'empty image list can still invent URLs')

const vagueOnly = runNode('build-generate-request.js', {
  ...lead,
  _visual_reference: { reference_name: 'modern and clean', tied_to: '', page_spec: '' },
  _brief: { design_direction: 'modern and clean', location_context: 'Biloxi, Mississippi' }
}, opusNodes)[0].json
assert(!vagueOnly._user.includes('Name: modern and clean'), 'vague reference name was kept')
assert(vagueOnly._user.includes('Biloxi'), 'town was dropped when the name was vague')

const html = `<!doctype html><html><head><meta name="robots" content="noindex, nofollow"></head><body>${'x'.repeat(240)}</body></html>`
const revision = runNode('build-generate-request.js', {
  ...lead,
  _feedback: 'Make the phone number larger.',
  _version: 2
}, {
  'When Called by WF-1': { model: 'claude-fable-5-1' },
  'Fetch Current Mockup HTML': { content: Buffer.from(html, 'utf8').toString('base64') }
})[0].json
assert(revision._html_model === 'claude-fable-5-1', 'revision dropped the model id')
assert(revision._system.includes('EXISTING single-file HTML'), 'revision system changed')
assert(revision._system.includes(`CURRENT YEAR (${year})`), 'revision year was not injected')
assert(!revision._system.includes('Visual reference'), 'revision restyles from the reference')
assert(!revision._system.includes('tactile micro-details'), 'revision grew a house style')
assert(revision._user.includes('Make the phone number larger.'), 'revision dropped the feedback')
assert(revision._user.includes(html), 'revision dropped the current HTML')

const chosen = runNode('build-visual-reference-request.js', lead, {})[0].json
assert(chosen._system === visualTxt, 'chooser system is not the visual-reference prompt')
assert(chosen._user.includes('Harbor Bait'), 'chooser did not see the business')
assert(chosen._user.includes('Biloxi'), 'chooser did not see the town')
assert(chosen._brief.summary === lead._brief.summary, 'chooser dropped the brief')

const parsed = runNode('parse-visual-reference.js', {
  content: [{ type: 'text', text: '```json\n{"reference_name":"modern and clean","tied_to":"Biloxi bait shop","page_spec":"Enamel menu board."}\n```' }]
}, { 'Build Visual Reference Request': lead })[0].json
assert(parsed._visual_reference.reference_name === '', 'vague chooser name was kept')
assert(parsed._visual_reference.tied_to === 'Biloxi bait shop', 'tied_to was dropped')
assert(parsed._visual_reference.page_spec === 'Enamel menu board.', 'page_spec was dropped')
assert(parsed._visual_reference.vague_name === true, 'vague name was not flagged')
assert(parsed.business_name === 'Harbor Bait', 'parse dropped the lead')

const broken = runNode('parse-visual-reference.js', { text: 'not json' }, {
  'Build Visual Reference Request': lead
})[0].json
assert(broken._visual_reference === null, 'garbage JSON became a reference')
assert(broken._visual_reference_missing === true, 'missing reference was not flagged')

console.log('wf-2 studio prompts ok')
