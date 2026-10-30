export type CursorMode = 'walk' | 'look' | 'take' | 'talk'

export interface Point {
  x: number
  y: number
}

export interface WalkNode extends Point {
  id: string
}

export interface AdventureHotspot {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  message: string
  item?: string
  dialogue?: string
  node?: string
}

export interface AdventureScene {
  walk: {
    nodes: WalkNode[]
    edges: Array<[string, string]>
  }
  hotspots: AdventureHotspot[]
}

export interface ItemCombination {
  id: string
  inputs: [string, string]
  output: string
  message: string
}

export interface AdventureRiddle {
  id: string
  scene: string
  background: string
  solution: string[]
  ending: string
  message: string
}

export interface AdventureEnding {
  label: string
}

/** Data owned by this pack; no narrative implementation is imported. */
export interface AdventureContent {
  version: 1
  startScene: string
  startNode: string
  scenes: Record<string, AdventureScene>
  combinations: ItemCombination[]
  riddles: AdventureRiddle[]
  endings: Record<string, AdventureEnding>
}

/** Structural save contract supplied by the required narrative capability. */
export interface NarrativeQuestState {
  stage: string
  status: 'active' | 'completed' | 'failed'
  journal: string[]
}

export interface NarrativeDialogueState {
  dialogue: string
  node: string
}

export interface NarrativeState {
  scene: string
  location: string
  flags: Record<string, boolean>
  inventory: Record<string, number>
  quests: Record<string, NarrativeQuestState>
  dialogue: NarrativeDialogueState | null
  usedChoices: string[]
  visitedScenes: string[]
  journal: string[]
}

export type NarrativeEvent =
  | { type: 'goto'; scene: string }
  | { type: 'travel'; location: string }
  | { type: 'start_dialogue'; dialogue: string; node?: string }
  | { type: 'choose_dialogue'; choice: number }
  | { type: 'continue_dialogue' }
  | { type: 'start_quest'; quest: string }
  | { type: 'set_flag'; flag: string; value?: boolean }
  | { type: 'add_item'; item: string; quantity?: number }

export interface AvatarState {
  node: string
  x: number
  y: number
  path: Point[]
  distance: number
}

/** Foreign data is namespaced so a narrative-only reader can ignore it. */
export interface AdventureRuntime {
  avatar: AvatarState
  cursor: CursorMode
  takenHotspots: string[]
  activeRiddle: string | null
  solvedRiddles: string[]
  ending: string | null
  message: string | null
}

export interface AdventureState extends NarrativeState {
  adventure: AdventureRuntime
}

export type AdventureEvent =
  | NarrativeEvent
  | { type: 'adventure_cursor'; mode: CursorMode }
  | { type: 'adventure_click'; x: number; y: number }
  | { type: 'adventure_combine'; first: string; second: string }
  | { type: 'adventure_open_riddle'; riddle: string }
  | { type: 'adventure_solve_riddle'; riddle: string; solution: string[] }

export interface AdventureFrame {
  frame: number
}
