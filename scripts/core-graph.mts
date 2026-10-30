import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const coreRoot = path.join(root, 'src/core')
const sourceExtensions = ['.ts', '.tsx', '.mts', '.js', '.mjs']

async function collectTsFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectTsFiles(fullPath)
    return /\.(?:ts|tsx|mts)$/.test(entry.name) ? [fullPath] : []
  }))
  return nested.flat()
}

function resolveModule(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const base = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [base, ...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => path.join(base, `index${extension}`))]
  return candidates.find((candidate) => files.has(candidate))
}

const files = new Set(await collectTsFiles(coreRoot))
const graph = new Map<string, string[]>()
const failures: string[] = []
const importPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const dependencies: string[] = []
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2]
    const target = resolveModule(file, specifier)
    if (!target) continue
    dependencies.push(target)
    if (path.basename(target) === 'engine.ts' && target !== file) {
      failures.push(`${path.relative(root, file)} imports ${path.relative(root, target)}`)
    }
  }
  graph.set(file, dependencies)
}

const visiting = new Set<string>()
const visited = new Set<string>()
const stack: string[] = []
function visit(file: string): void {
  if (visiting.has(file)) {
    const start = stack.indexOf(file)
    const cycle = [...stack.slice(start), file].map((item) => path.relative(root, item)).join(' -> ')
    failures.push(`core import cycle: ${cycle}`)
    return
  }
  if (visited.has(file)) return
  visiting.add(file)
  stack.push(file)
  for (const dependency of graph.get(file) ?? []) visit(dependency)
  stack.pop()
  visiting.delete(file)
  visited.add(file)
}

for (const file of files) visit(file)

if (failures.length) {
  console.error(`Core graph check failed:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(`Core graph OK (${files.size} modules; acyclic; no core imports of engine.ts).`)
}
