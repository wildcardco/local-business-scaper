import assert from 'node:assert/strict'
import test from 'node:test'
import {
  gbpPhotoMessage,
  gbpPhotosFrom,
  gbpWebhookFields,
  googleBusinessIdFrom,
  googlePlaceIdFrom,
  siteExtractionStatus
} from './gbp-listing.ts'
import { pageChoiceLead } from './website-intake.ts'

const leeps = {
  website: 'https://www.leeps.com/',
  phone: '219-696-1000',
  address: '100 Washington St, Lowell, IN 46356',
  category: 'Building materials supplier',
  rating: 4.6,
  review_count: 22
}

test('a confirmed Google listing replaces the synthetic business id and keeps the website', () => {
  const fields = gbpWebhookFields({
    appBusinessId: 'app_row_1',
    googleBusinessId: '0x880e1c:0x3a0c0e',
    photos: [{
      photo_id: 'p1',
      photo_url_large: 'https://photos.example/leeps-large.jpg',
      photo_url: 'https://photos.example/leeps.jpg',
      type: 'cover',
      photo_timestamp: '2026-01-01'
    }],
    photoCount: 8
  })

  assert.equal(googleBusinessIdFrom('0x880e1c:0x3a0c0e'), '0x880e1c:0x3a0c0e')
  assert.equal(googleBusinessIdFrom('ChIJleeps'), null)
  assert.equal(googlePlaceIdFrom('ChIJleepsplace'), 'ChIJleepsplace')
  assert.equal(googlePlaceIdFrom('studio_ryan_m1'), null)
  assert.equal(fields.business_id, '0x880e1c:0x3a0c0e')
  assert.equal(fields.photo_count, 8)
  assert.deepEqual(fields.gbp_photos, [{
    id: 'p1',
    url: 'https://photos.example/leeps-large.jpg',
    type: 'cover',
    ts: '2026-01-01'
  }])

  const one = pageChoiceLead({ ...leeps, ...fields }, 'one_page')
  assert.equal(one.website, 'https://www.leeps.com/')
  assert.equal(one.phone, '219-696-1000')
  assert.equal(one.address, '100 Washington St, Lowell, IN 46356')
  assert.equal(one.business_id, '0x880e1c:0x3a0c0e')
  assert.equal(one.page_intent, 'one_page')
  assert.equal('build_mode' in one, false)
  assert.equal('photo_urls' in one, false)

  const multi = pageChoiceLead({ ...leeps, ...fields }, 'multi_page')
  assert.equal(multi.build_mode, 'web_stack')
  assert.equal(multi.business_id, '0x880e1c:0x3a0c0e')
  assert.equal(multi.website, 'https://www.leeps.com/')
  assert.equal('page_intent' in multi, false)
})

test('a photo without a large url uses photo_url, and a missing hex id keeps the app id', () => {
  const photos = gbpPhotosFrom([
    { id: 'p2', photo_url: 'https://photos.example/front.jpg', type: 'street' },
    { photo_url_large: 'https://photos.example/no-id.jpg' }
  ])
  assert.deepEqual(photos, [{
    id: 'p2',
    url: 'https://photos.example/front.jpg',
    type: 'street',
    ts: null
  }])

  const fields = gbpWebhookFields({ appBusinessId: 'app_row_1', photos: [] })
  assert.equal(fields.business_id, 'app_row_1')
  assert.equal('gbp_photos' in fields, false)
  assert.equal('photo_urls' in fields, false)
})

test('a town-only address tells the truth, and a street does not claim the page was read', () => {
  const missing = siteExtractionStatus({
    website: 'https://www.leeps.com/',
    phone: null,
    address: 'Lowell, Indiana'
  })
  assert.equal(missing.status, 'identity-missing')
  assert.match(missing.message, /does not claim those assets were used/)
  assert.doesNotMatch(missing.message, /navigation was read/i)

  const ready = siteExtractionStatus({
    website: 'https://www.leeps.com/',
    phone: '219-696-1000',
    address: '100 Washington St, Lowell, IN 46356'
  })
  assert.equal(ready.status, 'unverified')
  assert.match(ready.message, /Cloudflare/)
  assert.match(ready.message, /does not claim those assets were used/)

  assert.match(gbpPhotoMessage({ failed: true, count: 0 }), /did not load/)
  assert.match(gbpPhotoMessage({ failed: false, count: 2 }), /gbp_photos/)
})
