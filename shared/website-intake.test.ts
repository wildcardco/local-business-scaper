import assert from 'node:assert/strict'
import test from 'node:test'
import { leadPayloadForBuild, BUILD_MODE_WEB_STACK } from './web-stack.ts'
import {
  SITE_PROFILE_UNAVAILABLE,
  confirmedWebsiteMatch,
  onePageSiteFields,
  outboundLeadPayload,
  pageChoiceLead,
  pageChoiceRequest,
  parseWebsiteIntakeUrl,
  websiteInspection,
  websiteIntakeMatches
} from './website-intake.ts'

const leepsListing = {
  placeId: 'ChIJleeps',
  name: 'Leeps Supply Company',
  address: '100 Washington St, Lowell, IN 46356',
  city: 'Lowell',
  state: 'IN',
  website: 'https://www.leeps.com/',
  phone: '219-696-1000',
  category: 'Building materials supplier'
}

test('a pasted website URL is accepted and a non-URL is refused', () => {
  const pasted = parseWebsiteIntakeUrl('https://www.leeps.com/')
  assert.equal(pasted.ok, true)
  if (pasted.ok) {
    assert.equal(pasted.url, 'https://www.leeps.com/')
    assert.equal(pasted.host, 'leeps.com')
  }

  const bare = parseWebsiteIntakeUrl('leeps.com')
  assert.equal(bare.ok, true)
  if (bare.ok) assert.equal(bare.host, 'leeps.com')

  const empty = parseWebsiteIntakeUrl('  ')
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.match(empty.message, /Enter the current website/)

  const junk = parseWebsiteIntakeUrl('not a website')
  assert.equal(junk.ok, false)
  if (!junk.ok) assert.match(junk.message, /Nothing was filled in/)
})

test('URL-first intake keeps the listing on that website and leaves a different business out', () => {
  const matches = websiteIntakeMatches('leeps.com', [
    leepsListing,
    {
      placeId: 'ChIJhardware',
      name: 'Leeps Hardware',
      city: 'Lowell',
      state: 'IN',
      website: 'https://leepshardware.example/'
    },
    {
      placeId: 'ChIJother',
      name: 'Leeps Supply Company',
      website: 'https://other.example/'
    }
  ])

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.placeId, 'ChIJleeps')
  assert.equal(matches[0]?.websiteMatch, true)
  assert.equal(confirmedWebsiteMatch(matches, 'ChIJleeps')?.name, 'Leeps Supply Company')
  assert.equal(confirmedWebsiteMatch(matches, null), null)
  assert.equal(confirmedWebsiteMatch(matches, 'ChIJhardware'), null)
})

test('inspection reports the Google listing and does not claim the page was read', () => {
  const parsed = parseWebsiteIntakeUrl('https://www.leeps.com/')
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const matches = websiteIntakeMatches(parsed.host, [leepsListing])
  const found = websiteInspection({ url: parsed.url, host: parsed.host, matches })
  assert.equal(found.listingStatus, 'matches')
  assert.equal(found.siteProfile, 'unavailable')
  assert.equal(found.siteProfileReason, SITE_PROFILE_UNAVAILABLE)
  assert.match(found.siteProfileReason, /does not send a site profile/)
  assert.doesNotMatch(found.message, /navigation was/i)
  assert.equal(found.matches[0]?.phone, '219-696-1000')

  const missed = websiteInspection({ url: parsed.url, host: parsed.host, matches: [] })
  assert.equal(missed.listingStatus, 'none')
  assert.equal(missed.matches.length, 0)
  assert.match(missed.message, /Nothing was filled in/)
  assert.equal(missed.siteProfile, 'unavailable')
})

test('a confirmed website generates a one-page request with the site and the street address', () => {
  const sent = onePageSiteFields({
    website: 'https://www.leeps.com/',
    phone: '219-696-1000',
    address: '100 Washington St',
    city: 'Lowell',
    state: 'IN',
    zip: '46356',
    category: 'Building materials supplier',
    rating: 4.6,
    reviewCount: 22
  }, 'one_page')

  assert.equal(sent.website, 'https://www.leeps.com/')
  assert.equal(sent.phone, '219-696-1000')
  assert.equal(sent.address, '100 Washington St, Lowell, IN 46356')
  assert.equal(sent.page_intent, 'one_page')
  assert.equal('build_mode' in sent, false)
})

test('a URL with no listing still requests one page and does not invent a phone or street', () => {
  const sent = onePageSiteFields({ website: 'www.leeps.com' }, 'one_page')
  assert.equal(sent.website, 'https://www.leeps.com/')
  assert.equal(sent.phone, null)
  assert.equal(sent.address, null)
  assert.equal(sent.page_intent, 'one_page')
})

test('manual generation and web stack do not receive the one-page flag', () => {
  const site = {
    website: 'https://www.leeps.com/',
    phone: '219-696-1000',
    address: '100 Washington St, Lowell, IN 46356'
  }
  const manual = outboundLeadPayload(site, {})
  assert.equal('page_intent' in manual, false)

  const html = outboundLeadPayload(site, { pageIntent: 'one_page', buildMode: 'html' })
  assert.equal(html.page_intent, 'one_page')

  const stack = outboundLeadPayload(site, { pageIntent: 'one_page', buildMode: BUILD_MODE_WEB_STACK })
  assert.equal('page_intent' in stack, false)
  assert.equal(stack.website, 'https://www.leeps.com/')
  const built = leadPayloadForBuild(stack, BUILD_MODE_WEB_STACK)
  assert.equal(built.build_mode, 'web_stack')
  assert.equal('page_intent' in built, false)
  assert.equal(built.website, 'https://www.leeps.com/')
})

test('one-page and multi-page stay on different workflows', () => {
  const site = {
    website: 'https://www.leeps.com/',
    phone: '219-696-1000',
    address: '100 Washington St, Lowell, IN 46356',
    category: 'Building materials supplier'
  }

  const one = pageChoiceLead(site, 'one_page')
  assert.equal(one.page_intent, 'one_page')
  assert.equal(one.website, 'https://www.leeps.com/')
  assert.equal(one.address, '100 Washington St, Lowell, IN 46356')
  assert.equal('build_mode' in one, false)
  assert.deepEqual(pageChoiceRequest('one_page'), { pageIntent: 'one_page' })
  assert.equal('buildMode' in pageChoiceRequest('one_page'), false)

  const multi = pageChoiceLead(site, 'multi_page')
  assert.equal(multi.build_mode, 'web_stack')
  assert.equal(multi.stack, 'react-vite-tailwind')
  assert.equal(multi.agent_model, 'grok-4.7')
  assert.equal(multi.on_demand_fallback, false)
  assert.equal(multi.website, 'https://www.leeps.com/')
  assert.equal(multi.phone, '219-696-1000')
  assert.equal(multi.address, '100 Washington St, Lowell, IN 46356')
  assert.equal('page_intent' in multi, false)
  assert.deepEqual(pageChoiceRequest('multi_page'), { buildMode: 'web_stack' })
  assert.equal('pageIntent' in pageChoiceRequest('multi_page'), false)

  assert.deepEqual(pageChoiceRequest('a full website'), { pageIntent: 'one_page' })
})
