#!/usr/bin/env node
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { declaredAbsences } from './absence-policy.mjs'
import {
  auditKnownAbsences,
  loadObservationRegistry,
  splitCampaignResponseFailures,
} from './observation-policy.mjs'

const campaignId = 'ash-of-caerden'
const registry = loadObservationRegistry()
const entries = registry.knownAbsences.filter((candidate) => candidate.campaignId === campaignId)
const entry = entries[0]
assert.ok(entry, `expected a registered known-absence for ${campaignId}`)

const observations = entries.map((candidate) => {
  const expected = candidate.expected.preview
  const reason = expected.status >= 400
    ? `HTTP ${expected.status}`
    : expected.contentType.startsWith('image/')
      ? 'image response'
      : `expected image/*, received ${expected.contentType}`
  return { path: candidate.path, status: expected.status, contentType: expected.contentType, reason }
})
const audited = auditKnownAbsences({
  campaignId,
  declaredPaths: declaredAbsences(resolve('public/campaigns'), campaignId),
  observations,
  registry,
  responseMode: 'preview',
})
assert.equal(audited.registeredCount, entries.length, 'all exact registered responses remain allowed')
assert.deepEqual(audited.findings, [])
const auditedEntry = audited.observations.find((observation) => observation.path === entry.path)
assert.ok(auditedEntry, `expected an audited response for ${entry.path}`)

const expectedResponse = {
  path: entry.path,
  status: entry.expected.preview.status,
  contentType: entry.expected.preview.contentType,
  reason: auditedEntry.reason,
  url: `http://127.0.0.1/campaigns/${campaignId}/${entry.path}`,
}
const failuresByCase = {
  registered: expectedResponse,
  'status-500': { ...expectedResponse, status: 500, reason: 'HTTP 500' },
  'wrong-mime': {
    ...expectedResponse,
    contentType: 'application/json',
    reason: 'expected image/*, received application/json',
  },
}
const selected = process.argv[2] || 'all'
const caseNames = selected === 'all' ? Object.keys(failuresByCase) : [selected]
assert.ok(caseNames.every((name) => failuresByCase[name]), `unknown case ${selected}; use all, registered, status-500, or wrong-mime`)

const results = caseNames.map((name) => {
  const failure = failuresByCase[name]
  const partition = splitCampaignResponseFailures({
    campaignId,
    failures: [failure],
    knownAbsences: audited.observations,
  })
  const productionRc = partition.blocking.length > 0 ? 1 : 0
  const pathOnlyWouldSuppress = new Set([entry.path]).has(failure.path)
  const expectedRc = name === 'registered' ? 0 : 1
  console.log(`RESPONSE-FILTER-PROBE PASS case=${name} pathOnlyWouldSuppress=${pathOnlyWouldSuppress}; blocking=${partition.blocking.length}; nonBlocking=${partition.nonBlocking.length}; production-rc=${productionRc}; record=${failure.status} ${failure.contentType}; path=${campaignId}/${entry.path}`)
  assert.equal(productionRc, expectedRc, `${name} must produce the real response filter's expected rc`)
  assert.equal(partition.blocking.length, expectedRc, `${name} blocking count must determine rc`)
  return { name, productionRc, blocking: partition.blocking.length }
})

// The process exit is the production blocking result, not an unconditional
// negative-test exit. Run each case separately to observe its real rc.
process.exitCode = results.some((result) => result.blocking > 0) ? 1 : 0
