export interface PackPanel {
  id: string
  title: string
  slot: 'left' | 'center' | 'right' | 'bottom' | 'modal'
  schema?: string
  caps?: string[]
  order?: number
}

export interface PackValidator {
  id: string
  title: string
  severity: 'error' | 'warn'
  description: string
  caps?: string[]
}

export interface PackProbe {
  id: string
  title: string
  kind: 'graph' | 'run' | 'soak' | 'snapshot'
  budget_ms: number
  checks: string[]
  caps?: string[]
}

export interface PackManifest {
  id: string
  title: string
  version: string
  runtime: 'turn' | 'realtime' | 'none'
  provides: {
    kind?: boolean
    schema: string
    panels: PackPanel[]
    validators: PackValidator[]
    probes: PackProbe[]
    seams?: Array<Record<string, unknown>>
  }
  saves: { namespace: string; version: number; migrations: number }
  requires: { core: string; packs?: string[]; caps?: string[] }
  caps?: string[]
}

export interface PackRegistryFile {
  version: 1
  packs: string[]
}

export interface ProjectKindPack {
  id: string
  pack: string
  requires?: string[]
}

export interface PackCatalogEntry {
  id: string
  title: string
}

export interface ProjectPackInput {
  kind?: unknown
  caps?: unknown
  cap_options?: unknown
  code?: unknown
  [key: string]: unknown
}

export interface PackMissingDiagnostic {
  code: 'PACK_MISSING'
  kind: string
  packId: string
  packTitle: string
  installInstructions: string
  message: string
}

export type ProjectPackResolution =
  | { status: 'ready'; kind: string; packId: string; manifest: PackManifest }
  | { status: 'missing'; diagnostic: PackMissingDiagnostic }

/** Resolve a project's kind from data registries without naming any package in code. */
export function resolveProjectPack(
  project: ProjectPackInput,
  kinds: readonly ProjectKindPack[],
  knownPacks: readonly PackCatalogEntry[],
  installedPacks: readonly PackManifest[],
): ProjectPackResolution {
  const kind = typeof project.kind === 'string' && project.kind.trim() ? project.kind.trim() : '(не указан)'
  const kindDefinition = kinds.find((entry) => entry.id === kind)
  const packId = kindDefinition?.pack ?? kind
  const manifest = installedPacks.find((entry) => entry.id === packId)
  if (manifest) return { status: 'ready', kind, packId, manifest }

  const packTitle = knownPacks.find((entry) => entry.id === packId)?.title ?? packId
  const installInstructions = `Установите каталог packs/${packId}/ с pack.json, добавьте «${packId}» в packs/registry.json и перезапустите студию.`
  return {
    status: 'missing',
    diagnostic: {
      code: 'PACK_MISSING',
      kind,
      packId,
      packTitle,
      installInstructions,
      message: `Тип проекта «${kind}» не установлен: нужен пак «${packTitle}» (${packId}). ${installInstructions}`,
    },
  }
}

/** Resolve a data registry against discovered manifests without naming any package in source. */
export function resolvePackRegistry(registryValue: unknown, manifestValues: readonly unknown[]): PackManifest[] {
  if (!registryValue || typeof registryValue !== 'object' || Array.isArray(registryValue)) {
    throw new TypeError('packs/registry.json: expected an object')
  }
  const registry = registryValue as Partial<PackRegistryFile>
  if (registry.version !== 1 || !Array.isArray(registry.packs)) {
    throw new TypeError('packs/registry.json: expected version 1 and a packs array')
  }

  const registered = new Set<string>()
  for (const id of registry.packs) {
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id)) {
      throw new TypeError(`packs/registry.json: invalid pack id ${String(id)}`)
    }
    if (registered.has(id)) throw new TypeError(`packs/registry.json: duplicate pack id "${id}"`)
    registered.add(id)
  }

  const manifests = new Map<string, PackManifest>()
  for (const value of manifestValues) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as { id?: unknown }).id !== 'string') {
      throw new TypeError('packs/*/pack.json: every discovered manifest must have a string id')
    }
    const manifest = value as PackManifest
    if (manifests.has(manifest.id)) throw new TypeError(`packs/*/pack.json: duplicate manifest id "${manifest.id}"`)
    manifests.set(manifest.id, manifest)
  }

  const missing = registry.packs.filter((id) => !manifests.has(id))
  const unregistered = [...manifests.keys()].filter((id) => !registered.has(id))
  if (missing.length || unregistered.length) {
    const details = [
      missing.length ? `registered manifests missing: ${missing.join(', ')}` : '',
      unregistered.length ? `manifests not in packs/registry.json: ${unregistered.join(', ')}` : '',
    ].filter(Boolean).join('; ')
    throw new TypeError(`packs/registry.json: ${details}`)
  }

  return registry.packs.map((id) => manifests.get(id)!)
}
