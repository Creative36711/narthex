/**
 * NAR-4.4 deterministic replay gate.
 *
 * Run with `npm run check:determinism`. The fixed, inline campaign and explicit
 * GameState keep this headless probe offline and out of campaign/runtime files.
 * `--mutate` adds one fixed 20 ms step to the final dt sample; that deliberate
 * divergence prints a mismatch and exits with code 1.
 */
import '../packs/narrative/operations'
import { GameEngine } from '../src/core/engine'
import type { Executor } from '../src/core/executor'
import { RealtimeExecutor } from '../src/core/realtime'
import { TurnExecutor } from '../src/core/turn'
import type { CampaignData, GameState } from '../src/shared/types'

const SEEDS = [
  'NAR-4.4-seed-01',
  'NAR-4.4-seed-02',
  'NAR-4.4-seed-03',
  'NAR-4.4-seed-04',
  'NAR-4.4-seed-05',
] as const

const RUNTIMES = ['turn', 'realtime'] as const
type Runtime = (typeof RUNTIMES)[number]

const STEP_MS = 20
const FIXED_DT_MS = [7, 13, 20, 3, 17, 41, 19, 1, 39, 60] as const
const MUTATION_SEED = SEEDS[0]

interface RunResult {
  readonly fingerprint: string
  readonly tick: number
  readonly rngHits: number
}

interface ReplayRow {
  readonly seed: string
  readonly runtime: Runtime
  readonly first: RunResult
  readonly second: RunResult
  readonly matches: boolean
}

interface MutationRow {
  readonly runtime: Runtime
  readonly baseline: RunResult
  readonly mutated: RunResult
  readonly diverged: boolean
}

function makeCampaign(): CampaignData {
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

function makeState(seed: string): GameState {
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

function runCycle(runtime: Runtime, seed: string, dtSequence: readonly number[]): RunResult {
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

function runNormalReplays(): ReplayRow[] {
  const rows: ReplayRow[] = []
  for (const seed of SEEDS) {
    for (const runtime of RUNTIMES) {
      const first = runCycle(runtime, seed, FIXED_DT_MS)
      const second = runCycle(runtime, seed, FIXED_DT_MS)
      rows.push({ seed, runtime, first, second, matches: first.fingerprint === second.fingerprint })
    }
  }
  return rows
}

function mutatedDtSequence(): number[] {
  const mutated: number[] = [...FIXED_DT_MS]
  const last = mutated.length - 1
  mutated[last] = mutated[last]! + STEP_MS
  return mutated
}

function runMutationProbe(): MutationRow[] {
  const altered = mutatedDtSequence()
  const rows: MutationRow[] = []
  for (const runtime of RUNTIMES) {
    const baseline = runCycle(runtime, MUTATION_SEED, FIXED_DT_MS)
    const mutated = runCycle(runtime, MUTATION_SEED, altered)
    const diverged = baseline.fingerprint !== mutated.fingerprint
    rows.push({ runtime, baseline, mutated, diverged })
  }
  return rows
}

function printReplayTable(rows: readonly ReplayRow[]): void {
  console.log('| seed | runtime | run 1 fingerprint | run 2 fingerprint | same |')
  console.log('|---|---|---|---|---|')
  for (const row of rows) {
    console.log(
      `| ${row.seed} | ${row.runtime} | ${row.first.fingerprint} | ${row.second.fingerprint} | ${row.matches ? 'yes' : 'NO'} |`,
    )
  }
}

function printMutationProbe(rows: readonly MutationRow[]): void {
  console.log(`Mutation probe: final fixed dt sample +${STEP_MS} ms; seed=${MUTATION_SEED}.`)
  for (const row of rows) {
    if (row.diverged) {
      console.log(
        `MUTATION MISMATCH: runtime=${row.runtime} seed=${MUTATION_SEED} ` +
        `baseline=${row.baseline.fingerprint} mutated=${row.mutated.fingerprint} ` +
        `tick=${row.baseline.tick}->${row.mutated.tick} rngHits=${row.baseline.rngHits}->${row.mutated.rngHits}`,
      )
    } else {
      console.log(
        `MUTATION NOT DETECTED: runtime=${row.runtime} seed=${MUTATION_SEED} ` +
        `fingerprint=${row.baseline.fingerprint}`,
      )
    }
  }
}

function main(): void {
  if (process.argv.includes('--mutate')) {
    const rows = runMutationProbe()
    printMutationProbe(rows)
    const detected = rows.length === RUNTIMES.length && rows.every((row) => row.diverged)
    console.log(detected
      ? '--mutate: deliberate divergence detected; expected exit code 1.'
      : '--mutate: divergence was not detected in every runtime; exiting 1.')
    process.exitCode = 1
    return
  }

  console.log('NAR-4.4 determinism check: 5 seeds × 2 runtimes × 2 replays.')
  console.log(`Fixed dt sequence (ms): [${FIXED_DT_MS.join(', ')}]; realtime step=${STEP_MS} ms.`)
  const rows = runNormalReplays()
  printReplayTable(rows)

  const mutationRows = runMutationProbe()
  printMutationProbe(mutationRows)

  const replaysMatch = rows.length === SEEDS.length * RUNTIMES.length && rows.every((row) => row.matches)
  const mutationDetected = mutationRows.length === RUNTIMES.length && mutationRows.every((row) => row.diverged)
  if (!replaysMatch || !mutationDetected) {
    console.error(`FAIL: replay-match=${replaysMatch}; mutation-detected=${mutationDetected}.`)
    process.exitCode = 1
    return
  }

  console.log('PASS: all 10 replay pairs match; the mutation probe detects divergence in both runtimes.')
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
