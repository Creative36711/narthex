import type {
  Executor,
  ExecutorFactory,
  ExecutorInput,
  ExecutorOptions,
  ExecutorStep,
} from '../executor'

/** Presentation is deliberately separate from authoritative simulation state. */
export interface RealtimeFrame<State> {
  readonly previous: State
  readonly current: State
  /** Unconsumed real time / fixed step, in [0, 1). */
  readonly alpha: number
  readonly clock: number
}

export interface RealtimeOptions {
  /** Whole milliseconds; default 20 ms (50 simulation updates per second). */
  readonly stepMs?: number
}

type PendingInput = { readonly time: number; readonly event: ExecutorInput }

/**
 * A fixed-step scheduler, not a second set of game rules. The composition root
 * supplies an Executor as the simulation port; it only ever sees fixed dt.
 * No wall clock, requestAnimationFrame, pack id or engine import lives here.
 *
 * Owns its simulation port exclusively: do not step/pause/mutate it elsewhere.
 * State must be structured-cloneable (as existing GameState saves are).
 */
export class RealtimeExecutor<State> implements Executor<State> {
  readonly stepMs: number
  private readonly simulation: Executor<State>
  private readonly originClock: number
  private ticks = 0
  private elapsedMs = 0
  private timeError = 0
  private previous: State
  private current: State
  private pending: PendingInput[] = []

  constructor(simulation: Executor<State>, options: RealtimeOptions = {}) {
    const stepMs = options.stepMs ?? 20
    if (!Number.isSafeInteger(stepMs) || stepMs <= 0) {
      throw new RangeError(`REALTIME_STEP_INVALID: ${stepMs}`)
    }
    this.stepMs = stepMs
    this.simulation = simulation
    this.originClock = simulation.clock
    this.current = structuredClone(simulation.state)
    this.previous = this.current
  }

  get state(): State {
    return this.simulation.state
  }

  get paused(): boolean {
    return this.simulation.paused
  }

  /** Fixed-step timeline, independent of action costs / coarse campaign ticks. */
  get clock(): number {
    return this.originClock + this.ticks * this.stepMs
  }

  get accumulatorMs(): number {
    return this.elapsedMs - this.ticks * this.stepMs
  }

  get alpha(): number {
    return this.accumulatorMs / this.stepMs
  }

  /** Defensive copies: a renderer cannot mutate the simulation or snapshots. */
  get frame(): RealtimeFrame<State> {
    return {
      previous: structuredClone(this.previous),
      current: structuredClone(this.current),
      alpha: this.alpha,
      clock: this.clock,
    }
  }

  /**
   * Interpolate only presentation fields (e.g. position), never ids, inventory,
   * seed or HP by guessing their meaning. Standard interpolation is one fixed
   * step behind the simulation, with no extrapolation into unknown state.
   * The projection receives isolated snapshots and may return any view type.
   */
  interpolate<View>(project: (previous: State, current: State, alpha: number) => View): View {
    const { previous, current, alpha } = this.frame
    return project(previous, current, alpha)
  }

  step(dt: number, input: readonly ExecutorInput[] = []): ExecutorStep {
    if (this.paused) return { changed: false, clock: this.clock }
    if (!Number.isFinite(dt) || dt < 0) {
      throw new RangeError(`REALTIME_DT_INVALID: ${dt}`)
    }
    const start = this.elapsedMs
    // Compensated addition preserves small dt contributions rather than losing
    // them to repeated subtraction (notably at 60 Hz). No epsilon, time
    // quantization or rounding is applied: we sum the supplied IEEE-754 values.
    const increment = dt - this.timeError
    const end = start + increment
    if (!Number.isFinite(end) || end > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`REALTIME_TIME_OVERFLOW: ${end}`)
    }
    // Validate the entire batch before accepting time or input. Input must be
    // chronological; equal timestamps retain arrival order. Never sort input
    // or round dt to conceal nondeterminism / floating-point discrepancies.
    let lastAt = 0
    const queued = input.map((event) => {
      const at = event.at ?? 0
      if (!event.action || !Number.isFinite(at) || at < lastAt || at > dt) {
        throw new RangeError(`REALTIME_INPUT_INVALID: ${event.action} at ${at}`)
      }
      lastAt = at
      return { time: start + at, event: { ...event } }
    })
    for (const event of queued) this.pending.push(event)
    this.timeError = (end - start) - increment
    this.elapsedMs = end
    let changed = false
    let consumed = 0
    // No clamp, max-dt or discarded backlog: a long frame executes every step.
    // Therefore the 4 ms budget is per simulation step, NOT per catch-up frame.
    while ((this.ticks + 1) * this.stepMs <= this.elapsedMs) {
      const tickStart = this.ticks * this.stepMs
      const tickEnd = tickStart + this.stepMs
      const events: ExecutorInput[] = []
      let next = consumed
      // Half-open intervals: an event exactly at tickEnd belongs to NEXT tick.
      while (next < this.pending.length && this.pending[next].time < tickEnd) {
        const { time, event } = this.pending[next++]
        events.push({ ...event, at: time - tickStart })
      }
      const result = this.simulation.step(this.stepMs, events)
      consumed = next
      this.ticks += 1
      changed = changed || result.changed
      this.previous = this.current
      this.current = structuredClone(this.state)
    }
    this.pending = this.pending.slice(consumed)
    return { changed, clock: this.clock }
  }

  /** Paused calls consume neither real time nor input; fractional time survives. */
  pause(): void {
    this.simulation.pause()
  }

  resume(): void {
    this.simulation.resume()
  }

  /** Like Executor.setSeed, reseeds; it does not restart the world or timeline. */
  setSeed(seed: string): void {
    this.simulation.setSeed(seed)
    this.current = structuredClone(this.state)
    this.previous = this.current
  }

  /** Authoritative state only, never interpolated presentation. */
  fingerprint(): string {
    return this.simulation.fingerprint()
  }
}

/**
 * Example composition, outside core: createRealtimeExecutorFactory(
 *   createTurnExecutorFactory(campaign, GameEngine), { stepMs: 20 })
 * Any other ExecutorFactory can supply the simulation without runtime branches
 * in the engine. Existing clients still consume the unchanged ExecutorFactory.
 */
export function createRealtimeExecutorFactory<State>(
  simulationFactory: ExecutorFactory<State>,
  options: RealtimeOptions = {},
): (initial?: ExecutorOptions<State>) => RealtimeExecutor<State> {
  // Copy options so the caller cannot change the configuration between runs.
  const configuration = { ...options }
  return (initial = {}) => new RealtimeExecutor(simulationFactory(initial), configuration)
}
