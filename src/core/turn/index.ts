import type {
  Executor,
  ExecutorFactory,
  ExecutorInput,
  ExecutorOptions,
  ExecutorStep,
} from '../executor'
import { fingerprintOf } from '../executor'
import { newCharChoice, type CharChoice } from '../charcreate'
import { PRNG } from '../prng'
import type {
  CampaignData,
  EntityDef,
  GameState,
  NavigationZone,
  NpcDef,
  SceneDef,
  SlotDef,
} from '../../shared/types'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Structural view of the existing GameEngine. Keeping this interface here
 * avoids a forbidden core/turn -> core/engine import; the composition root
 * supplies the real constructor and no duplicate game rules are needed.
 */
export interface TurnEngine {
  campaign: CampaignData
  state: GameState
  rng: PRNG
  applyCharCreation(choice: CharChoice): void
  start(): void
  advanceTicks(ticks: number): void
  currentScene(): SceneDef
  navigate(nav: NavigationZone): boolean
  travelTo(locationId: string): void
  slotOccupants(scene: SceneDef): Array<{ slot: SlotDef; entity: EntityDef | null }>
  interactWithSlot(occupant: { slot: SlotDef; entity: EntityDef | null }): boolean
  useItem(id: string): void
  chooseDialogueOption(index: number): void
  hasPackOperation(operation: string): boolean
  runPackOperation(operation: string, ...args: unknown[]): unknown
}

export type TurnEngineConstructor = new (
  campaign: CampaignData,
  state?: GameState,
) => TurnEngine

/**
 * Build the frozen ExecutorFactory outside the engine. The caller chooses both
 * the campaign and the real engine constructor; state takes precedence over a
 * seed exactly as it does when opening an existing run.
 */
export function createTurnExecutorFactory(
  campaign: CampaignData,
  Engine: TurnEngineConstructor,
): ExecutorFactory<GameState> {
  return (options: ExecutorOptions<GameState> = {}) => {
    const engine = new Engine(campaign, options.state)
    const executor = new TurnExecutor(engine)

    if (!options.state) {
      if (options.seed !== undefined) executor.setSeed(options.seed)
      const creation = campaign.meta.char_creation
      if (creation) {
        const template = campaign.entities[campaign.meta.default_player] as NpcDef
        engine.applyCharCreation(newCharChoice(creation, template, campaign.meta))
      }
    }
    engine.start()
    return executor
  }
}

/** Turn-based Executor: milliseconds are converted to whole campaign ticks. */
export class TurnExecutor implements Executor<GameState> {
  private readonly engine: TurnEngine
  private pausedValue = false
  private remainderMs = 0

  constructor(engine: TurnEngine) {
    const ticksPerDay = engine.campaign.meta.ticks_per_day
    if (!Number.isFinite(ticksPerDay) || ticksPerDay <= 0) {
      throw new RangeError(`TURN_TICKS_PER_DAY_INVALID: ${ticksPerDay}`)
    }
    this.engine = engine
  }

  get state(): GameState {
    return this.engine.state
  }

  get paused(): boolean {
    return this.pausedValue
  }

  get clock(): number {
    return this.engine.state.tick * this.tickMs()
  }

  step(dt: number, input: readonly ExecutorInput[] = []): ExecutorStep {
    if (this.paused) return { changed: false, clock: this.clock }
    if (!Number.isFinite(dt) || dt < 0) {
      throw new RangeError(`TURN_DT_INVALID: ${dt}`)
    }

    const events = this.orderedInput(dt, input)
    const before = this.fingerprint()
    let cursor = 0
    for (const event of events) {
      const at = event.at ?? 0
      this.advanceTime(at - cursor)
      this.applyInput(event)
      cursor = at
    }
    this.advanceTime(dt - cursor)
    return { changed: before !== this.fingerprint(), clock: this.clock }
  }

  pause(): void {
    this.pausedValue = true
  }

  resume(): void {
    this.pausedValue = false
  }

  setSeed(seed: string): void {
    const rng = new PRNG(seed)
    this.engine.rng = rng
    this.engine.state.seed = rng.seed
  }

  fingerprint(): string {
    return fingerprintOf(this.state)
  }

  private tickMs(): number {
    return DAY_MS / this.engine.campaign.meta.ticks_per_day
  }

  /** Preserve sub-tick time between calls; only complete ticks reach the engine. */
  private advanceTime(ms: number): void {
    if (ms === 0) return
    const total = this.remainderMs + ms
    const ticks = Math.floor(total / this.tickMs())
    if (ticks === 0) {
      this.remainderMs = total
      return
    }
    this.remainderMs = Math.max(0, total - ticks * this.tickMs())
    this.engine.advanceTicks(ticks)
  }

  private orderedInput(
    dt: number,
    input: readonly ExecutorInput[],
  ): ExecutorInput[] {
    return input
      .map((event, index) => ({ event, index }))
      .sort((a, b) => (a.event.at ?? 0) - (b.event.at ?? 0) || a.index - b.index)
      .map(({ event }) => {
        const at = event.at ?? 0
        if (!event.action || !Number.isFinite(at) || at < 0 || at > dt) {
          throw new RangeError(`TURN_INPUT_INVALID: ${event.action} at ${event.at}`)
        }
        return event
      })
  }

  private applyInput(event: ExecutorInput): void {
    const { action, value } = event
    switch (action) {
      case 'wait':
        return
      case 'move': {
        const scene = typeof value === 'string'
          ? this.engine.currentScene().navigation.find((nav) => nav.go_to_scene === value)
          : undefined
        if (scene) {
          this.engine.navigate(scene)
          return
        }
        break
      }
      case 'travel':
        this.engine.travelTo(requiredId(value, action))
        return
      case 'interact': {
        const slotId = requiredId(value, action)
        const occupant = this.engine.slotOccupants(this.engine.currentScene())
          .find((candidate) => candidate.slot.id === slotId)
        if (occupant) {
          this.engine.interactWithSlot(occupant)
          return
        }
        break
      }
      case 'use':
        this.engine.useItem(requiredId(value, action))
        return
      case 'choose': {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
          throw new TypeError(`TURN_CHOOSE_INVALID: ${value}`)
        }
        this.engine.chooseDialogueOption(value)
        return
      }
      default:
        break
    }

    // Pack actions use the existing generic operation port, never a pack id.
    if (!this.engine.hasPackOperation(action)) {
      throw new Error(`TURN_INPUT_UNKNOWN: ${action}`)
    }
    if (value === undefined) this.engine.runPackOperation(action)
    else this.engine.runPackOperation(action, value)
  }
}

function requiredId(value: number | string | undefined, action: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`TURN_${action.toUpperCase()}_ID_INVALID: ${value}`)
  }
  return value
}
