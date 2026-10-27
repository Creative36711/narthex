/**
 * Shared NAR-4.4/NAR-4.6 parity project. Node and the browser bundle import
 * this exact campaign, state constructor, runtime wiring, and fixed dt row.
 */
import '../packs/narrative/operations'
import { GameEngine } from '../src/core/engine'
import type { Executor } from '../src/core/executor'
import { RealtimeExecutor } from '../src/core/realtime'
import { TurnExecutor } from '../src/core/turn'
import type { CampaignData, GameState } from '../src/shared/types'

export const SEEDS = [
  'NAR-4.4-seed-01',
  'NAR-4.4-seed-02',
  'NAR-4.4-seed-03',
  'NAR-4.4-seed-04',
  'NAR-4.4-seed-05',
] as const

export const RUNTIMES = ['turn', 'realtime'] as const
export type Runtime = (typeof RUNTIMES)[number]

export const STEP_MS = 20
export const FIXED_DT_MS = [7, 13, 20, 3, 17, 41, 19, 1, 39, 60] as const
export const MUTATION_SEED = SEEDS[0]

export interface RunResult {
  readonly fingerprint: string
  readonly tick: number
  readonly rngHits: number
}

export function makeCampaign(): CampaignData {
  return {
    meta: {
      id: 'nar-4.4-determinism-fixture',
      title: 'NAR-4.4 determinism fixture',
      version: '1.0.0',
      engine_version: '0.9.0',
      author: 'Narthex test fixture',
      description: 'Inline, offline executor determinism fixture.',
      tick_label: 'tick',
      ticks_per_day: 4_320_000,
      starting_tick: 17,
      starting_region: 'region',
      starting_location: 'location',
      starting_scene: 'scene',
      default_player: 'hero',
      needs: [],
      caps: [],
    },
    world: { regions: [] },
    scenes: {},
    entities: {
      hero: {
        id: 'hero',
        type: 'npc',
        label: 'Determinism probe hero',
        stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10, HP: 50, MP: 20 },
        skills: {},
        inventory: [],
        equipment: {},
      },
    },
    rules: {
      rng_probe: {
        id: 'rng_probe',
        label: 'Record seeded random outcomes',
        once: false,
        conditions: [{ type: 'random_chance', probability: 0.5 }],
        effects: [{ type: 'change_variable', var: 'rng_hits', delta: 1 }],
      },
    },
    ruleOrder: ['rng_probe'],
    arenas: {},
    quests: {},
    encounters: {},
    encounterOrder: [],
    cutscenes: {},
    recipes: {},
    codex: {},
    dialogues: {},
    basePath: '',
  } as unknown as CampaignData
}

export function makeState(seed: string): GameState {
  return {
    campaign_id: 'nar-4.4-determinism-fixture',
    seed,
    tick: 17,
    region: 'region',
    location: 'location',
    scene: 'scene',
    flags: {},
    variables: { rng_hits: 0 },
    fired_rules: [],
    revealed_locations: [],
    dead_entities: [],
    removed_entities: [],
    spawned: [],
    player: {
      entity: 'hero',
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10, HP: 50, MP: 20 },
      skills: {},
      skill_marks: {},
      hp: 50,
      max_hp: 50,
      mp: 20,
      max_mp: 20,
      needs: {},
      inventory: [],
      equipment: {},
    },
    quests: {},
    dispositions: {},
    party: [],
    blocked_paths: [],
    log: [],
    game_over: null,
    stats_run: { travels: 0, dialogues: 0, ticks_survived: 0, kills: 0, quests_completed: 0 },
  }
}

/** Run one identical campaign/seed/dt row through the selected Executor. */
export function runCycle(runtime: Runtime, seed: string, dtSequence: readonly number[]): RunResult {
  const engine = new GameEngine(makeCampaign(), makeState(seed))
  const turn = new TurnExecutor(engine)
  const executor: Executor<GameState> = runtime === 'realtime'
    ? new RealtimeExecutor<GameState>(turn, { stepMs: STEP_MS })
    : turn

  for (const dt of dtSequence) executor.step(dt)

  const rngHits = executor.state.variables.rng_hits
  if (typeof rngHits !== 'number') {
    throw new Error(`RNG probe did not leave a numeric result for seed=${seed}, runtime=${runtime}`)
  }
  return {
    fingerprint: executor.fingerprint(),
    tick: executor.state.tick,
    rngHits,
  }
}
