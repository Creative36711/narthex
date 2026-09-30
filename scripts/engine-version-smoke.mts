import assert from 'node:assert/strict'
import { canOfferEngineVersionRepair, setCurrentEngineRequirement } from '../src/editor/engineVersionRepair'
import type { CampaignMeta } from '../src/shared/types'
import { ENGINE_VERSION } from '../src/shared/versions'

const looksMislabelled = {
  id: 'quiet-harbor',
  title: 'Тихая Гавань',
  version: '1.0.0',
  engine_version: '1.0',
  min_engine: '1.0',
  package_format: 1,
  author: 'AI',
  description: '',
} as CampaignMeta
assert.equal(canOfferEngineVersionRepair(looksMislabelled, []), true)
assert.equal(canOfferEngineVersionRepair(looksMislabelled, ['missing reference']), false)
assert.equal(canOfferEngineVersionRepair({ ...looksMislabelled, version: '1.1.0' }, []), false)
assert.equal(canOfferEngineVersionRepair({ ...looksMislabelled, package_format: 2 }, []), false)

setCurrentEngineRequirement(looksMislabelled)
assert.equal(looksMislabelled.min_engine, ENGINE_VERSION)
assert.equal(looksMislabelled.engine_version, ENGINE_VERSION)
assert.equal(looksMislabelled.version, '1.0.0', 'campaign release version remains independent')
console.log(`engine-version-smoke: ALL GREEN (engine ${ENGINE_VERSION})`)
