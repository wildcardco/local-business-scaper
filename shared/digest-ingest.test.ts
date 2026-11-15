import assert from 'node:assert/strict'
import test from 'node:test'
import {
  digestLeadFields,
  GBP_PHOTO_LIMIT,
  mergeContactEmails,
  normalizeDigestEmail,
  normalizeGbpPhotos,
  normalizeLeadGroup,
  normalizePhotoCount
} from './digest-ingest.ts'
import {
  formatLeadPhone,
  gbpPhotoUrls,
  googlePhotosNote,
  leadEmails,
  leadGroupLabel,
  leadScoreBadge,
  leadTypeLine,
  siteCheckText
} from './lead-context.ts'

const saved = {
  email: 'keep@acme.example',
  contacts_data: JSON.stringify({
    emails: ['keep@acme.example'],
    phone_numbers: ['+19185551234'],
    facebook: 'https://facebook.com/acme'
  })
}

test('an old lead payload does not invent email, photos, or a group', () => {
  const fields = digestLeadFields({
    place_id: 'ChIJold',
    name: 'Acme Roofing',
    score: 87,
    tier: 'Call First',
    signals: { no_website: false }
  })
  assert.deepEqual(fields, {
    email: null,
    contactsData: null,
    photoCount: null,
    gbpPhotos: null,
    leadGroup: null
  })
})

test('unknown keys are ignored and a bad field does not blank the others', () => {
  const fields = digestLeadFields({
    email: 'not-an-email',
    emails: ['office@acme.example', 'office@acme.example', 'bad', 12],
    photo_count: '12',
    gbp_photos: '["https://cdn.example/a.jpg", 5, {"url":"https://cdn.example/b.jpg","id":"p2"}]',
    lead_group: 'Industrial',
    mystery: { nope: true },
    website_status: 'ok'
  }, saved)

  assert.equal(fields.email, 'office@acme.example')
  assert.equal(fields.photoCount, 12)
  assert.equal(fields.leadGroup, 'industrial')
  assert.equal('mystery' in fields, false)
  const contacts = JSON.parse(fields.contactsData || '{}')
  assert.deepEqual(contacts.emails, ['keep@acme.example', 'office@acme.example'])
  assert.deepEqual(contacts.phone_numbers, ['+19185551234'])
  assert.equal(contacts.facebook, 'https://facebook.com/acme')
  assert.deepEqual(JSON.parse(fields.gbpPhotos || '[]'), [
    'https://cdn.example/a.jpg',
    { url: 'https://cdn.example/b.jpg', id: 'p2' }
  ])
})

test('a non-empty saved email is kept when the new email is empty', () => {
  const fields = digestLeadFields({
    email: '   ',
    emails: 'office@acme.example',
    photo_count: 4.5,
    gbp_photos: ['ftp://files.example/a.jpg', 'not a url'],
    lead_group: 3
  }, saved)
  assert.equal(fields.email, 'keep@acme.example')
  assert.equal(fields.contactsData, null)
  assert.equal(fields.photoCount, null)
  assert.equal(fields.gbpPhotos, null)
  assert.equal(fields.leadGroup, null)
})

test('an explicit email wins over emails[0] and still merges the list', () => {
  const fields = digestLeadFields({
    email: 'owner@acme.example',
    emails: ['desk@acme.example', 'OWNER@acme.example']
  }, { contacts_data: '{"yelp":"https://yelp.com/acme"}' })
  assert.equal(fields.email, 'owner@acme.example')
  assert.deepEqual(JSON.parse(fields.contactsData || '{}'), {
    yelp: 'https://yelp.com/acme',
    emails: ['desk@acme.example', 'OWNER@acme.example']
  })
})

test('photo_count accepts integers only and gbp_photos accepts a JSON string or objects', () => {
  assert.equal(normalizePhotoCount(0), 0)
  assert.equal(normalizePhotoCount('8'), 8)
  assert.equal(normalizePhotoCount(8.5), null)
  assert.equal(normalizePhotoCount(-1), null)
  assert.equal(normalizePhotoCount(true), null)
  assert.deepEqual(normalizeGbpPhotos([]), [])
  assert.equal(normalizeGbpPhotos('{"url":"https://cdn.example/a.jpg"}'), null)
  assert.equal(normalizeGbpPhotos(['nope']), null)
  assert.equal(normalizeLeadGroup(' nonprofit '), 'nonprofit')
  assert.equal(normalizeLeadGroup(''), null)
  assert.equal(normalizeDigestEmail(' owner@acme.example '), 'owner@acme.example')
})

test('merge keeps later duplicates out and caps stored photo urls', () => {
  const merged = mergeContactEmails('{"emails":["A@acme.example","nope"]}', ['a@acme.example', 'b@acme.example'])
  assert.deepEqual(JSON.parse(merged).emails, ['A@acme.example', 'b@acme.example'])
  const urls = Array.from({ length: GBP_PHOTO_LIMIT + 5 }, (_, index) => `https://cdn.example/${index}.jpg`)
  assert.equal(normalizeGbpPhotos(urls)?.length, GBP_PHOTO_LIMIT)
})

test('a one-address emails array fills businesses.email', () => {
  const fields = digestLeadFields({ emails: ['owner@acme.example'] })
  assert.equal(fields.email, 'owner@acme.example')
  assert.deepEqual(JSON.parse(fields.contactsData || '{}').emails, ['owner@acme.example'])
})

test('lead_details photo objects are stored as-is and only http urls are shown', () => {
  const photos = [
    { id: 'p1', url: 'https://lh3.googleusercontent.com/p/example-1', type: 'owner', ts: '1710000000' },
    { id: 'p2', url: '', type: null, ts: null },
    { id: 'p3', type: 'street', ts: null }
  ]
  assert.deepEqual(normalizeGbpPhotos(photos), photos)
  assert.deepEqual(gbpPhotoUrls(photos), ['https://lh3.googleusercontent.com/p/example-1'])
  assert.deepEqual(gbpPhotoUrls([]), [])
  assert.deepEqual(gbpPhotoUrls(null), [])
  assert.equal(googlePhotosNote(4, []), '4 Google photos we can use in the mockup')
  assert.equal(googlePhotosNote(4, photos), '4 Google photos we can use in the mockup')
  assert.equal(googlePhotosNote(null, []), '')
  assert.equal(formatLeadPhone('+12196966430'), '(219) 696-6430')
})

test('the card note and badge use the digest wording', () => {
  assert.equal(googlePhotosNote(1), '1 Google photo we can use in the mockup')
  assert.equal(googlePhotosNote(6), '6 Google photos we can use in the mockup')
  assert.equal(googlePhotosNote(0), '')
  assert.equal(googlePhotosNote(null, ['https://cdn.example/a.jpg']), '1 Google photo we can use in the mockup')
  assert.equal(leadTypeLine('Roofing contractor', 'industrial'), 'Roofing contractor · Industrial')
  assert.equal(leadGroupLabel('nonprofit'), 'Nonprofit')
  assert.equal(leadScoreBadge('Call First').label, 'Call First')
  assert.equal(leadScoreBadge('Good').label, 'Good')
  assert.equal(leadScoreBadge('Worth a look').label, 'Worth a look')
  assert.equal(leadScoreBadge('Long shot').label, 'Long shot')
  assert.equal(leadScoreBadge('Skip').label, 'Skip')
  assert.equal(leadScoreBadge('hot').label, 'Hot')
  assert.equal(leadScoreBadge(null).label, 'Unknown')
  assert.equal(siteCheckText(null), '')
  assert.equal(siteCheckText({}), '')
  assert.equal(siteCheckText({ site_check: 'Basic site' }), 'Basic site')
  assert.deepEqual(leadEmails('owner@acme.example', { emails: ['owner@acme.example'] }), [
    'owner@acme.example'
  ])
})
