import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { NARRATIVE_CODES, NARRATIVE_CODE_LIST } from './playkit/narrative-codes'

const root = resolve(import.meta.dirname, '..')
const validatorPath = join(root, 'scripts/playkit/analyze.ts')
const validator = await readFile(validatorPath, 'utf8')
const catalogKeys = Object.keys(NARRATIVE_CODES).sort()
const catalogIds = NARRATIVE_CODE_LIST.map((entry) => entry.code).sort()
const references = [...validator.matchAll(/\bNARRATIVE_CODES\.([A-Za-z][A-Za-z0-9]*)\.code\b/g)].map((match) => match[1]!)
const validatorKeys = [...new Set(references)].sort()

assert.equal(NARRATIVE_CODE_LIST.length, 28, `Ожидалось 28 кодов narrative, найдено ${NARRATIVE_CODE_LIST.length}`)
assert.equal(new Set(catalogIds).size, catalogIds.length, 'В каталоге повторяются диагностические коды')
assert.deepEqual(validatorKeys, catalogKeys, 'Список кодов, используемый валидатором, расходится с каталогом explain')
assert.doesNotMatch(validator, /\bcode\s*:\s*['"][a-z][a-z0-9_]*['"]/, 'Валидатор содержит отдельный литерал диагностического кода')

const catalogIdSet = new Set(catalogIds)
const escapedIds = catalogIds.map((code) => code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const sourceCodeId = new RegExp(`\\b(?:${escapedIds.join('|')})\\b`, 'g')

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(path)))
    else if (entry.isFile()) out.push(path)
  }
  return out
}

for (const path of await walk(join(root, 'scripts/playkit'))) {
  if (path === join(root, 'scripts/playkit/narrative-codes.ts')) continue
  if (!['.ts', '.mts'].includes(extname(path))) continue
  const text = await readFile(path, 'utf8')
  const duplicates = [...text.matchAll(sourceCodeId)].map((match) => match[0]).filter((code) => catalogIdSet.has(code))
  assert.deepEqual(duplicates, [], `${path.slice(root.length + 1)} повторно перечисляет коды narrative: ${duplicates.join(', ')}`)
}

const documentedExamples = new Set<string>()
for (const path of [
  join(root, 'public/ai/campaign-guide.md'),
  join(root, 'docs/guides'),
]) {
  try {
    const files = path.endsWith('.md') ? [path] : await walk(path)
    for (const file of files.filter((candidate) => candidate.endsWith('.md'))) {
      const text = await readFile(file, 'utf8')
      for (const match of text.matchAll(sourceCodeId)) {
        const code = match[0]
        const index = match.index ?? 0
        const lineStart = text.lastIndexOf('\n', index - 1) + 1
        const lineEnd = text.indexOf('\n', index)
        const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim()
        assert.match(
          line,
          /^(?:npm run play -- explain|node (?:public\/ai\/cf-play\.mjs|__chronicle_ai__\/cf-play\.mjs) explain) [a-z][a-z0-9_]*$/,
          `${file.slice(root.length + 1)} упоминает ${code} вне исполняемой команды explain`,
        )
        documentedExamples.add(code)
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
assert.ok(documentedExamples.size <= 1, `Документация перечисляет несколько кодов вместо одного примера: ${[...documentedExamples].join(', ')}`)

console.log(`✓ narrative explain: ${catalogIds.length} кодов; валидатор использует тот же каталог, документация содержит только один исполняемый пример`)
