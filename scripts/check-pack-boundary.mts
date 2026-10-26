import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = resolve(import.meta.dirname, '..')
const scriptPath = fileURLToPath(import.meta.url)
const tsxCli = join(repoRoot, 'node_modules/tsx/dist/cli.mjs')
const sourceExtensions = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i

interface PackRegistry {
  version: number
  packs: string[]
}

interface BoundaryFinding {
  file: string
  line: number
  category: 'pack-id branch' | 'core-to-pack import'
  message: string
}

interface ScanResult {
  files: number
  findings: BoundaryFinding[]
}

function relativePath(root: string, file: string): string {
  return relative(root, file).split(sep).join('/')
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function within(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    if (entry.isFile() && sourceExtensions.test(entry.name)) return [fullPath]
    return []
  }))
  return nested.flat().sort()
}

async function readPackIds(root: string): Promise<Set<string>> {
  const registry = JSON.parse(await readFile(join(root, 'packs/registry.json'), 'utf8')) as Partial<PackRegistry>
  if (registry.version !== 1 || !Array.isArray(registry.packs) || !registry.packs.every((id) => typeof id === 'string' && id.length > 0)) {
    throw new Error(`${relativePath(root, join(root, 'packs/registry.json'))}: expected version 1 and a string pack-id list`)
  }
  const ids = new Set(registry.packs)
  if (ids.size !== registry.packs.length) throw new Error('packs/registry.json contains duplicate pack IDs')
  return ids
}

function stringLiteral(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined
}

function importSpecifierTargetsPacks(root: string, file: string, specifier: string): boolean {
  const normalized = specifier.replaceAll('\\', '/')
  if (
    normalized === 'packs' || normalized.startsWith('packs/') ||
    normalized === '/packs' || normalized.startsWith('/packs/') ||
    normalized === '@/packs' || normalized.startsWith('@/packs/')
  ) return true

  if (!normalized.startsWith('.')) return false
  const target = resolve(dirname(file), normalized)
  return within(resolve(root, 'packs'), target)
}

function moduleSpecifiers(sourceFile: ts.SourceFile): Array<{ node: ts.Node; specifier: string }> {
  const found: Array<{ node: ts.Node; specifier: string }> = []
  const add = (node: ts.Node, value: ts.Node | undefined) => {
    const specifier = stringLiteral(value)
    if (specifier !== undefined) found.push({ node, specifier })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      add(node, node.moduleSpecifier)
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node, node.moduleReference.expression)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node, node.argument.literal)
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isDynamicImport || isRequire) add(node, node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function containsPackId(node: ts.Node, packIds: Set<string>): string | undefined {
  let found: string | undefined
  const visit = (child: ts.Node): void => {
    if (found !== undefined) return
    const literal = stringLiteral(child)
    if (literal !== undefined && packIds.has(literal)) {
      found = literal
      return
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function isEqualityOperator(kind: ts.SyntaxKind): boolean {
  return kind === ts.SyntaxKind.EqualsEqualsToken ||
    kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    kind === ts.SyntaxKind.ExclamationEqualsToken ||
    kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
}

function packReference(node: ts.Node): boolean {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
    return packReference(node.expression)
  }
  if (ts.isIdentifier(node)) {
    const name = node.text.toLowerCase().replace(/[_-]/g, '')
    return name === 'pack' || name === 'packid' || name.endsWith('packid') || name.endsWith('pack')
  }
  if (ts.isPropertyAccessExpression(node)) {
    const name = node.name.text.toLowerCase().replace(/[_-]/g, '')
    return name === 'pack' || name === 'packid'
  }
  if (ts.isElementAccessExpression(node)) {
    const name = stringLiteral(node.argumentExpression)?.toLowerCase().replace(/[_-]/g, '')
    return name === 'pack' || name === 'packid'
  }
  return false
}

async function scanCore(root: string): Promise<ScanResult> {
  const coreRoot = resolve(root, 'src/core')
  const files = await sourceFiles(coreRoot)
  const packIds = await readPackIds(root)
  const findings: BoundaryFinding[] = []

  const addFinding = (source: ts.SourceFile, node: ts.Node, category: BoundaryFinding['category'], message: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    findings.push({ file: relativePath(root, source.fileName), line: line + 1, category, message })
  }

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const scriptKind = /\.tsx$/i.test(file) ? ts.ScriptKind.TSX : /\.(?:jsx)$/i.test(file) ? ts.ScriptKind.JSX : undefined
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind)

    for (const item of moduleSpecifiers(source)) {
      if (importSpecifierTargetsPacks(root, file, item.specifier)) {
        addFinding(source, item.node, 'core-to-pack import', `core source imports packs/** via ${JSON.stringify(item.specifier)}`)
      }
    }

    const visit = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) && isEqualityOperator(node.operatorToken.kind)) {
        const id = containsPackId(node, packIds)
        const leftIsPack = packReference(node.left)
        const rightIsPack = packReference(node.right)
        const otherSideIsString = (leftIsPack && stringLiteral(node.right) !== undefined) ||
          (rightIsPack && stringLiteral(node.left) !== undefined)
        if (id !== undefined || otherSideIsString) {
          const selectedId = id ?? stringLiteral(leftIsPack ? node.right : node.left) ?? '(unknown)'
          addFinding(source, node, 'pack-id branch', `comparison branches on pack ID ${JSON.stringify(selectedId)}`)
        }
      } else if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
        const id = containsPackId(node.expression, packIds)
        if (id !== undefined) addFinding(source, node, 'pack-id branch', `control-flow condition depends on pack ID ${JSON.stringify(id)}`)
      } else if (ts.isConditionalExpression(node)) {
        const id = containsPackId(node.condition, packIds)
        if (id !== undefined) addFinding(source, node, 'pack-id branch', `control-flow condition depends on pack ID ${JSON.stringify(id)}`)
      } else if (ts.isForStatement(node) && node.condition) {
        const id = containsPackId(node.condition, packIds)
        if (id !== undefined) addFinding(source, node, 'pack-id branch', `loop condition depends on pack ID ${JSON.stringify(id)}`)
      } else if (ts.isSwitchStatement(node)) {
        const id = containsPackId(node.expression, packIds) ?? node.caseBlock.clauses
          .map((clause) => ts.isCaseClause(clause) ? containsPackId(clause.expression, packIds) : undefined)
          .find((value): value is string => value !== undefined)
        if (id !== undefined) addFinding(source, node, 'pack-id branch', `switch dispatches on pack ID ${JSON.stringify(id)}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  findings.sort((a, b) => compareText(a.file, b.file) || a.line - b.line || compareText(a.category, b.category))
  return { files: files.length, findings }
}

function printScan(result: ScanResult): void {
  if (result.findings.length) {
    for (const finding of result.findings) {
      console.error(`✗ ${finding.file}:${finding.line}: ${finding.message} [${finding.category}]`)
    }
    console.error(`pack-boundary failed: ${result.findings.length} finding(s) in ${result.files} core files`)
    return
  }
  console.log(`✓ core pack boundary: ${result.files} source files; no pack-ID branches or imports from packs/**`)
}

function runScan(root: string): { status: number | null; output: string; error?: Error } {
  const result = spawnSync(process.execPath, [tsxCli, scriptPath, '--scan-root', root], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}`, error: result.error }
}

async function createFixtureRoot(base: string, name: string, files: Record<string, string>): Promise<string> {
  const fixtureRoot = join(base, name)
  await mkdir(join(fixtureRoot, 'packs'), { recursive: true })
  await mkdir(join(fixtureRoot, 'src/core'), { recursive: true })
  await writeFile(join(fixtureRoot, 'packs/registry.json'), JSON.stringify({ version: 1, packs: ['narrative', 'grid-strategy', 'adventure'] }, null, 2))
  for (const [path, contents] of Object.entries(files)) {
    const target = join(fixtureRoot, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, 'utf8')
  }
  return fixtureRoot
}

async function verifyFixtures(): Promise<void> {
  const workspace = await mkdtemp(join(repoRoot, 'scripts', '.pack-boundary-fixtures-'))
  try {
    const branchRoot = await createFixtureRoot(workspace, 'a-core-branch', {
      'src/core/fixture-branch.ts': "if (pack === 'narrative') { return 'pack-specific' }\n",
    })
    const branch = runScan(branchRoot)
    assert.ifError(branch.error)
    assert.equal(branch.status, 1, `core pack-id branch should return rc=1, got rc=${branch.status}\n${branch.output}`)
    assert.match(branch.output, /src\/core\/fixture-branch\.ts:1:.*pack ID "narrative"/)
    console.log('fixture (a) branch on pack ID in src/core: PASS — rc=1, src/core/fixture-branch.ts:1')

    const probeRoot = await createFixtureRoot(workspace, 'b-probe-filter', {
      'scripts/fmv-passport-probe.mts': "const owned = CAPABILITY_REGISTRY.filter((entry) => entry.pack === 'narrative')\n",
    })
    const probeSource = await readFile(join(probeRoot, 'scripts/fmv-passport-probe.mts'), 'utf8')
    assert.match(probeSource, /entry\.pack === 'narrative'/, 'probe fixture must contain the registry filter')
    const probe = runScan(probeRoot)
    assert.ifError(probe.error)
    assert.equal(probe.status, 0, `scripts probe filter must return rc=0\n${probe.output}`)
    assert.match(probe.output, /no pack-ID branches or imports from packs/)
    console.log('fixture (b) entry.pack filter in scripts probe: PASS — rc=0')

    const diagnosticRoot = await createFixtureRoot(workspace, 'c-registry-diagnostic', {
      'src/core/pack/registry.ts': "export const diagnostic = 'packs/registry.json: expected an object'\n",
    })
    const diagnostic = runScan(diagnosticRoot)
    assert.ifError(diagnostic.error)
    assert.equal(diagnostic.status, 0, `registry diagnostic string must return rc=0\n${diagnostic.output}`)
    assert.match(diagnostic.output, /no pack-ID branches or imports from packs/)
    console.log('fixture (c) registry diagnostic string literal: PASS — rc=0')

    const importRoot = await createFixtureRoot(workspace, 'd-core-import', {
      'src/core/fixture-import.ts': "import { createStory } from '../../packs/narrative/index'\n",
    })
    const packImport = runScan(importRoot)
    assert.ifError(packImport.error)
    assert.equal(packImport.status, 1, `core import from packs/** should return rc=1, got rc=${packImport.status}\n${packImport.output}`)
    assert.match(packImport.output, /src\/core\/fixture-import\.ts:1:.*imports packs\/\*\*.*\.\.\/\.\.\/packs\/narrative\/index/)
    console.log('fixture (d) import from packs/** in src/core: PASS — rc=1, src/core/fixture-import.ts:1')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

const scanRootIndex = process.argv.indexOf('--scan-root')
if (scanRootIndex >= 0) {
  const scanRootPath = process.argv[scanRootIndex + 1]
  if (!scanRootPath) throw new Error('--scan-root requires a repository root')
  const scanRootPathResolved = resolve(scanRootPath)
  const result = await scanCore(scanRootPathResolved)
  printScan(result)
  if (result.findings.length) process.exitCode = 1
} else {
  await verifyFixtures()
  const production = await scanCore(repoRoot)
  printScan(production)
  if (production.findings.length) process.exitCode = 1
  else console.log('check:pack-boundary passed')
}
