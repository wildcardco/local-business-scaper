import assert from 'node:assert/strict'
import test from 'node:test'
import {
  confirmedMatch,
  fillIntakeFields,
  intakeErrorMessage,
  intakeMatches,
  intakeResultCopy,
  type IntakeListing
} from './intake-lookup.ts'

const query = {
  name: 'Leeps Supply Company',
  city: 'Lowell',
  state: 'Indiana',
  website: 'https://www.leeps.com/'
}

const exact: IntakeListing = {
  placeId: 'ChIJleepsExact0001',
  name: 'Leeps Supply Company',
  address: '100 Washington St, Lowell, IN 46356',
  city: 'Lowell',
  state: 'IN',
  website: 'https://leeps.com/about',
  phone: '219-696-1000',
  category: 'Building materials supplier'
}

const sameTownOtherName: IntakeListing = {
  placeId: 'ChIJleepsOther0002',
  name: 'Leeps Hardware',
  address: '5 Main St, Lowell, IN 46356',
  city: 'Lowell',
  state: 'Indiana',
  website: 'https://leepshardware.example',
  phone: '219-555-0199',
  category: 'Hardware store'
}

const otherTown: IntakeListing = {
  placeId: 'ChIJleepsChicago003',
  name: 'Leeps Supply Company',
  address: '1 Lake Shore Dr, Chicago, IL 60601',
  city: 'Chicago',
  state: 'IL',
  website: 'https://chicago.example',
  phone: '312-555-0100',
  category: 'Wholesaler'
}

const closeName: IntakeListing = {
  placeId: 'ChIJleepsClose0004',
  name: 'Leeps Supply',
  address: '200 Mill St, Lowell, IN 46356',
  city: 'Lowell',
  state: 'IN',
  website: 'https://other.example',
  phone: '219-555-0142',
  category: 'Supplier'
}

test('an exact name in the town is selectable and a different business is not chosen for you', () => {
  const matches = intakeMatches(query, [sameTownOtherName, otherTown, closeName, exact])
  assert.deepEqual(matches.map(match => match.placeId), [exact.placeId, closeName.placeId])
  assert.equal(matches[0]?.exactName, true)
  assert.equal(matches[0]?.websiteMatch, true)
  assert.equal(matches[1]?.exactName, false)
  assert.equal(confirmedMatch(matches, null), null)
  assert.equal(confirmedMatch(matches, ''), null)
  assert.equal(confirmedMatch(matches, exact.placeId)?.phone, '219-696-1000')
  assert.equal(confirmedMatch(matches, sameTownOtherName.placeId), null)
})

test('two exact listings stay selectable and neither is applied without its place id', () => {
  const second: IntakeListing = {
    ...exact,
    placeId: 'ChIJleepsExact0005',
    address: '400 Oak St, Lowell, IN 46356',
    phone: '219-696-2000',
    website: 'https://www.leeps.com/'
  }
  const matches = intakeMatches(query, [exact, second])
  assert.equal(matches.length, 2)
  assert.equal(matches.every(match => match.exactName), true)
  assert.equal(confirmedMatch(matches, null), null)
  assert.equal(confirmedMatch(matches, second.placeId)?.address, '400 Oak St, Lowell, IN 46356')
  assert.notEqual(confirmedMatch(matches, second.placeId)?.phone, exact.phone)
})

test('a website match can show a close name, and a wrong website does not win by itself', () => {
  const siteOnly: IntakeListing = {
    placeId: 'ChIJleepsSite00006',
    name: 'Leeps Building Supply',
    address: '9 Commerce Dr, Cedar Lake, IN 46303',
    city: 'Cedar Lake',
    state: 'Indiana',
    website: 'https://www.leeps.com/',
    phone: '219-374-0000',
    category: 'Building supply store'
  }
  const matches = intakeMatches({ ...query, city: 'Lowell' }, [siteOnly, sameTownOtherName])
  assert.deepEqual(matches.map(match => match.placeId), [siteOnly.placeId])
  assert.equal(matches[0]?.exactName, false)
  assert.equal(matches[0]?.websiteMatch, true)
  assert.equal(confirmedMatch(matches, null), null)
})

test('choosing a match fills returned details and keeps a typed value the listing does not have', () => {
  const matches = intakeMatches(query, [exact, closeName])
  const chosen = confirmedMatch(matches, exact.placeId)
  assert.ok(chosen)
  const filled = fillIntakeFields({
    name: 'Leeps Supply Company',
    website: 'https://www.leeps.com/',
    phone: '',
    email: 'owner@leeps.com',
    address: '',
    city: 'Lowell',
    state: 'Indiana',
    category: 'my note'
  }, {
    name: 'Leeps Supply Company',
    website: 'https://www.leeps.com/',
    phone: '219-696-1000',
    address: '100 Washington St, Lowell, IN 46356',
    city: 'Lowell',
    state: 'IN',
    category: 'Building materials supplier'
  })
  assert.equal(filled.phone, '219-696-1000')
  assert.equal(filled.address, '100 Washington St, Lowell, IN 46356')
  assert.equal(filled.city, 'Lowell')
  assert.equal(filled.state, 'IN')
  assert.equal(filled.category, 'Building materials supplier')
  assert.equal(filled.website, 'https://www.leeps.com/')
  assert.equal(filled.email, 'owner@leeps.com')
  assert.equal(confirmedMatch(matches, closeName.placeId)?.phone, closeName.phone)
  assert.notEqual(filled.phone, closeName.phone)
})

test('no listing match explains that nothing was filled in', () => {
  const matches = intakeMatches(query, [sameTownOtherName, otherTown])
  assert.equal(matches.length, 0)
  const copy = intakeResultCopy(query, matches)
  assert.equal(copy.status, 'none')
  assert.match(copy.message, /No listing matched Leeps Supply Company in Lowell, Indiana/)
  assert.match(copy.message, /Nothing was filled in/)
  assert.equal(confirmedMatch(matches, sameTownOtherName.placeId), null)
})

test('lookup errors stay on the form and do not describe a chosen business', () => {
  assert.match(intakeErrorMessage('need-town'), /city or state/)
  assert.match(intakeErrorMessage('missing-key'), /not configured/)
  assert.match(intakeErrorMessage('search-failed'), /did not answer/)
  assert.match(intakeErrorMessage('details-failed'), /did not load/)
  for (const kind of ['need-town', 'missing-key', 'search-failed', 'details-failed', 'details-empty'] as const) {
    assert.match(intakeErrorMessage(kind), /Nothing was filled in/)
  }
  const copy = intakeResultCopy(query, intakeMatches(query, [closeName]))
  assert.equal(copy.status, 'matches')
  assert.match(copy.message, /No exact name match/)
})
