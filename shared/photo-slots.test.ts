import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPhotoSlots, preferredSlotIndex, slotAfterAssign, slotOrderedPhotoUrls } from './photo-slots.ts'

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

test('preferred slot keeps an explicit aim, otherwise the first empty slot', () => {
  const slots = [{ index: 0 }, { index: 1 }, { index: 2 }]
  assert.equal(preferredSlotIndex(slots, { 0: 'https://cdn.example.com/a.jpg' }, null), 1)
  assert.equal(preferredSlotIndex(slots, { 0: 'https://cdn.example.com/a.jpg' }, 2), 2)
  assert.equal(preferredSlotIndex(slots, {}, 9), 0)
  assert.equal(preferredSlotIndex([], {}, null), null)
})

test('after assign, the next open slot follows in order and wraps', () => {
  const slots = [{ index: 0 }, { index: 1 }, { index: 2 }]
  assert.equal(slotAfterAssign(slots, { 0: 'https://cdn.example.com/a.jpg' }, 0), 1)
  assert.equal(slotAfterAssign(slots, {
    0: '',
    1: 'https://cdn.example.com/b.jpg',
    2: 'https://cdn.example.com/c.jpg'
  }, 1), 0)
  assert.equal(slotAfterAssign(slots, {
    0: 'https://cdn.example.com/a.jpg',
    1: 'https://cdn.example.com/b.jpg',
    2: 'https://cdn.example.com/c.jpg'
  }, 2), 2)
})
