#!/usr/bin/env node
/**
 * Product-brand regression guard. Exact unchanged legacy snapshots from the
 * recorded main baseline are treated as historical/compatibility inputs, not
 * fresh product insertions. A byte change expires that narrow exception.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import baselines from './protected-legacy-baselines.json' with { type: 'json' }

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'target', '.vite', 'coverage',
  '_ai-temp', // external/imported campaign workspace, not owned product content
])
const SKIP_FILES = new Set(['package-lock.json', 'Cargo.lock'])

/** Legacy product markers that must not be introduced in mutable product files. */
const BRAND_PATTERNS = [
  { re: /chronicle-forge:(?![\w-]*world)/i, what: 'legacy storage key' },
  { re: /chronicle-compat|chronicle-inventory/i, what: 'legacy interchange format' },
  { re: /app\.chronicleforge/i, what: 'legacy application identifier' },
  { re: /Chronicle Forge/, what: 'former product title' },
  { re: /(?<![\w-])chronicle-forge(?![\w-])/, what: 'former package/repository name' },
  { re: /\.chronicle(?![\w/])/, what: 'former archive extension' },
  { re: /\.cfsave/, what: 'former save extension' },
]

/** Historical ADRs and this guard itself intentionally describe the transition. */
const ALLOW_FILES = new Set([
  'docs/contracts/adr/0001-platform-name.md',
  'docs/contracts/adr/0005-versioning.md',
  'CHANGELOG.md',
  'scripts/brand-guard.mts',
])
const ALLOW_LINE = [/accept="/, /\.nxsave,\.cfsave/]
const PINNED_LEGACY_FILES = baselines.brandFiles as Record<string, string>

export interface BrandScanResult {
  hits: string[]
  checkedFiles: number
  unchangedBaselineFiles: number
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

function isAllowedCompatibilityLine(relativePath: string, line: string): boolean {
  if (ALLOW_LINE.some((pattern) => pattern.test(line))) return true
  // The npm package ID remains fixed to match the locked dependency manifest.
  return relativePath === 'package.json' && line.trim() === '"name": "chronicle-forge",'
}

/** Return new or modified hits; exact unchanged legacy snapshots are not rescanned. */
export function scanBrandRoot(
  root: string,
  pinnedLegacyFiles: Record<string, string> = PINNED_LEGACY_FILES,
): BrandScanResult {
  const files: string[] = []
  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const relativePath = relative(root, full).split('\\').join('/')
      if (SKIP_DIRS.has(name) || relativePath === 'dist-ai') continue
      if (statSync(full).isDirectory()) walk(full)
      else if (!SKIP_FILES.has(name)) files.push(full)
    }
  }
  walk(root)

  const hits: string[] = []
  let checkedFiles = 0
  let unchangedBaselineFiles = 0
  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/')
    if (!/\.(ts|tsx|mts|js|mjs|gs|json|md|css|toml|yml|yaml|html)$/.test(rel)) continue
    if (ALLOW_FILES.has(rel)) continue

    const bytes = readFileSync(file)
    checkedFiles += 1
    const pinnedHash = pinnedLegacyFiles[rel]
    if (pinnedHash && sha256(bytes) === pinnedHash) {
      unchangedBaselineFiles += 1
      continue
    }

    const lines = bytes.toString('utf8').split('\n')
    lines.forEach((line, index) => {
      if (isAllowedCompatibilityLine(rel, line)) return
      for (const { re, what } of BRAND_PATTERNS) {
        if (re.test(line)) hits.push(`${rel}:${index + 1} — ${what}: ${line.trim().slice(0, 110)}`)
      }
    })
  }
  return { hits, checkedFiles, unchangedBaselineFiles }
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedFile === fileURLToPath(import.meta.url)) {
  const result = scanBrandRoot(process.cwd())
  if (result.hits.length) {
    console.error(`✗ найдены новые/изменённые брендовые следы: ${result.hits.length}`)
    for (const hit of result.hits.slice(0, 40)) console.error('  ' + hit)
    if (result.hits.length > 40) console.error(`  … ещё ${result.hits.length - 40}`)
    console.error('\nТочечное legacy-совпадение допустимо только для точной baseline-копии; новые пути и изменённые файлы остаются строгими.')
    process.exit(1)
  }

  console.log(`✓ брендовый guard: новых следов нет (проверено файлов=${result.checkedFiles}, точных baseline-файлов=${result.unchangedBaselineFiles})`)
}
