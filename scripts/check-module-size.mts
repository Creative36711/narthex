import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const MODULE_LIMIT = 450
const FACADE_LIMIT = 600
const ENGINE_PATH = 'src/core/engine.ts'
const EXTERNAL_DEBT = ['src/core/combat.ts', 'src/core/savemigrate.ts'] as const
const sourceExtensions = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i

interface SizeResult {
  path: string
  lines: number
  limit: number
  violation?: string
}

function countLines(contents: string): number {
  if (contents.length === 0) return 0
  const lines = contents.split(/\r\n|\r|\n/).length
  return lines - (/(?:\r\n|\r|\n)$/.test(contents) ? 1 : 0)
}

function limitFor(path: string): number {
  return path === ENGINE_PATH ? FACADE_LIMIT : MODULE_LIMIT
}

function evaluateSize(path: string, contents: string): SizeResult {
  const lines = countLines(contents)
  const limit = limitFor(path)
  return {
    path,
    lines,
    limit,
    violation: lines > limit ? `${path}: ${lines} lines exceeds limit=${limit}` : undefined,
  }
}

function runGit(args: string[]): string {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (rc=${result.status}): ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

function ensureBaseRef(): void {
  const verify = spawnSync('git', ['rev-parse', '--verify', 'origin/main^{commit}'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (verify.status === 0) return
  const fetch = spawnSync('git', [
    'fetch', '--quiet', '--no-tags', 'origin', 'main:refs/remotes/origin/main',
  ], { cwd: repoRoot, encoding: 'utf8' })
  if (fetch.error) throw fetch.error
  if (fetch.status !== 0) {
    throw new Error(`origin/main is unavailable and could not be fetched: ${fetch.stderr || fetch.stdout}`)
  }
}

function changedSourceModules(): string[] {
  ensureBaseRef()
  const changed = new Set<string>()
  const diff = runGit(['diff', '--name-status', '--no-renames', 'origin/main', '--', 'src', 'packs'])
  for (const line of diff.split(/\r?\n/).filter(Boolean)) {
    const [status, path] = line.split('\t')
    if (!path || status === 'D' || !sourceExtensions.test(path)) continue
    changed.add(path.replaceAll('\\', '/'))
  }

  const untracked = runGit(['ls-files', '--others', '--exclude-standard', '--', 'src', 'packs'])
  for (const path of untracked.split(/\r?\n/).filter(Boolean)) {
    if (sourceExtensions.test(path)) changed.add(path.replaceAll('\\', '/'))
  }
  return [...changed].sort()
}

function assertFixture(name: string, path: string, lines: number, expectedRc: number): void {
  const result = evaluateSize(path, 'x\n'.repeat(lines))
  const actualRc = result.violation ? 1 : 0
  assert.equal(actualRc, expectedRc, `${name}: expected rc=${expectedRc}, got rc=${actualRc}; ${result.violation ?? `lines=${result.lines}, limit=${result.limit}`}`)
  if (expectedRc !== 0) {
    assert.ok(result.violation?.includes(String(lines)), `${name}: failure must include actual line count ${lines}`)
    assert.ok(result.violation?.includes(String(result.limit)), `${name}: failure must include limit ${result.limit}`)
  }
  console.log(`${name}: PASS — rc=${actualRc}, lines=${result.lines}, limit=${result.limit}`)
}

function verifyFixtures(): void {
  assertFixture('fixture (a) changed module 451 lines', 'src/core/fixture.ts', 451, 1)
  assertFixture('fixture (b) changed module 450 lines', 'src/core/fixture.ts', 450, 0)
  assertFixture('fixture (c) engine.ts 600 lines', ENGINE_PATH, 600, 0)
  assertFixture('fixture (d) engine.ts 601 lines', ENGINE_PATH, 601, 1)
}

async function readResult(path: string): Promise<SizeResult> {
  const contents = await readFile(join(repoRoot, path), 'utf8')
  return evaluateSize(path, contents)
}

async function main(): Promise<void> {
  verifyFixtures()

  const changedModules = changedSourceModules()
  const checkedPaths = new Set(changedModules)
  // The engine facade is a global architecture invariant, not external debt.
  checkedPaths.add(ENGINE_PATH)

  const results: SizeResult[] = []
  for (const path of [...checkedPaths].sort()) results.push(await readResult(path))
  const debtResults: SizeResult[] = []
  for (const path of EXTERNAL_DEBT) debtResults.push(await readResult(path))

  console.log(`limit=${MODULE_LIMIT} facade=${FACADE_LIMIT}`)
  console.log(`changed source modules=${changedModules.length}`)
  for (const result of results) {
    console.log(`module ${result.path}: ${result.lines}/${result.limit} lines${changedModules.includes(result.path) ? ' (changed)' : ' (facade)'}`)
  }
  console.log(
    `external debt (non-blocking unless changed): ${debtResults.map((item) => `${item.path} ${item.lines}`).join('; ')}`,
  )

  const failures = results.filter((result) => result.violation)
  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure.violation}`)
    console.error(`check:module-size failed: ${failures.length} module(s) exceed their limit`)
    process.exitCode = 1
    return
  }
  console.log('check:module-size passed')
}

await main()
