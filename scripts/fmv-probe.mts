import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { PackHost, type PackDrawCommand } from '../src/core/pack/host'
import type { PackManifest } from '../src/core/pack/registry'
import { createFmvPreloader, FmvResourceError } from '../packs/narrative/fmv-loader'
import type { FmvDocument } from '../packs/narrative/fmv'
import { createNarrativeHooks } from '../packs/narrative/hooks'
import { createNarrativeState } from '../packs/narrative/sim'
import type {
  NarrativeChoice,
  NarrativeContent,
  NarrativeEvent,
  NarrativeFrame,
  NarrativeLocation,
  NarrativeState,
} from '../packs/narrative/types'

const root = resolve(import.meta.dirname, '..')
const packRoot = join(root, 'packs/narrative')
const dataRoot = join(packRoot, 'data/fmv-crossing')
const ajv = new Ajv2020({ allErrors: true, strict: false })

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

interface DataManifest {
  scenes: string[]
  dialogues: string[]
  quests: string[]
  fmv: string[]
}
interface WorldRegion { locations: NarrativeLocation[]; sub_regions?: WorldRegion[] }
interface RunResult {
  state: NarrativeState
  hash: string
  draws: PackDrawCommand[]
  seamDraws: PackDrawCommand[]
  preload: string[]
}

function flattenLocations(regions: WorldRegion[]): Record<string, NarrativeLocation> {
  const result: Record<string, NarrativeLocation> = {}
  for (const region of regions) {
    for (const location of region.locations) result[location.id] = location
    Object.assign(result, flattenLocations(region.sub_regions ?? []))
  }
  return result
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

const [manifest, campaign, world, dataManifest, project] = await Promise.all([
  readJson<PackManifest>(join(packRoot, 'pack.json')),
  readJson<NarrativeContent['campaign']>(join(dataRoot, 'campaign.json')),
  readJson<{ regions: WorldRegion[] }>(join(dataRoot, 'world.json')),
  readJson<DataManifest>(join(dataRoot, 'manifest.json')),
  readJson<{ kind: string; caps: string[] }>(join(dataRoot, 'project.json')),
])
assert.equal(project.kind, 'narrative')
assert.ok(project.caps.includes('fmv'))
assert.equal(dataManifest.fmv.length, 1)

const document = await readJson<FmvDocument>(join(dataRoot, 'fmv', dataManifest.fmv[0]!))
const [documentSchema, fragmentSchema, sceneSchema] = await Promise.all([
  readJson<object>(join(packRoot, 'schema/fmv.schema.json')),
  readJson<object>(join(packRoot, 'schema/fmv-fragment.schema.json')),
  readJson<object>(join(packRoot, 'schema/scene.schema.json')),
])
const validateDocument = ajv.compile(documentSchema)
const validateFragment = ajv.compile(fragmentSchema)
const validateScene = ajv.compile(sceneSchema)
assert.ok(validateDocument(document), JSON.stringify(validateDocument.errors))
assert.equal(new Set(document.fragments.map((fragment) => fragment.id)).size, document.fragments.length)
assert.ok(document.fragments.some((fragment) => fragment.id === document.start))
for (const fragment of document.fragments) {
  assert.ok(validateFragment(fragment), `${fragment.id}: ${JSON.stringify(validateFragment.errors)}`)
  assert.ok(!fragment.src.includes('..') && !fragment.poster.includes('..'))
  for (const subtitle of fragment.subtitles) {
    assert.ok(subtitle.start_ms < subtitle.end_ms)
    assert.ok(subtitle.end_ms <= fragment.duration_ms)
  }
  for (const choice of fragment.choices ?? []) {
    assert.ok(document.fragments.some((candidate) => candidate.id === choice.next), choice.next)
  }
}
console.log(`✓ FMV schema: document PASS · fragments ${document.fragments.length}/${document.fragments.length} PASS · choices resolve`)
for (const fragment of document.fragments) {
  console.log(`  фрагмент ${fragment.id}: duration_ms=${fragment.duration_ms} · src=${fragment.src}`)
}

const scenes: NarrativeContent['scenes'] = {}
for (const file of dataManifest.scenes) {
  const scene = await readJson<NarrativeContent['scenes'][string]>(join(dataRoot, 'scenes', file))
  assert.ok(validateScene(scene), JSON.stringify(validateScene.errors))
  scenes[scene.id] = scene
}
const content: NarrativeContent = {
  campaign,
  scenes,
  locations: flattenLocations(world.regions),
  dialogues: {},
  quests: {},
  fmv: { [document.id]: document },
}
const fragmentA = document.fragments.find((fragment) => fragment.id === 'fragment_a')!
const fragmentB = document.fragments.find((fragment) => fragment.id === 'fragment_b')!
const selected = fragmentA.choices![0]!

type Host = PackHost<NarrativeState, NarrativeEvent, NarrativeFrame>
function makeHost(bound: NarrativeContent = content): Host {
  const host: Host = new PackHost([manifest])
  assert.equal(host.register('narrative', createNarrativeHooks(bound)), true, host.paused?.reason)
  return host
}

async function diskLoader(src: string): Promise<ArrayBuffer> {
  const bytes = await readFile(join(dataRoot, src))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function runRoute(viewEnabled: boolean): Promise<RunResult> {
  const host = makeHost()
  const preloader = createFmvPreloader(diskLoader)
  const preload: string[] = []
  const draws: PackDrawCommand[] = []
  let seamDraws: PackDrawCommand[] = []
  let state = createNarrativeState(content)
  let frame = 0
  assert.equal(state.fmv?.fragment, 'fragment_a')
  assert.equal(state.fmv?.phase, 'loading')

  function project(positionMs = 0): PackDrawCommand[] {
    const before = hash(state)
    const output: PackDrawCommand[] = []
    const pause = host.runView({
      state,
      frame: { frame: frame++, position_ms: positionMs },
      enabled: viewEnabled,
      draw: (command) => { output.push(command); draws.push(command) },
    })
    assert.equal(pause, null, pause?.reason)
    assert.equal(hash(state), before, 'view mutated state')
    return output
  }
  function dispatch(event: NarrativeEvent, positionMs = 0): PackDrawCommand[] {
    const result = host.runSim({ state, event, seed: 47 })
    assert.equal(result.paused, null, result.paused?.reason)
    state = result.state
    return project(positionMs)
  }

  const initialDraws = project()
  if (viewEnabled) {
    const poster = initialDraws.find((command) => command.type === 'narrative.fmv.frame')
    assert.equal(poster?.fragment, 'fragment_a')
    assert.equal(poster?.blank, false)
    assert.ok(poster?.poster)
  }

  const first = await preloader.preload(document.id, fragmentA)
  assert.ok(first.bytes > 0)
  preload.push(`start:${first.fragment} bytes=${first.bytes}`)
  dispatch({ type: 'fmv_ready', scene: document.id, fragment: first.fragment })
  assert.equal(state.fmv?.phase, 'playing')

  const next = await preloader.preloadChoices(document.id, fragmentA, document)
  for (const resource of next) {
    preload.push(`after ${fragmentA.id} ready, before choice:${resource.fragment} bytes=${resource.bytes}`)
    dispatch({ type: 'fmv_ready', scene: document.id, fragment: resource.fragment })
  }
  assert.ok(state.fmv?.ready.includes(fragmentB.id))
  assert.equal(state.fmv?.fragment, fragmentA.id)

  const beforeClock = hash(state)
  project(fragmentA.duration_ms * 100)
  assert.equal(hash(state), beforeClock, 'frame position or wall-clock-like input changed sim state')
  assert.equal(state.fmv?.fragment, fragmentA.id)

  dispatch({ type: 'fmv_ended', scene: document.id, fragment: fragmentA.id }, fragmentA.duration_ms)
  assert.equal(state.fmv?.phase, 'choice')
  const choiceEvent: NarrativeEvent = { type: 'choose_dialogue', choice: 0 }
  seamDraws = dispatch(choiceEvent)
  assert.equal(state.fmv?.fragment, fragmentB.id)
  assert.equal(state.fmv?.lastTransition?.from, fragmentA.id)
  assert.equal(state.fmv?.lastTransition?.to, fragmentB.id)
  assert.equal(state.fmv?.lastTransition?.choice, selected.id)
  assert.equal(state.fmv?.lastTransition?.readyNext, true)
  assert.equal(state.flags.chose_lantern, true)
  assert.deepEqual(state.usedChoices, [`${document.id}:${fragmentA.id}:0`])
  if (viewEnabled) {
    const nextFrame = seamDraws.find((command) => command.type === 'narrative.fmv.frame')
    assert.equal(nextFrame?.fragment, fragmentB.id)
    assert.equal(nextFrame?.ready, true)
    assert.equal(nextFrame?.blank, false)
    assert.equal(nextFrame?.presentation, 2)
  }

  dispatch({ type: 'fmv_ended', scene: document.id, fragment: fragmentB.id }, fragmentB.duration_ms)
  assert.equal(state.fmv?.phase, 'ended')
  return { state, hash: hash(state), draws, seamDraws, preload }
}

const withView: RunResult[] = []
const withoutView: RunResult[] = []
for (let index = 0; index < 20; index++) withView.push(await runRoute(true))
for (let index = 0; index < 20; index++) withoutView.push(await runRoute(false))
assert.equal(new Set(withView.map((run) => run.hash)).size, 1)
assert.deepEqual(withView.map((run) => run.hash), withoutView.map((run) => run.hash))
assert.ok(withoutView.every((run) => run.draws.length === 0))
const completed = withView[0]!
console.log(`✓ предзагрузка: ${completed.preload.join(' · ')}`)
console.log(`✓ ${fragmentA.id} → choose_dialogue[0]=${selected.id} → ${fragmentB.id}; ready(next)=true · usedChoices=${completed.state.usedChoices[0]} · flag=chose_lantern:true`)
console.log('✓ условие перехода: runtime.ready.includes(choice.next) === true; кадры/position_ms не вызывают переход и не меняют state')
const seamFrame = completed.seamDraws.find((command) => command.type === 'narrative.fmv.frame')
const blankFrames = completed.draws.filter((command) => command.type === 'narrative.fmv.frame' && command.blank !== false).length
assert.equal(blankFrames, 0)
console.log(`✓ нет пустого кадра: empty_frames=${blankFrames} · next_frame_in_draw_queue=1 · fragment=${String(seamFrame?.fragment)} · presentation=${String(seamFrame?.presentation)}`)
console.log(`✓ детерминизм: 20/20 одинаковых прогонов · view on/off · state sha256=${completed.hash}`)

const subtitles = new Map<string, string>()
for (const command of completed.draws) {
  if (command.type === 'narrative.fmv.subtitle') {
    subtitles.set(`${String(command.fragment)}:${String(command.start_ms)}`, String(command.text))
  }
}
assert.equal(subtitles.size, 2)
assert.equal(completed.state.journal.length, 0)
for (const text of subtitles.values()) assert.ok(!completed.state.journal.includes(text))
assert.ok(!completed.draws.some((command) => /audio|speech|\blog\b/.test(String(command.type))))
console.log(`✓ субтитры: ${subtitles.size} реплики (fragment_a + fragment_b) · journal=0 · audio/speech дублирования в лог=0`)

// Early input is held on the current poster until the selected resource is ready.
{
  const host = makeHost()
  const preloader = createFmvPreloader(diskLoader)
  let state = createNarrativeState(content)
  const sim = (event: NarrativeEvent) => {
    const result = host.runSim({ state, event, seed: 47 })
    assert.equal(result.paused, null, result.paused?.reason)
    state = result.state
  }
  await preloader.preload(document.id, fragmentA)
  sim({ type: 'fmv_ready', scene: document.id, fragment: fragmentA.id })
  sim({ type: 'fmv_ended', scene: document.id, fragment: fragmentA.id })
  sim({ type: 'choose_dialogue', choice: 0 })
  assert.equal(state.fmv?.fragment, fragmentA.id)
  assert.equal(state.fmv?.phase, 'buffering')
  assert.equal(state.fmv?.pendingChoice, 0)
  assert.equal(state.usedChoices.length, 0)
  await preloader.preload(document.id, fragmentB)
  sim({ type: 'fmv_ready', scene: document.id, fragment: fragmentB.id })
  assert.equal(state.fmv?.fragment, fragmentB.id)
  assert.equal(state.usedChoices.length, 1)
  console.log(`✓ ранний выбор: ${fragmentA.id}/buffering → ready(${fragmentB.id}) → ${fragmentB.id}; повторное применение=0`)
}

// Compare with an ordinary dialogue using the same event, sections and once key.
{
  const ordinaryChoice: NarrativeChoice = {
    text: selected.text,
    once: selected.once,
    sections: selected.sections,
    goto: 'end',
  }
  const ordinaryContent: NarrativeContent = {
    ...content,
    scenes: Object.fromEntries(Object.entries(content.scenes).map(([id, scene]) => [id, { ...scene, fmv: undefined }])),
    dialogues: { [document.id]: { version: 2, nodes: [{ id: fragmentA.id, choices: [ordinaryChoice] }] } },
    fmv: undefined,
  }
  const host = makeHost(ordinaryContent)
  let state = createNarrativeState(ordinaryContent)
  for (const event of [
    { type: 'start_dialogue', dialogue: document.id, node: fragmentA.id },
    { type: 'choose_dialogue', choice: 0 },
  ] as NarrativeEvent[]) {
    const result = host.runSim({ state, event, seed: 47 })
    assert.equal(result.paused, null, result.paused?.reason)
    state = result.state
  }
  assert.deepEqual(state.flags, completed.state.flags)
  assert.deepEqual(state.usedChoices, completed.state.usedChoices)
  assert.deepEqual(state.journal, completed.state.journal)
  assert.deepEqual(state.inventory, completed.state.inventory)
  console.log(`✓ эталон обычного narrative: event=choose_dialogue(0) в обоих случаях · flags/inventory/journal/usedChoices совпали · key=${state.usedChoices[0]}`)
}

// A rejected write is tested through the same host boundary; state stays byte-identical.
{
  const before = hash(completed.state)
  const host: Host = new PackHost([manifest])
  assert.equal(host.register('narrative', {
    view: ({ state }) => { Reflect.set(state.fmv as object, 'fragment', 'fragment_c') },
  }), true, host.paused?.reason)
  const pause = host.runView({ state: completed.state, frame: { frame: 999 }, draw: () => undefined })
  assert.equal(pause?.hook, 'view')
  assert.match(pause.reason, /read-only/)
  assert.equal(hash(completed.state), before)
  console.log(`✓ view write rejected: ${pause.reason} · sha256 before=after=${before}`)
}

// Offline is data in the state and draw port, not an exception escaping the project.
{
  const host = makeHost()
  let state = createNarrativeState(content)
  const offline = createFmvPreloader(async () => {
    throw new FmvResourceError('FMV_OFFLINE', 'Загрузчик отключён: видео недоступно офлайн; проект сохранён, повторите позже.')
  })
  let failure: FmvResourceError | null = null
  try {
    await offline.preload(document.id, fragmentA)
  } catch (error) {
    assert.ok(error instanceof FmvResourceError)
    failure = error
  }
  assert.ok(failure)
  const result = host.runSim({
    state,
    event: {
      type: 'fmv_error',
      scene: document.id,
      fragment: fragmentA.id,
      code: failure.code,
      message: failure.message,
    },
    seed: 47,
  })
  assert.equal(result.paused, null, result.paused?.reason)
  state = result.state
  const before = hash(state)
  const draws: PackDrawCommand[] = []
  assert.equal(host.runView({ state, frame: { frame: 0 }, draw: (command) => draws.push(command) }), null)
  assert.equal(hash(state), before)
  const errorDraw = draws.find((command) => command.type === 'narrative.fmv.error')
  const poster = draws.find((command) => command.type === 'narrative.fmv.frame')
  assert.equal(errorDraw?.code, 'FMV_OFFLINE')
  assert.match(String(errorDraw?.message), /Загрузчик отключён/)
  assert.equal(poster?.blank, false)
  assert.ok(poster?.poster)
  assert.equal(state.scene, campaign.starting_scene)
  console.log(`✓ оффлайн: code=${String(errorDraw?.code)} · text=${String(errorDraw?.message)} · host_paused=false · project_state=intact · poster=true`)
}

console.log('FMV_PROBE passed')
