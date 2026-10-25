import type { DeepReadonly } from '../../src/core/pack/host'
import type {
  AdventureContent,
  AdventureRuntime,
  AdventureState,
  NarrativeState,
} from './types'

export function copyNarrativeState(state: DeepReadonly<NarrativeState>): NarrativeState {
  return {
    scene: state.scene,
    location: state.location,
    flags: { ...state.flags },
    inventory: { ...state.inventory },
    quests: Object.fromEntries(Object.entries(state.quests).map(([id, quest]) => [
      id,
      { ...quest, journal: [...quest.journal] },
    ])),
    dialogue: state.dialogue ? { ...state.dialogue } : null,
    usedChoices: [...state.usedChoices],
    visitedScenes: [...state.visitedScenes],
    journal: [...state.journal],
  }
}

export function copyAdventureRuntime(runtime: DeepReadonly<AdventureRuntime>): AdventureRuntime {
  return {
    avatar: {
      ...runtime.avatar,
      path: runtime.avatar.path.map((point) => ({ ...point })),
    },
    cursor: runtime.cursor,
    takenHotspots: [...runtime.takenHotspots],
    activeRiddle: runtime.activeRiddle,
    solvedRiddles: [...runtime.solvedRiddles],
    ending: runtime.ending,
    message: runtime.message,
  }
}

export function copyAdventureState(state: DeepReadonly<AdventureState>): AdventureState {
  return {
    ...copyNarrativeState(state),
    adventure: copyAdventureRuntime(state.adventure),
  }
}

function initialRuntime(content: AdventureContent, sceneId: string): AdventureRuntime {
  const scene = content.scenes[sceneId]
  const startScene = content.scenes[content.startScene]
  if (!startScene) throw new Error(`Unknown adventure start scene ${content.startScene}`)
  const startNode = startScene.walk.nodes.find((node) => node.id === content.startNode)
  if (!startNode) throw new Error(`Unknown adventure start node ${content.startNode}`)
  const node = scene?.walk.nodes[0] ?? (sceneId === content.startScene ? startNode : null)
  return {
    avatar: node
      ? { node: node.id, x: node.x, y: node.y, path: [], distance: 0 }
      : { node: 'narrative', x: 0, y: 0, path: [], distance: 0 },
    cursor: 'walk',
    takenHotspots: [],
    activeRiddle: null,
    solvedRiddles: [],
    ending: null,
    message: null,
  }
}

/** Add adventure defaults without changing any narrative save field. */
export function openNarrativeSave(
  content: AdventureContent,
  save: DeepReadonly<NarrativeState>,
): AdventureState {
  return {
    ...copyNarrativeState(save),
    adventure: initialRuntime(content, save.scene),
  }
}

/** Project the same save for a host with only narrative capabilities. */
export function openAdventureSaveInNarrative(
  save: DeepReadonly<AdventureState>,
): NarrativeState {
  return copyNarrativeState(save)
}

export function createAdventureState(
  content: AdventureContent,
  narrative: DeepReadonly<NarrativeState>,
): AdventureState {
  return openNarrativeSave(content, narrative)
}
