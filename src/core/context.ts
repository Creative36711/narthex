import type { CampaignData, GameState } from '../shared/types'
import type { PRNG } from './prng'

/**
 * Narrow architectural boundary for core systems that need access to the runtime.
 * Core modules depend on this contract, never on the concrete engine module.
 *
 * The index signature temporarily preserves the existing engine operations used
 * by combat, conditions, and dialogue; those operations can be made explicit as
 * they are extracted behind focused services.
 */
export interface EngineCtx {
  campaign: CampaignData
  state: GameState
  rng: PRNG
  notify(): void
  log(text: string): void
  audio: {
    playUi: typeof import('../shared/audio').playUi
    playInteraction: typeof import('../shared/audio').playInteraction
    stopSound: typeof import('../shared/audio').stopSound
  }
  [operation: string]: any
}
