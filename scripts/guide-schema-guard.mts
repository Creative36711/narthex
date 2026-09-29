/**
 * Сторож синхронности docs/ai-campaign-guide.md ↔ docs/campaign.schema.json (Задача 1).
 *
 * Проверяет:
 * (а) все JSON-литералы и инлайн-формы эффектов/условий в гайде соответствуют
 *     campaign.schema.json (Effect / Condition / DlgEffect / DlgCond);
 * (б) обратное покрытие — каждый тип эффекта и условия из схемы встречается
 *     в гайде хотя бы раз.
 *
 * Запуск: npm run smoke:guide (или npx tsx scripts/guide-schema-guard.mts)
 */
import Ajv2020 from 'ajv/dist/2020.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const guidePath = join(root, 'docs/ai-campaign-guide.md')
const schemaPath = join(root, 'docs/campaign.schema.json')

const guide = readFileSync(guidePath, 'utf8')
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
  $id: string
  $defs: Record<string, { anyOf?: Array<{ properties?: Record<string, { const?: string }> }> }>
}

const ajv = new Ajv2020({ allErrors: true, strict: false })
ajv.addSchema(schema)

const UNION_GROUPS = ['Effect', 'Condition', 'DlgEffect', 'DlgCond'] as const
const EXTRA_GROUPS = ['NeedCondition'] as const

type VariantEntry = {
  group: string
  typeName: string
  schema: Record<string, unknown>
  allowedKeys: Set<string>
  validate: ReturnType<typeof ajv.compile>
}

const byType = new Map<string, VariantEntry[]>()
const requiredByGroup = new Map<string, string[]>()

for (const group of [...UNION_GROUPS, ...EXTRA_GROUPS]) {
  const def = schema.$defs[group]
  const list: string[] = []
  for (const variant of def?.anyOf ?? []) {
    const t = variant.properties?.type?.const
    if (!t) continue
    list.push(t)
    const allowedKeys = new Set(Object.keys(variant.properties ?? {}))
    const validate = ajv.compile({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      ...variant,
      $defs: schema.$defs,
    })
    const arr = byType.get(t) ?? []
    arr.push({ group, typeName: t, schema: variant, allowedKeys, validate })
    byType.set(t, arr)
  }
  if ((UNION_GROUPS as readonly string[]).includes(group)) {
    requiredByGroup.set(group, list)
  }
}

let failures = 0
function pass(msg: string) {
  console.log(`✓ ${msg}`)
}
function fail(msg: string) {
  console.error(`✗ ${msg}`)
  failures++
}

// ── (а.1) Инлайн-сигнатуры вида `type_name { field1, field2, ... }` ──
let inlineChecked = 0
const inlineRe = /`([a-z][a-z0-9_]*)\s*\{([^`}]*)\}`/g
for (const m of guide.matchAll(inlineRe)) {
  const typeName = m[1]
  const body = m[2]
  const variants = byType.get(typeName)
  if (!variants) continue
  inlineChecked++
  // вытаскиваем имена ключей из псевдо-объекта `{ a, b: "x", c? }`
  const keys = body
    .split(',')
    .map((part) => part.trim().split(':')[0]?.replace(/\?$/, '').trim())
    .filter((k): k is string => !!k && /^[a-z_][a-z0-9_]*$/i.test(k))
  const allAllowed = new Set<string>()
  for (const v of variants) for (const k of v.allowedKeys) allAllowed.add(k)
  const unknown = keys.filter((k) => !allAllowed.has(k))
  if (unknown.length > 0) {
    fail(
      `Инлайн-форма \`${m[0].slice(1, -1)}\`: поля [${unknown.join(', ')}] отсутствуют в схеме ${typeName} (допустимы: ${[...allAllowed].join(', ')})`,
    )
  }
}

// ── (а.2) JSON-литералы `{ "type": "<name>", ... }` в гайде ──
let jsonChecked = 0
const jsonStartRe = /\{\s*"type"\s*:\s*"([a-z_]+)"/g
for (const m of guide.matchAll(jsonStartRe)) {
  const typeName = m[1]
  const variants = byType.get(typeName)
  if (!variants) continue // например ArtShape rect/ellipse/polygon/line/text

  const start = m.index!
  let depth = 0
  let end = start
  let inStr = false
  let esc = false
  for (let i = start; i < guide.length; i++) {
    const ch = guide[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  const raw = guide.slice(start, end)
  // Нормализуем многоточие-заполнитель в примерах (`"cutscene": …` → `"cutscene": "stub"`)
  const normalized = raw.replace(/:\s*…/g, ': "stub"')
  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch (e) {
    fail(`Невалидный JSON-литерал для типа "${typeName}": ${raw} (${(e as Error).message})`)
    continue
  }
  jsonChecked++
  const ok = variants.some((v) => v.validate(parsed))
  if (!ok) {
    const errs = variants
      .map((v) => `${v.group}: ${v.validate.errors?.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')}`)
      .join(' | ')
    fail(`Литерал "${typeName}" не прошёл схему: ${raw.replace(/\s+/g, ' ')} -> ${errs}`)
  }
}

if (failures === 0) {
  pass(`Проверены все литералы гайда против схемы (JSON: ${jsonChecked}, инлайн-сигнатуры: ${inlineChecked})`)
}

// ── (б) Обратное покрытие: каждый тип из схемы встречается в гайде ──
for (const group of UNION_GROUPS) {
  const types = requiredByGroup.get(group) ?? []
  const missing: string[] = []
  for (const t of types) {
    // Тип должен встречаться как JSON-литерал `"type": "<t>"` или в кодовых кавычках `` `<t>` `` / `` `<t> {` ``
    const hasJson = new RegExp(`"type"\\s*:\\s*"${t}"`).test(guide)
    const hasCode = new RegExp(`\`${t}(?:\\s*\\{|\\b)`).test(guide)
    if (!hasJson && !hasCode) missing.push(t)
  }
  if (missing.length > 0) {
    fail(`${group}: в docs/ai-campaign-guide.md отсутствуют типы (${missing.length}/${types.length}): ${missing.join(', ')}`)
  } else {
    pass(`Обратное покрытие ${group}: все ${types.length} типов присутствуют в гайде`)
  }
}

if (failures > 0) {
  console.error(`\nПРОВАЛЕНО ПРОВЕРОК: ${failures}`)
  process.exit(1)
}
console.log('\nВСЕ ПРОВЕРКИ СТОРОЖА ГАЙДА ПРОЙДЕНЫ')
