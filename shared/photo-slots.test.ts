import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPhotoSlots, slotOrderedPhotoUrls } from './photo-slots.ts'

const example = `<!doctype html><html><body>
<img data-photo-query="asphalt crew paving a residential driveway" alt="hero">
<figure data-photo-query="sealcoating a suburban driveway"><img alt=""></figure>
<figure data-photo-query="road crack repair close up"><img src=""></figure>
<img data-photo-query="parking lot striping crew">
<section><img data-photo-query="concrete driveway pour"></section>
<figure data-photo-query="asphalt roller compacting a street"><img src="images/roller.jpg"></figure>
<img data-photo-query="finished blacktop driveway" src="https://cdn.example.com/done.jpg">
<!-- <img data-photo-query="commented out shot"> -->
</body></html>`

test('example page has a hero plus six service slots', () => {
  const slots = extractPhotoSlots(example)
  assert.equal(slots.length, 7)
  assert.equal(slots[0]?.role, 'hero')
  assert.equal(slots[0]?.query, 'asphalt crew paving a residential driveway')
  assert.equal(slots[0]?.open, true)
  assert.equal(slots[6]?.open, false)
  assert.equal(slots[6]?.src, 'https://cdn.example.com/done.jpg')
  assert.equal(slots.filter(slot => slot.open).length, 6)
  assert.ok(slots.every((slot, index) => slot.index === index))
})

test('slot order keeps the hero first and leftover slots empty', () => {
  const urls = slotOrderedPhotoUrls([
    'https://cdn.example.com/hero.jpg',
    '',
    ' https://cdn.example.com/crack.jpg ',
    null,
    'javascript:alert(1)',
    'not a url'
  ])
  assert.deepEqual(urls, [
    'https://cdn.example.com/hero.jpg',
    '',
    'https://cdn.example.com/crack.jpg',
    '',
    '',
    ''
  ])
})
