import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CAPABILITY_REGISTRY } from '../src/core/caps'
import {
  resolveProjectPack,
  type PackManifest,
  type PackRegistryFile,
  type ProjectKindPack,
} from '../src/core/pack/registry'

interface AdventureContracts {
  kinds: Array<ProjectKindPack & { title: string }>
  packs: Array<{ id: string; title: string; runtime: string; status: string }>
  caps: Array<{
    id: string
    title: string
    pack: string | null
    status: string
    since: number
    enables: string
    probe: string | null
  }>
}

const root = resolve(import.meta.dirname, '..')
const contracts = JSON.parse(
  await readFile(resolve(root, 'docs/contracts/caps.json'), 'utf8'),
) as AdventureContracts
const packRegistry = JSON.parse(
  await readFile(resolve(root, 'packs/registry.json'), 'utf8'),
) as PackRegistryFile
const installedPacks = await Promise.all(
  packRegistry.packs.map(async (id) => JSON.parse(
    await readFile(resolve(root, 'packs', id, 'pack.json'), 'utf8'),
  ) as PackManifest),
)

const pack = contracts.packs.find((entry) => entry.id === 'adventure')
assert.ok(pack, 'docs/contracts/caps.json must contain the adventure pack passport')
assert.equal(pack.runtime, 'turn')
assert.equal(pack.status, 'experimental')
console.log(`✓ паспорт пака ${pack.id}: runtime=${pack.runtime} · status=${pack.status}`)

const capability = contracts.caps.find((entry) => entry.id === 'adventure')
const runtimeCapability = CAPABILITY_REGISTRY.find((entry) => entry.id === 'adventure')
assert.ok(capability, 'docs/contracts/caps.json must contain the adventure capability')
assert.ok(runtimeCapability, 'CAPABILITY_REGISTRY must contain the adventure capability')
assert.deepEqual({ ...runtimeCapability }, { ...capability })
assert.equal(capability.pack, 'adventure')
assert.equal(capability.status, 'experimental')
assert.equal(capability.probe, 'probe:adventure')
console.log(
  `✓ возможность ${capability.id}: pack=${capability.pack} · status=${capability.status} · probe=${capability.probe}`,
)

const kind = contracts.kinds.find((entry) => entry.id === 'adventure')
assert.ok(kind, 'docs/contracts/caps.json must contain the adventure project kind')
assert.equal(kind.pack, 'adventure')
assert.deepEqual(kind.requires, ['adventure'])
console.log(`✓ тип проекта ${kind.id} → пак ${kind.pack} · requires=${JSON.stringify(kind.requires)}`)

// The negative resolver control must remain valid after the real pack is installed.
const withoutAdventure = installedPacks.filter((entry) => entry.id !== 'adventure')
const resolution = resolveProjectPack(
  { kind: 'adventure' },
  contracts.kinds,
  contracts.packs,
  withoutAdventure,
)
assert.equal(resolution.status, 'missing')
if (resolution.status !== 'missing') throw new Error('uninstalled adventure must not resolve as ready')
assert.equal(resolution.diagnostic.code, 'PACK_MISSING')
assert.equal(resolution.diagnostic.packId, 'adventure')
assert.match(resolution.diagnostic.installInstructions, /packs\/adventure\//)
assert.match(resolution.diagnostic.installInstructions, /packs\/registry\.json/)
console.log('✓ resolveProjectPack({kind:"adventure"}): PACK_MISSING · packId=adventure')
console.log(`  ${resolution.diagnostic.installInstructions}`)
console.log('ADVENTURE_PASSPORT_PROBE passed')
