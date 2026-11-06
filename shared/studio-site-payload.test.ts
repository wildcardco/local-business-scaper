import assert from 'node:assert/strict'
import test from 'node:test'
import { studioSiteResearch } from './studio-site-payload'

const leeps = {
  website: 'https://www.leeps.com/',
  phone: '219-696-1000',
  address: '100 Washington St',
  city: 'Lowell',
  state: 'IN',
  zip: '46356',
  category: 'Building materials supplier',
  rating: 4.6,
  reviewCount: 22
}

test('manual generation sends the same website, phone, and street address as the email lead', () => {
  const manual = studioSiteResearch(leeps)
  const emailLead = studioSiteResearch({ ...leeps })

  assert.deepEqual(manual, emailLead)
  assert.equal(manual.website, 'https://www.leeps.com/')
  assert.equal(manual.phone, '219-696-1000')
  assert.equal(manual.address, '100 Washington St, Lowell, IN 46356')
  assert.equal(manual.category, 'Building materials supplier')
  assert.equal(manual.rating, 4.6)
  assert.equal(manual.review_count, 22)
})

test('a typed website without a scheme is still sent for the existing site check', () => {
  const fields = studioSiteResearch({
    website: 'www.leeps.com',
    city: 'Lowell',
    state: 'Indiana'
  })

  assert.equal(fields.website, 'https://www.leeps.com/')
  assert.equal(fields.phone, null)
  assert.equal(fields.address, 'Lowell, Indiana')
})

test('a full listing address is not doubled, and a blank website stays blank', () => {
  const fields = studioSiteResearch({
    website: '   ',
    phone: '',
    address: '100 Washington St, Lowell, IN 46356',
    city: 'Lowell',
    state: 'IN',
    zip: '46356'
  })

  assert.equal(fields.website, null)
  assert.equal(fields.phone, null)
  assert.equal(fields.address, '100 Washington St, Lowell, IN 46356')
})

test('a separate ZIP is appended when the street line does not already include it', () => {
  const fields = studioSiteResearch({
    website: 'https://www.leeps.com/store',
    address: '100 Washington St, Lowell, IN',
    city: 'Lowell',
    state: 'IN',
    zip: '46356'
  })

  assert.equal(fields.website, 'https://www.leeps.com/store')
  assert.equal(fields.address, '100 Washington St, Lowell, IN 46356')
})
