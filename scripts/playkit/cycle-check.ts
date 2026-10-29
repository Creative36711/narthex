import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, resolve, sep, join } from 'node:path'
import type { Executor, ExecutorInput } from '../../src/core/executor'
import { resolveProjectPackForCheck } from './project-pack'

export interface CycleStep {
  readonly dt: number
  readonly input?: readonly ExecutorInput[]
}

export type CycleAssertionOperator =
  | 'equals'
  | 'changed'
  | 'less_than_or_equal'
  | 'greater_than'

export interface CycleAssertion {
  readonly name: string
  readonly path: string
  readonly op: CycleAssertionOperator
  readonly expected?: unknown
}

export interface CycleProjectManifest {
  readonly format: 1
  readonly id: string
  readonly title: string
  readonly runtime: string
  readonly world: string
  readonly route: string
  readonly step_ms: number
  readonly summary_paths: readonly string[]
  readonly assertions: readonly CycleAssertion[]
}

export interface CycleRoute {
  readonly steps: readonly CycleStep[]
}

export interface CycleProject {
  readonly directory: string
  readonly id: string
  readonly title: string
  readonly runtime: string
  readonly manifest: CycleProjectManifest | null
  readonly world: unknown
  readonly route: CycleRoute | null
}

export interface CycleSetup {
  readonly executor: Executor<unknown>
  readonly steps: readonly CycleStep[]
  readonly assertions: readonly CycleAssertion[]
  readonly summaryPaths: readonly string[]
}

export type CycleAdapter = (project: CycleProject) => CycleSetup | Promise<CycleSetup>

export interface CycleAssertionResult extends CycleAssertion {
  readonly ok: boolean
  readonly actual: unknown
  readonly previous: unknown
}

export interface CycleProjectResult {
  readonly id: string
  readonly title: string
  readonly runtime: string
  readonly stepCalls: number
  readonly clockBefore: number
  readonly clockAfter: number
  readonly initialFingerprint: string
  readonly finalFingerprint: string
  readonly summary: Readonly<Record<string, unknown>>
  readonly assertions: readonly CycleAssertionResult[]
  readonly ok: boolean
}

export interface CycleReport {
  readonly projects: readonly CycleProjectResult[]
  readonly configuredRuntimes: readonly string[]
  readonly usedRuntimes: readonly string[]
  readonly missingRuntimes: readonly string[]
  readonly ok: boolean
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

function projectFile(directory: string, relativePath: unknown, field: string): string {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    throw new TypeError(`CF_PLAY_CYCLE_MANIFEST_INVALID: ${field} must be a relative path`)
  }
  const root = resolve(directory)
  const file = resolve(root, relativePath)
  if (file === root || !file.startsWith(`${root}${sep}`)) {
    throw new TypeError(`CF_PLAY_CYCLE_MANIFEST_INVALID: ${field} escapes the project directory`)
  }
  return file
}

/**
 * Load cycle identity from one project manifest, or from the installed pack
 * manifest for an existing campaign. Runtime values are data; no cycle is
 * selected by a conditional in the runner.
 */
export async function loadCycleProject(directory: string): Promise<CycleProject> {
  const root = resolve(directory)
  const projectPath = join(root, 'project.json')
  if (existsSync(projectPath)) {
    const raw = await readJson<Record<string, unknown>>(projectPath)
    if (typeof raw.runtime === 'string' && raw.runtime.trim()) {
      const manifest = raw as unknown as CycleProjectManifest
      const world = await readJson<unknown>(projectFile(root, raw.world, 'world'))
      const route = await readJson<CycleRoute>(projectFile(root, raw.route, 'route'))
      if (!Array.isArray(route.steps) || !route.steps.length) {
        throw new TypeError(`CF_PLAY_CYCLE_ROUTE_INVALID: ${root}`)
      }
      for (const [index, step] of route.steps.entries()) {
        if (!Number.isFinite(step.dt) || step.dt < 0 || (step.input !== undefined && !Array.isArray(step.input))) {
          throw new TypeError(`CF_PLAY_CYCLE_ROUTE_INVALID: ${root} step ${index}`)
        }
      }
      if (!Array.isArray(manifest.assertions) || !manifest.assertions.length) {
        throw new TypeError(`CF_PLAY_CYCLE_MANIFEST_INVALID: ${root} must declare assertions`)
      }
      if (!Array.isArray(manifest.summary_paths)) {
        throw new TypeError(`CF_PLAY_CYCLE_MANIFEST_INVALID: ${root} must declare summary_paths`)
      }
      return {
        directory: root,
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : basename(root),
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : basename(root),
        runtime: raw.runtime,
        manifest,
        world,
        route,
      }
    }
  }

  const resolution = await resolveProjectPackForCheck(root)
  if (!resolution) throw new Error(`CF_PLAY_CYCLE_PROJECT_UNAVAILABLE: ${root}`)
  if (resolution.status === 'missing') throw new Error(resolution.diagnostic.message)
  const campaign = await readJson<{ id?: string; title?: string }>(join(root, 'campaign.json'))
  return {
    directory: root,
    id: campaign.id ?? basename(root),
    title: campaign.title ?? campaign.id ?? basename(root),
    runtime: resolution.manifest.runtime,
    manifest: null,
    world: null,
    route: null,
  }
}

function valueAt(value: unknown, path: string): unknown {
  let current = value
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function evaluateAssertion(
  assertion: CycleAssertion,
  before: unknown,
  after: unknown,
): CycleAssertionResult {
  const previous = valueAt(before, assertion.path)
  const actual = valueAt(after, assertion.path)
  let ok = false
  switch (assertion.op) {
    case 'equals':
      ok = Object.is(actual, assertion.expected)
      break
    case 'changed':
      ok = !Object.is(previous, actual)
      break
    case 'less_than_or_equal':
      ok = typeof actual === 'number' && typeof assertion.expected === 'number' && actual <= assertion.expected
      break
    case 'greater_than':
      ok = typeof actual === 'number' && typeof assertion.expected === 'number' && actual > assertion.expected
      break
  }
  return { ...assertion, ok, actual: actual ?? null, previous: previous ?? null }
}

/**
 * Shared runner: each project is loaded once, receives its manifest-selected
 * adapter, then follows the same ordered step loop and assertion evaluator.
 */
export async function runCycleProjects(
  projects: readonly CycleProject[],
  adapters: Readonly<Record<string, CycleAdapter>>,
): Promise<CycleReport> {
  if (!projects.length) throw new Error('CF_PLAY_CYCLE_SUITE_EMPTY')
  const configuredRuntimes = Object.keys(adapters).sort()
  const used = new Set<string>()
  const results: CycleProjectResult[] = []

  for (const project of projects) {
    used.add(project.runtime)
    const adapter = adapters[project.runtime]
    if (!adapter) throw new Error(`CF_PLAY_CYCLE_ADAPTER_MISSING: ${project.runtime}`)
    const setup = await adapter(project)
    if (!setup.steps.length || !setup.assertions.length) {
      throw new Error(`CF_PLAY_CYCLE_SETUP_INCOMPLETE: ${project.id}`)
    }

    const initialState = structuredClone(setup.executor.state)
    const initialFingerprint = setup.executor.fingerprint()
    const clockBefore = setup.executor.clock
    for (const step of setup.steps) setup.executor.step(step.dt, step.input ?? [])
    const finalState = setup.executor.state
    const assertions = setup.assertions.map((assertion) => evaluateAssertion(assertion, initialState, finalState))
    const summary = Object.fromEntries(setup.summaryPaths.map((path) => [path, valueAt(finalState, path) ?? null]))
    results.push({
      id: project.id,
      title: project.title,
      runtime: project.runtime,
      stepCalls: setup.steps.length,
      clockBefore,
      clockAfter: setup.executor.clock,
      initialFingerprint,
      finalFingerprint: setup.executor.fingerprint(),
      summary,
      assertions,
      ok: assertions.every((assertion) => assertion.ok),
    })
  }

  const usedRuntimes = [...used].sort()
  const missingRuntimes = configuredRuntimes.filter((runtime) => !used.has(runtime))
  return {
    projects: results,
    configuredRuntimes,
    usedRuntimes,
    missingRuntimes,
    ok: missingRuntimes.length === 0 && results.every((result) => result.ok),
  }
}

function jsonValue(value: unknown): string {
  const result = JSON.stringify(value)
  return result === undefined ? String(value) : result
}

export function formatCycleReport(report: CycleReport): string {
  const passed = report.projects.filter((project) => project.ok).length
  const lines = ['cf-play cycles', '']
  for (const project of report.projects) {
    lines.push(
      `${project.ok ? '✓' : '✗'} ${project.id} [${project.runtime}]: ` +
        `${project.stepCalls} step calls, clock ${project.clockBefore} → ${project.clockAfter} ms, ` +
        `state ${jsonValue(project.summary)}`,
    )
    for (const assertion of project.assertions) {
      lines.push(`  ${assertion.ok ? '✓' : '✗'} ${assertion.name}: ${jsonValue(assertion.actual)}`)
    }
  }
  lines.push('')
  lines.push(
    `Coverage: ${report.usedRuntimes.length}/${report.configuredRuntimes.length} runtimes; ` +
      `${passed}/${report.projects.length} projects passed; ${report.missingRuntimes.length} runtimes missing.`,
  )
  return lines.join('\n') + '\n'
}
