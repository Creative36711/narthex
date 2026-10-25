import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { GameEngine } from '../src/core/engine'
import { loadCampaign } from '../src/core/loader'
import {
  createNarrativePackBinding,
  loadNarrativeContent,
  NARRATIVE_PACK_MANIFEST,
} from '../packs/narrative/runtime'
import type { NarrativeEvent, NarrativeState } from '../packs/narrative/types'

const root = resolve(import.meta.dirname, '..')
const cli = join(root, 'public/ai/cf-play.mjs')
const ashDir = join(root, 'public/campaigns/ash-of-caerden')
const fmvDir = join(root, 'packs/narrative/data/fmv-crossing')
const content = await loadNarrativeContent(ashDir)
const origin = 'http://pack-execution.local/'
const originalFetch = globalThis.fetch

try {
  globalThis.fetch = async (input) => {
    const url = String(input)
    assert.ok(url.startsWith(origin), `unexpected URL ${url}`)
    const relative = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '')
    return new Response(await readFile(join(ashDir, relative)), { status: 200 })
  }
  const campaign = await loadCampaign(origin)
  const engine = new GameEngine(campaign)
  const binding = createNarrativePackBinding(content, NARRATIVE_PACK_MANIFEST)
  engine.attachPackSim(binding)
  const event: NarrativeEvent = { type: 'goto', scene: 'scene_gates_guardroom' }
  const state = engine.runPackSim(event, 23) as NarrativeState
  assert.equal(state.scene, 'scene_gates_guardroom')
  assert.deepEqual(state.visitedScenes, ['scene_gates_front', 'scene_gates_guardroom'])
  assert.deepEqual(engine.packExecution, { packId: 'narrative', seam: 'narrative.sim', steps: 1 })
  console.log('NARRATIVE_SIM_FROM_PACK=narrative.sim')
  console.log('✓ GameEngine: PackHost + narrative.sim · event=goto · scene_gates_front → scene_gates_guardroom · steps=1')

  const unbound = new GameEngine(campaign)
  assert.throws(() => unbound.runPackSim(event, 23), /PACK_RUNTIME_MISSING/)
  const failing = new GameEngine(campaign)
  failing.attachPackSim({
    manifest: NARRATIVE_PACK_MANIFEST,
    state: binding.state,
    hooks: { sim: () => { throw new Error('negative control') } },
  })
  assert.throws(() => failing.runPackSim(event, 23), /PACK_SIM_FAILED: narrative\/sim: negative control/)
  assert.equal(failing.packExecution?.steps, 0)
  console.log('✓ fail-fast: без binding=PACK_RUNTIME_MISSING · pause=PACK_SIM_FAILED · legacy fallback не вызывается')
} finally {
  globalThis.fetch = originalFetch
}

const workspace = await mkdtemp(join(tmpdir(), 'narthex-pack-execution-'))
try {
  for (const fixture of [
    { name: 'ash', dir: ashDir, event: 'goto', scene: 'scene_gates_guardroom', fmv: null },
    { name: 'fmv', dir: fmvDir, event: 'fmv_ready', scene: 'scene_fmv_crossing', fmv: 'playing' },
  ]) {
    const checked = spawnSync(process.execPath, [
      cli,
      'check',
      fixture.dir,
      '--json',
      '--seeds',
      '1-5',
      '--steps',
      '300',
      '--out',
      join(workspace, fixture.name),
    ], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
    assert.equal(checked.status, 0, `${checked.stdout ?? ''}${checked.stderr ?? ''}`)
    const report = JSON.parse(checked.stdout) as {
      pack?: {
        packId?: string
        seam?: string
        steps?: number
        event?: string
        to?: { scene?: string; fmv?: string | null }
      }
    }
    assert.equal(report.pack?.packId, 'narrative')
    assert.equal(report.pack?.seam, 'narrative.sim')
    assert.equal(report.pack?.steps, 1)
    assert.equal(report.pack?.event, fixture.event)
    assert.equal(report.pack?.to?.scene, fixture.scene)
    assert.equal(report.pack?.to?.fmv, fixture.fmv)
    console.log(`✓ cf-play ${fixture.name}: seam=${report.pack.seam} · event=${fixture.event} · steps=1 · rc=0`)
  }
} finally {
  await rm(workspace, { recursive: true, force: true })
}

console.log('PACK_EXECUTION_PROBE passed')
