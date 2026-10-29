import assert from 'node:assert/strict'
import { analyzeCampaign } from './analyze'
import { NARRATIVE_CODES } from './narrative-codes'

const SIMPLE_FLAGS = ['case136_read', 'shaft_roped', 'vein_hidden']
const TYPED_FLAG = 'typed_flag_read'
const WRITE_ONLY_FLAG = 'write_only_fixture'
const WARNING_CODE = NARRATIVE_CODES.flagWrittenNeverRead.code

function makeFixture(includeWriteOnly = false) {
  const flags = [...SIMPLE_FLAGS, TYPED_FLAG, ...(includeWriteOnly ? [WRITE_ONLY_FLAG] : [])]
  return {
    meta: {
      id: 'analyze-flags-smoke',
      title: 'Analyzer flag conditions fixture',
      version: '1',
      flags: flags.map((id) => ({ id })),
      starting_scene: 'scene_fixture',
      starting_location: 'location_fixture',
      starting_region: 'region_fixture',
      endings: [],
    },
    scenes: {
      scene_fixture: {
        id: 'scene_fixture',
        label: 'Fixture scene',
        location: 'location_fixture',
        navigation: [{ id: 'exit', open_map: true }],
        states: [
          { id: 'case', condition: { flag: 'case136_read' } },
          { id: 'shaft', condition: { flag: 'shaft_roped' } },
          { id: 'typed', condition: { type: 'flag_set', flag: TYPED_FLAG } },
        ],
        slots: [{ id: 'vein', condition: { not_flag: 'vein_hidden' } }],
        effects: includeWriteOnly ? [{ type: 'set_flag', flag: WRITE_ONLY_FLAG }] : [],
      },
    },
    world: {
      regions: [{
        id: 'region_fixture',
        locations: [{
          id: 'location_fixture',
          scenes: ['scene_fixture'],
          arrival_scene: 'scene_fixture',
          travel_connections: [],
        }],
      }],
    },
    dialogues: {},
    entities: {},
    encounters: {},
    quests: {},
    rules: {},
    arenas: {},
  }
}

const positive = analyzeCampaign(makeFixture())
const positiveFlagWarnings = positive.findings.filter((finding) => finding.code === WARNING_CODE)
assert.equal(positive.counts.flagsWritten, 4)
assert.equal(positive.counts.flagsRead, 4)
assert.deepEqual(positiveFlagWarnings, [], 'flag / not_flag scene conditions must count as reads')

const negative = analyzeCampaign(makeFixture(true))
const negativeFlagWarnings = negative.findings.filter((finding) => finding.code === WARNING_CODE)
assert.equal(negative.counts.flagsWritten, 5)
assert.equal(negative.counts.flagsRead, 4)
assert.equal(negativeFlagWarnings.length, 1, 'a write-only flag must still produce one warning')
assert.equal(negativeFlagWarnings[0]?.message, 'флаг «write_only_fixture» выставляется, но нигде не читается')

console.log('✓ simple condition.flag, condition.not_flag, and typed flag_set are counted as reads')
console.log(`✓ negative fixture preserves ${WARNING_CODE}: ${negativeFlagWarnings[0]!.message}`)
