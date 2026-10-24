import registrySource from '../../packs/registry.json?raw'
import { resolvePackRegistry, type PackManifest } from '../core/pack/registry'

const discoveredManifests = import.meta.glob<PackManifest>('../../packs/*/pack.json', {
  eager: true,
  import: 'default',
})

/** Same data-backed catalog consumed by the core-facing registry API and check:packs. */
export const PACK_CATALOG = Object.freeze(
  resolvePackRegistry(JSON.parse(registrySource) as unknown, Object.values(discoveredManifests)),
)
