import assert from 'node:assert/strict'
import test from 'node:test'
import { detailsFromPlaceListing } from './place-lookup.ts'

test('only returned strings are kept', () => {
  assert.deepEqual(detailsFromPlaceListing({
    name: 'Timberwerks',
    city: '  Lowell ',
    state: '',
    website: 'https://timberwerks.example',
    phone_number: '',
    phones: ['219-555-0100'],
    emails: ['', 'owner@timberwerks.example'],
    full_address: '10 Main St, Lowell, IN 46356',
    category: 'Cabinet maker'
  }), {
    name: 'Timberwerks',
    city: 'Lowell',
    website: 'https://timberwerks.example',
    phone: '219-555-0100',
    email: 'owner@timberwerks.example',
    address: '10 Main St, Lowell, IN 46356',
    category: 'Cabinet maker'
  })
})

test('a missing town stays missing even when the street address names one', () => {
  assert.deepEqual(detailsFromPlaceListing({
    full_address: '10 Main St, Lowell, IN 46356',
    city: '   ',
    state: 'ChIJthisisaplaceidvalue'
  }), {
    address: '10 Main St, Lowell, IN 46356'
  })
})

test('an empty listing adds nothing', () => {
  assert.deepEqual(detailsFromPlaceListing(null), {})
  assert.deepEqual(detailsFromPlaceListing({}), {})
})
