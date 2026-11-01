#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { BRAND_COMPATIBILITY_ALLOWANCES, scanBrandRoot } from './brand-guard.mts'

const projectRoot = resolve(process.cwd())
const baselinePath = join(projectRoot, 'scripts/protected-legacy-baselines.json')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
  brandFiles: Record<string, string>
}
const formerBaselinePaths = Object.keys(baseline.brandFiles).sort()

assert.equal(formerBaselinePaths.length, 33, 'expected the original 33-file inventory')
assert.ok(formerBaselinePaths.includes('src/shared/settings.ts'), 'negative A must use a former baseline path')

const positive = scanBrandRoot(projectRoot)
assert.deepEqual(positive.hits, [], 'the current repository should pass the positive full-scan probe')
assert.equal(
  positive.allowedCompatibilityOccurrences,
  BRAND_COMPATIBILITY_ALLOWANCES.length,
  'every exact compatibility rule must correspond to one live scanned occurrence',
)
assert.equal(
  new Set(BRAND_COMPATIBILITY_ALLOWANCES.map((entry) =>
    [entry.path, entry.line, entry.column, entry.occurrence].join('|'),
  )).size,
  BRAND_COMPATIBILITY_ALLOWANCES.length,
  'compatibility rules must not duplicate an occurrence',
)
for (const entry of BRAND_COMPATIBILITY_ALLOWANCES) {
  assert.ok(entry.reason.trim(), `missing reason for ${entry.path}:${entry.line}:${entry.column}`)
  const lines = readFileSync(join(projectRoot, entry.path), 'utf8').split('\n')
  assert.equal(
    lines[entry.line - 1]?.slice(entry.column - 1, entry.column - 1 + entry.occurrence.length),
    entry.occurrence,
    `stale point rule at ${entry.path}:${entry.line}:${entry.column}`,
  )
}
const scannedPaths = new Set(positive.checkedPaths)
const formerBaselineScanned = formerBaselinePaths.filter((path) => scannedPaths.has(path))
assert.equal(
  formerBaselineScanned.length,
  formerBaselinePaths.length,
  'all former SHA-list files must be scanned without a hash bypass',
)
console.log(`✓ positive: ${positive.checkedFiles} files scanned; former SHA inventory ${formerBaselineScanned.length}/${formerBaselinePaths.length}; ${positive.allowedCompatibilityOccurrences} live point rules.`)

const formerPackageName = ['chronicle', '-forge'].join('')
const formerTitle = ['Chronicle', ' Forge'].join('')
const formerExtensionLine = ['.', 'nxsave,', '.', 'cfsave'].join('')

function scanFixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'narthex-brand-probe-'))
  try {
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(root, path)
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, content, 'utf8')
    }
    return scanBrandRoot(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const settingsRule = BRAND_COMPATIBILITY_ALLOWANCES.find((entry) => entry.path === 'src/shared/settings.ts')
assert.ok(settingsRule, 'negative A needs the existing point rule in the former baseline file')
const settingsLines = Array.from({ length: settingsRule.line }, () => '')
settingsLines[settingsRule.line - 1] =
  `${' '.repeat(settingsRule.column - 1)}${settingsRule.occurrence}; appended ${JSON.stringify(`${formerPackageName}:probe`)}`
const probeA = scanFixture({ 'src/shared/settings.ts': `${settingsLines.join('\n')}\n` })
assert.equal(probeA.allowedCompatibilityOccurrences, 1, 'negative A must retain only the exact pre-existing point')
assert.ok(
  probeA.hits.some((hit) => hit.startsWith(`src/shared/settings.ts:${settingsRule.line}:`) && hit.includes('legacy storage key')),
  'negative A must reject a second marker in the same former SHA-list file',
)
console.log('✓ negative A: the exact old point remains allowed, but a second marker in the former SHA-list file is rejected.')

const probeB = scanFixture({
  'fixtures/accept.html': `<input accept="image/*" aria-label=${JSON.stringify(formerTitle)} />\n`,
})
assert.ok(
  probeB.hits.some((hit) => hit.startsWith('fixtures/accept.html:1:') && hit.includes('former product title')),
  'negative B must reject a marker on a line containing an accept attribute',
)
console.log('✓ negative B: an accept-attribute line does not mask a marker.')

const probeC = scanFixture({
  'index.html': `<title>${formerTitle}</title>\n`,
  'public/ai/brand-probe.mjs': `const legacyExtensions = ${JSON.stringify(formerExtensionLine)}; const label = ${JSON.stringify(formerTitle)};\n`,
})
assert.ok(
  probeC.hits.some((hit) => hit.startsWith('index.html:1:') && hit.includes('former product title')),
  'negative C must reject the index.html insertion',
)
assert.ok(
  probeC.hits.some((hit) => hit.startsWith('public/ai/brand-probe.mjs:1:') && hit.includes('former product title')),
  'negative C must separately reject the public AI insertion',
)
console.log('✓ negative C: separate index.html and public/ai insertions are rejected.')

console.log('✓ all brand-guard probes passed.')
