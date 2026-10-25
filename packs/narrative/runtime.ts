import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PackSimBinding } from '../../src/core/pack/host'
import type { PackManifest } from '../../src/core/pack/registry'
import manifest from './pack.json' with { type: 'json' }
import { createNarrativeHooks } from './hooks'
import { createNarrativeState } from './sim'
import type {
  NarrativeContent,
  NarrativeEvent,
  NarrativeFrame,
  NarrativeLocation,
  NarrativeState,
} from './types'

export const NARRATIVE_PACK_MANIFEST = manifest as PackManifest

interface DataManifest {
  scenes: string[]
  dialogues: string[]
  quests?: string[]
  fmv?: string[]
}

interface WorldRegion {
  locations: NarrativeLocation[]
  sub_regions?: WorldRegion[]
}

interface WorldFile {
  regions: WorldRegion[]
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

function flattenLocations(regions: readonly WorldRegion[]): Record<string, NarrativeLocation> {
  const result: Record<string, NarrativeLocation> = {}
  for (const region of regions) {
    for (const location of region.locations) result[location.id] = location
    Object.assign(result, flattenLocations(region.sub_regions ?? []))
  }
  return result
}

/** Load only the immutable data owned by the narrative pack; no core rules are imported. */
export async function loadNarrativeContent(campaignDir: string): Promise<NarrativeContent> {
  const [campaign, world, dataManifest] = await Promise.all([
    readJson<NarrativeContent['campaign']>(join(campaignDir, 'campaign.json')),
    readJson<WorldFile>(join(campaignDir, 'world.json')),
    readJson<DataManifest>(join(campaignDir, 'manifest.json')),
  ])

  const scenes: NarrativeContent['scenes'] = {}
  for (const file of dataManifest.scenes) {
    const scene = await readJson<NarrativeContent['scenes'][string]>(join(campaignDir, 'scenes', file))
    scenes[scene.id] = scene
  }
  const dialogues: NarrativeContent['dialogues'] = {}
  for (const file of dataManifest.dialogues) {
    const id = file.replace(/\.ink$/, '')
    dialogues[id] = await readJson<NarrativeContent['dialogues'][string]>(
      join(campaignDir, 'dialogues', `${id}.dlg.json`),
    )
  }
  const quests: NarrativeContent['quests'] = {}
  for (const file of dataManifest.quests ?? []) {
    const quest = await readJson<NarrativeContent['quests'][string]>(join(campaignDir, 'quests', file))
    quests[quest.id] = quest
  }
  const fmvDocuments: NonNullable<NarrativeContent['fmv']> = {}
  for (const file of dataManifest.fmv ?? []) {
    const document = await readJson<NonNullable<NarrativeContent['fmv']>[string]>(join(campaignDir, 'fmv', file))
    fmvDocuments[document.id] = document
  }

  return {
    campaign,
    scenes,
    locations: flattenLocations(world.regions),
    dialogues,
    quests,
    ...(Object.keys(fmvDocuments).length ? { fmv: fmvDocuments } : {}),
  }
}

/** The engine receives code and initial state, never a core implementation of narrative rules. */
export function createNarrativePackBinding(
  content: NarrativeContent,
  manifest: PackManifest,
): PackSimBinding<NarrativeState, NarrativeEvent, NarrativeFrame> {
  return {
    manifest,
    hooks: createNarrativeHooks(content),
    state: createNarrativeState(content),
  }
}

/** Pick one real entry event for the headless check without inventing a second rules engine. */
export function narrativeEntryEvent(
  content: NarrativeContent,
  state: NarrativeState,
): NarrativeEvent {
  if (state.fmv) {
    return { type: 'fmv_ready', scene: state.fmv.scene, fragment: state.fmv.fragment }
  }
  const scene = content.scenes[state.scene]
  const target = scene?.navigation?.find((navigation) => navigation.go_to_scene)?.go_to_scene
  if (target) return { type: 'goto', scene: target }
  const destination = content.locations[state.location]?.travel_connections?.[0]?.to
  if (destination) return { type: 'travel', location: destination }
  throw new Error(`PACK_RUNTIME_NO_ENTRY: ${state.scene} has no FMV, scene navigation, or travel event`)
}
