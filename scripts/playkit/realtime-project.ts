import {
  createRealtimeExecutorFactory,
} from '../../src/core/realtime'
import { fingerprintOf, type Executor, type ExecutorFactory, type ExecutorInput, type ExecutorOptions, type ExecutorStep } from '../../src/core/executor'
import type { CycleProject, CycleSetup } from './cycle-check'

interface Rectangle {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface RealtimeWorld {
  readonly bounds: { readonly min_x: number; readonly min_y: number; readonly max_x: number; readonly max_y: number }
  readonly spawn: { readonly x: number; readonly y: number }
  readonly movement_speed: number
  readonly player_radius: number
  readonly walls: readonly Rectangle[]
  readonly zones: readonly (Rectangle & { readonly state: string })[]
}

interface RealtimeState {
  seed: string
  position: { x: number; y: number }
  max_x: number
  wall_contact: boolean
  wall_contacts: number
  zone_trigger_count: number
  triggered_zones: Record<string, boolean>
  world_state: string | null
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`CF_PLAY_REALTIME_PROJECT_INVALID: ${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`CF_PLAY_REALTIME_PROJECT_INVALID: ${label} must be finite`)
  }
  return value
}

function requireRectangle(value: unknown, label: string): Rectangle {
  const rectangle = requireObject(value, label)
  if (typeof rectangle.id !== 'string' || !rectangle.id) {
    throw new TypeError(`CF_PLAY_REALTIME_PROJECT_INVALID: ${label}.id is required`)
  }
  const width = requireNumber(rectangle.width, `${label}.width`)
  const height = requireNumber(rectangle.height, `${label}.height`)
  if (width <= 0 || height <= 0) {
    throw new TypeError(`CF_PLAY_REALTIME_PROJECT_INVALID: ${label} dimensions must be positive`)
  }
  return {
    id: rectangle.id,
    x: requireNumber(rectangle.x, `${label}.x`),
    y: requireNumber(rectangle.y, `${label}.y`),
    width,
    height,
  }
}

function requireWorld(value: unknown): RealtimeWorld {
  const raw = requireObject(value, 'world')
  const bounds = requireObject(raw.bounds, 'world.bounds')
  const spawn = requireObject(raw.spawn, 'world.spawn')
  if (!Array.isArray(raw.walls) || !Array.isArray(raw.zones)) {
    throw new TypeError('CF_PLAY_REALTIME_PROJECT_INVALID: world walls and zones must be arrays')
  }
  const zones = raw.zones.map((item, index) => {
    const zone = requireRectangle(item, `world.zones[${index}]`)
    const state = requireObject(item, `world.zones[${index}]`).state
    if (typeof state !== 'string' || !state) {
      throw new TypeError(`CF_PLAY_REALTIME_PROJECT_INVALID: world.zones[${index}].state is required`)
    }
    return { ...zone, state }
  })
  const minX = requireNumber(bounds.min_x, 'world.bounds.min_x')
  const minY = requireNumber(bounds.min_y, 'world.bounds.min_y')
  const maxX = requireNumber(bounds.max_x, 'world.bounds.max_x')
  const maxY = requireNumber(bounds.max_y, 'world.bounds.max_y')
  if (minX >= maxX || minY >= maxY) {
    throw new TypeError('CF_PLAY_REALTIME_PROJECT_INVALID: world bounds must have positive area')
  }
  const world: RealtimeWorld = {
    bounds: { min_x: minX, min_y: minY, max_x: maxX, max_y: maxY },
    spawn: {
      x: requireNumber(spawn.x, 'world.spawn.x'),
      y: requireNumber(spawn.y, 'world.spawn.y'),
    },
    movement_speed: requireNumber(raw.movement_speed, 'world.movement_speed'),
    player_radius: requireNumber(raw.player_radius, 'world.player_radius'),
    walls: raw.walls.map((item, index) => requireRectangle(item, `world.walls[${index}]`)),
    zones,
  }
  if (world.movement_speed <= 0 || world.player_radius <= 0) {
    throw new TypeError('CF_PLAY_REALTIME_PROJECT_INVALID: speed and player radius must be positive')
  }
  return world
}

class RealtimeWorldSimulation implements Executor<RealtimeState> {
  private pausedValue = false
  private clockMs = 0
  private current: RealtimeState

  constructor(
    private readonly world: RealtimeWorld,
    seed: string,
    initial?: RealtimeState,
  ) {
    this.current = initial ? structuredClone(initial) : {
      seed,
      position: { ...world.spawn },
      max_x: world.spawn.x,
      wall_contact: false,
      wall_contacts: 0,
      zone_trigger_count: 0,
      triggered_zones: {},
      world_state: null,
    }
  }

  get state(): RealtimeState {
    return this.current
  }

  get paused(): boolean {
    return this.pausedValue
  }

  get clock(): number {
    return this.clockMs
  }

  step(dt: number, input: readonly ExecutorInput[] = []): ExecutorStep {
    if (this.paused) return { changed: false, clock: this.clock }
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError(`REALTIME_PROJECT_DT_INVALID: ${dt}`)
    const before = this.fingerprint()
    let direction = 0
    for (const event of input) {
      if (event.action !== 'move') throw new RangeError(`REALTIME_PROJECT_INPUT_INVALID: ${event.action}`)
      if (typeof event.value !== 'number' || ![-1, 0, 1].includes(event.value)) {
        throw new RangeError(`REALTIME_PROJECT_MOVE_INVALID: ${String(event.value)}`)
      }
      direction = event.value
    }

    if (direction !== 0) {
      const nextX = this.current.position.x + direction * this.world.movement_speed * dt / 1000
      const outsideBounds =
        nextX - this.world.player_radius < this.world.bounds.min_x ||
        nextX + this.world.player_radius > this.world.bounds.max_x ||
        this.current.position.y - this.world.player_radius < this.world.bounds.min_y ||
        this.current.position.y + this.world.player_radius > this.world.bounds.max_y
      const wallHit = this.world.walls.some((wall) =>
        nextX + this.world.player_radius > wall.x &&
        nextX - this.world.player_radius < wall.x + wall.width &&
        this.current.position.y + this.world.player_radius > wall.y &&
        this.current.position.y - this.world.player_radius < wall.y + wall.height,
      )
      if (wallHit) {
        this.current.wall_contact = true
        this.current.wall_contacts += 1
      } else if (!outsideBounds) {
        this.current.position.x = nextX
      }
    }

    this.current.max_x = Math.max(this.current.max_x, this.current.position.x)
    for (const zone of this.world.zones) {
      const overlaps =
        this.current.position.x + this.world.player_radius > zone.x &&
        this.current.position.x - this.world.player_radius < zone.x + zone.width &&
        this.current.position.y + this.world.player_radius > zone.y &&
        this.current.position.y - this.world.player_radius < zone.y + zone.height
      if (overlaps && !this.current.triggered_zones[zone.id]) {
        this.current.triggered_zones[zone.id] = true
        this.current.zone_trigger_count += 1
        this.current.world_state = zone.state
      }
    }

    this.clockMs += dt
    return { changed: before !== this.fingerprint(), clock: this.clock }
  }

  pause(): void {
    this.pausedValue = true
  }

  resume(): void {
    this.pausedValue = false
  }

  setSeed(seed: string): void {
    this.current.seed = seed
  }

  fingerprint(): string {
    return fingerprintOf(this.current)
  }
}

/** A runtime adapter chosen by the project's manifest value, not by a branch. */
export function createRealtimeProjectSetup(project: CycleProject): CycleSetup {
  const manifest = project.manifest
  const route = project.route
  if (!manifest || !route) throw new Error(`CF_PLAY_REALTIME_PROJECT_DATA_MISSING: ${project.directory}`)
  if (!Number.isSafeInteger(manifest.step_ms) || manifest.step_ms <= 0) {
    throw new RangeError(`CF_PLAY_REALTIME_STEP_INVALID: ${manifest.step_ms}`)
  }
  const world = requireWorld(project.world)
  const simulationFactory: ExecutorFactory<RealtimeState> = (options: ExecutorOptions<RealtimeState> = {}) =>
    new RealtimeWorldSimulation(world, options.seed ?? project.id, options.state)
  const realtimeFactory = createRealtimeExecutorFactory(simulationFactory, { stepMs: manifest.step_ms })
  const executor = realtimeFactory({ seed: `${project.id}:NAR-4.5` })
  return {
    executor,
    steps: route.steps,
    assertions: manifest.assertions,
    summaryPaths: manifest.summary_paths,
  }
}
