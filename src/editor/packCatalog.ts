import registrySource from '../../packs/registry.json?raw'
import capabilitySource from '../../docs/contracts/caps.json?raw'
import {
  resolvePackRegistry,
  resolveProjectPack,
  type PackCatalogEntry,
  type PackManifest,
  type PackRegistryFile,
  type ProjectKindPack,
  type ProjectPackInput,
} from '../core/pack/registry'

const discoveredManifests = import.meta.glob<PackManifest>('../../packs/*/pack.json', {
  eager: true,
  import: 'default',
})

const declaredRegistry = JSON.parse(registrySource) as PackRegistryFile
const discovered = Object.values(discoveredManifests)
// A missing installed pack must not make Studio fail while importing its catalog.
// check:packs remains strict and reports registry/manifests drift at build time.
const installed = declaredRegistry.packs.flatMap((id) => {
  const manifest = discovered.find((entry) => entry.id === id)
  return manifest ? [manifest] : []
})
const runtimeRegistry: PackRegistryFile = { version: 1, packs: installed.map((pack) => pack.id) }

/** Registered and discovered manifests currently installed in this Studio build. */
export const PACK_CATALOG = Object.freeze(resolvePackRegistry(runtimeRegistry, installed))

const contracts = JSON.parse(capabilitySource) as {
  kinds: ProjectKindPack[]
  packs: PackCatalogEntry[]
}
export const PROJECT_KIND_CATALOG = Object.freeze(contracts.kinds)
export const KNOWN_PACK_CATALOG = Object.freeze(contracts.packs)

/** The same generic pack resolution used by project opening and cf-play check. */
export function resolveProjectPackForStudio(project: ProjectPackInput) {
  return resolveProjectPack(project, PROJECT_KIND_CATALOG, KNOWN_PACK_CATALOG, PACK_CATALOG)
}
