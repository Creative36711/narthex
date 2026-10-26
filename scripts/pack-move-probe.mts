import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import * as narrativeBarrel from '../packs/narrative/index'
import { loadCampaign } from '../src/core/loader'

const root = resolve(import.meta.dirname, '..')
const modules = [
  ['dialogue', 441],
  ['dialogue-runtime', 360],
  ['scene-slots', 341],
  ['encounters', 352],
  ['world', 357],
  ['social', 302],
  ['director', 243],
  ['roguelike', 103],
  ['quests', 70],
] as const

let totalLines = 0
const paths: string[] = []
for (const [module, expectedLines] of modules) {
  const corePath = join(root, 'src/core', `${module}.ts`)
  const relative = `packs/narrative/${module}.ts`
  const packPath = join(root, relative)
  assert.equal(existsSync(corePath), false, `${corePath} must not exist`)
  assert.equal(existsSync(packPath), true, `${packPath} must exist`)
  const source = readFileSync(packPath, 'utf8')
  const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0)
  assert.equal(lines, expectedLines, module)
  totalLines += lines
  paths.push(relative)
  console.log(`PACK_MOVE_PATH module=${module} path=${relative} lines=${lines}`)
}
assert.equal(totalLines, 2569)
console.log(`PACK_MOVE pack=narrative modules=9 lines=2569`)
console.log(`PACK_MOVE_PATHS ${paths.join(',')}`)
const barrelExports = ['cleanDialogueLine', 'dialogueRuntime', 'sceneSlots', 'encounters', 'world', 'social', 'director', 'roguelike', 'quests'] as const
for (const key of barrelExports) {
  assert.equal(typeof narrativeBarrel[key], key === 'cleanDialogueLine' ? 'function' : 'object', `barrel export ${key}`)
}
console.log(`PACK_MOVE_BARREL exports=${barrelExports.join(',')}`)

function printGrepDiagnostic(label: string, result: SpawnSyncReturns<string>): void {
  const matches = (result.stdout ?? '').split(/\r?\n/).filter(Boolean)
  console.log(`PACK_MOVE_GREP diagnostic=${label} exit=${result.status ?? 'unavailable'} matches=${matches.length}`)
  for (const match of matches) console.log(`  ${match}`)
  if (result.error) console.log(`  grep unavailable: ${result.error.message}`)
  if (result.stderr?.trim()) console.log(`  grep stderr: ${result.stderr.trim()}`)
}

// Keep the legacy text searches as visible diagnostics. The AST-backed
// check:pack-boundary gate now decides core -> packs imports semantically.
const coreImports = spawnSync('grep', ['-rn', 'packs/narrative', 'src/core'], { cwd: root, encoding: 'utf8' })
printGrepDiagnostic('core-pack-import-text', coreImports)
const oldPaths = spawnSync('grep', [
  '-RInE',
  "core/(dialogue|dialogue-runtime|scene-slots|encounters|world|social|director|roguelike|quests)(\\.ts|['\"/]|$)",
  'src',
  'scripts',
], { cwd: root, encoding: 'utf8' })
printGrepDiagnostic('moved-core-path-text', oldPaths)

const api = Object.getOwnPropertyNames(GameEngine.prototype).sort()
const apiHash = createHash('sha256').update(`${api.join('\n')}\n`).digest('hex')
assert.equal(api.length, 269)
assert.equal(apiHash, '3ff22ce79ef63770d477b2749a5a10db18e1cd5bf937510229172c4168238973')
console.log(`PACK_MOVE_API methods=${api.length} sha256=${apiHash}`)

const campaignDir = join(root, 'public/campaigns/ash-of-caerden')
const origin = 'http://pack-move.local/'
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = async (input) => {
    const url = String(input)
    assert.ok(url.startsWith(origin), `unexpected URL ${url}`)
    const relative = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '')
    return new Response(await readFile(join(campaignDir, relative)), { status: 200 })
  }
  const campaign = await loadCampaign(origin)
  const engine = new GameEngine(campaign)
  const scene = engine.currentScene()
  assert.equal(scene.id, 'scene_gates_front')

  const cleaned = engine.runPackOperation<string>('cleanDialogueLine', 'Алдрик: «Проверка»')
  assert.equal(cleaned, 'Проверка')
  console.log('PACK_MOVE_OPERATION module=dialogue operation=cleanDialogueLine result=Проверка')

  engine.runPackOperation('startDialogue', 'npc_guard_aldric')
  assert.equal(engine.dialogue?.npc.id, 'npc_guard_aldric')
  console.log('PACK_MOVE_OPERATION module=dialogue-runtime operation=startDialogue result=npc_guard_aldric')
  engine.runPackOperation('endDialogue')

  const formatted = engine.runPackOperation<string>('fmt', 'pack-move')
  assert.equal(formatted, 'pack-move')
  console.log('PACK_MOVE_OPERATION module=scene-slots operation=fmt result=pack-move')

  const stealth = engine.runPackOperation<boolean>('stealthEnabled')
  assert.equal(typeof stealth, 'boolean')
  console.log(`PACK_MOVE_OPERATION module=encounters operation=stealthEnabled result=${stealth}`)
  console.log(`PACK_MOVE_OPERATION module=world operation=currentScene result=${scene.id}`)

  const mood = engine.runPackOperation<number>('npcMood', 'npc_guard_aldric')
  assert.equal(mood, 50)
  console.log('PACK_MOVE_OPERATION module=social operation=npcMood result=50')

  const cutsceneKey = engine.runPackOperation<number>('cutsceneKey')
  assert.ok(Number.isSafeInteger(cutsceneKey) && cutsceneKey >= 0)
  console.log(`PACK_MOVE_OPERATION module=director operation=cutsceneKey result=${cutsceneKey}`)

  const ngPlus = engine.runPackOperation<boolean>('newGamePlusAvailable')
  assert.equal(ngPlus, false)
  console.log('PACK_MOVE_OPERATION module=roguelike operation=newGamePlusAvailable result=false')

  const questId = Object.keys(campaign.quests).sort()[0]!
  engine.runPackOperation('startQuest', questId)
  assert.equal(engine.state.quests[questId]?.status, 'active')
  console.log(`PACK_MOVE_OPERATION module=quests operation=startQuest result=active:${questId}`)
} finally {
  globalThis.fetch = originalFetch
}

const childSource = `
import { GameEngine } from './src/core/engine.ts'
import { PackOperationError } from './src/core/pack/host.ts'
const engine = Object.create(GameEngine.prototype)
try {
  engine.runPackOperation('currentScene')
  throw new Error('unregistered call unexpectedly succeeded')
} catch (error) {
  if (!(error instanceof PackOperationError) || error.code !== 'PACK_OPERATION_MISSING') throw error
  console.log('PACK_MOVE_UNREGISTERED code=' + error.code + ' operation=' + error.refusal.operation)
}
`
const child = spawnSync(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '-e', childSource], {
  cwd: root,
  encoding: 'utf8',
})
assert.equal(child.status, 0, `${child.stdout}${child.stderr}`)
assert.match(child.stdout, /PACK_MOVE_UNREGISTERED code=PACK_OPERATION_MISSING operation=currentScene/)
process.stdout.write(child.stdout)
console.log('PACK_MOVE_PROBE passed')
