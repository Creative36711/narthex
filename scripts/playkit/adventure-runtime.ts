import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PackHost, type PackDrawCommand } from '../../src/core/pack/host'
import { resolveProjectPackForCheck } from './project-pack'
import adventureManifestSource from '../../packs/adventure/pack.json' with { type: 'json' }
import narrativeManifestSource from '../../packs/narrative/pack.json' with { type: 'json' }
import { createAdventureHooks } from '../../packs/adventure/hooks'
import { createAdventureState } from '../../packs/adventure/state'
import type { AdventureContent, AdventureEvent, AdventureFrame, AdventureState, NarrativeState } from '../../packs/adventure/types'
import { createNarrativeSim, createNarrativeState } from '../../packs/narrative/sim'
import { loadNarrativeContent } from '../../packs/narrative/runtime'
import type { PackManifest } from '../../src/core/pack/registry'

const adventureManifest = adventureManifestSource as PackManifest
const narrativeManifest = narrativeManifestSource as PackManifest

type Engine = Record<string, any>
type Action = Record<string, any>

export interface PlaykitAdventureSession {
  readonly state: AdventureState
  act(engine: Engine, action: Action): string
  observe(): Record<string, unknown>
  draw(): PackDrawCommand[]
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

function narrativeStateFromEngine(engine: Engine): NarrativeState {
  const state = engine.state as Record<string, any>
  return {
    scene: String(state.scene),
    location: String(state.location),
    flags: { ...(state.flags ?? {}) },
    inventory: Object.fromEntries(((state.player?.inventory ?? []) as Array<Record<string, any>>).map((entry) => [
      String(entry.item), Number(entry.quantity ?? 1),
    ])),
    quests: Object.fromEntries(Object.entries((state.quests ?? {}) as Record<string, any>).map(([id, quest]) => [id, {
      stage: String(quest.stage ?? ''),
      status: quest.status,
      journal: [...(quest.journal ?? [])],
    }])),
    dialogue: null,
    usedChoices: [],
    visitedScenes: [String(state.scene)],
    journal: [...(state.log ?? [])],
  }
}

function eventOf(action: Action): AdventureEvent {
  switch (action.do) {
    case 'adventure_cursor':
      return { type: 'adventure_cursor', mode: action.mode }
    case 'adventure_click':
      return { type: 'adventure_click', x: Number(action.x), y: Number(action.y) }
    case 'adventure_combine':
      return { type: 'adventure_combine', first: String(action.first), second: String(action.second) }
    case 'adventure_open_riddle':
      return { type: 'adventure_open_riddle', riddle: String(action.riddle) }
    case 'adventure_solve_riddle':
      return {
        type: 'adventure_solve_riddle',
        riddle: String(action.riddle),
        solution: Array.isArray(action.solution) ? action.solution.map(String) : [],
      }
    default:
      throw new Error(`Unsupported adventure action: ${String(action.do)}`)
  }
}

async function createAdventureSession(campaignDir: string, engine: Engine, manifest: PackManifest): Promise<PlaykitAdventureSession> {
  const schemaFile = manifest.provides.schema.split('/').at(-1) ?? ''
  const contentFile = schemaFile.replace(/\.schema\.json$/, '.json')
  if (!contentFile.endsWith('.json')) throw new Error(`Pack ${manifest.id} has no schema-derived data filename`)
  const [content, narrativeContent] = await Promise.all([
    readJson<AdventureContent>(join(campaignDir, contentFile)),
    loadNarrativeContent(campaignDir),
  ])
  const initial = createAdventureState(content, narrativeStateFromEngine(engine))
  const narrative = createNarrativeSim(narrativeContent)
  const host = new PackHost<AdventureState, AdventureEvent, AdventureFrame>([narrativeManifest, manifest])
  if (!host.register(manifest.id, createAdventureHooks(content, narrative))) {
    throw new Error(`Pack ${manifest.id} registration failed: ${host.paused?.reason ?? 'unknown reason'}`)
  }
  let state = initial
  let frame = 0
  return {
    get state() { return state },
    act(currentEngine, action) {
      const cursor = state.adventure.cursor
      const event = eventOf(action)
      const result = host.runSim({ state, event, seed: Number(currentEngine.state.seed) || 0 })
      if (result.paused) throw new Error(`Pack ${result.paused.packId} paused: ${result.paused.reason}`)
      state = result.state
      if (event.type === 'adventure_click' && cursor === 'talk' && state.dialogue) {
        const dialogueRef = state.dialogue.dialogue.replaceAll('\\', '/')
        const npc = Object.values(currentEngine.campaign.entities as Record<string, Record<string, any>>).find((entity) => {
          if (entity.type !== 'npc' || !entity.dialogue) return false
          const ref = String(entity.dialogue).replaceAll('\\', '/')
          return ref === dialogueRef || ref.endsWith(`/${dialogueRef}.ink`) || ref === `${dialogueRef}.ink`
        })
        if (npc) currentEngine.startDialogue(npc.id, state.dialogue.node)
      }
      if (event.type === 'adventure_open_riddle' && state.scene !== currentEngine.state.scene) {
        currentEngine.goToScene(state.scene)
      }
      return `${event.type}${event.type === 'adventure_click' ? ` (${event.x},${event.y})` : ''}`
    },
    observe() {
      return {
        scene: state.scene,
        cursor: state.adventure.cursor,
        avatar: { ...state.adventure.avatar, path: state.adventure.avatar.path.map((point) => ({ ...point })) },
        inventory: { ...state.inventory },
        message: state.adventure.message,
        activeRiddle: state.adventure.activeRiddle,
        ending: state.adventure.ending,
      }
    },
    draw() {
      const commands: PackDrawCommand[] = []
      const paused = host.runView({ state, frame: { frame: frame++ }, draw: (command) => commands.push(command) })
      if (paused) throw new Error(`Pack ${paused.packId} view paused: ${paused.reason}`)
      return commands
    },
  }
}

const factories = new Map<string, (campaignDir: string, engine: Engine, manifest: PackManifest) => Promise<PlaykitAdventureSession>>([
  [adventureManifest.id, createAdventureSession],
])

/** Installs only a runtime whose project kind resolves through packs/registry.json. */
export async function createPlaykitAdventureSession(campaignDir: string, engine: Engine): Promise<PlaykitAdventureSession | null> {
  const resolution = await resolveProjectPackForCheck(campaignDir)
  if (!resolution || resolution.status !== 'ready') return null
  const factory = factories.get(resolution.manifest.id)
  return factory ? factory(campaignDir, engine, resolution.manifest) : null
}
