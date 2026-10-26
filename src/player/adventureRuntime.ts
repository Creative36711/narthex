import type { GameState } from '../shared/types'
import { PackHost, type PackDrawCommand } from '../core/pack/host'
import { PACK_CATALOG, resolveProjectPackForStudio } from '../editor/packCatalog'
import adventureManifestSource from '../../packs/adventure/pack.json'
import narrativeManifestSource from '../../packs/narrative/pack.json'
import { createAdventureHooks } from '../../packs/adventure/hooks'
import { createAdventureState } from '../../packs/adventure/state'
import { createNarrativeSim } from '../../packs/narrative/sim'
import type { AdventureContent, AdventureEvent, AdventureFrame, AdventureState, NarrativeState } from '../../packs/adventure/types'
import type { NarrativeContent } from '../../packs/narrative/types'
import type { GameEngine } from '../core/engine'
import type { PackManifest, ProjectPackInput } from '../core/pack/registry'

const adventureManifest = adventureManifestSource as PackManifest
const narrativeManifest = narrativeManifestSource as PackManifest

export interface AdventureSession {
  readonly manifest: PackManifest
  readonly content: AdventureContent
  readonly state: AdventureState
  dispatch(event: AdventureEvent): AdventureState
  draw(): PackDrawCommand[]
}

type SessionFactory = (engine: GameEngine, manifest: PackManifest) => Promise<AdventureSession>

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Adventure runtime could not load ${url}: ${response.status}`)
  try {
    return await response.json() as T
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Adventure runtime received invalid JSON from ${url}: ${detail}`)
  }
}

function flattenLocations(regions: any[]): Record<string, any> {
  const result: Record<string, any> = {}
  for (const region of regions) {
    for (const location of region.locations ?? []) result[location.id] = location
    Object.assign(result, flattenLocations(region.sub_regions ?? []))
  }
  return result
}

async function narrativeContentFor(engine: GameEngine): Promise<NarrativeContent> {
  const base = engine.campaign.basePath
  const [campaignManifest, world] = await Promise.all([
    getJson<{ dialogues: string[]; fmv?: string[] }>(`${base}/manifest.json`),
    getJson<{ regions: any[] }>(`${base}/world.json`),
  ])
  const dialogues: NarrativeContent['dialogues'] = {}
  await Promise.all((campaignManifest.dialogues ?? []).map(async (file) => {
    const id = file.replace(/\.ink$/, '')
    try {
      dialogues[id] = await getJson(`${base}/dialogues/${id}.dlg.json`)
    } catch {
      // A campaign may contain raw Ink without the Studio's optional visual document.
    }
  }))
  const scenes: NarrativeContent['scenes'] = Object.fromEntries(
    Object.entries(engine.campaign.scenes).map(([id, scene]) => [id, {
      id,
      location: scene.location,
      navigation: scene.navigation.map((navigation) => ({
        ...(navigation.go_to_scene ? { go_to_scene: navigation.go_to_scene } : {}),
        ...(navigation.open_map ? { open_map: true } : {}),
      })),
    }]),
  )
  return {
    campaign: { id: engine.campaign.meta.id, starting_scene: engine.campaign.meta.starting_scene },
    scenes,
    locations: flattenLocations(world.regions),
    dialogues,
    quests: engine.campaign.quests as NarrativeContent['quests'],
  }
}

function narrativeStateFromEngine(state: GameState): NarrativeState {
  return {
    scene: state.scene,
    location: state.location,
    flags: { ...state.flags },
    inventory: Object.fromEntries(state.player.inventory.map((entry) => [entry.item, entry.quantity])),
    quests: Object.fromEntries(Object.entries(state.quests).map(([id, quest]) => [id, {
      stage: quest.stage,
      status: quest.status,
      journal: [...quest.journal],
    }])),
    dialogue: null,
    usedChoices: [],
    visitedScenes: [state.scene],
    journal: [...state.log],
  }
}

async function createAdventureSession(engine: GameEngine, manifest: PackManifest): Promise<AdventureSession> {
  const schemaFile = manifest.provides.schema.split('/').at(-1) ?? ''
  const contentFile = schemaFile.replace(/\.schema\.json$/, '.json')
  if (!contentFile.endsWith('.json')) throw new Error(`Pack ${manifest.id} has no schema-derived data filename`)
  const content = await getJson<AdventureContent>(`${engine.campaign.basePath}/${contentFile}`)
  const narrativeContent = await narrativeContentFor(engine)
  const initial = createAdventureState(content, narrativeStateFromEngine(engine.state))
  const host = new PackHost<AdventureState, AdventureEvent, AdventureFrame>([narrativeManifest, manifest])
  const narrative = createNarrativeSim(narrativeContent)
  const hooks = createAdventureHooks(content, narrative)
  if (!host.register(manifest.id, hooks)) {
    throw new Error(`Pack ${manifest.id} registration failed: ${host.paused?.reason ?? 'unknown reason'}`)
  }

  let state = initial
  let frame = 0
  return {
    manifest,
    content,
    get state() { return state },
    dispatch(event) {
      const cursor = state.adventure.cursor
      const result = host.runSim({ state, event, seed: Number(engine.state.seed) || 0 })
      if (result.paused) throw new Error(`Pack ${result.paused.packId} paused: ${result.paused.reason}`)
      state = result.state

      if (event.type === 'adventure_click' && cursor === 'talk' && state.dialogue) {
        const dialogueRef = state.dialogue.dialogue.replaceAll('\\', '/')
        const npc = Object.values(engine.campaign.entities).find((entity) => {
          if (entity.type !== 'npc' || !entity.dialogue) return false
          const ref = entity.dialogue.replaceAll('\\', '/')
          return ref === dialogueRef || ref.endsWith(`/${dialogueRef}.ink`) || ref === `${dialogueRef}.ink`
        })
        if (npc) engine.startDialogue(npc.id, state.dialogue.node)
      }
      if (event.type === 'adventure_open_riddle' && state.scene !== engine.state.scene) {
        engine.goToScene(state.scene)
      }
      return state
    },
    draw() {
      const commands: PackDrawCommand[] = []
      const paused = host.runView({
        state,
        frame: { frame: frame++ },
        draw: (command) => commands.push(command),
      })
      if (paused) throw new Error(`Pack ${paused.packId} view paused: ${paused.reason}`)
      return commands
    },
  }
}

// Runtime modules are keyed by their installed manifest ID, never by a project or pack-name branch.
const sessionFactories = new Map<string, SessionFactory>([[adventureManifest.id, createAdventureSession]])

/** Resolve the project kind through the registry before loading its available screen runtime. */
export async function loadPlayerPackSession(engine: GameEngine): Promise<AdventureSession | null> {
  const response = await fetch(`${engine.campaign.basePath}/project.json`)
  if (!response.ok) return null
  let project: ProjectPackInput
  try {
    project = await response.json()
  } catch {
    // Legacy campaigns do not have project.json; SPA fallback HTML is not a pack declaration.
    return null
  }
  const resolution = resolveProjectPackForStudio(project)
  if (resolution.status !== 'ready') return null
  const installedManifest = PACK_CATALOG.find((entry) => entry.id === resolution.manifest.id)
  const factory = sessionFactories.get(resolution.manifest.id)
  if (!installedManifest || !factory) return null
  return factory(engine, installedManifest)
}
