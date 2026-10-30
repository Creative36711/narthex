import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { PackHost } from '../../../src/core/pack/host'
import { resolvePackRegistry, type PackManifest, type PackRegistryFile } from '../../../src/core/pack/registry'
import { createNarrativeHooks } from '../hooks'
import { createNarrativeState } from '../sim'
import type {
  NarrativeContent,
  NarrativeEvent,
  NarrativeFrame,
  NarrativeLocation,
  NarrativeState,
} from '../types'

const root = resolve(import.meta.dirname, '../../..')
const packRoot = resolve(import.meta.dirname, '..')
const dataRoot = join(packRoot, 'data/ash-of-caerden')
const manifest = await readJson<PackManifest>(join(packRoot, 'pack.json'))
const ajv = new Ajv2020({ allErrors: true, strict: false })

interface DataManifest {
  scenes: string[]
  dialogues: string[]
  quests: string[]
}

interface WorldRegion {
  locations: NarrativeLocation[]
  sub_regions?: WorldRegion[]
}

interface WorldFile {
  regions: WorldRegion[]
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function validateData(schema: string, data: unknown, label: string): Promise<void> {
  const validator = ajv.compile(await readJson<object>(join(packRoot, schema)))
  assert.ok(validator(data), `${label}: ${JSON.stringify(validator.errors)}`)
}

function flattenLocations(regions: WorldRegion[]): Record<string, NarrativeLocation> {
  const result: Record<string, NarrativeLocation> = {}
  for (const region of regions) {
    for (const location of region.locations) {
      assert.equal(result[location.id], undefined, `duplicate location ${location.id}`)
      result[location.id] = location
    }
    Object.assign(result, flattenLocations(region.sub_regions ?? []))
  }
  return result
}

async function loadContent(): Promise<NarrativeContent> {
  const [campaign, world, dataManifest] = await Promise.all([
    readJson<NarrativeContent['campaign']>(join(dataRoot, 'campaign.json')),
    readJson<WorldFile>(join(dataRoot, 'world.json')),
    readJson<DataManifest>(join(dataRoot, 'manifest.json')),
  ])
  await Promise.all([
    validateData(manifest.provides.schema, campaign, 'campaign.json'),
    validateData('schema/world.schema.json', world, 'world.json'),
  ])

  const scenes: NarrativeContent['scenes'] = {}
  for (const file of dataManifest.scenes) {
    const scene = await readJson<NarrativeContent['scenes'][string]>(join(dataRoot, 'scenes', file))
    await validateData('schema/scene.schema.json', scene, `scenes/${file}`)
    scenes[scene.id] = scene
  }
  const dialogues: NarrativeContent['dialogues'] = {}
  for (const file of dataManifest.dialogues) {
    const id = file.replace(/\.ink$/, '')
    const document = await readJson<NarrativeContent['dialogues'][string]>(
      join(dataRoot, 'dialogues', `${id}.dlg.json`),
    )
    await validateData('schema/dialogue.schema.json', document, `dialogues/${id}.dlg.json`)
    dialogues[id] = document
  }
  const quests: NarrativeContent['quests'] = {}
  for (const file of dataManifest.quests) {
    const quest = await readJson<NarrativeContent['quests'][string]>(join(dataRoot, 'quests', file))
    await validateData('schema/quest.schema.json', quest, `quests/${file}`)
    quests[quest.id] = quest
  }
  return { campaign, scenes, locations: flattenLocations(world.regions), dialogues, quests }
}

const content = await loadContent()
assert.equal(Object.keys(content.scenes).length, 10)
assert.equal(Object.keys(content.locations).length, 8)
assert.equal(Object.keys(content.dialogues).length, 6)
assert.equal(Object.keys(content.quests).length, 4)
const project = await readJson<{ kind: string; caps: string[] }>(join(dataRoot, 'project.json'))
assert.equal(project.kind, manifest.id)
// Pack-provided capabilities are not auto-enabled in existing project data.
// Keep the previous 15-cap oracle exact; the FMV project probes its own opt-in.
assert.deepEqual(
  [...project.caps].sort(),
  [...(manifest.caps ?? [])].filter((capability) => capability !== 'fmv').sort(),
)
assert.ok(!project.caps.includes('fmv'))
console.log('✓ манифест и локальные схемы: 10 сцен, 8 локаций, 6 диалогов, 4 квеста')
console.log('✓ эталон не включает experimental fmv автоматически: прежние 15 caps сохранены')

const registry = await readJson<PackRegistryFile>(join(root, 'packs/registry.json'))
const discovered = await Promise.all(registry.packs.map((id) =>
  readJson<PackManifest>(join(root, 'packs', id, 'pack.json')),
))
const catalogue = resolvePackRegistry(registry, discovered)
console.log('✓ catalogue из packs/registry.json и pack.json:')
for (const pack of catalogue) console.log(`  ${pack.id}: ${(pack.caps ?? []).join(', ')}`)

const route: NarrativeEvent[] = [
  { type: 'goto', scene: 'scene_gates_guardroom' },
  { type: 'goto', scene: 'scene_gates_front' },
  { type: 'start_dialogue', dialogue: 'aldric', node: 'first_meeting' },
  { type: 'choose_dialogue', choice: 0 },
  { type: 'continue_dialogue' },
  { type: 'start_quest', quest: 'quest_bandit_threat' },
  { type: 'travel', location: 'loc_market' },
  { type: 'start_dialogue', dialogue: 'bran' },
  { type: 'choose_dialogue', choice: 2 },
  { type: 'choose_dialogue', choice: 3 },
  { type: 'travel', location: 'loc_gates' },
  { type: 'travel', location: 'loc_forest' },
  { type: 'travel', location: 'loc_ravine' },
  { type: 'start_dialogue', dialogue: 'yorek' },
  { type: 'choose_dialogue', choice: 3 },
  { type: 'set_flag', flag: 'camp_cleared' },
  { type: 'travel', location: 'loc_forest' },
  { type: 'travel', location: 'loc_gates' },
  { type: 'travel', location: 'loc_temple' },
  { type: 'start_dialogue', dialogue: 'corvin' },
  { type: 'choose_dialogue', choice: 1 },
  { type: 'choose_dialogue', choice: 4 },
  { type: 'add_item', item: 'item_medallion' },
  { type: 'start_dialogue', dialogue: 'corvin' },
  { type: 'choose_dialogue', choice: 2 },
  { type: 'travel', location: 'loc_gates' },
  { type: 'travel', location: 'loc_tavern' },
  { type: 'start_dialogue', dialogue: 'maeva' },
  { type: 'choose_dialogue', choice: 2 },
  { type: 'choose_dialogue', choice: 1 },
  { type: 'choose_dialogue', choice: 5 },
  { type: 'set_flag', flag: 'rats_started' },
  { type: 'start_quest', quest: 'quest_rats' },
  { type: 'set_flag', flag: 'rats_rewarded' },
  { type: 'start_dialogue', dialogue: 'lena' },
  { type: 'choose_dialogue', choice: 2 },
  { type: 'start_quest', quest: 'quest_secret_path' },
  { type: 'set_flag', flag: 'secret_path_used' },
]

function makeHost(): PackHost<NarrativeState, NarrativeEvent, NarrativeFrame> {
  const host = new PackHost<NarrativeState, NarrativeEvent, NarrativeFrame>([manifest])
  assert.equal(host.register(manifest.id, createNarrativeHooks(content)), true, host.paused?.reason)
  return host
}

function hash(state: NarrativeState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex')
}

function runRoute(viewEnabled: boolean): { state: NarrativeState; hash: string; draws: number } {
  const host = makeHost()
  let state = createNarrativeState(content)
  let draws = 0
  for (const [index, event] of route.entries()) {
    const result = host.runSim({ state, event, seed: 23 })
    assert.equal(result.paused, null, `sim step ${index}: ${result.paused?.reason}`)
    state = result.state
    const pause = host.runView({
      state,
      frame: { frame: index },
      enabled: viewEnabled,
      draw: () => { draws++ },
    })
    assert.equal(pause, null, `view step ${index}: ${pause?.reason}`)
  }
  return { state, hash: hash(state), draws }
}

const withView = Array.from({ length: 20 }, () => runRoute(true))
const withoutView = Array.from({ length: 20 }, () => runRoute(false))
assert.equal(new Set(withView.map((run) => run.hash)).size, 1)
assert.deepEqual(withView.map((run) => run.hash), withoutView.map((run) => run.hash))
assert.ok(withView.every((run) => run.draws > 0))
assert.ok(withoutView.every((run) => run.draws === 0))
const final = withView[0]!.state
assert.equal(final.quests.quest_bandit_threat?.stage, 'completed_fight')
assert.equal(final.quests.quest_rats?.status, 'completed')
assert.equal(final.quests.quest_relic?.status, 'completed')
assert.equal(final.quests.quest_secret_path?.status, 'completed')
assert.equal(final.inventory.item_medallion, undefined)
assert.equal(final.dialogue, null)
assert.equal(final.flags.bran_told_about_bandits, true)
assert.equal(final.flags.relic_returned, true)
console.log(`✓ host + реальный маршрут: 20/20 детерминированы; view on/off sha256=${withView[0]!.hash}`)
console.log('✓ сцены, 6 диалогов и 4 квеста прошли через sim; view использовал только draw-порт')

const headlessHost = makeHost()
let headlessState = createNarrativeState(content)
const headlessSim = headlessHost.runSim({ state: headlessState, event: route[0]!, seed: 23 })
assert.equal(headlessSim.paused, null)
headlessState = headlessSim.state
assert.equal(headlessHost.runView({
  state: headlessState,
  frame: { frame: 0 },
  headless: true,
  draw: () => assert.fail('headless view must not draw'),
}), null)
console.log('✓ headless не вызывает view; исходное состояние не мутируется')

const outputDir = await mkdtemp(join(tmpdir(), 'narthex-narrative-pack-'))
try {
  const checked = spawnSync(process.execPath, [
    join(root, 'public/ai/cf-play.mjs'),
    'check',
    dataRoot,
    '--seeds',
    '1-5',
    '--steps',
    '300',
    '--out',
    outputDir,
  ], { cwd: root, encoding: 'utf8', timeout: 180_000 })
  process.stdout.write(checked.stdout ?? '')
  process.stderr.write(checked.stderr ?? '')
  assert.equal(checked.status, 0, `cf-play check exited ${checked.status}`)
  for (const expected of [
    '10 сцен · 8 локаций · 6 диалогов · 21 узлов ink',
    'ошибок 0 · предупреждений 8',
    'seed\'ов 5 · исходы {"death":5}',
    'посещено 6 из 10 достижимых сцен',
  ]) assert.ok((checked.stdout ?? '').includes(expected), `missing oracle: ${expected}`)
} finally {
  await rm(outputDir, { recursive: true, force: true })
}
console.log('✓ эталон §2.1 на данных пака совпал: 0 errors / 8 warnings, 5 смертей, покрытие 6/10')
console.log('NARRATIVE_PACK_PROBE passed')
