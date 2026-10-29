import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { CAPABILITY_REGISTRY } from '../../src/core/caps'
import { resolveProjectCapabilityModes } from '../../src/core/pack/capability-modes'
import {
  resolvePackRegistry,
  resolveProjectPack,
  type PackManifest,
  type PackRegistryFile,
  type ProjectKindPack,
  type PackCatalogEntry,
  type ProjectPackInput,
  type ProjectPackResolution,
} from '../../src/core/pack/registry'

interface CapabilityCatalog {
  kinds: ProjectKindPack[]
  packs: PackCatalogEntry[]
}

function sourceRoot(): string | null {
  const candidates = [process.cwd(), resolve(import.meta.dirname, '../..')]
  return candidates.find((candidate) => existsSync(join(candidate, 'packs/registry.json'))) ?? null
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

/** Installed pack metadata for explain; IDs and capabilities come only from data. */
export async function readInstalledPackCatalogue(): Promise<PackManifest[]> {
  const root = sourceRoot()
  if (!root) return []
  const registry = await readJson<PackRegistryFile>(join(root, 'packs/registry.json'))
  const discovered = await Promise.all(registry.packs.map((id) =>
    readJson<PackManifest>(join(root, 'packs', id, 'pack.json')),
  ))
  return resolvePackRegistry(registry, discovered)
}

/**
 * Preflight for cf-play check. A standalone bundled playkit without a source
 * pack registry keeps its legacy behavior; repository checks use the installed
 * manifests from packs/registry.json. An optional registry path is useful for
 * validating projects against a particular installation set.
 */
export async function resolveProjectCapabilityModesForCheck(projectDir: string) {
  const projectPath = join(projectDir, 'project.json')
  if (!existsSync(projectPath)) return null
  const project = await readJson<ProjectPackInput>(projectPath)
  const root = sourceRoot()
  if (!root) return null
  const contracts = await readJson<CapabilityCatalog>(join(root, 'docs/contracts/caps.json'))
  const kind = contracts.kinds.find((entry) => entry.id === project.kind)
  const resolution = resolveProjectCapabilityModes(project, CAPABILITY_REGISTRY, kind?.requires ?? [])
  if (resolution.status === 'invalid') throw new TypeError(resolution.message)
  return { ...resolution, projectOptions: project.cap_options ?? {} }
}

export async function resolveProjectPackForCheck(
  projectDir: string,
  registryOverride?: string | null,
): Promise<ProjectPackResolution | null> {
  const projectPath = join(projectDir, 'project.json')
  let project: ProjectPackInput = { kind: 'narrative' }
  if (existsSync(projectPath)) project = await readJson<ProjectPackInput>(projectPath)

  const root = sourceRoot()
  if (!root && !registryOverride) return null
  const contractsPath = join(root ?? process.cwd(), 'docs/contracts/caps.json')
  const registryPath = registryOverride ? resolve(registryOverride) : join(root!, 'packs/registry.json')
  const [contracts, registry] = await Promise.all([
    readJson<CapabilityCatalog>(contractsPath),
    readJson<PackRegistryFile>(registryPath),
  ])
  const installed: PackManifest[] = []
  const packRoot = join(root ?? process.cwd(), 'packs')
  for (const id of registry.packs) {
    try {
      const manifest = await readJson<PackManifest>(join(packRoot, id, 'pack.json'))
      if (manifest.id === id) installed.push(manifest)
    } catch {
      // A registry entry without a readable manifest is not an installed pack.
    }
  }
  return resolveProjectPack(project, contracts.kinds, contracts.packs, installed)
}
