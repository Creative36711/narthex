import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { renameAjvHelper } from './rename-audit-ajv-helper.mts'

const root = resolve(import.meta.dirname, '..')
const source = 'scripts/campaign-audit.mts'
const committedBundle = 'public/ai/campaign-audit.mjs'
const protectedSha256 = 'b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d'
// Canonical bundle source immediately before the behavior-preserving module split.
const canonicalSourceCommit = '0a5abca49ff91daf4b642fb76272dec56a6a778e'
const fixture = resolve(root, 'public/campaigns/stone-tablet-siege')
const esbuild = join(root, 'node_modules/esbuild/bin/esbuild')
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

function buildBundle(cwd: string, outfile: string, preserveSymlinks = false): Buffer {
  const args = [
    source,
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node18',
    ...(preserveSymlinks ? ['--preserve-symlinks'] : []),
    `--outfile=${outfile}`,
  ]
  const build = command(esbuild, args, cwd)
  assert.equal(
    build.status,
    0,
    `esbuild exited with rc=${build.status ?? 1}\n${build.stdout ?? ''}${build.stderr ?? ''}`,
  )
  return Buffer.from(renameAjvHelper(readFileSync(outfile, 'utf8')))
}

function runAudit(args: string[]) {
  const run = command(process.execPath, args, root)
  assert.ok(run.status === 0 || run.status === 1, `audit process failed to launch: ${run.stderr ?? ''}`)
  const stdout = String(run.stdout ?? '').trim()
  assert.ok(stdout, `audit produced no JSON output (rc=${run.status}): ${run.stderr ?? ''}`)
  return { status: run.status, report: JSON.parse(stdout) as unknown }
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
  const committed = await readFile(join(root, committedBundle))
  assert.equal(
    sha256(committed),
    protectedSha256,
    `${committedBundle} no longer has its protected SHA-256`,
  )

  // Prove the published file is reproducible from the clean pre-split source tree.
  // The symlink and --preserve-symlinks keep dependency comments relative in this
  // temporary tree, matching the standard build from a normal repository checkout.
  let hasCanonicalCommit = command('git', ['cat-file', '-e', `${canonicalSourceCommit}^{commit}`], root).status === 0
  if (!hasCanonicalCommit) {
    const fetch = command('git', ['fetch', '--quiet', 'origin', canonicalSourceCommit], root)
    assert.equal(
      fetch.status,
      0,
      `cannot fetch canonical audit source ${canonicalSourceCommit}: ${fetch.stderr ?? ''}`,
    )
    hasCanonicalCommit = command('git', ['cat-file', '-e', `${canonicalSourceCommit}^{commit}`], root).status === 0
  }
  assert.ok(hasCanonicalCommit, `canonical audit source commit is unavailable: ${canonicalSourceCommit}`)

  const archive = command('git', ['archive', '--format=tar', canonicalSourceCommit], root)
  assert.equal(archive.status, 0, `git archive failed: ${archive.stderr ?? ''}`)
  const baselineTree = join(tempDir, 'canonical-source')
  await mkdir(baselineTree)
  const extract = command('tar', ['-xf', '-', '-C', baselineTree], root, Buffer.from(archive.stdout as Buffer))
  assert.equal(extract.status, 0, `cannot extract canonical source tree: ${extract.stderr ?? ''}`)
  await symlink(join(root, 'node_modules'), join(baselineTree, 'node_modules'), 'dir')
  const baselineBundlePath = join(baselineTree, committedBundle)
  const canonicalBundle = buildBundle(baselineTree, baselineBundlePath, true)
  assert.ok(
    committed.equals(canonicalBundle),
    `clean canonical build does not match ${committedBundle}: generated sha256 ${sha256(canonicalBundle)}`,
  )

  // Current source now has a different bundle layout because the editor/types
  // modules were split. Require reproducible clean builds and prove behavior
  // parity against both the source runner and the protected public bundle.
  const currentBuildA = buildBundle(root, join(tempDir, 'current-a.mjs'))
  const currentBuildB = buildBundle(root, join(tempDir, 'current-b.mjs'))
  assert.ok(currentBuildA.equals(currentBuildB), 'two clean current-source builds differ byte-for-byte')
  const currentBuildPath = join(tempDir, 'current-source.mjs')
  await writeFile(currentBuildPath, currentBuildA)

  const sourceResult = runAudit(['--import=tsx', source, fixture, '--json'])
  const currentBundleResult = runAudit([currentBuildPath, fixture, '--json'])
  const publishedBundleResult = runAudit([join(root, committedBundle), fixture, '--json'])
  assert.equal(currentBundleResult.status, sourceResult.status, 'current bundle exit code differs from the source runner')
  assert.equal(publishedBundleResult.status, sourceResult.status, 'protected bundle exit code differs from the source runner')
  assert.deepEqual(comparable(currentBundleResult.report), comparable(sourceResult.report), 'current bundle JSON differs from the source runner')
  assert.deepEqual(comparable(publishedBundleResult.report), comparable(sourceResult.report), 'protected bundle JSON differs from the source runner')

  console.log(`✓ ${committedBundle} matches the clean canonical build (${committed.length} bytes, sha256 ${protectedSha256})`)
  console.log(`✓ current-source bundles are byte-reproducible (sha256 ${sha256(currentBuildA)})`)
  console.log(`✓ source/current/published audit JSON is identical on stone-tablet-siege (audit rc=${sourceResult.status})`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
