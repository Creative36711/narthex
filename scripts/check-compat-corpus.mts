import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const scriptPath = fileURLToPath(import.meta.url)
const tsxCli = join(root, 'node_modules/tsx/dist/cli.mjs')
const configPath = join(root, '_tools/compat-corpus.json')
const playerBundle = join(root, 'public/ai/cf-play.mjs')
const minimumReferences = 7
const processTimeoutMs = 120_000
const processBufferBytes = 16 * 1024 * 1024

interface CampaignReference {
  ref: string
  projectId: string
  path: string
  runner: 'campaign-check'
}

interface CycleReference {
  ref: string
  projectId: string
  path: string
  runner: 'cycles'
  runtime: string
}

type Reference = CampaignReference | CycleReference

interface CorpusConfig {
  version: number
  description?: string
  references: Reference[]
}

interface ProcessResult {
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
  sweep?: {
    status?: string
    seeds?: number
    finals?: Record<string, number>
  }
  coverage?: { visited?: number; total?: number }
}

interface CycleProjectPayload {
  id?: string
  runtime?: string
  stepCalls?: number
  clockBefore?: number
  clockAfter?: number
  finalFingerprint?: string
  ok?: boolean
}

interface CyclePayload {
  projects?: CycleProjectPayload[]
  configuredRuntimes?: string[]
  usedRuntimes?: string[]
  missingRuntimes?: string[]
  ok?: boolean
}

interface ReferenceResult {
  reference: Reference
  displayPath: string
  command: string
  playerRc: number | null
  gateOk: boolean
  summary: string
  detail?: string
}

const requiredReferences: Array<Pick<Reference, 'ref' | 'projectId' | 'path' | 'runner'>> = [
  {
    ref: 'narrative-public',
    projectId: 'ash-of-caerden',
    path: 'public/campaigns/ash-of-caerden',
    runner: 'campaign-check',
  },
  {
    ref: 'adventure-public',
    projectId: 'ash-of-caerden-adventure',
    path: 'public/campaigns/ash-of-caerden-adventure',
    runner: 'campaign-check',
  },
  {
    ref: 'fmv-public',
    projectId: 'fmv-crossing',
    path: 'public/campaigns/fmv-crossing',
    runner: 'campaign-check',
  },
  {
    ref: 'narrative-pack-data',
    projectId: 'ash-of-caerden',
    path: 'packs/narrative/data/ash-of-caerden',
    runner: 'campaign-check',
  },
  {
    ref: 'adventure-pack-data',
    projectId: 'ash-of-caerden-adventure',
    path: 'packs/adventure/data/ash-of-caerden-adventure',
    runner: 'campaign-check',
  },
  {
    ref: 'fmv-pack-data',
    projectId: 'fmv-crossing',
    path: 'packs/narrative/data/fmv-crossing',
    runner: 'campaign-check',
  },
  {
    ref: 'realtime-wall',
    projectId: 'realtime-wall-zone',
    path: '_tools/projects/realtime-wall',
    runner: 'cycles',
  },
]

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
    'packs/narrative/data/',
    'packs/adventure/data/',
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
  if (candidate.references.length < minimumReferences) {
    fail(`compatibility corpus has ${candidate.references.length} references; minimum is ${minimumReferences}`)
  }

  const references = candidate.references as Reference[]
  const refIds = new Set<string>()
  const paths = new Set<string>()
  for (const reference of references) {
    if (!reference || typeof reference !== 'object') fail('each corpus reference must be an object')
    if (!reference.ref || !reference.projectId || !reference.path) fail('each corpus reference needs ref, projectId, and path')
    if (refIds.has(reference.ref)) fail(`duplicate corpus reference id: ${reference.ref}`)
    if (paths.has(reference.path)) fail(`duplicate corpus path: ${reference.path}`)
    if (!allowedReferencePath(reference.path)) fail(`reference path is outside the approved read-only roots: ${reference.path}`)
    repoPath(reference.path)
    refIds.add(reference.ref)
    paths.add(reference.path)

    if (reference.runner === 'campaign-check') continue
    if (reference.runner === 'cycles') {
      if (!reference.runtime) fail(`${reference.ref}: cycles reference needs its expected runtime`)
      continue
    }
    fail(`${reference.ref}: unsupported runner ${String((reference as { runner?: unknown }).runner)}`)
  }

  for (const required of requiredReferences) {
    const found = references.find((reference) => reference.ref === required.ref)
    if (!found || found.projectId !== required.projectId || found.path !== required.path || found.runner !== required.runner) {
      fail(`required reference changed or missing: ${required.ref} (${required.path})`)
    }
  }

  return candidate as CorpusConfig
}

function runNode(args: string[]): ProcessResult {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    timeout: processTimeoutMs,
    maxBuffer: processBufferBytes,
  })
  const rc = result.status ?? (result.error ? 127 : 1)
  return {
    rc,
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
    coverage: {
      visited: payload.coverage?.visited ?? null,
      total: payload.coverage?.total ?? null,
    },
  })
}

function summarizeCycles(payload: CyclePayload): string {
  return JSON.stringify({
    ok: payload.ok ?? false,
    configuredRuntimes: payload.configuredRuntimes ?? [],
    usedRuntimes: payload.usedRuntimes ?? [],
    missingRuntimes: payload.missingRuntimes ?? [],
    projects: (payload.projects ?? []).map((project) => ({
      id: project.id ?? null,
      runtime: project.runtime ?? null,
      stepCalls: project.stepCalls ?? null,
      clock: `${project.clockBefore ?? '?'}->${project.clockAfter ?? '?'}`,
      finalFingerprint: project.finalFingerprint ?? null,
      ok: project.ok ?? false,
    })),
  })
}

function renderCommand(reference: Reference, playerPath: string, outPath: string): string {
  if (reference.runner === 'cycles') return 'node public/ai/cf-play.mjs cycles --json'
  return `node public/ai/cf-play.mjs check ${playerPath} --json --out ${outPath}`
}

async function preflight(reference: Reference, targetPath: string): Promise<string | undefined> {
  if (!existsSync(targetPath)) return `missing reference path: ${targetPath}`
  if (reference.runner === 'campaign-check') {
    if (!existsSync(join(targetPath, 'campaign.json'))) return `missing campaign.json: ${targetPath}`
    return undefined
  }

  const projectJsonPath = join(targetPath, 'project.json')
  if (!existsSync(projectJsonPath)) return `missing project.json: ${targetPath}`
  let project: { id?: string; runtime?: string }
  try {
    project = JSON.parse(await readFile(projectJsonPath, 'utf8')) as { id?: string; runtime?: string }
  } catch (error) {
    return `project.json cannot be parsed: ${error instanceof Error ? error.message : String(error)}`
  }
  if (project.id !== reference.projectId) return `project id ${String(project.id)} != ${reference.projectId}`
  if (project.runtime !== reference.runtime) return `project runtime ${String(project.runtime)} != ${reference.runtime}`
  return undefined
}

async function runCampaignReference(
  reference: CampaignReference,
  targetPath: string,
  outputRoot: string,
): Promise<ReferenceResult> {
  const relativePathForCommand = targetPath.startsWith(root + sep)
    ? relative(root, targetPath).split(sep).join('/')
    : `<temporary broken copy of ${reference.path}>`
  const outPath = join(outputRoot, reference.ref)
  const command = renderCommand(reference, relativePathForCommand, `<temporary-output>/${reference.ref}`)
  const preflightIssue = await preflight(reference, targetPath)
  if (preflightIssue) {
    return {
      reference,
      displayPath: relativePathForCommand,
      command,
      playerRc: null,
      gateOk: false,
      summary: 'not run',
      detail: preflightIssue,
    }
  }

  const invocation = runNode([playerBundle, 'check', targetPath, '--json', '--out', outPath])
  const payload = parseJson<CampaignPayload>(invocation.stdout)
  const projectId = payload?.campaign?.id ?? null
  const gateOk = invocation.rc === 0 && payload?.verdict === 'ok' && projectId === reference.projectId
  const summary = payload
    ? summarizeCampaign(payload)
    : oneLine(invocation.stderr || invocation.stdout || invocation.error || 'no player output')
  const detail = invocation.error
    ? `spawn error: ${invocation.error}`
    : (invocation.rc !== 0 ? `player rc=${invocation.rc}` : (projectId !== reference.projectId ? `campaign id=${String(projectId)}` : undefined))

  return { reference, displayPath: relativePathForCommand, command, playerRc: invocation.rc, gateOk, summary, ...(detail ? { detail } : {}) }
}

async function runCycleReference(reference: CycleReference, targetPath: string): Promise<ReferenceResult> {
  const preflightIssue = await preflight(reference, targetPath)
  const command = renderCommand(reference, '', '')
  if (preflightIssue) {
    return { reference, displayPath: reference.path, command, playerRc: null, gateOk: false, summary: 'not run', detail: preflightIssue }
  }

  const invocation = runNode([playerBundle, 'cycles', '--json'])
  const payload = parseJson<CyclePayload>(invocation.stdout)
  const projects = payload?.projects ?? []
  const expectedProject = projects.find((project) => project.id === reference.projectId)
  // The same real-player cycles run also exercises the existing turn reference.
  const turnExam = projects.find((project) => project.id === 'ash-of-caerden')
  const runtimes = new Set(payload?.usedRuntimes ?? [])
  const gateOk = invocation.rc === 0
    && payload?.ok === true
    && payload.missingRuntimes?.length === 0
    && runtimes.has('turn')
    && runtimes.has(reference.runtime)
    && expectedProject?.runtime === reference.runtime
    && expectedProject.ok === true
    && turnExam?.runtime === 'turn'
    && turnExam.ok === true
  const summary = payload
    ? summarizeCycles(payload)
    : oneLine(invocation.stderr || invocation.stdout || invocation.error || 'no player output')
  const detail = invocation.error
    ? `spawn error: ${invocation.error}`
    : (invocation.rc !== 0 ? `player rc=${invocation.rc}` : (gateOk ? undefined : 'cycles assertions/runtime set did not match'))
  return { reference, displayPath: reference.path, command, playerRc: invocation.rc, gateOk, summary, ...(detail ? { detail } : {}) }
}

function printResult(result: ReferenceResult): void {
  const mark = result.gateOk ? '✓' : '✗'
  const playerRc = result.playerRc === null ? 'not-run' : String(result.playerRc)
  console.log(`${mark} ${result.reference.ref} (${result.reference.projectId}) — player rc=${playerRc}`)
  console.log(`  path: ${result.displayPath}`)
  console.log(`  command: ${result.command}`)
  console.log(`  stdout summary: ${result.summary}`)
  if (result.detail) console.log(`  detail: ${result.detail}`)
}

async function runCorpus(
  config: CorpusConfig,
  outputRoot: string,
  brokenOverride?: { ref: string; path: string },
): Promise<{ ok: boolean; results: ReferenceResult[] }> {
  console.log(`NAR-5.9 real-player compatibility corpus: ${config.references.length} references; minimum=${minimumReferences}`)
  const results: ReferenceResult[] = []

  for (const reference of config.references) {
    const targetPath = brokenOverride?.ref === reference.ref
      ? brokenOverride.path
      : repoPath(reference.path)
    const result = reference.runner === 'campaign-check'
      ? await runCampaignReference(reference, targetPath, outputRoot)
      : await runCycleReference(reference, targetPath)
    results.push(result)
    printResult(result)
  }

  const ok = results.length >= minimumReferences && results.every((result) => result.gateOk)
  console.log(`check:compat-corpus ${ok ? 'passed' : 'failed'}; refs=${results.length}; rc=${ok ? 0 : 1}`)
  return { ok, results }
}

function parseBreakReference(args: string[]): string | undefined {
  const index = args.indexOf('--break-and-run')
  if (index < 0) return undefined
  const ref = args[index + 1]
  if (!ref || ref.startsWith('--')) fail('--break-and-run requires a campaign reference id')
  return ref
}

async function makeBrokenCopy(reference: Reference, tempRoot: string): Promise<string> {
  if (reference.runner !== 'campaign-check') fail(`negative mutation requires a campaign-check reference, got ${reference.ref}`)
  const source = repoPath(reference.path)
  const copyPath = join(tempRoot, 'broken-project')
  await cp(source, copyPath, { recursive: true })
  // Deliberately corrupt only this temporary copy. The checked-in source stays untouched.
  await writeFile(join(copyPath, 'campaign.json'), '{ broken corpus project\n', 'utf8')
  return copyPath
}

async function runNegativeMode(config: CorpusConfig, referenceId: string): Promise<number> {
  const reference = config.references.find((candidate) => candidate.ref === referenceId)
  if (!reference) fail(`unknown --break-and-run reference: ${referenceId}`)
  if (reference.runner !== 'campaign-check') fail(`--break-and-run supports campaign-check references only: ${referenceId}`)

  const tempRoot = await mkdtemp(join(tmpdir(), 'narthex-compat-corpus-negative-'))
  try {
    const brokenPath = await makeBrokenCopy(reference, tempRoot)
    const results = await runCorpus(config, join(tempRoot, 'player-output'), { ref: referenceId, path: brokenPath })
    return results.ok ? 0 : 1
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

function runNegativeSelfTest(referenceId: string): boolean {
  const command = [tsxCli, scriptPath, '--break-and-run', referenceId]
  const result = spawnSync(process.execPath, command, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    timeout: processTimeoutMs,
    maxBuffer: processBufferBytes,
  })
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const observedRc = result.status ?? (result.error ? 127 : 1)
  console.log('\nNegative control: one existing campaign is copied to a temporary directory and its campaign.json is corrupted.')
  console.log(`command: node ${relative(root, tsxCli).split(sep).join('/')} ${relative(root, scriptPath).split(sep).join('/')} --break-and-run ${referenceId}`)
  console.log(`expected gate rc=1; observed gate rc=${observedRc}`)
  if (combined.trim()) console.log(combined.trimEnd())

  const failedReference = combined.includes(`✗ ${referenceId} (`)
  const playerRejected = /player rc=2/.test(combined)
  const gateRejected = /check:compat-corpus failed;[^\n]*rc=1/.test(combined)
  const ok = observedRc === 1 && failedReference && playerRejected && gateRejected
  console.log(`negative proof ${ok ? 'passed' : 'failed'}; broken-project player rejection=${playerRejected}; gate rc=1=${gateRejected}`)
  return ok
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const configValue = JSON.parse(await readFile(configPath, 'utf8')) as unknown
  const config = validateConfig(configValue)
  const brokenRef = parseBreakReference(args)

  if (brokenRef) return runNegativeMode(config, brokenRef)
  if (args.length) fail(`unsupported arguments: ${args.join(' ')}`)

  const tempRoot = await mkdtemp(join(tmpdir(), 'narthex-compat-corpus-'))
  let corpusOk = false
  try {
    const result = await runCorpus(config, join(tempRoot, 'player-output'))
    corpusOk = result.ok
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
  if (!corpusOk) return 1

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
