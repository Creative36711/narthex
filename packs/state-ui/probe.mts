import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { advanceState } from './machine'
import { buildStatePanel } from './panel'
import { validateStateMachine } from './validate'
import type { StateMachineDefinition } from './types'

const root = resolve(import.meta.dirname, '../..')
const schema = JSON.parse(await readFile(resolve(root, 'packs/state-ui/schema/state-machine.schema.json'), 'utf8'))
const machine = JSON.parse(await readFile(resolve(root, 'packs/state-ui/data/turn-cycle.json'), 'utf8')) as StateMachineDefinition
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateSchema = ajv.compile(schema)
assert.equal(validateSchema(machine), true, JSON.stringify(validateSchema.errors))
assert.deepEqual(validateStateMachine(machine), [])
console.log('✓ state-ui data: JSON Schema and semantic validator accept the declared turn-cycle machine')

function replay(events: string[]): string[] {
  let state = machine.initial
  const sequence = [state]
  for (const event of events) {
    state = advanceState(machine, state, event)
    sequence.push(state)
  }
  return sequence
}

const events = ['begin', 'finish']
const firstReplay = replay(events)
assert.deepEqual(firstReplay, ['ready', 'active', 'completed'])
assert.deepEqual(replay(events), firstReplay, 'identical event streams must replay deterministically')
assert.throws(() => advanceState(machine, 'ready', 'finish'), /No transition/)
console.log(`✓ deterministic simulation: ${events.join(' → ')} ⇒ ${firstReplay.join(' → ')}`)

const panel = buildStatePanel(machine, 'active')
assert.equal(panel.currentTitle, 'Ход выполняется')
assert.deepEqual(panel.availableEvents.map((item) => item.event), ['finish', 'cancel'])
assert.equal(panel.terminal, false)
assert.throws(() => buildStatePanel(machine, 'missing'), /Unknown current state/)
console.log('✓ read-only state panel: active state and both available events are projected from the manifest data')

const ambiguous = structuredClone(machine)
ambiguous.transitions.push({ id: 'finish-again', from: 'active', event: 'finish', to: 'cancelled' })
assert.ok(validateStateMachine(ambiguous).some((problem) => problem.includes('ambiguous event')))
console.log('✓ negative validator control: duplicate (state, event) transition is rejected')

// Run the checked-in, production player bundle against a real existing campaign.
const player = resolve(root, 'public/ai/cf-play.mjs')
const campaign = resolve(root, 'public/campaigns/ash-of-caerden')
const workspace = await mkdtemp(join(tmpdir(), 'narthex-state-ui-probe-'))
try {
  const checked = spawnSync(process.execPath, [
    player,
    'check',
    campaign,
    '--json',
    '--seeds',
    '1-1',
    '--steps',
    '80',
    '--out',
    join(workspace, 'player-check'),
  ], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
  assert.equal(checked.status, 0, `${checked.stdout ?? ''}${checked.stderr ?? ''}`)
  const report = JSON.parse(checked.stdout) as {
    verdict?: string
    pack?: { packId?: string; seam?: string; steps?: number }
  }
  assert.equal(report.verdict, 'ok')
  assert.equal(report.pack?.packId, 'narrative')
  assert.equal(report.pack?.seam, 'narrative.sim')
  assert.equal(report.pack?.steps, 1)
  console.log(`✓ real player: cf-play check verdict=${report.verdict}, pack=${report.pack.packId}, seam=${report.pack.seam}, rc=${checked.status}`)
} finally {
  await rm(workspace, { recursive: true, force: true })
}

console.log('STATE_UI_PROBE passed')
