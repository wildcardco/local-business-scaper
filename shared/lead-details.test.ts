import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LEAD_DETAILS_NOT_FOUND,
  LEAD_DETAILS_NO_PLACE,
  LEAD_DETAILS_SECRET,
  LEAD_DETAILS_TIMEOUT,
  LEAD_DETAILS_UNAVAILABLE,
  interpretLeadDetailsHttp,
  leadDetailsRequest,
  leadDetailsTransportError,
  mergeLeadDetails
} from './lead-details.ts'

const placeId = 'ChIJlyMchiWjEYgRaD7CAYYYOoc'

const saved = {
  email: 'keep@acme.example',
  phone: '+19185551234',
  contacts_data: JSON.stringify({
    emails: ['keep@acme.example'],
    facebook: 'https://facebook.com/acme'
  }),
  photo_count: 4,
  gbp_photos: JSON.stringify([{ id: 'old', url: 'https://cdn.example/old.jpg', type: 'owner', ts: '1' }]),
  signals: JSON.stringify({ no_website: false, site_check: 'Old note' })
}

test('lead_details request uses a ChIJ place id and a known owner', () => {
  const result = leadDetailsRequest({ owner: 'Ryan', placeId })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.body, {
    action: 'lead_details',
    owner: 'ryan',
    place_id: placeId
  })
})

test('a missing or synthetic place id is rejected and an unknown owner is omitted', () => {
  assert.deepEqual(leadDetailsRequest({ owner: 'ryan', placeId: 'studio_user_mock' }), {
    ok: false,
    message: LEAD_DETAILS_NO_PLACE
  })
  const result = leadDetailsRequest({ owner: 'guest', placeId })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.body.owner, undefined)
  assert.equal(result.body.place_id, placeId)
})

test('found, missing, secret, 404, and unknown action stay distinct', () => {
  const found = interpretLeadDetailsHttp(200, {
    ok: true,
    found: true,
    place_id: placeId,
    tier: 'Worth a look',
    emails: ['owner@acme.example']
  })
  assert.equal(found.kind, 'found')
  assert.equal(interpretLeadDetailsHttp(200, { ok: true, found: false, place_id: placeId }).kind, 'missing')
  assert.equal(interpretLeadDetailsHttp(401, { message: 'nope' }).kind, 'secret')
  assert.equal(interpretLeadDetailsHttp(403, 'Authorization data is wrong!').kind, 'secret')
  assert.equal(interpretLeadDetailsHttp(404, { message: 'not registered' }).kind, 'unavailable')
  assert.equal(interpretLeadDetailsHttp(200, { message: 'Unknown action: lead_details' }).kind, 'unavailable')
  assert.equal(interpretLeadDetailsHttp(200, { ok: false, action: 'other' }).kind, 'unavailable')
  assert.equal(interpretLeadDetailsHttp(500, { message: 'boom' }).kind, 'error')
  assert.equal(leadDetailsTransportError('TimeoutError'), LEAD_DETAILS_TIMEOUT)
  assert.equal(leadDetailsTransportError('TypeError'), null)
  assert.equal(LEAD_DETAILS_NOT_FOUND.includes('No saved details'), true)
  assert.equal(LEAD_DETAILS_UNAVAILABLE, 'Lookup not available yet')
  assert.match(LEAD_DETAILS_SECRET, /secret/i)
})

test('a one-item emails array merges, and empty values do not clear saved details', () => {
  const merged = mergeLeadDetails(saved, {
    ok: true,
    found: true,
    emails: ['keep@acme.example'],
    phone: '+12196966430',
    photo_count: 0,
    gbp_photos: [],
    tier: 'Worth a look',
    site_check: '   '
  })
  assert.equal(merged.email, 'keep@acme.example')
  const contacts = JSON.parse(merged.contactsData || '{}')
  assert.deepEqual(contacts.emails, ['keep@acme.example'])
  assert.equal(contacts.facebook, 'https://facebook.com/acme')
  assert.equal(merged.phone, null)
  assert.equal(merged.photoCount, null)
  assert.equal(merged.gbpPhotos, null)
  assert.equal(merged.signals, null)
  assert.deepEqual(merged.tier, { slug: 'worth_a_look', label: 'Worth a look' })
})

test('photo objects are stored as sent, phone fills only an empty number, and site_check merges', () => {
  const merged = mergeLeadDetails({
    email: '',
    phone: '   ',
    contacts_data: JSON.stringify({ phone_numbers: ['+1555'] }),
    photo_count: null,
    gbp_photos: '[]',
    signals: { no_website: true }
  }, {
    email: 'owner@acme.example',
    emails: ['owner@acme.example'],
    phone: '+12196966430',
    photo_count: 29,
    gbp_photos: [
      { id: 'p1', url: 'https://lh3.googleusercontent.com/p/example', type: 'owner', ts: '1710000000' },
      { id: 'p2', url: '', type: null, ts: null }
    ],
    lead_group: 'Industrial',
    angle: '  Dated site  ',
    score: 37,
    tier: 'Good',
    site_check: 'Basic site'
  })
  assert.equal(merged.email, 'owner@acme.example')
  assert.deepEqual(JSON.parse(merged.contactsData || '{}').emails, ['owner@acme.example'])
  assert.equal(JSON.parse(merged.contactsData || '{}').phone_numbers[0], '+1555')
  assert.equal(merged.phone, '+12196966430')
  assert.equal(merged.photoCount, 29)
  assert.deepEqual(JSON.parse(merged.gbpPhotos || '[]'), [
    { id: 'p1', url: 'https://lh3.googleusercontent.com/p/example', type: 'owner', ts: '1710000000' },
    { id: 'p2', url: '', type: null, ts: null }
  ])
  assert.equal(merged.leadGroup, 'industrial')
  assert.equal(merged.angle, 'Dated site')
  assert.equal(merged.score, 37)
  assert.deepEqual(merged.tier, { slug: 'good', label: 'Good' })
  assert.deepEqual(JSON.parse(merged.signals || '{}'), {
    no_website: true,
    site_check: 'Basic site'
  })
})

test('photos without urls do not replace a saved photo list', () => {
  const merged = mergeLeadDetails(saved, {
    photo_count: 6,
    gbp_photos: [{ id: 'blank', url: '' }]
  })
  assert.equal(merged.photoCount, 6)
  assert.equal(merged.gbpPhotos, null)
  assert.equal(mergeLeadDetails(saved, { tier: 'Call sometime' }).tier, null)
})
