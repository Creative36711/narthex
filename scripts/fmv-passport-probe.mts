import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { CAPABILITY_REGISTRY, type CapabilityDefinition } from '../src/core/caps'
import type { PackManifest } from '../src/core/pack/registry'

interface Contracts {
  packs: Array<{ id: string; runtime: string }>
  caps: CapabilityDefinition[]
}

const root = resolve(import.meta.dirname, '..')
async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(root, path), 'utf8')) as T
}

const [contracts, manifest, example, schema, pkg] = await Promise.all([
  readJson<Contracts>('docs/contracts/caps.json'),
  readJson<PackManifest>('packs/narrative/pack.json'),
  readJson<PackManifest>('docs/contracts/examples/pack.narrative.json'),
  readJson<object>('src/core/contracts/pack.schema.json'),
  readJson<{ scripts: Record<string, string> }>('package.json'),
])

const capability = contracts.caps.find((entry) => entry.id === 'fmv')
const runtimeCapability = CAPABILITY_REGISTRY.find((entry) => entry.id === 'fmv')
assert.ok(capability, 'docs/contracts/caps.json must contain fmv')
assert.ok(runtimeCapability, 'CAPABILITY_REGISTRY must contain fmv')
assert.deepEqual({ ...runtimeCapability }, { ...capability })
assert.equal(capability.pack, 'narrative')
assert.equal(capability.status, 'experimental')
assert.equal(capability.probe, 'probe:fmv')
assert.equal(capability.since, 2)
assert.equal(contracts.caps.filter((entry) => entry.id === 'fmv').length, 1)
console.log(
  `✓ возможность ${capability.id}: pack=${capability.pack} · status=${capability.status} · probe=${capability.probe} · registry=runtime`,
)

const owned = CAPABILITY_REGISTRY.filter((entry) => entry.pack === 'narrative')
const ownedIds = owned.map((entry) => entry.id)
const capById = new Map<string, CapabilityDefinition>(CAPABILITY_REGISTRY.map((entry) => [entry.id, entry]))
const packById = new Map<string, { id: string; runtime: string }>(contracts.packs.map((entry) => [entry.id, entry]))

function semanticProblems(candidate: PackManifest): string[] {
  const problems: string[] = []
  const declared = candidate.caps ?? []
  if (candidate.id !== 'narrative') problems.push('id must be narrative')
  if (candidate.runtime !== packById.get(candidate.id)?.runtime) problems.push('runtime differs from registry')
  for (const id of declared) {
    const entry = capById.get(id)
    if (!entry) problems.push(`unknown capability ${id}`)
    else if (entry.pack !== candidate.id) problems.push(`foreign capability ${id}`)
  }
  for (const id of ownedIds) if (!declared.includes(id)) problems.push(`caps is missing ${id}`)
  for (const key of ['panels', 'validators', 'probes'] as const) {
    for (const item of candidate.provides[key]) {
      for (const id of item.caps ?? []) if (!capById.has(id)) problems.push(`${key} names unknown ${id}`)
    }
  }
  for (const id of candidate.requires.caps ?? []) if (!capById.has(id)) problems.push(`requires unknown ${id}`)
  for (const id of candidate.requires.packs ?? []) {
    if (!packById.has(id)) problems.push(`requires unknown pack ${id}`)
    if (id === candidate.id) problems.push('pack requires itself')
  }
  return problems
}

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(schema)
assert.ok(validate(manifest), JSON.stringify(validate.errors))
assert.deepEqual(semanticProblems(manifest), [])
const manifestCaps = manifest.caps ?? []
assert.equal(manifestCaps.filter((id) => id === 'fmv').length, 1)
assert.deepEqual(manifestCaps, ownedIds)
const previousCount = manifestCaps.filter((id) => id !== 'fmv').length
assert.equal(manifestCaps.length, previousCount + 1)
console.log(`✓ packs/narrative/pack.json: fmv declared · caps ${previousCount} → ${manifestCaps.length}`)

assert.ok(validate(example), JSON.stringify(validate.errors))
assert.deepEqual(semanticProblems(example), [])
assert.deepEqual(example.caps ?? [], ownedIds)
console.log(`✓ docs/contracts/examples/pack.narrative.json: schema PASS · semantics PASS · caps=${example.caps?.length}`)

for (const entry of owned) {
  assert.ok(entry.probe, `${entry.id} has no probe`)
  assert.equal(typeof pkg.scripts[entry.probe], 'string', `${entry.id} probe ${entry.probe} is absent from npm scripts`)
}
assert.ok(pkg.scripts['probe:fmv-passport'], 'passport probe alias is absent')
console.log(`✓ пробы narrative: ${owned.length}/${owned.length} возможностей имеют npm probe · fmv=probe:fmv`)
console.log('FMV_PASSPORT_PROBE passed')
