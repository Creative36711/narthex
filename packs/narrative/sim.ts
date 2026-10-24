import type { DeepReadonly, PackSimHook } from '../../src/core/pack/host'
import type {
  NarrativeCondition,
  NarrativeContent,
  NarrativeDialogueNode,
  NarrativeEffect,
  NarrativeEvent,
  NarrativeSection,
  NarrativeState,
  NarrativeStep,
} from './types'

interface WorkingState extends NarrativeState {
  content: NarrativeContent
}

function runtimeCopy(state: DeepReadonly<NarrativeState>): NarrativeState {
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

function editable(
  state: DeepReadonly<NarrativeState>,
  content: NarrativeContent,
): WorkingState {
  return { ...runtimeCopy(state), content }
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}`)
  return value
}

export function createNarrativeState(content: NarrativeContent): NarrativeState {
  const scene = content.scenes[content.campaign.starting_scene]
  if (!scene) throw new Error(`Unknown starting scene ${content.campaign.starting_scene}`)
  if (!content.locations[scene.location]) throw new Error(`Unknown starting location ${scene.location}`)
  return {
    scene: scene.id,
    location: scene.location,
    flags: {},
    inventory: {},
    quests: {},
    dialogue: null,
    usedChoices: [],
    visitedScenes: [scene.id],
    journal: [],
  }
}

function conditionOk(state: WorkingState, condition: NarrativeCondition): boolean {
  let result: boolean
  switch (condition.type) {
    case 'flag':
    case 'flag_set':
      result = state.flags[required(condition.flag, 'flag condition id')] === true
      break
    case 'quest': {
      const questId = required(condition.quest, 'quest condition id')
      result = (state.quests[questId]?.stage ?? '') === (condition.stage ?? '')
      break
    }
    case 'has_item':
      result = (state.inventory[required(condition.item, 'item condition id')] ?? 0) > 0
      break
    case 'item_ge':
      result = (state.inventory[required(condition.item, 'item condition id')] ?? 0) >= (condition.count ?? 1)
      break
    case 'player_enters_location':
      result = state.location === required(condition.location, 'location condition id')
      break
    default:
      throw new Error(`Unsupported narrative condition ${condition.type}`)
  }
  return condition.not ? !result : result
}

function conditionsOk(state: WorkingState, conditions: readonly NarrativeCondition[]): boolean {
  return conditions.every((condition) => conditionOk(state, condition))
}

function writeJournal(state: WorkingState, questId: string, textKey: string): void {
  const quest = state.content.quests[questId]
  if (!quest) throw new Error(`Unknown quest ${questId}`)
  const text = quest.journal_entries[textKey]
  if (!text) throw new Error(`Unknown journal entry ${questId}/${textKey}`)
  if (!state.journal.includes(text)) state.journal.push(text)
  const current = state.quests[questId]
  if (current && !current.journal.includes(text)) current.journal.push(text)
}

function enterQuestStage(state: WorkingState, questId: string, stageId: string): void {
  const quest = state.content.quests[questId]
  if (!quest) throw new Error(`Unknown quest ${questId}`)
  const stage = quest.stages.find((candidate) => candidate.id === stageId)
  if (!stage) throw new Error(`Unknown quest stage ${questId}/${stageId}`)
  const previous = state.quests[questId]
  state.quests[questId] = {
    stage: stageId,
    status: stage.final ? (stage.outcome === 'failure' ? 'failed' : 'completed') : 'active',
    journal: previous ? [...previous.journal] : [],
  }
  // Journal effects are narrative-owned; rewards and UI messages stay outside this reducer.
  for (const effect of stage.on_enter_effects ?? []) {
    if (effect.type === 'journal_update') applyEffect(state, effect)
  }
}

function startQuest(state: WorkingState, questId: string): void {
  if (state.quests[questId]) return
  const quest = state.content.quests[questId]
  if (!quest) throw new Error(`Unknown quest ${questId}`)
  const first = quest.stages[0]
  if (!first) throw new Error(`Quest ${questId} has no stages`)
  enterQuestStage(state, questId, first.id)
}

function advanceQuests(state: WorkingState): void {
  // A transition can unlock another transition; the bound turns cycles into a pause.
  for (let pass = 0; pass < 64; pass++) {
    let changed = false
    for (const questId of Object.keys(state.content.quests).sort()) {
      const current = state.quests[questId]
      if (!current || current.status !== 'active') continue
      const quest = state.content.quests[questId]!
      const stage = quest.stages.find((candidate) => candidate.id === current.stage)
      if (!stage) throw new Error(`Unknown active quest stage ${questId}/${current.stage}`)
      const transition = (stage.transitions ?? []).find((candidate) => conditionsOk(state, candidate.conditions))
      if (!transition) continue
      enterQuestStage(state, questId, transition.to)
      changed = true
    }
    if (!changed) return
  }
  throw new Error('Quest transition limit exceeded')
}

function changeItem(state: WorkingState, itemId: string, delta: number): void {
  const quantity = (state.inventory[itemId] ?? 0) + delta
  if (quantity < 0) throw new Error(`Not enough ${itemId}`)
  if (quantity === 0) delete state.inventory[itemId]
  else state.inventory[itemId] = quantity
}

function applyEffect(state: WorkingState, effect: NarrativeEffect): void {
  switch (effect.type) {
    case 'set_flag':
      state.flags[required(effect.flag, 'flag effect id')] = true
      return
    case 'start_quest':
      startQuest(state, required(effect.quest, 'quest effect id'))
      return
    case 'add_item':
      changeItem(state, required(effect.item, 'item effect id'), effect.qty ?? 1)
      return
    case 'remove_item':
      changeItem(state, required(effect.item, 'item effect id'), -(effect.qty ?? 1))
      return
    case 'journal_update':
      writeJournal(state, required(effect.quest, 'journal quest id'), required(effect.text_key, 'journal text key'))
      return
    default:
      throw new Error(`Unsupported narrative effect ${effect.type}`)
  }
}

function applySteps(state: WorkingState, steps: readonly NarrativeStep[]): void {
  for (const step of steps) {
    if (step.effect) applyEffect(state, step.effect)
  }
}

function applySections(state: WorkingState, sections: readonly NarrativeSection[]): void {
  for (const section of sections) {
    const steps = conditionsOk(state, section.conds ?? []) ? section.steps : section.else_steps
    applySteps(state, steps ?? [])
  }
}

function dialogueNode(state: WorkingState): NarrativeDialogueNode {
  if (!state.dialogue) throw new Error('No active dialogue')
  const dialogueDoc = state.content.dialogues[state.dialogue.dialogue]
  if (!dialogueDoc) throw new Error(`Unknown dialogue ${state.dialogue.dialogue}`)
  const node = dialogueDoc.nodes.find((candidate) => candidate.id === state.dialogue!.node)
  if (!node) throw new Error(`Unknown dialogue node ${state.dialogue.dialogue}/${state.dialogue.node}`)
  return node
}

function enterDialogueNode(state: WorkingState, nodeId: string): void {
  if (!state.dialogue) throw new Error('No active dialogue')
  const dialogueDoc = state.content.dialogues[state.dialogue.dialogue]
  if (!dialogueDoc) throw new Error(`Unknown dialogue ${state.dialogue.dialogue}`)
  const node = dialogueDoc.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) throw new Error(`Unknown dialogue node ${state.dialogue.dialogue}/${nodeId}`)
  state.dialogue.node = nodeId
  applySections(state, node.sections ?? [])
}

function finishDialogueTransition(state: WorkingState, target: string): void {
  if (target === 'end') state.dialogue = null
  else if (target !== 'stay') enterDialogueNode(state, target)
}

function enterScene(state: WorkingState, sceneId: string): void {
  const scene = state.content.scenes[sceneId]
  if (!scene) throw new Error(`Unknown scene ${sceneId}`)
  if (!state.content.locations[scene.location]) throw new Error(`Unknown scene location ${scene.location}`)
  state.scene = sceneId
  state.location = scene.location
  if (!state.visitedScenes.includes(sceneId)) state.visitedScenes.push(sceneId)
}

function reduceNarrative(
  content: NarrativeContent,
  readonlyState: DeepReadonly<NarrativeState>,
  event: DeepReadonly<NarrativeEvent>,
): NarrativeState {
  const state = editable(readonlyState, content)
  switch (event.type) {
    case 'goto': {
      const current = state.content.scenes[state.scene]
      if (!current?.navigation?.some((navigation) => navigation.go_to_scene === event.scene)) {
        throw new Error(`Scene ${state.scene} has no navigation to ${event.scene}`)
      }
      enterScene(state, event.scene)
      break
    }
    case 'travel': {
      const current = state.content.locations[state.location]
      if (!current?.travel_connections?.some((connection) => connection.to === event.location)) {
        throw new Error(`Location ${state.location} has no route to ${event.location}`)
      }
      const target = state.content.locations[event.location]
      if (!target) throw new Error(`Unknown location ${event.location}`)
      const scene = target.arrival_scene ?? target.scenes[0]
      enterScene(state, required(scene, `arrival scene for ${event.location}`))
      break
    }
    case 'start_dialogue': {
      if (state.dialogue) throw new Error('Another dialogue is already active')
      if (!state.content.dialogues[event.dialogue]) throw new Error(`Unknown dialogue ${event.dialogue}`)
      state.dialogue = { dialogue: event.dialogue, node: event.node ?? 'main' }
      enterDialogueNode(state, state.dialogue.node)
      break
    }
    case 'choose_dialogue': {
      const node = dialogueNode(state)
      const choice = node.choices?.[event.choice]
      if (!choice) throw new Error(`Unknown dialogue choice ${event.choice}`)
      const key = `${state.dialogue!.dialogue}:${node.id}:${event.choice}`
      if (choice.once && state.usedChoices.includes(key)) throw new Error(`Choice ${key} was already used`)
      if (!conditionsOk(state, choice.conds ?? [])) throw new Error(`Choice ${key} is not available`)
      if (choice.check !== undefined) throw new Error('Skill checks require a resolved outcome event')
      applySections(state, choice.sections ?? [])
      if (choice.once) state.usedChoices.push(key)
      finishDialogueTransition(state, choice.goto ?? 'stay')
      break
    }
    case 'continue_dialogue': {
      const node = dialogueNode(state)
      if (node.choices?.length) throw new Error('Dialogue node is waiting for a choice')
      finishDialogueTransition(state, node.goto ?? 'end')
      break
    }
    case 'start_quest':
      startQuest(state, event.quest)
      break
    case 'set_flag':
      state.flags[event.flag] = event.value ?? true
      break
    case 'add_item':
      changeItem(state, event.item, event.quantity ?? 1)
      break
  }
  advanceQuests(state)
  return runtimeCopy(state)
}

/** Bind immutable data once; the returned hook remains synchronous and input-only. */
export function createNarrativeSim(
  content: NarrativeContent,
): PackSimHook<NarrativeState, NarrativeEvent> {
  return ({ state, event }) => reduceNarrative(content, state, event)
}
