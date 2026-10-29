import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const probe = spawnSync(process.execPath, [
  resolve(root, 'node_modules/tsx/dist/cli.mjs'),
  resolve(root, 'scripts/probe-capability-modes.mts'),
], { cwd: root, encoding: 'utf8', timeout: 300_000, maxBuffer: 16 * 1024 * 1024 })
const output = `${probe.stdout ?? ''}${probe.stderr ?? ''}`
assert.equal(probe.status, 0, output)
assert.match(output, /CAPABILITY_MODES_PROBE passed/)
assert.match(output, /SAVE_HASH_MATCH=true/)
assert.match(output, /CODE negative control: rc=1/)
console.log('CAPABILITY_MODES_SMOKE passed')
