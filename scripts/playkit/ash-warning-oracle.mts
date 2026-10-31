import assert from 'node:assert/strict'

const ASH_FLAG_WARNING_CODE = ['flag', 'written', 'never', 'read'].join('_')
export const ASH_WARNING_MESSAGES = [
  `${ASH_FLAG_WARNING_CODE}: флаг «market_raid_repelled» выставляется, но нигде не читается`,
  `${ASH_FLAG_WARNING_CODE}: флаг «raid_rumors» выставляется, но нигде не читается`,
  `${ASH_FLAG_WARNING_CODE}: флаг «tavern_chest_opened» выставляется, но нигде не читается`,
] as const

export const ASH_COVERED_SCENES = [
  'scene_barracks',
  'scene_forest_edge',
  'scene_gates_front',
  'scene_market',
  'scene_tavern_hall',
  'scene_temple',
] as const

export const ASH_UNCOVERED_SCENES = [
  'scene_gates_guardroom',
  'scene_mine_deep',
  'scene_mine_entrance',
  'scene_ravine_camp',
] as const

export type AshCampaignId = 'ash-of-caerden' | 'ash-of-caerden-adventure'

interface AshWarningReport {
  campaign?: { id?: unknown }
  verdict?: unknown
  problems?: unknown
  graph?: {
    counts?: Record<string, unknown>
    errors?: unknown
    warnings?: unknown
    reachability?: {
      scenes?: { total?: unknown }
      locations?: { total?: unknown }
    }
  }
  sweep?: {
    status?: unknown
    seeds?: unknown
    finals?: Record<string, unknown>
    endings?: unknown
    deaths?: Record<string, number>
  }
  coverage?: {
    visited?: unknown
    total?: unknown
    seen?: unknown
    uncovered?: unknown
  }
}

/** Strict report oracle for the two protected, warning-bearing Ash campaigns. */
export function assertAshWarningReport(value: unknown, campaignId: AshCampaignId): void {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value), `${campaignId}: report must be an object`)
  const report = value as AshWarningReport
  assert.equal(report.campaign?.id, campaignId, `${campaignId}: campaign identity`)
  assert.equal(report.verdict, 'failed', `${campaignId}: strict warning gate must remain failed`)
  assert.deepEqual(report.problems, ['warning не допускается: 3'], `${campaignId}: only the documented warning failure is expected`)
  assert.deepEqual(report.graph?.errors, [], `${campaignId}: static errors`)
  assert.deepEqual(report.graph?.warnings, ASH_WARNING_MESSAGES, `${campaignId}: exact warning set and order`)

  const counts = report.graph?.counts
  assert.equal(counts?.scenes, 10, `${campaignId}: scenes`)
  assert.equal(counts?.locations, 8, `${campaignId}: locations`)
  assert.equal(counts?.dialogues, 6, `${campaignId}: dialogues`)
  assert.equal(counts?.inkKnots, 21, `${campaignId}: Ink knots`)
  assert.equal(report.graph?.reachability?.scenes?.total, 10, `${campaignId}: reachable scene total`)
  assert.equal(report.graph?.reachability?.locations?.total, 8, `${campaignId}: reachable location total`)

  assert.equal(report.sweep?.status, 'ok', `${campaignId}: deterministic sweep status`)
  assert.equal(report.sweep?.seeds, 5, `${campaignId}: seed count`)
  assert.deepEqual(report.sweep?.finals, { death: 5 }, `${campaignId}: seed outcomes`)
  assert.deepEqual(report.sweep?.endings, ['ending_ashes'], `${campaignId}: ending`)
  assert.deepEqual(report.sweep?.deaths, {
    'death: Смерть от истощения: жажда на нуле.': 1,
    'death: Вы пали в бою.': 4,
  }, `${campaignId}: one thirst death and four combat deaths`)

  assert.equal(report.coverage?.visited, 6, `${campaignId}: visited scenes`)
  assert.equal(report.coverage?.total, 10, `${campaignId}: reachable scenes`)
  assert.deepEqual(report.coverage?.seen, ASH_COVERED_SCENES, `${campaignId}: covered scene set`)
  assert.deepEqual(report.coverage?.uncovered, ASH_UNCOVERED_SCENES, `${campaignId}: uncovered scene set`)
}

/** Assert the same RC-1 warning oracle from cf-play's human-readable output. */
export function assertAshWarningText(output: string, context: string): void {
  const expected = [
    '✗ проверка не пройдена',
    '- ✗ warning не допускается: 3',
    '10 сцен · 8 локаций · 6 диалогов · 21 узлов ink',
    'ошибок 0 · предупреждений 3',
    ...ASH_WARNING_MESSAGES,
    `seed'ов 5 · исходы {"death":5}`,
    'концовки: ending_ashes',
    'посещено 6 из 10 достижимых сцен',
    'не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp',
  ]
  for (const fragment of expected) {
    assert.ok(output.includes(fragment), `${context}: missing exact Ash oracle fragment «${fragment}»`)
  }
}

/** `example` prints its documented reference row in addition to the report. */
export function assertAshExampleText(output: string, context: string): void {
  assertAshWarningText(output, context)
  const reference = 'Эталон: 10 сцен · 8 локаций · 6 диалогов · 21 ink · ошибок 0 · предупреждений 3 · смертей 5 · покрытие 6 из 10'
  assert.ok(output.includes(reference), `${context}: missing documented reference row «${reference}»`)
}
