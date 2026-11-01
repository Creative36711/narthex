/**
 * Deterministic replay and browser/Node parity gate.
 *
 * The NAR-4.4 replay/mutation checks remain intact. NAR-4.6 adds the same
 * shared project, seed, and fixed dt row in Chromium and the cf-play Node
 * executor path; `--mutate` remains the deliberate rc=1 mutation-only mode.
 */
import { performance } from 'node:perf_hooks'
import {
  FIXED_DT_MS,
  MUTATION_SEED,
  RUNTIMES,
  SEEDS,
  STEP_MS,
  runCycle,
  type RunResult,
  type Runtime,
} from './parity-fixture'
import { runParity } from './check-parity.mts'

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

async function main(): Promise<void> {
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
  console.log('NAR-4.4 fixed-seed replay phase: start.')
  const replayStartedAt = performance.now()
  const rows = runNormalReplays()
  console.log(`NAR-4.4 fixed-seed replay phase: ${(performance.now() - replayStartedAt).toFixed(1)} ms.`)
  printReplayTable(rows)

  console.log('NAR-4.4 mutation probe phase: start.')
  const mutationStartedAt = performance.now()
  const mutationRows = runMutationProbe()
  console.log(`NAR-4.4 mutation probe phase: ${(performance.now() - mutationStartedAt).toFixed(1)} ms.`)
  printMutationProbe(mutationRows)

  const replaysMatch = rows.length === SEEDS.length * RUNTIMES.length && rows.every((row) => row.matches)
  const mutationDetected = mutationRows.length === RUNTIMES.length && mutationRows.every((row) => row.diverged)
  if (!replaysMatch || !mutationDetected) {
    console.error(`FAIL: replay-match=${replaysMatch}; mutation-detected=${mutationDetected}.`)
    process.exitCode = 1
    return
  }

  console.log('PASS: all 10 replay pairs match; the mutation probe detects divergence in both runtimes.')
  console.log('NAR-4.6 browser/Node parity phase: start.')
  const parityStartedAt = performance.now()
  await runParity()
  console.log(`NAR-4.6 browser/Node parity phase: ${(performance.now() - parityStartedAt).toFixed(1)} ms.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
