export interface NarrativeCondition {
  type: string
  flag?: string
  quest?: string
  stage?: string
  item?: string
  count?: number
  location?: string
  not?: boolean
}

export interface NarrativeEffect {
  type: string
  flag?: string
  quest?: string
  item?: string
  qty?: number
  text_key?: string
}

export interface NarrativeStep {
  kind?: string
  effect?: NarrativeEffect
}

export interface NarrativeSection {
  conds?: NarrativeCondition[]
  steps?: NarrativeStep[]
  else_steps?: NarrativeStep[]
}

export interface NarrativeChoice {
  text: string
  once?: boolean
  conds?: NarrativeCondition[]
  sections?: NarrativeSection[]
  goto?: string
  check?: unknown
}

export interface NarrativeDialogueNode {
  id: string
  sections?: NarrativeSection[]
  choices?: NarrativeChoice[]
  goto?: string
}

export interface NarrativeDialogueDoc {
  version?: number
  label?: string
  nodes: NarrativeDialogueNode[]
}

export interface NarrativeScene {
  id: string
  location: string
  navigation?: Array<{ go_to_scene?: string }>
}

export interface NarrativeLocation {
  id: string
  scenes: string[]
  arrival_scene?: string
  travel_connections?: Array<{ to: string }>
}

export interface NarrativeQuestStage {
  id: string
  final?: boolean
  outcome?: 'success' | 'failure'
  on_enter_effects?: NarrativeEffect[]
  transitions?: Array<{ to: string; conditions: NarrativeCondition[] }>
}

export interface NarrativeQuest {
  id: string
  journal_entries: Record<string, string>
  stages: NarrativeQuestStage[]
}

export interface NarrativeContent {
  campaign: {
    id: string
    starting_scene: string
  }
  scenes: Record<string, NarrativeScene>
  locations: Record<string, NarrativeLocation>
  dialogues: Record<string, NarrativeDialogueDoc>
  quests: Record<string, NarrativeQuest>
}

export interface NarrativeQuestState {
  stage: string
  status: 'active' | 'completed' | 'failed'
  journal: string[]
}

export interface NarrativeDialogueState {
  dialogue: string
  node: string
}

/** Save-sized runtime data; immutable campaign content is bound at registration. */
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

export interface NarrativeFrame {
  frame: number
}
