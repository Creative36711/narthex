import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { PackHost } from '../src/core/pack/host'
import {
  resolveProjectPack,
  type PackCatalogEntry,
  type PackManifest,
  type PackRegistryFile,
  type ProjectKindPack,
} from '../src/core/pack/registry'
import { createNarrativeSim, createNarrativeState } from '../packs/narrative/sim'
import type {
  NarrativeContent,
  NarrativeEvent,
  NarrativeLocation,
  NarrativeState,
} from '../packs/narrative/types'
import { createAdventureHooks } from '../packs/adventure/hooks'
import {
  createAdventureState,
  openAdventureSaveInNarrative,
  openNarrativeSave,
} from '../packs/adventure/state'
import { validateAdventureContent } from '../packs/adventure/validate'
import type {
  AdventureContent,
  AdventureEvent,
  AdventureFrame,
  AdventureState,
} from '../packs/adventure/types'

const root = resolve(import.meta.dirname, '..')
const packRoot = join(root, 'packs/adventure')
const dataRoot = join(packRoot, 'data/ash-of-caerden-adventure')

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

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

function flattenLocations(regions: WorldRegion[]): Record<string, NarrativeLocation> {
  const result: Record<string, NarrativeLocation> = {}
  for (const region of regions) {
    for (const location of region.locations) result[location.id] = location
    Object.assign(result, flattenLocations(region.sub_regions ?? []))
  }
  return result
}

async function loadNarrativeContent(): Promise<NarrativeContent> {
  const [campaign, world, dataManifest] = await Promise.all([
    readJson<NarrativeContent['campaign']>(join(dataRoot, 'campaign.json')),
    readJson<WorldFile>(join(dataRoot, 'world.json')),
    readJson<DataManifest>(join(dataRoot, 'manifest.json')),
  ])
  const scenes: NarrativeContent['scenes'] = {}
  for (const file of dataManifest.scenes) {
    const scene = await readJson<NarrativeContent['scenes'][string]>(join(dataRoot, 'scenes', file))
    scenes[scene.id] = scene
  }
  const dialogues: NarrativeContent['dialogues'] = {}
  for (const file of dataManifest.dialogues) {
    const id = file.replace(/\.ink$/, '')
    dialogues[id] = await readJson(join(dataRoot, 'dialogues', `${id}.dlg.json`))
  }
  const quests: NarrativeContent['quests'] = {}
  for (const file of dataManifest.quests) {
    const quest = await readJson<NarrativeContent['quests'][string]>(join(dataRoot, 'quests', file))
    quests[quest.id] = quest
  }
  return { campaign, scenes, locations: flattenLocations(world.regions), dialogues, quests }
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

const [adventureManifest, narrativeManifest, registry, contracts, project, content, narrativeContent] = await Promise.all([
  readJson<PackManifest>(join(packRoot, 'pack.json')),
  readJson<PackManifest>(join(root, 'packs/narrative/pack.json')),
  readJson<PackRegistryFile>(join(root, 'packs/registry.json')),
  readJson<{ kinds: ProjectKindPack[]; packs: PackCatalogEntry[] }>(join(root, 'docs/contracts/caps.json')),
  readJson<{ kind: string; caps: string[] }>(join(dataRoot, 'project.json')),
  readJson<AdventureContent>(join(dataRoot, 'adventure.json')),
  loadNarrativeContent(),
])
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateSchema = ajv.compile(await readJson<object>(join(packRoot, adventureManifest.provides.schema)))
assert.ok(validateSchema(content), JSON.stringify(validateSchema.errors))
assert.deepEqual(validateAdventureContent(content), [])
assert.equal(project.kind, 'adventure')
for (const cap of ['adventure', ...(adventureManifest.requires.caps ?? [])]) assert.ok(project.caps.includes(cap))
console.log(`✓ adventure.json: schema PASS · validators ${adventureManifest.provides.validators.length}/4 · errors=0`)

const narrativeSim = createNarrativeSim(narrativeContent)
function makeHost(): PackHost<AdventureState, AdventureEvent, AdventureFrame> {
  const host = new PackHost<AdventureState, AdventureEvent, AdventureFrame>([narrativeManifest, adventureManifest])
  assert.equal(host.register('adventure', createAdventureHooks(content, narrativeSim)), true, host.paused?.reason)
  return host
}

const route: AdventureEvent[] = [
  { type: 'adventure_cursor', mode: 'walk' },
  { type: 'adventure_click', x: 520, y: 560 },
  { type: 'adventure_cursor', mode: 'take' },
  { type: 'adventure_click', x: 510, y: 540 },
  { type: 'adventure_click', x: 570, y: 540 },
  { type: 'adventure_combine', first: 'item_herb', second: 'item_herb' },
  { type: 'adventure_cursor', mode: 'look' },
  { type: 'adventure_click', x: 850, y: 340 },
  { type: 'adventure_cursor', mode: 'talk' },
  { type: 'adventure_click', x: 340, y: 400 },
  { type: 'choose_dialogue', choice: 0 },
  { type: 'continue_dialogue' },
  { type: 'adventure_cursor', mode: 'walk' },
  { type: 'adventure_click', x: 900, y: 560 },
  { type: 'adventure_open_riddle', riddle: 'gate_sigils' },
  { type: 'adventure_solve_riddle', riddle: 'gate_sigils', solution: ['ash', 'oak', 'sun'] },
]

interface RunResult {
  state: AdventureState
  hash: string
  draws: number
  cursors: string[]
  walk: { from: string; to: string; nodes: number; length: number }
}

function runRoute(viewEnabled: boolean): RunResult {
  const host = makeHost()
  let state = createAdventureState(content, createNarrativeState(narrativeContent))
  const cursors: string[] = []
  let draws = 0
  let walk: RunResult['walk'] | null = null
  for (const [index, event] of route.entries()) {
    const before = state
    const result = host.runSim({ state, event, seed: 31 })
    assert.equal(result.paused, null, `route step ${index}: ${result.paused?.reason}`)
    state = result.state
    if (event.type === 'adventure_cursor') cursors.push(event.mode)
    if (index === 1) {
      walk = {
        from: `${before.adventure.avatar.x},${before.adventure.avatar.y}`,
        to: `${state.adventure.avatar.x},${state.adventure.avatar.y}`,
        nodes: state.adventure.avatar.path.length,
        length: state.adventure.avatar.distance,
      }
    }
    const pause = host.runView({
      state,
      frame: { frame: index },
      enabled: viewEnabled,
      draw: () => { draws++ },
    })
    assert.equal(pause, null, `view step ${index}: ${pause?.reason}`)
  }
  assert.ok(walk)
  return { state, hash: hash(state), draws, cursors, walk }
}

const withView = Array.from({ length: 20 }, () => runRoute(true))
const withoutView = Array.from({ length: 20 }, () => runRoute(false))
assert.equal(new Set(withView.map((run) => run.hash)).size, 1)
assert.deepEqual(withView.map((run) => run.hash), withoutView.map((run) => run.hash))
assert.ok(withView.every((run) => run.draws > 0))
assert.ok(withoutView.every((run) => run.draws === 0))
const completed = withView[0]!
const final = completed.state
assert.equal(final.adventure.ending, 'ending_gate_unlocked')
assert.equal(final.adventure.solvedRiddles[0], 'gate_sigils')
assert.equal(final.inventory.item_healing_salve, 1)
assert.equal(final.inventory.item_herb, undefined)
assert.equal(final.dialogue, null)
assert.deepEqual(final.visitedScenes, ['scene_gates_front', 'scene_gates_guardroom'])
assert.deepEqual(completed.cursors, ['walk', 'take', 'look', 'talk', 'walk'])
assert.equal(completed.walk.length, 200)

console.log(`✓ ходьба к точке клика: (${completed.walk.from}) → (${completed.walk.to}) · узлов пути=${completed.walk.nodes} · длина=${completed.walk.length}`)
console.log(`✓ режимы курсора: ${completed.cursors.join(' → ')} · переключение=adventure_cursor`)
console.log(`✓ соединение предметов: item_herb + item_herb → item_healing_salve · inventory=${final.inventory.item_healing_salve}`)
console.log('✓ крупный план-загадка: gate_sigils → ash,oak,sun · solved=true · scene=scene_gates_guardroom')
console.log(`✓ маршрут: ending=${final.adventure.ending} · scenes=${final.visitedScenes.join(',')} · steps=${route.length}`)
console.log(`✓ детерминизм: 20/20 · view on/off один state sha256=${completed.hash}`)

const narrativeSave = createNarrativeState(narrativeContent)
const openedAdventure = openNarrativeSave(content, narrativeSave)
assert.deepEqual(openAdventureSaveInNarrative(openedAdventure), narrativeSave)
const narrativeToAdventure = makeHost().runSim({
  state: openedAdventure,
  event: { type: 'adventure_cursor', mode: 'look' },
  seed: 31,
})
assert.equal(narrativeToAdventure.paused, null, narrativeToAdventure.paused?.reason)
console.log(`✓ сейв narrative → adventure: открыт без ошибок · narrative sha256=${hash(narrativeSave)}`)

const projectedSave = openAdventureSaveInNarrative(final)
const narrativeHost = new PackHost<NarrativeState, NarrativeEvent, AdventureFrame>([narrativeManifest])
assert.equal(narrativeHost.register('narrative', { sim: narrativeSim }), true, narrativeHost.paused?.reason)
const adventureToNarrative = narrativeHost.runSim({
  state: projectedSave,
  event: { type: 'travel', location: 'loc_market' },
  seed: 31,
})
assert.equal(adventureToNarrative.paused, null, adventureToNarrative.paused?.reason)
assert.equal(adventureToNarrative.state.location, 'loc_market')
console.log(`✓ сейв adventure → narrative: открыт без ошибок · narrative sha256=${hash(projectedSave)} · travel=loc_market`)

const writeHost = new PackHost<AdventureState, AdventureEvent, AdventureFrame>([adventureManifest])
assert.equal(writeHost.register('adventure', {
  view: ({ state }) => {
    // @ts-expect-error negative control: the view state is deeply readonly.
    state.adventure.cursor = 'look'
  },
}), true, writeHost.paused?.reason)
const beforeWriteHash = hash(final)
const writePause = writeHost.runView({ state: final, frame: { frame: 99 }, draw: () => undefined })
assert.match(writePause?.reason ?? '', /read-only.*state writes are forbidden/)
assert.equal(hash(final), beforeWriteHash)
console.log(`✓ view: draw commands=${completed.draws} · запись в состояние отклонена · sha256=${beforeWriteHash}`)

const installed = await Promise.all(registry.packs.map((id) => readJson<PackManifest>(join(root, 'packs', id, 'pack.json'))))
const ready = resolveProjectPack(project, contracts.kinds, contracts.packs, installed)
assert.equal(ready.status, 'ready')
const missing = resolveProjectPack(project, contracts.kinds, contracts.packs, installed.filter((pack) => pack.id !== 'adventure'))
assert.equal(missing.status, 'missing')
if (missing.status === 'missing') {
  assert.equal(missing.diagnostic.code, 'PACK_MISSING')
  assert.equal(missing.diagnostic.packId, 'adventure')
}
console.log('✓ project resolver: installed=ready · without adventure=PACK_MISSING · packId=adventure')
console.log('ADVENTURE_MECHANICS_PROBE passed')
