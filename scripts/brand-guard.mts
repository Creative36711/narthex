#!/usr/bin/env node
/**
 * Product-brand regression guard. Historical compatibility is allowed only at
 * individual, address-specific occurrences; no file hash or whole-line bypass.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Split the former identifiers so this guard does not exempt its own patterns.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'target', '.vite', 'coverage',
  '_ai-temp', // external/imported campaign workspace, not owned product content
])
const SKIP_FILES = new Set(['package-lock.json', 'Cargo.lock'])

const TOKENS = {
  packageName: ['chronicle', '-forge'].join(''),
  storagePrefix: ['chronicle', '-forge:'].join(''),
  compatFormat: ['chronicle', '-compat'].join(''),
  inventoryFormat: ['chronicle', '-inventory'].join(''),
  appId: ['app.', 'chronicleforge'].join(''),
  formerTitle: ['Chronicle', ' Forge'].join(''),
  archiveExtension: ['.', 'chronicle'].join(''),
  saveExtension: ['.', 'cfsave'].join(''),
}

const REGEXP_SPECIAL_CHARACTERS = new Set([
  '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\',
])

function escapeRegExp(value: string): string {
  return Array.from(value, (character) =>
    REGEXP_SPECIAL_CHARACTERS.has(character) ? `\\${character}` : character,
  ).join('')
}

const STORAGE_KEY_PATTERN = new RegExp(escapeRegExp(TOKENS.storagePrefix), 'ig')
const PACKAGE_NAME_PATTERN = new RegExp(
  `(?<![\\w-])${escapeRegExp(TOKENS.packageName)}(?![\\w:-])`,
  'ig',
)

/** Legacy product markers forbidden at new or unreviewed locations. */
const BRAND_PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: STORAGE_KEY_PATTERN, what: 'legacy storage key' },
  { re: PACKAGE_NAME_PATTERN, what: 'legacy package/repository identifier' },
  { re: new RegExp(`${escapeRegExp(TOKENS.compatFormat)}|${escapeRegExp(TOKENS.inventoryFormat)}`, 'ig'), what: 'legacy interchange identifier' },
  { re: new RegExp(escapeRegExp(TOKENS.appId), 'ig'), what: 'legacy application identifier' },
  { re: new RegExp(escapeRegExp(TOKENS.formerTitle), 'g'), what: 'former product title' },
  { re: new RegExp(`${escapeRegExp(TOKENS.archiveExtension)}(?![\\w/])`, 'g'), what: 'former archive extension' },
  { re: new RegExp(escapeRegExp(TOKENS.saveExtension), 'g'), what: 'former save extension' },
]

interface CompatibilityAllowance {
  path: string
  line: number
  column: number
  occurrence: string
  reason: string
}

const rule = (
  path: string,
  line: number,
  column: number,
  occurrence: string,
  reason: string,
): CompatibilityAllowance => ({ path, line, column, occurrence, reason })

/**
 * Each allowance names one token at one file/line/column and gives its reason.
 * Moving the token, adding another one, or adding one on an allowed line is not
 * covered. These are compatibility/history citations, never file exemptions.
 */
export const BRAND_COMPATIBILITY_ALLOWANCES: readonly CompatibilityAllowance[] = [
  rule('CHANGELOG.md', 10, 52, TOKENS.formerTitle, 'Historical release note; retained only at this exact occurrence.'),
  rule('CHANGELOG.md', 36, 16, TOKENS.packageName, 'Historical release note; retained only at this exact occurrence.'),
  rule('_tools/reports/GOLD-1.10.md', 71, 122, TOKENS.storagePrefix, 'Archived GOLD-1.10 evidence describing the legacy save/settings keys.'),
  rule('_tools/reports/GOLD-1.10.md', 71, 149, TOKENS.storagePrefix, 'Archived GOLD-1.10 evidence describing the legacy save/settings keys.'),
  rule('_tools/reports/GOLD-1.13.md', 25, 255, TOKENS.packageName, 'Archived GOLD-1.13 diff/audit evidence; not current product copy.'),
  rule('_tools/reports/GOLD-1.13.md', 45, 142, TOKENS.storagePrefix, 'Archived GOLD-1.13 diff/audit evidence; not current product copy.'),
  rule('_tools/reports/GOLD-1.13.md', 48, 125, TOKENS.saveExtension, 'Archived GOLD-1.13 diff/audit evidence; not current product copy.'),
  rule('_tools/reports/GOLD-1.13.md', 49, 112, TOKENS.formerTitle, 'Archived GOLD-1.13 diff/audit evidence; not current product copy.'),
  rule('_tools/reports/GOLD-1.6b.md', 12, 12, TOKENS.packageName, 'Archived package-lock compatibility note.'),
  rule('_tools/reports/GOLD-1.6d.md', 10, 142, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/GOLD-1.6d.md', 10, 214, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/GOLD-1.6d.md', 12, 204, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/GOLD-1.6d.md', 19, 46, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/GOLD-1.6d.md', 20, 53, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/GOLD-1.6d.md', 27, 175, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/GOLD-1.6d.md', 30, 165, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/GOLD-1.6d.md', 30, 205, TOKENS.storagePrefix, 'Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding.'),
  rule('_tools/reports/STAB-1.19.md', 48, 96, TOKENS.formerTitle, 'Archived STAB-1.19 diagnostic of historical scan findings.'),
  rule('docs/ai-campaign-guide.md', 461, 46, TOKENS.formerTitle, 'Canonical guide documents the historical label for the existing forge style ID.'),
  rule('docs/campaign.schema.json', 3, 19, TOKENS.packageName, 'Canonical schema retains its historical schema metadata and persisted-key documentation.'),
  rule('docs/campaign.schema.json', 4, 13, TOKENS.formerTitle, 'Canonical schema retains its historical schema metadata and persisted-key documentation.'),
  rule('docs/campaign.schema.json', 5, 35, TOKENS.formerTitle, 'Canonical schema retains its historical schema metadata and persisted-key documentation.'),
  rule('docs/campaign.schema.json', 6363, 161, TOKENS.storagePrefix, 'Canonical schema retains its historical schema metadata and persisted-key documentation.'),
  rule('docs/contracts/adr/0001-platform-name.md', 9, 42, TOKENS.formerTitle, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 11, 2, TOKENS.formerTitle, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 33, 46, TOKENS.packageName, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 41, 32, TOKENS.packageName, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 42, 23, TOKENS.packageName, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 43, 42, TOKENS.appId, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 43, 23, TOKENS.formerTitle, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 44, 27, TOKENS.storagePrefix, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 45, 21, TOKENS.compatFormat, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 45, 43, TOKENS.inventoryFormat, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 46, 21, TOKENS.archiveExtension, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 47, 22, TOKENS.saveExtension, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 48, 27, TOKENS.formerTitle, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0001-platform-name.md', 49, 20, TOKENS.packageName, 'Ratified platform-name ADR records the former identifier and its replacement.'),
  rule('docs/contracts/adr/0005-versioning.md', 5, 27, TOKENS.formerTitle, 'Historical versioning ADR records the rebrand context.'),
  rule('docs/decisions/GOLD-1.13.md', 18, 222, TOKENS.storagePrefix, 'Historical GOLD-1.13 decision records the prior storage-key behavior.'),
  rule('docs/decisions/STAB-1.8.md', 62, 64, TOKENS.formerTitle, 'Historical STAB-1.8 decision records a prior review observation.'),
  rule('docs/decisions/STAB-1.8.md', 63, 4, TOKENS.archiveExtension, 'Historical STAB-1.8 decision records a prior review observation.'),
  rule('package.json', 2, 12, TOKENS.packageName, 'Exact npm package ID retained to match the locked dependency identity.'),
  rule('public/ai/campaign-audit.mjs', 10195, 21, TOKENS.packageName, 'Generated audit artifact embeds canonical schema metadata and legacy key documentation.'),
  rule('public/ai/campaign-audit.mjs', 10196, 15, TOKENS.formerTitle, 'Generated audit artifact embeds canonical schema metadata and legacy key documentation.'),
  rule('public/ai/campaign-audit.mjs', 10197, 87, TOKENS.formerTitle, 'Generated audit artifact embeds canonical schema metadata and legacy key documentation.'),
  rule('public/ai/campaign-audit.mjs', 16555, 638, TOKENS.storagePrefix, 'Generated audit artifact embeds canonical schema metadata and legacy key documentation.'),
  rule('public/ai/campaign-guide.md', 461, 46, TOKENS.formerTitle, 'Published guide documents the historical label for the existing forge style ID.'),
  rule('public/ai/campaign.schema.json', 3, 19, TOKENS.packageName, 'Published schema retains its stable identifier and persisted-key documentation.'),
  rule('public/ai/campaign.schema.json', 4, 13, TOKENS.formerTitle, 'Published schema retains its stable identifier and persisted-key documentation.'),
  rule('public/ai/campaign.schema.json', 5, 35, TOKENS.formerTitle, 'Published schema retains its stable identifier and persisted-key documentation.'),
  rule('public/ai/campaign.schema.json', 6363, 161, TOKENS.storagePrefix, 'Published schema retains its stable identifier and persisted-key documentation.'),
  rule('public/ai/cf-play.mjs', 3789, 12, TOKENS.storagePrefix, 'Runtime compatibility reads settings written under the pre-migration storage key.'),
  rule('public/campaigns/ash-of-caerden/campaign.json', 8, 14, TOKENS.formerTitle, 'Frozen campaign author metadata; exact source value preserved outside this task scope.'),
  rule('scripts/combat-rules-smoke.mts', 1025, 20, TOKENS.storagePrefix, 'Regression smoke retains the legacy metadata key as a test fixture.'),
  rule('scripts/feedback8-A-smoke.mts', 159, 62, TOKENS.storagePrefix, 'Regression smoke retains the legacy map-label key as a test fixture.'),
  rule('scripts/feedback8-G-smoke.mts', 80, 59, TOKENS.storagePrefix, 'Regression smoke retains the legacy settings key as a test fixture.'),
  rule('scripts/gen-schema.mts', 221, 17, TOKENS.packageName, 'Schema generator retains the canonical schema identifier and historical descriptive text.'),
  rule('scripts/gen-schema.mts', 222, 11, TOKENS.formerTitle, 'Schema generator retains the canonical schema identifier and historical descriptive text.'),
  rule('scripts/gen-schema.mts', 224, 22, TOKENS.formerTitle, 'Schema generator retains the canonical schema identifier and historical descriptive text.'),
  rule('scripts/p2-mechanics-smoke.mts', 216, 15, TOKENS.storagePrefix, 'Regression smoke asserts the old metadata key is absent from the no-meta fixture.'),
  rule('scripts/tz7-slots-smoke.mts', 36, 16, TOKENS.storagePrefix, 'Regression smoke uses a named legacy save-key fixture.'),
  rule('src/App.tsx', 401, 53, TOKENS.saveExtension, 'Existing save-export extension compatibility; protected runtime file is unchanged.'),
  rule('src/editor/editorAppChrome.tsx', 126, 28, TOKENS.archiveExtension, 'Existing campaign-import extension compatibility; protected runtime file is unchanged.'),
  rule('src/editor/editorAppGuard.tsx', 74, 32, TOKENS.archiveExtension, 'Existing campaign-import extension compatibility; protected runtime file is unchanged.'),
  rule('src/editor/playtestNotes.ts', 9, 22, TOKENS.storagePrefix, 'Existing playtest-note persistence keys remain readable; protected runtime file is unchanged.'),
  rule('src/editor/playtestNotes.ts', 10, 25, TOKENS.storagePrefix, 'Existing playtest-note persistence keys remain readable; protected runtime file is unchanged.'),
  rule('src/player/MainMenu.tsx', 286, 33, TOKENS.saveExtension, 'Existing save/campaign import filter compatibility; protected runtime file is unchanged.'),
  rule('src/player/MainMenu.tsx', 297, 34, TOKENS.archiveExtension, 'Existing save/campaign import filter compatibility; protected runtime file is unchanged.'),
  rule('src/player/NoCampaignScreen.tsx', 125, 28, TOKENS.archiveExtension, 'Existing campaign-import extension compatibility; protected runtime file is unchanged.'),
  rule('src/shared/compat.ts', 32, 31, TOKENS.compatFormat, 'Existing legacy interchange-format compatibility; protected runtime file is unchanged.'),
  rule('src/shared/compatInventory.ts', 11, 34, TOKENS.inventoryFormat, 'Existing legacy inventory-format compatibility; protected runtime file is unchanged.'),
  rule('src/shared/modals.tsx', 263, 34, TOKENS.archiveExtension, 'Existing campaign JSON import-extension compatibility; protected runtime file is unchanged.'),
  rule('src/shared/settings.ts', 48, 14, TOKENS.storagePrefix, 'Existing persisted settings remain readable; protected runtime file is unchanged.'),
  rule('src/shared/types/saves.ts', 85, 12, TOKENS.compatFormat, 'Existing legacy save-format compatibility type; protected runtime file is unchanged.'),
  rule('vite.config.ts', 13, 53, TOKENS.archiveExtension, 'Historical compatibility-extension documentation; protected build config is unchanged.'),
  rule('vite.config.ts', 91, 60, TOKENS.archiveExtension, 'Historical compatibility-extension documentation; protected build config is unchanged.'),
]

export interface BrandScanResult {
  hits: string[]
  checkedFiles: number
  checkedPaths: string[]
  allowedCompatibilityOccurrences: number
}

function compatibilityAllowance(
  relativePath: string,
  lineNumber: number,
  column: number,
  occurrence: string,
): CompatibilityAllowance | undefined {
  return BRAND_COMPATIBILITY_ALLOWANCES.find((candidate) =>
    candidate.path === relativePath &&
    candidate.line === lineNumber &&
    candidate.column === column &&
    candidate.occurrence === occurrence,
  )
}

/** Return unreviewed legacy-brand occurrences; exact address rules are still scanned. */
export function scanBrandRoot(root: string): BrandScanResult {
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
  const checkedPaths: string[] = []
  let checkedFiles = 0
  let allowedCompatibilityOccurrences = 0
  for (const file of files) {
    const relativePath = relative(root, file).split('\\').join('/')
    if (!/\.(ts|tsx|mts|js|mjs|gs|json|md|css|toml|yml|yaml|html)$/.test(relativePath)) continue

    checkedFiles += 1
    checkedPaths.push(relativePath)
    const lines = readFileSync(file).toString('utf8').split('\n')
    lines.forEach((line, lineIndex) => {
      for (const pattern of BRAND_PATTERNS) {
        const regex = new RegExp(pattern.re.source, pattern.re.flags)
        for (const match of line.matchAll(regex)) {
          const occurrence = match[0]
          const column = match.index + 1
          if (compatibilityAllowance(relativePath, lineIndex + 1, column, occurrence)) {
            allowedCompatibilityOccurrences += 1
            continue
          }

          hits.push(`${relativePath}:${lineIndex + 1}:${column} — ${pattern.what}: ${line.trim().slice(0, 110)}`)
        }
      }
    })
  }

  return { hits, checkedFiles, checkedPaths, allowedCompatibilityOccurrences }
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedFile === fileURLToPath(import.meta.url)) {
  const result = scanBrandRoot(process.cwd())
  if (result.hits.length) {
    console.error(`✗ найдены новые/неадресованные брендовые следы: ${result.hits.length}`)
    for (const hit of result.hits.slice(0, 40)) console.error('  ' + hit)
    if (result.hits.length > 40) console.error(`  … ещё ${result.hits.length - 40}`)
    console.error('\nСовместимость допустима только при точном совпадении пути, строки, столбца и вхождения.')
    process.exit(1)
  }

  console.log(`✓ брендовый guard: новых следов нет (проверено файлов=${result.checkedFiles}, точечных совместимостей=${result.allowedCompatibilityOccurrences})`)
}
