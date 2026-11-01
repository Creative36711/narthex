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
const expected = entry.expected.preview
const reason = auditedEntry.reason

const expectedResponse = {
  path: entry.path,
  status: expected.status,
  contentType: expected.contentType,
  reason,
  url: `http://127.0.0.1/campaigns/${campaignId}/${entry.path}`,
}
const exact = splitCampaignResponseFailures({
  campaignId,
  failures: [expectedResponse],
  knownAbsences: audited.observations,
})
assert.equal(exact.blocking.length, 0, 'the exact registered 200 text/html response stays allowed')

// An unrelated HTTP 500 at the same known path was hidden by the former
// `!knownAbsencePaths.has(failure.path)` filter. It must now be blocking.
const unrelated = { ...expectedResponse, status: 500, reason: 'HTTP 500' }
const pathOnlyWouldSuppress = new Set([entry.path]).has(unrelated.path)
const rejected = splitCampaignResponseFailures({
  campaignId,
  failures: [unrelated],
  knownAbsences: audited.observations,
})
assert.equal(pathOnlyWouldSuppress, true, 'demonstrate the prior path-only blind spot')
assert.equal(rejected.blocking.length, 1, 'unrelated response on the known path must be rejected')

console.log(`NEGATIVE-PROBE PASS: path-only-suppressed=${pathOnlyWouldSuppress}; exact-known=allowed; unrelated status=500 on ${campaignId}/${entry.path} => blocking=${rejected.blocking.length}; intentional exit rc=1`)
process.exitCode = 1
