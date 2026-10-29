import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { renameAjvHelper } from './rename-audit-ajv-helper.mts'

const root = resolve(import.meta.dirname, '..')
const source = 'scripts/campaign-audit.mts'
const committedBundle = 'public/ai/campaign-audit.mjs'
const esbuild = join(root, 'node_modules/esbuild/bin/esbuild')
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

const tempDir = await mkdtemp(join(tmpdir(), 'narthex-audit-bundle-'))
try {
  const generatedPath = join(tempDir, 'campaign-audit.mjs')
  const build = spawnSync(esbuild, [
    source,
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node18',
    `--outfile=${generatedPath}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (build.error) throw build.error
  assert.equal(
    build.status,
    0,
    `esbuild exited with rc=${build.status ?? 1}\n${build.stdout ?? ''}${build.stderr ?? ''}`,
  )

  const [actual, rawGenerated] = await Promise.all([
    readFile(join(root, committedBundle)),
    readFile(generatedPath),
  ])
  const generated = Buffer.from(renameAjvHelper(rawGenerated.toString('utf8')))
  if (!actual.equals(generated)) {
    const commonLength = Math.min(actual.length, generated.length)
    let firstDifference = 0
    while (firstDifference < commonLength && actual[firstDifference] === generated[firstDifference]) firstDifference++
    console.error(`✗ ${committedBundle} is stale relative to ${source}`)
    console.error(`  committed: ${actual.length} bytes, sha256 ${sha256(actual)}`)
    console.error(`  generated: ${generated.length} bytes, sha256 ${sha256(generated)}`)
    console.error(`  first differing byte: ${firstDifference}`)
    console.error('  rebuild with: npm run build:ai-bundle')
    process.exitCode = 1
  } else {
    console.log(`✓ ${committedBundle} matches ${source} (${actual.length} bytes, sha256 ${sha256(actual)})`)
  }
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
