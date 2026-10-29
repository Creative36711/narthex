import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { CAPABILITY_REGISTRY } from '../src/core/caps'
import { resolvePackRegistry, type PackManifest } from '../src/core/pack/registry'

const root = resolve(import.meta.dirname, '..')
const packsRoot = resolve(root, 'packs')
const fixturesRoot = resolve(packsRoot, 'fixtures')
const corePackSchemaPath = resolve(root, 'src/core/contracts/pack.schema.json')
const docsPackSchemaPath = resolve(root, 'docs/contracts/pack.schema.json')
type Json = Record<string, any>
type Diagnostic = { path?: string; message?: string; instancePath?: string }

const readJson = async (path: string): Promise<Json> => JSON.parse(await readFile(path, 'utf8')) as Json
const rel = (path: string) => relative(root, path).split(sep).join('/')
const registry = await readJson(resolve(packsRoot, 'registry.json'))
const corePackSchema = await readJson(corePackSchemaPath)
const docsPackSchema = await readJson(docsPackSchemaPath)
const capsContract = await readJson(resolve(root, 'docs/contracts/caps.json'))
const capById = new Map<string, (typeof CAPABILITY_REGISTRY)[number]>(CAPABILITY_REGISTRY.map((cap) => [cap.id, cap]))
const packById = new Map<string, Json>(capsContract.packs.map((pack: Json) => [pack.id, pack]))
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validatePackSchema = ajv.compile(corePackSchema)
const failures: string[] = []

if (JSON.stringify(corePackSchema) !== JSON.stringify(docsPackSchema)) {
  failures.push('src/core/contracts/pack.schema.json differs from docs/contracts/pack.schema.json')
}

async function packageDirectories(): Promise<string[]> {
  const entries = await readdir(packsRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== 'fixtures')
    .map((entry) => entry.name)
    .sort()
}

async function readManifests(ids: string[]): Promise<Array<{ id: string; path: string; dir: string; manifest: Json }>> {
  const items = await Promise.all(ids.map(async (id) => {
    const dir = resolve(packsRoot, id)
    const path = resolve(dir, 'pack.json')
    return { id, path, dir, manifest: await readJson(path) }
  }))
  return items
}

function within(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate)
  return path === '' || (!isAbsolute(path) && !path.startsWith(`..${sep}`) && path !== '..')
}

function importsIn(source: string): string[] {
  const imports: string[] = []
  const pattern = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2]
    if (specifier) imports.push(specifier)
  }
  return imports
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = resolve(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(?:ts|tsx|mts|js|jsx|mjs|cjs)$/.test(extname(entry.name)) ? [full] : []
  }))
  return nested.flat()
}

async function crossPackImportDiagnostics(
  packageDir: string,
  ownerId: string | null,
  knownPackIds: string[],
): Promise<string[]> {
  const diagnostics: string[] = []
  for (const file of await sourceFiles(packageDir)) {
    const source = await readFile(file, 'utf8')
    for (const specifier of importsIn(source)) {
      for (const targetId of knownPackIds) {
        if (targetId === ownerId) continue
        const segments = specifier.split(/[\/@]+/).filter(Boolean)
        const relativeTarget = specifier.startsWith('.')
          ? resolve(dirname(file), specifier)
          : null
        const targetDir = resolve(packsRoot, targetId)
        if (segments.includes(targetId) || (relativeTarget && within(targetDir, relativeTarget))) {
          diagnostics.push(`${rel(file)}: imports another pack "${targetId}" via "${specifier}"`)
        }
      }
    }
  }
  return diagnostics
}

function schemaDiagnostics(path: string, manifest: Json): string[] {
  const valid = validatePackSchema(manifest)
  if (valid) return []
  return (validatePackSchema.errors ?? []).map((error: Diagnostic) =>
    `${rel(path)}: ${error.instancePath || '/'} ${error.message ?? 'schema validation failed'}`,
  )
}

function semanticDiagnostics(path: string, manifest: Json, expectedId?: string): string[] {
  const diagnostics: string[] = []
  if (expectedId && manifest.id !== expectedId) {
    diagnostics.push(`${rel(path)}: id "${String(manifest.id)}" does not match registered directory "${expectedId}"`)
  }

  const packRecord = packById.get(manifest.id)
  if (!packRecord) {
    diagnostics.push(`${rel(path)}: pack id "${String(manifest.id)}" is absent from capability registry`)
  } else if (manifest.runtime !== packRecord.runtime) {
    diagnostics.push(`${rel(path)}: runtime "${String(manifest.runtime)}" differs from capability registry runtime "${packRecord.runtime}"`)
  }

  const declared: string[] = Array.isArray(manifest.caps) ? manifest.caps : []
  const owned = CAPABILITY_REGISTRY.filter((cap) => cap.pack === manifest.id).map((cap) => cap.id)
  for (const id of declared) {
    if (!capById.has(id)) diagnostics.push(`${rel(path)}: caps contains unknown capability "${id}"`)
    else if (!owned.includes(id)) diagnostics.push(`${rel(path)}: caps contains capability "${id}" not owned by this pack`)
  }
  const missing = owned.filter((id) => !declared.includes(id))
  if (missing.length) diagnostics.push(`${rel(path)}: caps is missing registered capabilities: ${missing.join(', ')}`)

  for (const key of ['panels', 'validators', 'probes'] as const) {
    for (const item of manifest.provides?.[key] ?? []) {
      for (const cap of item.caps ?? []) {
        if (!capById.has(cap)) diagnostics.push(`${rel(path)}: provides.${key}.${item.id} names unknown capability "${cap}"`)
      }
    }
  }
  for (const cap of manifest.requires?.caps ?? []) {
    if (!capById.has(cap)) diagnostics.push(`${rel(path)}: requires.caps names unknown capability "${cap}"`)
  }
  for (const requiredPack of manifest.requires?.packs ?? []) {
    if (!packById.has(requiredPack)) diagnostics.push(`${rel(path)}: requires.packs names unknown pack "${requiredPack}"`)
    if (requiredPack === manifest.id) diagnostics.push(`${rel(path)}: a pack cannot require itself`)
  }

  return diagnostics
}

function localSchemaReferences(manifest: Json): string[] {
  const refs = [manifest.provides?.schema, ...(manifest.provides?.panels ?? []).map((panel: Json) => panel.schema)]
  return [...new Set(refs.filter((value): value is string => typeof value === 'string'))]
}

async function schemaFileDiagnostics(manifestPath: string, packageDir: string, manifest: Json): Promise<string[]> {
  const diagnostics: string[] = []
  for (const ref of localSchemaReferences(manifest)) {
    const target = resolve(packageDir, ref)
    if (!within(packageDir, target)) {
      diagnostics.push(`${rel(manifestPath)}: schema path "${ref}" escapes the package directory`)
      continue
    }
    try {
      const schema = await readJson(target)
      ajv.compile(schema)
    } catch (error) {
      diagnostics.push(`${rel(manifestPath)}: schema "${ref}" is missing or invalid (${error instanceof Error ? error.message : String(error)})`)
    }
  }
  return diagnostics
}

async function candidateDiagnostics(
  path: string,
  packageDir: string,
  manifest: Json,
  knownPackIds: string[],
  expectedId?: string,
  ownerId: string | null = expectedId ?? null,
): Promise<string[]> {
  return [
    ...schemaDiagnostics(path, manifest),
    ...semanticDiagnostics(path, manifest, expectedId),
    ...await schemaFileDiagnostics(path, packageDir, manifest),
    ...await crossPackImportDiagnostics(packageDir, ownerId, knownPackIds),
  ]
}

async function checkOneFixture(name: string, knownPackIds: string[]): Promise<{ output: string; mismatch?: string }> {
  const fixtureDir = resolve(fixturesRoot, name)
  const manifestPath = resolve(fixtureDir, 'pack.json')
  const expectation = await readJson(resolve(fixtureDir, 'expected.json'))
  const manifest = await readJson(manifestPath)
  const diagnostics = await candidateDiagnostics(manifestPath, fixtureDir, manifest, knownPackIds, undefined, null)
  const accepted = diagnostics.length === 0
  const expectedAccepted = expectation.accept === true
  const tokens: string[] = Array.isArray(expectation.diagnostic_contains) ? expectation.diagnostic_contains : []
  const text = diagnostics.join('\n')
  const tokensMatch = tokens.every((token) => text.includes(token))
  const matched = accepted === expectedAccepted && (expectedAccepted || tokensMatch)
  const result = accepted ? 'accepted (checker exit 0)' : `rejected (checker exit 1): ${text}`
  return {
    output: `fixture ${name}: ${matched ? 'PASS' : 'FAIL'} — ${result}`,
    mismatch: matched ? undefined : `fixture ${name} did not satisfy expected outcome${tokensMatch ? '' : `; missing diagnostic token(s): ${tokens.filter((token) => !text.includes(token)).join(', ')}`}`,
  }
}

const fixtureArgument = process.argv.indexOf('--fixture')
if (fixtureArgument >= 0) {
  const requestedName = process.argv[fixtureArgument + 1]
  const available = (await readdir(fixturesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  if (!requestedName || !available.includes(requestedName)) {
    console.error(`unknown fixture; available: ${available.sort().join(', ')}`)
    process.exit(2)
  }
  const result = await checkOneFixture(requestedName, registry.packs)
  console.log(result.output)
  if (result.mismatch) {
    console.error(result.mismatch)
    process.exit(2)
  }
  const isAccepted = result.output.includes('accepted (checker exit 0)')
  process.exit(isAccepted ? 0 : 1)
}

const diskIds = await packageDirectories()
const discovered = await readManifests(diskIds)
let resolved: PackManifest[] = []
try {
  resolved = resolvePackRegistry(registry, discovered.map((item) => item.manifest))
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
}
const registeredIds: string[] = Array.isArray(registry.packs) ? registry.packs : []
for (const id of diskIds) {
  if (!registeredIds.includes(id)) failures.push(`packs/${id}/pack.json is not registered in packs/registry.json`)
}
for (const id of registeredIds) {
  if (!diskIds.includes(id)) failures.push(`packs/registry.json lists "${id}" but packs/${id}/pack.json is missing`)
}

for (const item of discovered) {
  const diagnostics = await candidateDiagnostics(item.path, item.dir, item.manifest, registeredIds, item.id)
  failures.push(...diagnostics)
  if (diagnostics.length === 0) console.log(`pack ${item.id}: schema, registry, caps, local schemas, and import boundaries OK`)
  else for (const diagnostic of diagnostics) console.error(diagnostic)
}

const schemaCopyInSync = JSON.stringify(corePackSchema) === JSON.stringify(docsPackSchema)
console.log(`pack schema copy: ${schemaCopyInSync ? 'in sync' : 'MISMATCH'}`)
console.log(`registry: ${resolved.length} pack manifests in manifest order`)

const fixtureNames = (await readdir(fixturesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
for (const name of fixtureNames) {
  const result = await checkOneFixture(name, registeredIds)
  console.log(result.output)
  if (result.mismatch) failures.push(result.mismatch)
}

if (failures.length) {
  console.error(`\ncheck:packs failed: ${failures.length} issue(s)`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('\ncheck:packs passed')
