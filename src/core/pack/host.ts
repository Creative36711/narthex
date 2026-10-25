import type { PackManifest } from './registry'

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

export interface PackSimContext<State, Event> {
  readonly state: DeepReadonly<State>
  readonly event: DeepReadonly<Event>
  readonly seed: number
}

export interface PackDrawCommand {
  readonly type: string
  readonly [key: string]: unknown
}

export interface PackViewContext<State, Frame> {
  readonly state: DeepReadonly<State>
  readonly frame: DeepReadonly<Frame>
  readonly draw: (command: PackDrawCommand) => void
}

export type PackSimHook<State, Event> = (
  context: PackSimContext<State, Event>,
) => State | void

export type PackViewHook<State, Frame> = (
  context: PackViewContext<State, Frame>,
) => void

export interface PackHooks<State, Event, Frame> {
  readonly sim?: PackSimHook<State, Event>
  readonly view?: PackViewHook<State, Frame>
}

/** A fail-fast runtime binding: the caller supplies pack code and its initial state. */
export interface PackSimBinding<State, Event, Frame> {
  readonly manifest: PackHostManifest
  readonly hooks: PackHooks<State, Event, Frame> & {
    readonly sim: PackSimHook<State, Event>
  }
  readonly state: State
}

export interface PackPause {
  readonly packId: string
  readonly hook: 'register' | 'sim' | 'view'
  readonly reason: string
}

export interface PackHostResult<State> {
  readonly state: State
  readonly paused: PackPause | null
}

export interface PackSimInput<State, Event> {
  readonly state: State
  readonly event: Event
  readonly seed: number
}

export interface PackViewInput<State, Frame> {
  readonly state: State
  readonly frame: Frame
  readonly enabled?: boolean
  readonly headless?: boolean
  readonly draw: (command: PackDrawCommand) => void
}

export type PackHostManifest = Pick<PackManifest, 'id' | 'provides'>
type HookKind = 'sim' | 'view'

const FORBIDDEN_SIM_GLOBALS: Array<[string, RegExp]> = [
  ['Date.now', /\bDate\s*\.\s*now\s*\(/],
  ['Date construction', /\b(?:new\s+)?Date\s*\(/],
  ['Math.random', /\bMath\s*\.\s*random\s*\(/],
  ['I/O or ambient state', /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|document|window|self|globalThis|process|require|import|crypto|navigator|console|performance)\b/],
  ['timer', /\b(?:setTimeout|setInterval|clearTimeout|clearInterval)\s*\(/],
]

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

function readonlySnapshot<T>(value: T, label: string): DeepReadonly<T> {
  const clone = cloneValue(value)
  const proxies = new WeakMap<object, object>()
  const wrap = (item: unknown): unknown => {
    if (item === null || typeof item !== 'object') return item
    const cached = proxies.get(item)
    if (cached) return cached
    const proxy = new Proxy(item, {
      get(target, key, receiver) {
        return wrap(Reflect.get(target, key, receiver))
      },
      set() {
        throw new TypeError(`${label} is read-only; state writes are forbidden`)
      },
      deleteProperty() {
        throw new TypeError(`${label} is read-only; state writes are forbidden`)
      },
      defineProperty() {
        throw new TypeError(`${label} is read-only; state writes are forbidden`)
      },
      setPrototypeOf() {
        throw new TypeError(`${label} is read-only; state writes are forbidden`)
      },
    })
    proxies.set(item, proxy)
    return proxy
  }
  return wrap(clone) as DeepReadonly<T>
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return !!value && (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
}

function impureSimReason(hook: Function): string | null {
  if (hook.constructor?.name === 'AsyncFunction' || hook.constructor?.name === 'GeneratorFunction') {
    return 'sim hook must be synchronous'
  }
  const source = Function.prototype.toString.call(hook).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
  for (const [name, pattern] of FORBIDDEN_SIM_GLOBALS) {
    if (pattern.test(source)) return `sim hook uses forbidden ${name}`
  }
  if (source.includes('[native code]')) return 'sim hook must be inspectable pure source'
  return null
}

function pauseCopy(pause: PackPause | null): PackPause | null {
  return pause ? { ...pause } : null
}

/**
 * Pack hooks receive only immutable data and a draw port. The host never passes
 * an engine, and failures turn into a persistent pause result rather than an
 * exception escaping into the game loop.
 */
export class PackHost<State, Event, Frame> {
  private readonly manifests = new Map<string, PackHostManifest>()
  private readonly order: string[] = []
  private readonly registrations = new Map<string, PackHooks<State, Event, Frame>>()
  private pauseState: PackPause | null = null

  constructor(manifests: readonly PackHostManifest[]) {
    for (const manifest of manifests) {
      if (!manifest.id || this.manifests.has(manifest.id)) {
        this.pauseState = {
          packId: manifest.id || '(unknown)',
          hook: 'register',
          reason: 'invalid or duplicate pack registration in the host registry',
        }
        break
      }
      this.manifests.set(manifest.id, manifest)
      this.order.push(manifest.id)
    }
  }

  get paused(): PackPause | null {
    return pauseCopy(this.pauseState)
  }

  register(packId: string, hooks: PackHooks<State, Event, Frame>): boolean {
    if (this.pauseState) return false
    const manifest = this.manifests.get(packId)
    if (!manifest) return this.fail(packId, 'register', 'pack is not present in the host registry')
    if (this.registrations.has(packId)) return this.fail(packId, 'register', 'pack hooks are already registered')
    if (hooks.sim && !this.hasDeclaredHook(manifest, 'sim')) {
      return this.fail(packId, 'register', 'sim hook is not declared by the pack manifest')
    }
    if (hooks.view && !this.hasDeclaredHook(manifest, 'view')) {
      return this.fail(packId, 'register', 'view hook is not declared by the pack manifest')
    }
    if (hooks.sim) {
      const purityFailure = impureSimReason(hooks.sim as PackSimHook<unknown, unknown>)
      if (purityFailure) return this.fail(packId, 'register', purityFailure)
    }
    this.registrations.set(packId, hooks)
    return true
  }

  runSim(input: PackSimInput<State, Event>): PackHostResult<State> {
    let state: State
    try {
      state = cloneValue(input.state)
      if (!Number.isSafeInteger(input.seed)) throw new TypeError('seed must be a safe integer')
    } catch (error) {
      this.fail('(host)', 'sim', errorMessage(error))
      return { state: input.state, paused: this.paused }
    }
    if (this.pauseState) return { state, paused: this.paused }

    for (const packId of this.order) {
      const hook = this.registrations.get(packId)?.sim
      if (!hook) continue
      try {
        const result = hook(Object.freeze({
          state: readonlySnapshot(state, `sim state for ${packId}`),
          event: readonlySnapshot(input.event, `sim event for ${packId}`),
          seed: input.seed,
        }))
        if (isPromiseLike(result)) {
          void Promise.resolve(result).catch(() => undefined)
          throw new TypeError('sim hooks must be synchronous and deterministic')
        }
        if (result !== undefined) state = cloneValue(result)
      } catch (error) {
        this.fail(packId, 'sim', errorMessage(error))
        break
      }
    }
    return { state, paused: this.paused }
  }

  runView(input: PackViewInput<State, Frame>): PackPause | null {
    if (this.pauseState || input.enabled === false || input.headless === true) return this.paused
    for (const packId of this.order) {
      const hook = this.registrations.get(packId)?.view
      if (!hook) continue
      try {
        const result = hook(Object.freeze({
          state: readonlySnapshot(input.state, `view state for ${packId}`),
          frame: readonlySnapshot(input.frame, `view frame for ${packId}`),
          draw: (command: PackDrawCommand) => input.draw(cloneValue(command)),
        }))
        if (isPromiseLike(result)) {
          void Promise.resolve(result).catch(() => undefined)
          throw new TypeError('view hooks must be synchronous')
        }
        if (result !== undefined) throw new TypeError('view hooks cannot return state or effects')
      } catch (error) {
        this.fail(packId, 'view', errorMessage(error))
        break
      }
    }
    return this.paused
  }

  private hasDeclaredHook(manifest: PackHostManifest, kind: HookKind): boolean {
    return (manifest.provides.seams ?? []).some((seam) => seam.kind === kind)
  }

  private fail(packId: string, hook: PackPause['hook'], reason: string): false {
    this.pauseState ??= { packId, hook, reason }
    return false
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Compile-time assertion: a view hook cannot assign even a nested state field.
function assertViewStateIsReadonly(context: PackViewContext<{ nested: { score: number } }, unknown>): void {
  // @ts-expect-error view context state must remain deeply readonly
  context.state.nested.score = 0
}
void assertViewStateIsReadonly
