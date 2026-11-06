import assert from 'node:assert/strict'
import test from 'node:test'
import { dedupeLeadsByPlace } from './studio-sync-leads.ts'
import { mergeLeadSite, nextBusinessSite, readLeadSite, siteContract } from './site-discovery.ts'
import { pageChoiceLead } from './website-intake.ts'

const generic = ['Home', 'About', 'Services', 'Contact']

test('a website alone does not invent a page list', () => {
  const site = readLeadSite({
    website: 'https://www.leeps.com/',
    business_name: 'Leeps Supply Company'
  })
  assert.equal(site.website, 'https://www.leeps.com/')
  assert.equal(site.discovery.status, 'unavailable')
  assert.equal(site.discovery.navigation, null)
  assert.equal(site.discovery.footer, null)
  assert.equal(site.discovery.pages, null)
  assert.equal(site.discovery.content, null)
  for (const name of generic) {
    assert.equal(JSON.stringify(site.discovery).includes(name), false)
  }
})

test('observed navigation, footer, pages, and content are kept', () => {
  const site = readLeadSite({
    website: 'leeps.com',
    site_navigation: ['Shop products', 'Featured brands'],
    footer: ['Locations', 'Privacy'],
    page_structure: [
      { name: 'Shop products', path: '/shop' },
      { title: 'Featured brands', url: '/brands' }
    ],
    site_content: 'Building materials in Lowell.'
  })
  assert.equal(site.website, 'https://leeps.com/')
  assert.equal(site.discovery.status, 'observed')
  assert.deepEqual(site.discovery.navigation, ['Shop products', 'Featured brands'])
  assert.deepEqual(site.discovery.footer, ['Locations', 'Privacy'])
  assert.deepEqual(site.discovery.pages, [
    { name: 'Shop products', path: '/shop' },
    { name: 'Featured brands', path: '/brands' }
  ])
  assert.equal(site.discovery.content, 'Building materials in Lowell.')
})

test('a newer data-table row does not drop the website or discovery from the other row', () => {
  const current = {
    id: 4989,
    place_id: 'ChIJleeps',
    business_name: 'Leeps Supply Company',
    mockup_url: 'https://wildcard-mockup-ryan-leeps.vercel.app',
    updatedAt: '2026-11-06T18:00:00.000Z'
  }
  const inspected = {
    id: 1200,
    place_id: 'ChIJleeps',
    business_name: 'Leeps Supply Company',
    mockup_url: 'https://wildcard-mockup-ryan-leeps-old.vercel.app',
    updatedAt: '2026-10-01T00:00:00.000Z',
    website: 'https://www.leeps.com/',
    navigation: ['Shop products', 'Featured brands'],
    footer: ['Locations']
  }
  const merged = dedupeLeadsByPlace([current, inspected])
  const row = merged.rows[0]
  assert.equal(row?.mockup_url, current.mockup_url)
  assert.equal(row?.website, 'https://www.leeps.com/')
  const discovery = row?.site_discovery as { status: string, navigation: string[] | null, pages: unknown }
  assert.equal(discovery.status, 'observed')
  assert.deepEqual(discovery.navigation, ['Shop products', 'Featured brands'])
  assert.equal(discovery.pages, null)

  const kept = mergeLeadSite(
    { website: 'https://www.leeps.com/', site_discovery: discovery },
    { website: null }
  )
  assert.equal(kept.website, 'https://www.leeps.com/')
  assert.equal((kept.site_discovery as { status: string }).status, 'observed')
})

test('loading a data-table lead fills a blank website and does not wipe a stored one', () => {
  const filled = nextBusinessSite(
    { website: null, siteDiscovery: null },
    {
      website: 'https://www.leeps.com/',
      navigation: ['Shop products'],
      footer: ['Locations'],
      pages: [{ name: 'Shop products', path: '/shop' }],
      content: 'Building materials in Lowell.'
    }
  )
  assert.equal(filled.nextWebsite, 'https://www.leeps.com/')
  const stored = JSON.parse(String(filled.nextDiscovery)) as { status: string, pages: { name: string }[] }
  assert.equal(stored.status, 'observed')
  assert.equal(stored.pages[0]?.name, 'Shop products')

  const kept = nextBusinessSite(
    { website: 'https://typed.example/', siteDiscovery: filled.nextDiscovery },
    { website: 'https://other.example/', navigation: ['Replacement'] }
  )
  assert.equal(kept.nextWebsite, 'https://typed.example/')
  assert.equal(kept.nextDiscovery, filled.nextDiscovery)
  assert.equal(kept.changed, false)

  const blank = nextBusinessSite({ website: 'https://typed.example/' }, { business_name: 'Leeps' })
  assert.equal(blank.nextWebsite, 'https://typed.example/')
  assert.equal(blank.nextDiscovery, null)
  assert.equal(blank.changed, false)
  for (const name of generic) {
    assert.equal(JSON.stringify(blank).includes(name), false)
  }
})

test('one-page and multi-page both keep the website and do not add pages', () => {
  const contract = siteContract({ website: 'https://www.leeps.com/', stored: null })
  const lead = {
    business_name: 'Leeps Supply Company',
    phone: '219-696-1000',
    address: '100 Washington St, Lowell, IN 46356',
    ...contract
  }
  const one = pageChoiceLead(lead, 'one_page')
  const multi = pageChoiceLead(lead, 'multi_page')
  assert.equal(one.website, 'https://www.leeps.com/')
  assert.equal(one.site_discovery.status, 'unavailable')
  assert.equal(one.site_discovery.pages, null)
  assert.equal(one.page_intent, 'one_page')
  assert.equal(multi.website, 'https://www.leeps.com/')
  assert.equal(multi.site_discovery.status, 'unavailable')
  assert.equal(multi.site_discovery.pages, null)
  assert.equal(multi.build_mode, 'web_stack')
  assert.equal('page_intent' in multi, false)
  for (const name of generic) {
    assert.equal(JSON.stringify(multi.site_discovery).includes(name), false)
  }
})
