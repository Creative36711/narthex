/**
 * Заморозка формата v2: гейт на удаление и переименование полей.
 *
 *   npm run check:schema-freeze   — проверить, что замороженные поля на месте
 *   npm run schema:freeze         — записать манифест (делает фаза 4, не раньше)
 *
 * Почему не «схема просто есть». Схема отвечает на вопрос «валиден ли проект»,
 * но не на вопрос «можно ли убрать поле». После фазы 4 добавление
 * необязательного поля разрешено, удаление и переименование — только миграцией
 * (ADR 0003). Разница между этими двумя правилами видна лишь при сравнении с
 * прошлым состоянием, а прошлое состояние надо где-то хранить: `.git` shallow,
 * и `git show HEAD~5:docs/contracts/project.schema.json` может не найтись.
 *
 * Поэтому манифест — файл в репозитории: список полей на момент заморозки.
 * До заморозки манифеста нет, и гейт честно говорит «не заморожен» и пропускает:
 * выдумывать заморозку раньше решения нельзя, это сломало бы фазу 4.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const contracts = join(root, 'docs', 'contracts')
const manifestPath = join(contracts, 'format-v2.freeze.json')
const write = process.argv.includes('--write')

const SCHEMAS = [
  { id: 'project', file: 'project.schema.json' },
  { id: 'pack', file: 'pack.schema.json' },
] as const

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Пути свойств: `kind`, `caps`, `cap_options.code`…
 * Массивы раскрываются через `[]`, чтобы поле внутри элемента тоже считалось
 * замороженным: иначе переименование в `panels[]` прошло бы незамеченным.
 */
function collectPaths(node: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (!isObject(node)) return out
  const properties = node.properties
  if (isObject(properties)) {
    for (const [name, child] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${name}` : name
      out.add(path)
      collectPaths(child, path, out)
    }
  }
  if (Array.isArray(node.items)) {
    for (const item of node.items) collectPaths(item, prefix, out)
  } else if (isObject(node.items)) {
    collectPaths(node.items, prefix, out)
  }
  for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
    const branch = node[key]
    if (Array.isArray(branch)) for (const item of branch) collectPaths(item, prefix, out)
  }
  return out
}

function hasPath(schema: Json, path: string): boolean {
  const parts = path.split('.')
  let node: unknown = schema
  for (const part of parts) {
    const found = findProperty(node, part)
    if (found === undefined) return false
    node = found
  }
  return true
}

function findProperty(node: unknown, name: string): unknown {
  if (!isObject(node)) return undefined
  const properties = node.properties
  if (isObject(properties) && name in properties) return properties[name]
  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      const found = findProperty(item, name)
      if (found !== undefined) return found
    }
  } else if (isObject(node.items)) {
    const found = findProperty(node.items, name)
    if (found !== undefined) return found
  }
  for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
    const branch = node[key]
    if (Array.isArray(branch)) {
      for (const item of branch) {
        const found = findProperty(item, name)
        if (found !== undefined) return found
      }
    }
  }
  return undefined
}

const schemas = SCHEMAS.map((entry) => {
  const text = readFileSync(join(contracts, entry.file), 'utf8')
  const schema = JSON.parse(text) as Json
  return { ...entry, schema, paths: [...collectPaths(schema)].sort() }
})

if (write) {
  const manifest = {
    format: 'narthex-format-freeze/1',
    note:
      'Поля формата v2 на момент заморозки. Добавлять необязательные поля можно; удалять и переименовывать — только миграцией (ADR 0003).',
    frozenAt: new Date().toISOString().slice(0, 10),
    schemas: Object.fromEntries(schemas.map((entry) => [entry.id, `docs/contracts/${entry.file}`])),
    fields: Object.fromEntries(schemas.map((entry) => [entry.id, entry.paths])),
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  const total = schemas.reduce((sum, entry) => sum + entry.paths.length, 0)
  console.log(`Манифест заморозки записан: ${total} полей в ${schemas.length} схемах.`)
  console.log(`Файл: docs/contracts/format-v2.freeze.json`)
  process.exit(0)
}

if (!existsSync(manifestPath)) {
  console.log('Формат v2 не заморожен: манифеста docs/contracts/format-v2.freeze.json нет.')
  console.log('Это ожидаемо до фазы 4: гейт включится карточкой, которая принимает заморозку.')
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  frozenAt?: string
  fields?: Record<string, string[]>
}
const failures: string[] = []
let checked = 0
let added = 0

for (const entry of schemas) {
  const frozen = manifest.fields?.[entry.id]
  if (!Array.isArray(frozen)) {
    failures.push(`${entry.file}: в манифесте нет списка полей`)
    continue
  }
  const current = new Set(entry.paths)
  for (const path of frozen) {
    checked += 1
    if (!hasPath(entry.schema, path)) {
      failures.push(`${entry.file}: замороженное поле «${path}» исчезло или переименовано`)
    }
  }
  for (const path of entry.paths) {
    if (!frozen.includes(path)) added += 1
  }
}

console.log(
  `Заморозка от ${manifest.frozenAt ?? '—'}: проверено ${checked} полей, ` +
    `добавлено с тех пор ${added}, нарушений ${failures.length}.`,
)
if (failures.length > 0) {
  console.error('\nУдалять и переименовывать поля формата v2 нельзя — только миграцией (ADR 0003).')
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log('Формат v2: замороженные поля на месте.')
