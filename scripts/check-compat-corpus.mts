import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertAshWarningReport, type AshCampaignId } from './playkit/ash-warning-oracle.mts'

const root = resolve(import.meta.dirname, '..')
const scriptPath = fileURLToPath(import.meta.url)
const tsxCli = join(root, 'node_modules/tsx/dist/cli.mjs')
const contractsChecker = join(root, 'scripts/contracts-check.mts')
const configPath = join(root, '_tools/compat-corpus.json')
const playerBundle = join(root, 'public/ai/cf-play.mjs')
const minimumProjects = 7
const processTimeoutMs = 120_000
const processBufferBytes = 16 * 1024 * 1024

interface BaseReference {
  ref: string
  projectId: string
  path: string
}

interface CampaignReference extends BaseReference {
  runner: 'campaign-check'
}

interface CycleReference extends BaseReference {
  runner: 'cycles'
  runtime: string
}

interface ContractReference extends BaseReference {
  runner: 'contracts'
  relatedPaths?: string[]
}

type Reference = CampaignReference | CycleReference | ContractReference

interface CorpusConfig {
  version: number
  description?: string
  references: Reference[]
}

interface Invocation {
  rc: number
  stdout: string
  stderr: string
  error?: string
}

interface CampaignPayload {
  campaign?: { id?: string }
  verdict?: string
  problems?: unknown[]
  graph?: {
    counts?: { scenes?: number }
    errors?: unknown[]
    warnings?: unknown[]
  }
  sweep?: { seeds?: number; finals?: Record<string, number> }
  coverage?: { visited?: number; total?: number }
}

interface CycleProject {
  id?: string
  runtime?: string
  stepCalls?: number
  clockBefore?: number
  clockAfter?: number
  finalFingerprint?: string
  ok?: boolean
}

interface CyclePayload {
  projects?: CycleProject[]
  usedRuntimes?: string[]
  missingRuntimes?: string[]
  ok?: boolean
}

interface ReferenceResult {
  reference: Reference
  displayPath: string
  command: string
  rc: number | null
  ok: boolean
  stdoutSummary: string
  detail?: string
}

const requiredReferences: Reference[] = [
  { ref: 'ash-of-caerden', projectId: 'ash-of-caerden', path: 'public/campaigns/ash-of-caerden', runner: 'campaign-check' },
  { ref: 'ash-of-caerden-adventure', projectId: 'ash-of-caerden-adventure', path: 'public/campaigns/ash-of-caerden-adventure', runner: 'campaign-check' },
  { ref: 'fmv-crossing', projectId: 'fmv-crossing', path: 'public/campaigns/fmv-crossing', runner: 'campaign-check' },
  { ref: 'realtime-wall-zone', projectId: 'realtime-wall-zone', path: '_tools/projects/realtime-wall', runner: 'cycles', runtime: 'realtime' },
  {
    ref: 'river-of-ash',
    projectId: 'river-of-ash',
    path: 'docs/contracts/examples/project.narrative.json',
    relatedPaths: ['docs/contracts/examples/locales.de.json'],
    runner: 'contracts',
  },
  { ref: 'ash-arena', projectId: 'ash-arena', path: 'docs/contracts/examples/project.code-mode.json', runner: 'contracts' },
  { ref: 'stone-tablet-siege', projectId: 'stone-tablet-siege', path: 'public/campaigns/stone-tablet-siege', runner: 'campaign-check' },
]

const contractSections: Record<string, string[]> = {
  'river-of-ash': ['пример проекта narrative', 'пример локали'],
  'ash-arena': ['пример проекта с кодом в швах'],
}

function fail(message: string): never {
  throw new Error(message)
}

function repoPath(relativePath: string): string {
  if (isAbsolute(relativePath)) fail(`reference paths must be repository-relative: ${relativePath}`)
  const absolute = resolve(root, relativePath)
  const fromRoot = relative(root, absolute)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    fail(`reference path escapes the repository: ${relativePath}`)
  }
  return absolute
}

function allowedReferencePath(path: string): boolean {
  return [
    'public/campaigns/',
    '_tools/projects/',
    'docs/contracts/examples/',
  ].some((prefix) => path.startsWith(prefix))
}

function validateConfig(value: unknown): CorpusConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('compatibility corpus config must be a JSON object')
  }
  const candidate = value as Partial<CorpusConfig>
  if (candidate.version !== 1 || !Array.isArray(candidate.references)) {
    fail('compatibility corpus config must have version 1 and a references array')
  }

  const references = candidate.references as Reference[]
  if (references.length < minimumProjects) {
    fail(`compatibility corpus has ${references.length} references; minimum is ${minimumProjects}`)
  }

  const refIds = new Set<string>()
  const projectIds = new Set<string>()
  const paths = new Set<string>()
  for (const reference of references) {
    if (!reference || typeof reference !== 'object') fail('each corpus reference must be an object')
    if (typeof reference.ref !== 'string' || !reference.ref || typeof reference.projectId !== 'string' || !reference.projectId) {
      fail('each corpus reference needs non-empty ref and projectId strings')
    }
    if (typeof reference.path !== 'string' || !reference.path) fail(`${reference.ref}: path is required`)
    if (refIds.has(reference.ref)) fail(`duplicate corpus reference id: ${reference.ref}`)
    if (projectIds.has(reference.projectId)) fail(`duplicate project.id in corpus: ${reference.projectId}`)
    if (paths.has(reference.path)) fail(`duplicate corpus path: ${reference.path}`)
    if (!allowedReferencePath(reference.path)) fail(`reference path is outside the allowed read-only roots: ${reference.path}`)
    repoPath(reference.path)
    refIds.add(reference.ref)
    projectIds.add(reference.projectId)
    paths.add(reference.path)

    for (const relatedPath of reference.runner === 'contracts' ? reference.relatedPaths ?? [] : []) {
      if (!allowedReferencePath(relatedPath)) fail(`${reference.ref}: related path is outside the allowed read-only roots: ${relatedPath}`)
      if (paths.has(relatedPath)) fail(`duplicate corpus path: ${relatedPath}`)
      repoPath(relatedPath)
      paths.add(relatedPath)
    }

    if (reference.runner === 'campaign-check') continue
    if (reference.runner === 'cycles') {
      if (!reference.runtime) fail(`${reference.ref}: cycles reference needs its expected runtime`)
      continue
    }
    if (reference.runner === 'contracts') continue
    fail(`${reference.ref}: unsupported runner ${String((reference as { runner?: unknown }).runner)}`)
  }

  if (projectIds.size < minimumProjects) {
    fail(`compatibility corpus has ${projectIds.size} unique project IDs; minimum is ${minimumProjects}`)
  }

  for (const required of requiredReferences) {
    const found = references.find((reference) => reference.ref === required.ref)
    const relatedMatches = JSON.stringify(found && 'relatedPaths' in found ? found.relatedPaths ?? [] : [])
      === JSON.stringify('relatedPaths' in required ? required.relatedPaths ?? [] : [])
    const runtimeMatches = !('runtime' in required) || (found && 'runtime' in found && found.runtime === required.runtime)
    if (!found
      || found.projectId !== required.projectId
      || found.path !== required.path
      || found.runner !== required.runner
      || !relatedMatches
      || !runtimeMatches) {
      fail(`required reference changed or missing: ${required.ref} (${required.path})`)
    }
  }

  return candidate as CorpusConfig
}

function runNode(args: string[]): Invocation {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    timeout: processTimeoutMs,
    maxBuffer: processBufferBytes,
  })
  return {
    rc: result.status ?? (result.error ? 127 : 1),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error.message } : {}),
  }
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseJson<T>(output: string): T | null {
  try {
    return JSON.parse(output) as T
  } catch {
    return null
  }
}

function referencePathLabel(reference: Reference): string {
  const relatedPaths = reference.runner === 'contracts' ? reference.relatedPaths ?? [] : []
  return [reference.path, ...relatedPaths].join(' + ')
}

function commandFor(reference: Reference, displayPath = reference.path): string {
  if (reference.runner === 'campaign-check') {
    return `node public/ai/cf-play.mjs check ${displayPath} --json --seeds 1-5 --steps 300 --out <temporary-output>/${reference.ref}`
  }
  if (reference.runner === 'cycles') return 'node public/ai/cf-play.mjs cycles --json'
  return 'node node_modules/tsx/dist/cli.mjs scripts/contracts-check.mts'
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(filePath, 'utf8'))
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  } catch {
    return undefined
  }
  return undefined
}

async function preflight(reference: Reference, targetPath: string): Promise<string | undefined> {
  if (!existsSync(targetPath)) return `missing reference path: ${targetPath}`
  if (reference.runner === 'campaign-check') {
    if (!existsSync(join(targetPath, 'campaign.json'))) return `missing campaign.json: ${targetPath}`
    return undefined
  }
  if (reference.runner === 'cycles') {
    const projectPath = join(targetPath, 'project.json')
    const project = await readJsonFile(projectPath)
    if (!project) return `missing or invalid project.json: ${projectPath}`
    if (project.id !== reference.projectId) return `project id ${String(project.id)} != ${reference.projectId}`
    if (project.runtime !== reference.runtime) return `project runtime ${String(project.runtime)} != ${reference.runtime}`
    return undefined
  }

  const project = await readJsonFile(targetPath)
  if (!project) return `missing or invalid project example: ${targetPath}`
  if (project.id !== reference.projectId) return `project id ${String(project.id)} != ${reference.projectId}`
  for (const relatedPath of reference.relatedPaths ?? []) {
    const absolutePath = repoPath(relatedPath)
    const related = await readJsonFile(absolutePath)
    if (!related) return `missing or invalid related example: ${relatedPath}`
    if (relatedPath.endsWith('locales.de.json') && related.language !== 'de') {
      return `${relatedPath}: language ${String(related.language)} != de`
    }
  }
  return undefined
}

function summarizeCampaign(payload: CampaignPayload): string {
  return JSON.stringify({
    campaignId: payload.campaign?.id ?? null,
    verdict: payload.verdict ?? null,
    problems: Array.isArray(payload.problems) ? payload.problems.length : null,
    scenes: payload.graph?.counts?.scenes ?? null,
    graphErrors: Array.isArray(payload.graph?.errors) ? payload.graph.errors.length : null,
    graphWarnings: Array.isArray(payload.graph?.warnings) ? payload.graph.warnings.length : null,
    seeds: payload.sweep?.seeds ?? null,
    finals: payload.sweep?.finals ?? null,
    coverage: { visited: payload.coverage?.visited ?? null, total: payload.coverage?.total ?? null },
  })
}

function summarizeCycle(payload: CyclePayload, reference: CycleReference): string {
  const project = payload.projects?.find((entry) => entry.id === reference.projectId)
  return JSON.stringify({
    ok: payload.ok ?? false,
    missingRuntimes: payload.missingRuntimes ?? [],
    project: project ? {
      id: project.id,
      runtime: project.runtime,
      stepCalls: project.stepCalls,
      clock: `${project.clockBefore ?? '?'}->${project.clockAfter ?? '?'}`,
      finalFingerprint: project.finalFingerprint,
      ok: project.ok,
    } : null,
  })
}

function summarizeContractOutput(output: string, reference: ContractReference): { summary: string; allSectionsPresent: boolean } {
  const lines = output.split(/\r?\n/)
  const expectedSections = contractSections[reference.projectId] ?? []
  const selected: string[] = []
  let allSectionsPresent = expectedSections.length > 0
  for (const heading of expectedSections) {
    const index = lines.findIndex((line) => line.includes(heading))
    if (index < 0) {
      allSectionsPresent = false
      selected.push(`${heading}: missing`)
      continue
    }
    selected.push(lines.slice(index, index + 3).map((line) => line.trim()).filter(Boolean).join(' / '))
  }
  const completion = lines.find((line) => line.includes('контракты согласованы:'))?.trim()
  if (!completion) allSectionsPresent = false
  return {
    summary: [...selected, completion ?? 'contracts completion line missing'].join(' | '),
    allSectionsPresent,
  }
}

function resultFailure(reference: Reference, command: string, displayPath: string, detail: string): ReferenceResult {
  return { reference, displayPath, command, rc: null, ok: false, stdoutSummary: 'not run', detail }
}

async function runCampaignReference(
  reference: CampaignReference,
  targetPath: string,
  outputRoot: string,
): Promise<ReferenceResult> {
  const displayPath = targetPath.startsWith(root + sep)
    ? relative(root, targetPath).split(sep).join('/')
    : `<temporary broken copy of ${reference.path}>`
  const command = commandFor(reference, displayPath)
  const issue = await preflight(reference, targetPath)
  if (issue) return resultFailure(reference, command, displayPath, issue)

  const invocation = runNode([playerBundle, 'check', targetPath, '--json', '--seeds', '1-5', '--steps', '300', '--out', join(outputRoot, reference.ref)])
  const payload = parseJson<CampaignPayload>(invocation.stdout)
  const projectId = payload?.campaign?.id ?? null
  const ashId = reference.ref === 'ash-of-caerden' || reference.ref === 'ash-of-caerden-adventure'
    ? reference.projectId as AshCampaignId
    : null
  const expectedRc = ashId ? 1 : 0
  let reportMatches = false
  let reportError = ''
  if (ashId) {
    try {
      assertAshWarningReport(payload, ashId)
      reportMatches = true
    } catch (error) {
      reportError = error instanceof Error ? error.message : String(error)
    }
  } else {
    reportMatches = payload?.verdict === 'ok' && projectId === reference.projectId
  }
  const ok = invocation.rc === expectedRc && reportMatches
  const stdoutSummary = payload
    ? summarizeCampaign(payload)
    : oneLine(invocation.stderr || invocation.stdout || invocation.error || 'no player output')
  const detail = invocation.error
    ? `spawn error: ${invocation.error}`
    : (invocation.rc !== expectedRc
      ? `player rc=${invocation.rc}; expected ${ashId ? 'strict Ash rejection rc=1' : 'positive check rc=0'}`
      : (reportMatches ? undefined : reportError || `campaign report did not match ${reference.projectId}`))
  return { reference, displayPath, command, rc: invocation.rc, ok, stdoutSummary, ...(detail ? { detail } : {}) }
}

async function runCycleReference(reference: CycleReference, targetPath: string): Promise<ReferenceResult> {
  const displayPath = reference.path
  const command = commandFor(reference)
  const issue = await preflight(reference, targetPath)
  if (issue) return resultFailure(reference, command, displayPath, issue)

  const invocation = runNode([playerBundle, 'cycles', '--json'])
  const payload = parseJson<CyclePayload>(invocation.stdout)
  const project = payload?.projects?.find((entry) => entry.id === reference.projectId)
  const ok = invocation.rc === 0
    && payload?.ok === true
    && payload.missingRuntimes?.length === 0
    && project?.runtime === reference.runtime
    && project.ok === true
  const stdoutSummary = payload
    ? summarizeCycle(payload, reference)
    : oneLine(invocation.stderr || invocation.stdout || invocation.error || 'no player output')
  const detail = invocation.error
    ? `spawn error: ${invocation.error}`
    : (invocation.rc !== 0 ? `player rc=${invocation.rc}` : (ok ? undefined : 'cycles assertions/runtime did not match'))
  return { reference, displayPath, command, rc: invocation.rc, ok, stdoutSummary, ...(detail ? { detail } : {}) }
}

async function runContractReference(reference: ContractReference): Promise<ReferenceResult> {
  const displayPath = referencePathLabel(reference)
  const command = commandFor(reference)
  const issue = await preflight(reference, repoPath(reference.path))
  if (issue) return resultFailure(reference, command, displayPath, issue)

  const invocation = runNode([tsxCli, contractsChecker])
  const summarized = summarizeContractOutput(invocation.stdout, reference)
  const ok = invocation.rc === 0 && summarized.allSectionsPresent
  const detail = invocation.error
    ? `spawn error: ${invocation.error}`
    : (invocation.rc !== 0 ? `contracts checker rc=${invocation.rc}` : (ok ? undefined : 'expected contract section missing from checker output'))
  return {
    reference,
    displayPath,
    command,
    rc: invocation.rc,
    ok,
    stdoutSummary: summarized.summary,
    ...(detail ? { detail } : {}),
  }
}

async function runReference(
  reference: Reference,
  outputRoot: string,
  brokenOverride?: { ref: string; path: string },
): Promise<ReferenceResult> {
  const targetPath = brokenOverride?.ref === reference.ref ? brokenOverride.path : repoPath(reference.path)
  if (reference.runner === 'campaign-check') return runCampaignReference(reference, targetPath, outputRoot)
  if (reference.runner === 'cycles') return runCycleReference(reference, targetPath)
  return runContractReference(reference)
}

function printResults(results: ReferenceResult[], projectCount: number): void {
  console.log('\nproject | path | id | command | rc')
  console.log('--- | --- | --- | --- | ---:')
  for (const result of results) {
    const mark = result.ok ? '✓' : '✗'
    console.log(`| ${mark} ${result.reference.ref} | ${result.displayPath} | ${result.reference.projectId} | ${result.command} | ${result.rc ?? 'not-run'} |`)
    console.log(`  stdout: ${result.stdoutSummary}`)
    if (result.detail) console.log(`  detail: ${result.detail}`)
  }
  const ok = projectCount >= minimumProjects && results.length >= minimumProjects && results.every((result) => result.ok)
  console.log(`check:compat-corpus ${ok ? 'passed' : 'failed'}; unique-projects=${projectCount}; minimum=${minimumProjects}; rc=${ok ? 0 : 1}`)
}

async function runCorpus(
  config: CorpusConfig,
  outputRoot: string,
  brokenOverride?: { ref: string; path: string },
): Promise<{ ok: boolean; projectCount: number; results: ReferenceResult[] }> {
  const projectCount = new Set(config.references.map((reference) => reference.projectId)).size
  console.log(`NAR-5.9 compatibility corpus: ${config.references.length} references; unique project IDs=${projectCount}; minimum=${minimumProjects}`)
  const results: ReferenceResult[] = []
  for (const reference of config.references) results.push(await runReference(reference, outputRoot, brokenOverride))
  printResults(results, projectCount)
  return { ok: projectCount >= minimumProjects && results.length >= minimumProjects && results.every((result) => result.ok), projectCount, results }
}

function parseBreakReference(args: string[]): string | undefined {
  const index = args.indexOf('--break-and-run')
  if (index < 0) return undefined
  const referenceId = args[index + 1]
  if (!referenceId || referenceId.startsWith('--')) fail('--break-and-run requires a campaign reference id')
  return referenceId
}

async function makeBrokenCopy(reference: Reference, tempRoot: string): Promise<string> {
  if (reference.runner !== 'campaign-check') fail(`negative mutation requires a campaign reference, got ${reference.ref}`)
  const copyPath = join(tempRoot, 'broken-project')
  await cp(repoPath(reference.path), copyPath, { recursive: true })
  // Mutate only this temporary copy; the checked-in campaign remains untouched.
  await writeFile(join(copyPath, 'campaign.json'), '{ broken corpus project\n', 'utf8')
  return copyPath
}

async function runNegativeMode(config: CorpusConfig, referenceId: string): Promise<number> {
  const reference = config.references.find((candidate) => candidate.ref === referenceId)
  if (!reference) fail(`unknown --break-and-run reference: ${referenceId}`)
  if (reference.runner !== 'campaign-check') fail(`--break-and-run supports campaign references only: ${referenceId}`)

  const tempRoot = await mkdtemp(join(tmpdir(), 'narthex-compat-corpus-negative-'))
  try {
    const brokenPath = await makeBrokenCopy(reference, tempRoot)
    const result = await runCorpus(config, join(tempRoot, 'player-output'), { ref: referenceId, path: brokenPath })
    return result.ok ? 0 : 1
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

function runNegativeSelfTest(referenceId: string): boolean {
  const result = spawnSync(process.execPath, [tsxCli, scriptPath, '--break-and-run', referenceId], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    timeout: processTimeoutMs,
    maxBuffer: processBufferBytes,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const observedRc = result.status ?? (result.error ? 127 : 1)
  console.log('\nNegative control: corrupt one temporary copy of an existing corpus campaign.')
  console.log(`command: node node_modules/tsx/dist/cli.mjs scripts/check-compat-corpus.mts --break-and-run ${referenceId}`)
  console.log(`expected gate rc=1; observed gate rc=${observedRc}`)
  if (output.trim()) console.log(output.trimEnd())
  const rowFailed = output.includes(`| ✗ ${referenceId} |`)
  const playerRejected = /player rc=2/.test(output)
  const gateRejected = /check:compat-corpus failed;[^\n]*rc=1/.test(output)
  const ok = observedRc === 1 && rowFailed && playerRejected && gateRejected
  console.log(`negative proof ${ok ? 'passed' : 'failed'}; player rejection=${playerRejected}; gate rc=1=${gateRejected}`)
  return ok
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const configValue = JSON.parse(await readFile(configPath, 'utf8')) as unknown
  const config = validateConfig(configValue)
  const brokenReference = parseBreakReference(args)
  if (brokenReference) return runNegativeMode(config, brokenReference)
  if (args.length) fail(`unsupported arguments: ${args.join(' ')}`)

  const tempRoot = await mkdtemp(join(tmpdir(), 'narthex-compat-corpus-'))
  let result: { ok: boolean; projectCount: number; results: ReferenceResult[] }
  try {
    result = await runCorpus(config, join(tempRoot, 'player-output'))
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
  if (!result.ok) return 1

  const negativeReference = config.references.find((reference) => reference.runner === 'campaign-check')
  if (!negativeReference) fail('negative-control campaign reference is missing')
  return runNegativeSelfTest(negativeReference.ref) ? 0 : 1
}

main().then((rc) => {
  process.exitCode = rc
}).catch((error: unknown) => {
  console.error(`check:compat-corpus failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
