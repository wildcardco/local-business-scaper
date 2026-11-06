import assert from 'node:assert/strict'
import test from 'node:test'
import {
  confidentChoice,
  confirmedMatch,
  fillIntakeFields,
  intakeErrorMessage,
  intakeMatches,
  intakeResultCopy,
  listingLookupFailure,
  mockupPlaceNeedsGoogleId,
  resolveListingLookup,
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
  assert.equal(matches[1]?.nameEquivalent, true)
  assert.equal(confidentChoice(matches), null)
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
  assert.equal(confidentChoice(matches), null)
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
  assert.match(copy.message, /does not agree/)
  assert.match(copy.message, /Nothing is filled in until you do/)
})

const googleSupply: IntakeListing = {
  placeId: 'ChIJleepsSupply9511',
  name: 'Leeps Supply',
  address: '7332 McConnell Ave, Lowell, IN 46356',
  city: 'Lowell',
  state: 'IN',
  website: 'https://www.leeps.com/',
  phone: '(219) 696-9511',
  category: 'Plumbing supply store'
}

test('a missing place id can load one name variant in the same town', () => {
  const lead = {
    name: 'Leeps Supply Company',
    city: 'Lowell',
    state: 'Indiana',
    website: '',
    phone: '',
    address: ''
  }
  const matches = intakeMatches(lead, [googleSupply, sameTownOtherName, otherTown])
  assert.deepEqual(matches.map(match => match.placeId), [googleSupply.placeId])
  assert.equal(matches[0]?.exactName, false)
  assert.equal(matches[0]?.nameEquivalent, true)
  assert.equal(confidentChoice(matches)?.placeId, googleSupply.placeId)
  const decision = resolveListingLookup({ savedPlaceId: null, matches })
  assert.equal(decision.action, 'load-confident')
  assert.equal(decision.placeId, googleSupply.placeId)
  assert.equal(resolveListingLookup({ savedPlaceId: 'studio_ryan_m1', matches }).action, 'load-confident')
})

test('a saved Google place id is loaded without searching for a different business', () => {
  const matches = intakeMatches(query, [googleSupply])
  const decision = resolveListingLookup({
    savedPlaceId: 'ChIJsavedplace0001',
    matches
  })
  assert.equal(decision.action, 'load-saved')
  assert.equal(decision.placeId, 'ChIJsavedplace0001')
  assert.notEqual(decision.placeId, googleSupply.placeId)
})

test('two name variants stay unselected until the user picks a place id', () => {
  const north: IntakeListing = {
    ...googleSupply,
    placeId: 'ChIJleepsNorth0008',
    name: 'Leeps Supply North',
    address: '10 North St, Lowell, IN 46356',
    phone: '219-555-0177',
    website: ''
  }
  const matches = intakeMatches(
    { name: 'Leeps Supply Company', city: 'Lowell', state: 'IN', website: '' },
    [googleSupply, north]
  )
  assert.equal(matches.length, 2)
  assert.equal(confidentChoice(matches), null)
  const waiting = resolveListingLookup({ savedPlaceId: '', matches })
  assert.equal(waiting.action, 'choose')
  assert.equal(waiting.placeId, null)
  assert.match(waiting.message, /Nothing is filled in until you do/)
  const picked = resolveListingLookup({ savedPlaceId: '', requestedPlaceId: north.placeId, matches })
  assert.equal(picked.action, 'load-confirmed')
  assert.equal(picked.placeId, north.placeId)
  const rejected = resolveListingLookup({
    savedPlaceId: '',
    requestedPlaceId: 'ChIJnotinthematchlist01',
    matches
  })
  assert.equal(rejected.action, 'rejected')
  assert.match(rejected.message, /Nothing was saved/)
})

test('a phone or street disagreement blocks a silent match, and a real disagreement is ranked below agreement', () => {
  const wrongPhone: IntakeListing = {
    ...googleSupply,
    placeId: 'ChIJleepsWrongphone1',
    phone: '219-555-0100'
  }
  const conflicted = intakeMatches({
    ...query,
    phone: '(219) 696-9511',
    address: '7332 McConnell Ave',
    website: ''
  }, [wrongPhone])
  assert.equal(conflicted.length, 1)
  assert.equal(conflicted[0]?.phoneConflict, true)
  assert.equal(conflicted[0]?.streetMatch, true)
  assert.equal(confidentChoice(conflicted), null)

  const agreed = intakeMatches({
    name: 'Leeps Supply Company',
    city: 'Lowell',
    state: 'Indiana',
    phone: '1-219-696-9511',
    address: '7332 McConnell Avenue',
    website: 'leeps.com'
  }, [googleSupply, closeName])
  assert.equal(agreed[0]?.placeId, googleSupply.placeId)
  assert.equal(agreed[0]?.phoneMatch, true)
  assert.equal(agreed[0]?.streetMatch, true)
  assert.equal(agreed[0]?.websiteMatch, true)
  assert.equal(confidentChoice(agreed), null)
})

test('no candidate and a provider failure leave the lead unchanged', () => {
  const matches = intakeMatches(query, [])
  const none = resolveListingLookup({ savedPlaceId: null, matches })
  assert.equal(none.action, 'none')
  assert.equal(none.placeId, null)
  assert.match(none.message, /Nothing was filled in/)
  assert.equal(listingLookupFailure('RAPIDAPI_KEY is not configured'), 'missing-key')
  assert.equal(listingLookupFailure('Local Business Data API error: 500'), 'search-failed')
  assert.equal(mockupPlaceNeedsGoogleId('studio_ryan_m1'), true)
  assert.equal(mockupPlaceNeedsGoogleId(''), true)
  assert.equal(mockupPlaceNeedsGoogleId(null), true)
  assert.equal(mockupPlaceNeedsGoogleId('ChIJsavedplace0001'), false)
})
