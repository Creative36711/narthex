import assert from 'node:assert/strict'
import '../packs/narrative/operations'
import { loadCampaign } from '../src/core/loader'
import { effects } from '../src/core/effects'
import type { EngineCtx } from '../src/core/context'

const basePath = 'https://manifest-order.test/campaign'
const payloads: Record<string, unknown> = {
  [`${basePath}/campaign.json`]: {
    id: 'manifest-order-probe',
    version: '1.0.0',
    engine_version: '0.1.0',
    min_engine: '0.1.0',
    package_format: 1,
    needs: [],
  },
  [`${basePath}/world.json`]: { regions: [] },
  [`${basePath}/manifest.json`]: {
    scenes: [],
    entities: [],
    rules: ['slow-rule.json', 'fast-rule.json'],
    encounters: ['slow-encounters.json', 'fast-encounters.json'],
    dialogues: [],
  },
  [`${basePath}/rules/slow-rule.json`]: { id: '10', label: 'First', conditions: [], effects: [] },
  [`${basePath}/rules/fast-rule.json`]: { id: '2', label: 'Second', conditions: [], effects: [] },
  [`${basePath}/encounters/slow-encounters.json`]: {
    encounter_tables: [{ id: '10', rolls: 1, entries: [] }],
  },
  [`${basePath}/encounters/fast-encounters.json`]: {
    encounter_tables: [{ id: '2', rolls: 1, entries: [] }],
  },
}

const originalFetch = globalThis.fetch

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  // Force reverse completion order so the historical async-mutation bug is deterministic.
  if (url.includes('slow-')) await new Promise((resolve) => setTimeout(resolve, 40))
  const body = payloads[url]
  if (body === undefined) return new Response('not found', { status: 404 })
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}) as typeof fetch

try {
  const campaign = await loadCampaign(basePath)
  assert.deepEqual(
    campaign.ruleOrder ?? Object.keys(campaign.rules),
    ['10', '2'],
    'rules must retain manifest order, including numeric-looking IDs',
  )
  assert.deepEqual(
    campaign.encounterOrder ?? Object.keys(campaign.encounters),
    ['10', '2'],
    'encounters must retain manifest order, including numeric-looking IDs',
  )

  const fired: string[] = []
  const engine = {
    campaign,
    state: { quests: {} },
    tryFireRule: (id: string) => { fired.push(id) },
  } as unknown as EngineCtx
  effects.checkRules.call(engine)
  assert.deepEqual(fired, ['10', '2'], 'checkRules must visit rules in manifest order')

  console.log('✓ manifest-order smoke: rules, encounters, and rule traversal follow manifest order under reversed fetch completion')
} finally {
  globalThis.fetch = originalFetch
}
