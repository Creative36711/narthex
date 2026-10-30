import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { CAPABILITY_REGISTRY } from '../src/core/caps'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { loadCampaign } from '../src/core/loader'
import { resolveProjectCapabilityModes } from '../src/core/pack/capability-modes'
import { resolveProjectPack, type PackCatalogEntry, type PackManifest, type PackRegistryFile, type ProjectKindPack, type ProjectPackInput } from '../src/core/pack/registry'
import { EditorStore } from '../src/editor/store'

const root = resolve(import.meta.dirname, '..')
const campaignSource = join(root, 'public/campaigns/ash-of-caerden')
const fixturePath = join(root, 'scripts/smoke/fixtures/project-capability-modes/project.json')
const workspace = await mkdtemp(join(tmpdir(), 'narthex-capability-modes-'))
const projectDir = join(workspace, 'project')
const codeDir = join(workspace, 'code-negative')
const cli = join(root, 'node_modules/tsx/dist/cli.mjs')
const cliEntry = join(root, 'scripts/playkit/cli.mts')
const fixtureProject = JSON.parse(await readFile(fixturePath, 'utf8')) as ProjectPackInput
const contracts = JSON.parse(await readFile(join(root, 'docs/contracts/caps.json'), 'utf8')) as {
  kinds: ProjectKindPack[]
  packs: PackCatalogEntry[]
}
const packRegistry = JSON.parse(await readFile(join(root, 'packs/registry.json'), 'utf8')) as PackRegistryFile
const installedPacks = await Promise.all(packRegistry.packs.map(async (id) =>
  JSON.parse(await readFile(join(root, 'packs', id, 'pack.json'), 'utf8')) as PackManifest,
))
const narrative = installedPacks.find((pack) => pack.id === 'narrative')!
const kind = contracts.kinds.find((entry) => entry.id === fixtureProject.kind)!
const requiredCaps = kind.requires ?? []
const availableCaps = narrative.caps ?? []
const resolvePack = (project: ProjectPackInput) => resolveProjectPack(project, contracts.kinds, contracts.packs, installedPacks)
const resolveModes = (project: ProjectPackInput) => resolveProjectCapabilityModes(project, CAPABILITY_REGISTRY, requiredCaps)

async function directoryHash(dir: string): Promise<string> {
  const files: string[] = []
  const visit = async (current: string) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else files.push(path)
    }
  }
  await visit(dir)
  files.sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(dir, file).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function runCheck(dir: string, name: string, seeds = '1-5') {
  return spawnSync(process.execPath, [
    cli, cliEntry, 'check', dir,
    '--seeds', seeds, '--steps', '300',
    '--out', join(workspace, `${name}-check-output`),
  ], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
}

let originalFetch = globalThis.fetch
let originalProjectHash = ''
let finalProjectHash = ''
try {
  await cp(campaignSource, projectDir, { recursive: true })
  const originalProjectText = await readFile(fixturePath, 'utf8')
  await writeFile(join(projectDir, 'project.json'), originalProjectText)
  originalProjectHash = await directoryHash(projectDir)

  const diskFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'http://cap-mode-probe')
    if (init?.method === 'POST' && url.pathname === '/__editor/save') {
      const body = JSON.parse(String(init.body)) as { path: string; text: string }
      const relativePath = body.path.split('/').slice(2).join('/')
      assert.equal(relativePath, 'project.json', 'probe only writes the mode manifest')
      await writeFile(join(projectDir, relativePath), body.text)
      return new Response('saved', { status: 200 })
    }
    const relativePath = url.pathname.replace(/^\/campaigns\/capability-modes-probe\/?/, '')
    try {
      return new Response(await readFile(join(projectDir, relativePath)), { status: 200 })
    } catch {
      return new Response('', { status: 404 })
    }
  }
  globalThis.fetch = diskFetch
  const store = new EditorStore('/campaigns/capability-modes-probe', resolvePack, resolveModes)
  await store.load()
  assert.equal(store.packResolution?.status, 'ready')
  assert.equal(store.capabilityModes?.status, 'ready')
  const beforeModeHash = await directoryHash(projectDir)
  assert.equal(beforeModeHash, originalProjectHash)

  store.setCapabilityMode('quests', 'off', availableCaps, requiredCaps)
  assert.equal(store.capabilityModes?.status, 'ready')
  if (store.capabilityModes?.status !== 'ready') throw new Error('expected resolved off capability profile')
  assert.equal(store.capabilityModes.modes.quests, 'off')
  assert.equal(store.capabilityModes.activeCaps?.includes('quests'), false)
  await store.saveToDisk()
  const offProject = JSON.parse(await readFile(join(projectDir, 'project.json'), 'utf8')) as ProjectPackInput
  assert.equal((offProject.cap_options as Record<string, { mode?: string }>).quests.mode, 'off')
  const questNames = await readdir(join(projectDir, 'quests'))
  assert.ok(questNames.length > 0, 'quest files must remain on disk while the capability is off')
  const offHash = await directoryHash(projectDir)
  assert.notEqual(offHash, originalProjectHash, 'off mode is represented in project data')
  console.log(`OFF saved: quests mode=off; ${questNames.length} quest data file(s) retained; project sha256=${offHash}`)

  const offStore = new EditorStore('/campaigns/capability-modes-probe', resolvePack, resolveModes)
  await assert.doesNotReject(offStore.load(), 'opening a project with an off capability must not fail')
  assert.equal(offStore.capabilityModes?.status, 'ready')
  if (offStore.capabilityModes?.status !== 'ready') throw new Error('expected ready capability profile on reopen')
  assert.equal(offStore.capabilityModes.modes.quests, 'off')
  assert.ok(offStore.questPaths().length > 0, 'quest panels/data remain available while off')
  const questDocPath = offStore.questPaths()[0]!
  const questDocBefore = JSON.stringify(offStore.jsonFiles.get(questDocPath))
  offStore.setJson(questDocPath, { overwrittenByProbe: true })
  assert.equal(JSON.stringify(offStore.jsonFiles.get(questDocPath)), questDocBefore, 'off-mode quest data must remain read-only')
  assert.equal(offStore.dirty.has(questDocPath), false)
  assert.equal(offStore.createFile('quests', 'must-not-exist.json', {}), '')
  console.log(`OPEN off: no exception; ${offStore.questPaths().length} quest document(s) remain read-only and available`)

  const runtimeCampaign = await loadCampaign('/campaigns/capability-modes-probe')
  const runtimeModes = resolveModes(offStore.project)
  assert.equal(runtimeModes.status, 'ready')
  if (runtimeModes.status !== 'ready') throw new Error('expected off runtime capability profile')
  if (runtimeModes.activeCaps !== null) runtimeCampaign.meta.caps = runtimeModes.activeCaps
  ;(runtimeCampaign.meta as typeof runtimeCampaign.meta & { project_cap_options?: unknown }).project_cap_options = offStore.project.cap_options
  const runtime = new GameEngine(runtimeCampaign)
  runtime.start()
  const questId = Object.keys(runtimeCampaign.quests)[0]
  assert.ok(questId, 'fixture campaign must contain quest data')
  const quest = runtimeCampaign.quests[questId]!
  runtime.startQuest(questId)
  assert.equal(runtime.state.quests[questId], undefined, 'off mode must not start quests')
  runtime.state.quests[questId] = { stage: quest.stages[0]!.id, status: 'active', journal: ['preserved'] }
  const questStateBefore = JSON.stringify(runtime.state.quests[questId])
  runtime.advanceQuestTo(questId, quest.stages[1]?.id ?? quest.stages[0]!.id)
  const journalKey = Object.keys(quest.journal_entries ?? {})[0]
  if (journalKey) runtime.journalUpdate(questId, journalKey)
  runtime.applyEffects([{ type: 'fail_quest', quest: questId }])
  runtime.checkRules()
  assert.equal(JSON.stringify(runtime.state.quests[questId]), questStateBefore, 'off mode must pause quest mutations without deleting saved state')
  console.log(`RUNTIME off: quest start/stage/journal/fail mutations suppressed; existing quest state retained (${questId})`)

  const offCheck = runCheck(projectDir, 'off')
  const offOutput = `${offCheck.stdout ?? ''}${offCheck.stderr ?? ''}`
  assert.equal(offCheck.status, 0, offOutput)
  for (const expected of [
    '10 сцен · 8 локаций · 6 диалогов · 21 узлов ink',
    'ошибок 0 · предупреждений 8',
    'seed\'ов 5 · исходы {"death":5}',
    'посещено 6 из 10 достижимых сцен',
  ]) assert.ok(offOutput.includes(expected), `off-mode oracle missing: ${expected}`)
  console.log('CF-PLAY CHECK (off) output:')
  process.stdout.write(offOutput.endsWith('\n') ? offOutput : `${offOutput}\n`)

  store.setCapabilityMode('quests', 'core', availableCaps, requiredCaps)
  assert.equal(store.capabilityModes?.status, 'ready')
  if (store.capabilityModes?.status !== 'ready') throw new Error('expected resolved core capability profile')
  assert.equal(store.capabilityModes.modes.quests, 'core')
  await store.saveToDisk()
  finalProjectHash = await directoryHash(projectDir)
  assert.equal(finalProjectHash, originalProjectHash, 'turning capability back on must restore the exact original project/save bytes')

  await cp(campaignSource, codeDir, { recursive: true })
  const codeProject = {
    ...fixtureProject,
    cap_options: { quests: { mode: 'code', version: 1 } },
    code: { entry: 'code/quests.js', sandbox: 'worker' },
  }
  await writeFile(join(codeDir, 'project.json'), JSON.stringify(codeProject, null, 2) + '\n')
  const manifest = JSON.parse(await readFile(join(codeDir, 'manifest.json'), 'utf8')) as { scenes: string[] }
  const scenePath = join(codeDir, 'scenes', manifest.scenes[0]!)
  const scene = JSON.parse(await readFile(scenePath, 'utf8')) as Record<string, unknown>
  scene.location = 'nar25_missing_location'
  await writeFile(scenePath, JSON.stringify(scene, null, 2) + '\n')
  const codeCheck = runCheck(codeDir, 'code-negative', '1-1')
  const codeOutput = `${codeCheck.stdout ?? ''}${codeCheck.stderr ?? ''}`
  assert.notEqual(codeCheck.status, 0, codeOutput)
  assert.match(codeOutput, /scene_location_missing|несуществующей локации/i, 'code mode must not bypass static data validation')
  console.log(`CODE negative control: rc=${codeCheck.status}; validator rejected deliberate invalid scene location`)
  console.log(`SAVE SHA256 before=${originalProjectHash}`)
  console.log(`SAVE SHA256 after =${finalProjectHash}`)
  console.log('SAVE_HASH_MATCH=true')
  console.log('CAPABILITY_MODES_PROBE passed')
} finally {
  globalThis.fetch = originalFetch
  await rm(workspace, { recursive: true, force: true })
}
