import type { Effect, GameState } from '../../src/shared/types'
import type { EngineCtx } from '../../src/core/context'
import { capabilityIsOff } from '../../src/core/caps'
import { GameEngine } from '../../src/core/engine'
import {
  packOperations,
  PackOperationError,
  type PackOperation,
} from '../../src/core/pack/host'
import type { DialogueHistoryEntry, DialogueUI } from '../../src/core/dialogue'
import { dialogueRuntime } from '../../src/core/dialogue-runtime'
import { director } from '../../src/core/director'
import { encounters } from '../../src/core/encounters'
import { quests } from '../../src/core/quests'
import { roguelike } from '../../src/core/roguelike'
import { sceneSlots } from '../../src/core/scene-slots'
import { social } from '../../src/core/social'
import { world } from '../../src/core/world'
import manifest from './pack.json' with { type: 'json' }

declare module '../../src/core/engine' {
  interface GameEngine {
    dialogue: DialogueUI | null
    dialogueHistory: DialogueHistoryEntry[]
    dialogueTimer: { seconds: number; knot?: string } | null
    dialogueTimeout(): void
  }
}

type ThisImplementation = (this: EngineCtx, ...args: any[]) => unknown
type ContextImplementation = (context: EngineCtx, ...args: any[]) => unknown

const operations: Record<string, PackOperation<EngineCtx>> = {}

function addThisOperations(source: Record<string, unknown>): void {
  for (const [name, implementation] of Object.entries(source)) {
    if (typeof implementation !== 'function') continue
    if (operations[name]) throw new Error(`Duplicate narrative operation ${name}`)
    operations[name] = (context, ...args) => (implementation as ThisImplementation).apply(context, args)
  }
}

function addContextOperations(source: Record<string, unknown>): void {
  for (const [name, implementation] of Object.entries(source)) {
    if (typeof implementation !== 'function') continue
    if (operations[name]) throw new Error(`Duplicate narrative operation ${name}`)
    operations[name] = (context, ...args) => (implementation as ContextImplementation)(context, ...args)
  }
}

// The nine implementations stay untouched. These adapters only preserve their
// original invocation convention behind the generic synchronous operation port.
addThisOperations(dialogueRuntime as unknown as Record<string, unknown>)
addThisOperations(director as unknown as Record<string, unknown>)
addThisOperations(encounters as unknown as Record<string, unknown>)
addContextOperations(quests as unknown as Record<string, unknown>)
addThisOperations(roguelike as unknown as Record<string, unknown>)
addThisOperations(sceneSlots as unknown as Record<string, unknown>)
addContextOperations(social as unknown as Record<string, unknown>)
addContextOperations(world as unknown as Record<string, unknown>)

operations['effect:start_dialogue'] = (context, effect: Extract<Effect, { type: 'start_dialogue' }>) => {
  context.startDialogue(effect.entity, effect.dialogue_knot)
}
operations['effect:fail_quest'] = (context, effect: Extract<Effect, { type: 'fail_quest' }>) => {
  if (capabilityIsOff(context.campaign.meta, 'quests')) return
  const current = context.state.quests[effect.quest]
  if (current?.status === 'active') {
    current.status = 'failed'
    context.messages.push({ text: `Квест провален: «${context.campaign.quests[effect.quest]?.label ?? effect.quest}»` })
  }
}
operations.initialStateFields = () => ({ quests: {} })
operations.initialRunStats = (): GameState['stats_run'] => ({
  travels: 0,
  dialogues: 0,
  ticks_survived: 0,
  kills: 0,
  quests_completed: 0,
})
operations.initializeRuntime = (context) => {
  context.dialogue = null
  context.dialogueHistory = []
  context.dialogueTimer = null
}

/** Install only the lower-camel legacy facade member that cannot live in core. */
function installFacade(): void {
  Object.defineProperty(GameEngine.prototype, 'dialogueTimeout', {
    configurable: true,
    writable: true,
    value: function (this: GameEngine): void {
      return this.runPackOperation('dialogueTimeout')
    },
  })
}

/** Idempotent for HMR and for catalogue plus headless composition roots. */
export function registerNarrativeOperations(): void {
  installFacade()
  if (packOperations.hasPack(manifest.id)) return
  const refusal = packOperations.register(manifest.id, operations)
  if (refusal) throw new PackOperationError(refusal)
}

registerNarrativeOperations()
