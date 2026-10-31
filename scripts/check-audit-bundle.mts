import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildAiBundle } from './build-ai-bundle.mts'

const root = resolve(import.meta.dirname, '..')
const source = 'scripts/campaign-audit.mts'
const committedBundle = 'public/ai/campaign-audit.mjs'
const fixture = resolve(root, 'public/campaigns/stone-tablet-siege')
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const tempDir = await mkdtemp(join(tmpdir(), 'narthex-audit-bundle-'))

function command(commandName: string, args: string[], cwd: string, input?: Buffer) {
  const result = spawnSync(commandName, args, {
    cwd,
    input,
    maxBuffer: 512 * 1024 * 1024,
    timeout: 300_000,
  })
  if (result.error) throw result.error
  return result
}

function runAudit(args: string[]) {
  const run = command(process.execPath, args, root)
  assert.ok(run.status === 0 || run.status === 1, `audit process failed to launch: ${run.stderr ?? ''}`)
  const stdout = String(run.stdout ?? '').trim()
  assert.ok(stdout, `audit produced no JSON output (rc=${run.status}): ${run.stderr ?? ''}`)
  return { status: run.status, report: JSON.parse(stdout) as unknown }
}

function cmpFiles(left: string, right: string): number {
  const result = command('cmp', ['-s', left, right], root)
  assert.ok(result.status === 0 || result.status === 1, `cmp failed (${result.status}): ${result.stderr ?? ''}`)
  return result.status
}

function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== 'checkedAt').map(([key, item]) => [key, comparable(item)]),
    )
  }
  return value
}

try {
  const publishedPath = join(root, committedBundle)
  const committed = await readFile(publishedPath)
  const currentBuildAPath = join(tempDir, 'current-a.mjs')
  const currentBuildBPath = join(tempDir, 'current-b.mjs')
  const currentBuildA = await buildAiBundle(currentBuildAPath, true)
  const currentBuildB = await buildAiBundle(currentBuildBPath, true)

  const currentShaA = sha256(currentBuildA)
  const currentShaB = sha256(currentBuildB)
  const publishedSha = sha256(committed)
  const buildsCmp = cmpFiles(currentBuildAPath, currentBuildBPath)
  const publishedCmp = cmpFiles(publishedPath, currentBuildAPath)

  console.log(`current source: ${source}`)
  console.log(`build A: ${relative(root, currentBuildAPath)} — ${currentBuildA.length} bytes, sha256 ${currentShaA}`)
  console.log(`build B: ${relative(root, currentBuildBPath)} — ${currentBuildB.length} bytes, sha256 ${currentShaB}`)
  console.log(`published: ${committedBundle} — ${committed.length} bytes, sha256 ${publishedSha}`)
  console.log(`cmp -s ${relative(root, currentBuildAPath)} ${relative(root, currentBuildBPath)}: ${buildsCmp}`)
  console.log(`cmp -s ${committedBundle} ${relative(root, currentBuildAPath)}: ${publishedCmp}`)

  assert.equal(buildsCmp, 0, `two clean current-source builds differ: ${currentShaA} != ${currentShaB}`)
  assert.equal(
    publishedCmp,
    0,
    `${committedBundle} does not match a build of current ${source}: published sha256 ${publishedSha}, generated sha256 ${currentShaA}`,
  )

  const sourceResult = runAudit(['--import=tsx', source, fixture, '--json'])
  const currentBundleResult = runAudit([currentBuildAPath, fixture, '--json'])
  const publishedBundleResult = runAudit([publishedPath, fixture, '--json'])
  assert.equal(currentBundleResult.status, sourceResult.status, 'current bundle exit code differs from the source runner')
  assert.equal(publishedBundleResult.status, sourceResult.status, 'published bundle exit code differs from the source runner')
  assert.deepEqual(comparable(currentBundleResult.report), comparable(sourceResult.report), 'current bundle JSON differs from the source runner')
  assert.deepEqual(comparable(publishedBundleResult.report), comparable(sourceResult.report), 'published bundle JSON differs from the source runner')

  console.log(`✓ published audit bundle is byte-identical to current source (${publishedSha})`)
  console.log(`✓ source/current/published audit JSON is identical on stone-tablet-siege (audit rc=${sourceResult.status})`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
