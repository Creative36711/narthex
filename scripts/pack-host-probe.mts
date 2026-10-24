import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PackHost, type PackHooks, type PackHostManifest, type PackSimHook } from '../src/core/pack/host'
import type { PackManifest } from '../src/core/pack/registry'
import {
  attemptViewWrite,
  deterministicSim,
  drawScore,
  type ProbeEvent,
  type ProbeFrame,
  type ProbeState,
  throwingSim,
} from '../packs/fixtures/full/hooks'

const root = resolve(import.meta.dirname, '..')
const fixtureManifest = JSON.parse(
  await readFile(resolve(root, 'packs/fixtures/full/pack.json'), 'utf8'),
) as PackManifest
const hostManifest = fixtureManifest as PackHostManifest
const seed = 73

function hostWith(hooks: PackHooks<ProbeState, ProbeEvent, ProbeFrame>): PackHost<ProbeState, ProbeEvent, ProbeFrame> {
  const host = new PackHost<ProbeState, ProbeEvent, ProbeFrame>([hostManifest])
  assert.equal(host.register(fixtureManifest.id, hooks), true, host.paused?.reason)
  return host
}

function stateHash(state: ProbeState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex')
}

const observedSim: PackSimHook<ProbeState, ProbeEvent> = (context) => {
  assert.equal('engine' in context, false, 'sim receives a data context, never GameEngine')
  return deterministicSim(context)
}

function run(seedValue: number, viewEnabled: boolean): string {
  const host = hostWith({ sim: observedSim, view: drawScore })
  let state: ProbeState = { score: 0, steps: [] }
  for (let step = 0; step < 8; step++) {
    const sim = host.runSim({ state, event: { amount: step + 1 }, seed: seedValue })
    assert.equal(sim.paused, null)
    state = sim.state
    assert.equal(host.runView({ state, frame: { frame: step }, enabled: viewEnabled, draw: () => undefined }), null)
  }
  return stateHash(state)
}

assert.ok(fixtureManifest.provides.seams?.some((seam) => seam.kind === 'sim'))
assert.ok(fixtureManifest.provides.seams?.some((seam) => seam.kind === 'view'))
const registered = hostWith({ sim: observedSim, view: drawScore })
assert.ok(registered)
console.log('✓ пустышка зарегистрирована по manifest ID; хост не перечисляет ID паков')

const headlessHost = hostWith({
  sim: observedSim,
  view: ({ draw }) => {
    headlessViewCalls++
    draw({ type: 'fixture-view' })
  },
})
let headlessViewCalls = 0
const headlessResult = headlessHost.runSim({ state: { score: 0, steps: [] }, event: { amount: 1 }, seed })
assert.equal(headlessResult.paused, null)
assert.equal(headlessHost.runView({
  state: headlessResult.state,
  frame: { frame: 0 },
  enabled: true,
  headless: true,
  draw: () => assert.fail('headless view must not draw'),
}), null)
assert.equal(headlessViewCalls, 0)
let drawCalls = 0
assert.equal(headlessHost.runView({
  state: headlessResult.state,
  frame: { frame: 1 },
  enabled: true,
  draw: (command) => {
    assert.equal(command.type, 'fixture-view')
    drawCalls++
  },
}), null)
assert.equal(headlessViewCalls, 1)
assert.equal(drawCalls, 1)
console.log('✓ sim вызван; headless view подавлен, обычный view прошёл через draw-порт')

const withView = Array.from({ length: 20 }, () => run(seed, true))
const withoutView = Array.from({ length: 20 }, () => run(seed, false))
assert.equal(new Set(withView).size, 1, '20/20 одинаковых seed должны дать одинаковый state hash')
assert.equal(new Set(withoutView).size, 1)
assert.deepEqual(withView, withoutView, 'отключение view не меняет хэш состояния')
console.log(`✓ 20/20 sim прогонов детерминированы; view on/off state sha256=${withView[0]}`)

const writeHost = hostWith({ view: attemptViewWrite })
const beforeWrite = { score: 11, steps: [1] }
const beforeWriteHash = stateHash(beforeWrite)
const writePause = writeHost.runView({ state: beforeWrite, frame: { frame: 1 }, draw: () => undefined })
assert.equal(stateHash(beforeWrite), beforeWriteHash, 'host state was not exposed to view mutation')
assert.equal(writePause?.hook, 'view')
assert.match(writePause?.reason ?? '', /read-only.*state writes are forbidden/)
console.log('✓ view write rejected by readonly type contract and runtime proxy')

const errorHost = hostWith({ sim: throwingSim })
const errorResult = errorHost.runSim({ state: { score: 4, steps: [] }, event: { amount: 2 }, seed })
assert.equal(errorResult.paused?.hook, 'sim')
assert.match(errorResult.paused?.reason ?? '', /fixture sim failure/)
assert.doesNotThrow(() => errorHost.runSim({ state: errorResult.state, event: { amount: 1 }, seed }))

const viewErrorHost = hostWith({ view: () => { throw new Error('fixture view failure') } })
const viewError = viewErrorHost.runView({ state: { score: 1, steps: [] }, frame: { frame: 0 }, draw: () => undefined })
assert.equal(viewError?.hook, 'view')
assert.match(viewError?.reason ?? '', /fixture view failure/)
console.log('✓ ошибка sim/view возвращает pause с причиной и не выходит исключением в цикл')

const impureHooks: Array<[string, PackSimHook<ProbeState, ProbeEvent>]> = [
  ['Date.now', (context) => ({ ...context.state, score: Date.now() })],
  ['Math.random', (context) => ({ ...context.state, score: Math.random() })],
  ['I/O', (context) => ({ ...context.state, score: Number(Boolean(fetch)) })],
]
for (const [expected, hook] of impureHooks) {
  const impureHost = new PackHost<ProbeState, ProbeEvent, ProbeFrame>([hostManifest])
  assert.equal(impureHost.register(fixtureManifest.id, { sim: hook }), false)
  assert.match(impureHost.paused?.reason ?? '', new RegExp(expected.replace('.', '\\.')))
}
console.log('✓ sim registration rejects Date.now, Math.random, and I/O references')
console.log('PACK_HOST_PROBE passed')
