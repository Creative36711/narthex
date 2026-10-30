import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { loadCampaign } from '../src/core/loader'
import {
  packOperations,
  PackOperationError,
} from '../src/core/pack/host'

const root = resolve(import.meta.dirname, '..')
const campaignDir = join(root, 'public/campaigns/ash-of-caerden')
const origin = 'http://pack-operations.local/'
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

  const narrativeOperations = packOperations.list().filter((entry) => entry.packId === 'narrative')
  assert.ok(narrativeOperations.length >= 100)
  assert.ok(narrativeOperations.some((entry) => entry.operation === 'currentScene'))
  console.log(`PACK_OPERATIONS pack=narrative count=${narrativeOperations.length} operations=${narrativeOperations.map((entry) => entry.operation).join(',')}`)

  const current = engine.currentScene()
  assert.equal(current.id, 'scene_gates_front')
  console.log(`PACK_OPERATION_RESULT pack=narrative operation=currentScene result=${current.id}`)

  assert.equal(packOperations.register('empty-probe', {
    'empty.echo': (context, value: unknown) => ({ pack: 'empty-probe', location: context.state.location, value }),
  }), null)
  const echoed = engine.runPackOperation<{ pack: string; location: string; value: string }>('empty.echo', 'core-call-ok')
  assert.deepEqual(echoed, { pack: 'empty-probe', location: engine.state.location, value: 'core-call-ok' })
  console.log(`EMPTY_PACK_OPERATION pack=${echoed.pack} operation=empty.echo result=${echoed.value} location=${echoed.location}`)

  assert.equal(packOperations.register('broken-probe', {
    'broken.fail': () => { throw new Error('negative control') },
  }), null)
  let failure: PackOperationError | null = null
  try {
    engine.runPackOperation('broken.fail')
  } catch (error) {
    if (!(error instanceof PackOperationError)) throw error
    failure = error
  }
  assert.ok(failure)
  assert.equal(failure.refusal.code, 'PACK_OPERATION_FAILED')
  assert.equal(failure.refusal.packId, 'broken-probe')
  assert.equal(failure.refusal.operation, 'broken.fail')
  assert.equal(engine.packOperationPause?.code, 'PACK_OPERATION_FAILED')
  console.log(`PACK_OPERATION_REFUSAL code=${failure.refusal.code} pause=${engine.packOperationPause?.packId}/${engine.packOperationPause?.operation}: ${engine.packOperationPause?.reason}`)

  const paused = packOperations.call(engine, 'currentScene')
  assert.equal(paused.ok, false)
  if (!paused.ok) assert.equal(paused.refusal.code, 'PACK_OPERATION_PAUSED')
  console.log('PACK_OPERATION_PAUSED code=PACK_OPERATION_PAUSED')
} finally {
  globalThis.fetch = originalFetch
}

console.log('PACK_OPERATIONS_PROBE passed')
