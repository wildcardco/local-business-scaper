import assert from 'node:assert/strict'
import test from 'node:test'
import { applyImageSpotPhotos, detectImageSpots } from './mockup-image-spots.ts'
import { factoryFeedback, generatePhotoWebhookFields } from './photo-slots.ts'

const page = `<!doctype html><html><head>
<script>var img = '<img src="https://cdn.example.com/script.jpg">';</script>
<style>.x{background:url(https://cdn.example.com/css.jpg)}</style>
</head><body>
<img class="logo" src="https://cdn.example.com/logo.png" alt="logo">
<img src="https://cdn.example.com/hero.jpg" alt="storefront">
<section style="background-image: url('https://cdn.example.com/crew.jpg')">Crew</section>
<p>Crown Point Family Dental stays open late.</p>
<img src="https://cdn.example.com/about.jpg" alt="team">
</body></html>`

test('detects content images and skips logos, scripts, and css', () => {
  const spots = detectImageSpots(page)
  assert.deepEqual(spots.map(spot => spot.src), [
    'https://cdn.example.com/hero.jpg',
    'https://cdn.example.com/crew.jpg',
    'https://cdn.example.com/about.jpg'
  ])
  assert.equal(spots[0]?.key, 'hero')
  assert.equal(spots[0]?.kind, 'img')
  assert.equal(spots[1]?.kind, 'background')
})

test('swaps only the chosen image src and keeps the copy', () => {
  const result = applyImageSpotPhotos(page, [
    { index: 0, key: 'hero', label: 'Hero', url: 'https://cdn.example.com/new-hero.jpg' },
    { index: 2, key: 'about', label: 'About', url: 'https://cdn.example.com/new-about.jpg' }
  ])
  assert.equal(result.applied, 2)
  assert.match(result.html, /src="https:\/\/cdn\.example\.com\/new-hero\.jpg"/)
  assert.match(result.html, /data-photo-slot="hero"/)
  assert.match(result.html, /src="https:\/\/cdn\.example\.com\/logo\.png"/)
  assert.doesNotMatch(result.html, /src="https:\/\/cdn\.example\.com\/about\.jpg"/)
  assert.match(result.html, /Crown Point Family Dental stays open late/)
  assert.match(result.html, /background-image: url\('https:\/\/cdn\.example\.com\/crew\.jpg'\)/)
  assert.match(result.html, /<script>var img = '<img src="https:\/\/cdn\.example\.com\/script\.jpg">';<\/script>/)
})

test('empty photo slots stay off the webhook unless regenerate asked to keep them', () => {
  const slots = [
    { key: 'hero', label: 'Hero', url: '' },
    { key: 'about', label: 'About', url: '' }
  ]
  assert.equal(generatePhotoWebhookFields(slots), null)
  const kept = generatePhotoWebhookFields(slots, { includeEmpty: true })
  assert.equal(kept?.photo_urls.length, 0)
  assert.equal(kept?.photo_slots.length, 2)
})

test('regenerate clears stored revision notes so the factory does not edit in place', () => {
  assert.equal(factoryFeedback({
    clearFeedback: true,
    extraPrompt: 'Make the hero darker',
    stored: 'Move the phone number'
  }), '')
  assert.equal(factoryFeedback({
    extraPrompt: 'Move the phone number',
    stored: 'older notes'
  }), 'Move the phone number')
})
