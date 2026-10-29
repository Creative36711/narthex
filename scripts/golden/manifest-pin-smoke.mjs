#!/usr/bin/env node
/** Run the endings runner against disposable, mutated pin copies. */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TRACKED_MANIFEST = join(ROOT, '.golden', 'manifest.json')
const originalBytes = readFileSync(TRACKED_MANIFEST)
const originalDigest = createHash('sha256').update(originalBytes).digest('hex')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'golden-manifest-negative-'))

function stageRunner(root, manifestCopy) {
  const goldenRoot = join(root, '.golden')
  const campaignRoot = join(goldenRoot, 'karkas')
  const scriptsRoot = join(root, 'scripts')
  mkdirSync(join(scriptsRoot, 'golden'), { recursive: true })
  mkdirSync(join(scriptsRoot, 'visual'), { recursive: true })
  mkdirSync(campaignRoot, { recursive: true })
  copyFileSync(join(ROOT, 'scripts', 'golden', 'endings.mjs'), join(scriptsRoot, 'golden', 'endings.mjs'))
  copyFileSync(join(ROOT, 'scripts', 'golden', 'manifest-pin.mjs'), join(scriptsRoot, 'golden', 'manifest-pin.mjs'))
  copyFileSync(join(ROOT, 'scripts', 'visual', 'local-browser.mjs'), join(scriptsRoot, 'visual', 'local-browser.mjs'))
  copyFileSync(manifestCopy, join(goldenRoot, 'manifest.json'))
  writeFileSync(join(campaignRoot, 'manifest.json'), '{}\n')
  return {
    runnerPath: join(scriptsRoot, 'golden', 'endings.mjs'),
    outputPath: join(root, '_tools', 'reports', 'GOLD-1.10'),
  }
}

function runMutation(name, mutate, expectedMessage) {
  const caseRoot = join(temporaryRoot, name)
  const manifestCopy = join(temporaryRoot, `${name}.json`)
  copyFileSync(TRACKED_MANIFEST, manifestCopy)
  const copy = JSON.parse(readFileSync(manifestCopy, 'utf8'))
  mutate(copy)
  writeFileSync(manifestCopy, `${JSON.stringify(copy, null, 2)}\n`)
  const { runnerPath, outputPath } = stageRunner(caseRoot, manifestCopy)
  const result = spawnSync(process.execPath, [runnerPath], {
    cwd: caseRoot,
    encoding: 'utf8',
    timeout: 10000,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (result.error) throw result.error
  if (result.status === 0) throw new Error(`${name} mutation unexpectedly passed validation: ${output.trim()}`)
  if (!output.includes(expectedMessage)) {
    throw new Error(`${name} mutation returned rc=${result.status}, but not the expected validation message (${expectedMessage}): ${output.trim()}`)
  }
  if (existsSync(outputPath)) {
    throw new Error(`${name} mutation created the runner output directory before rejecting the pin`)
  }
  const validationLine = output.split(/\r?\n/).find((line) => line.includes(expectedMessage))?.trim() ?? 'validation error matched'
  console.log(`${name}: runner rc=${result.status}; rejected before report/browser startup; ${validationLine}`)
}

try {
  runMutation('commit', (manifest) => {
    manifest.commit = '0'.repeat(40)
  }, 'manifest URL must be the exact codeload tarball URL for manifest.commit')
  runMutation('sha256', (manifest) => {
    manifest.sha256 = '0'.repeat(64)
  }, 'manifest tree.archive_sha256 must equal manifest sha256')

  const afterBytes = readFileSync(TRACKED_MANIFEST)
  const afterDigest = createHash('sha256').update(afterBytes).digest('hex')
  if (afterDigest !== originalDigest || !afterBytes.equals(originalBytes)) {
    throw new Error('Tracked .golden/manifest.json changed during negative validation')
  }
  console.log(`tracked .golden/manifest.json unchanged: sha256=${afterDigest}`)
  console.log('Manifest negative smoke: PASS')
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
