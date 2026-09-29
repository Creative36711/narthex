/**
 * Генератор docs/campaign.schema.json (JSON Schema монолитного формата
 * кампании) из src/shared/types.ts — единого источника правды по формату.
 *
 * Запуск: npx tsx scripts/gen-schema.mts
 * (перегенерировать после правок типов; файл в git — схему читают внешние
 * генераторы и редакторы JSON)
 *
 * Реализация — компиляторный API TypeScript: берём корневой тип MonolithDoc
 * и рекурсивно отражаем все ссылочные типы shared/types.ts в $defs.
 */
import ts from 'typescript'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src/shared/types.ts')
const outFile = join(root, 'docs/campaign.schema.json')
const ROOT_TYPE = 'MonolithDoc'

const program = ts.createProgram([entry], { strict: true, target: ts.ScriptTarget.ES2022 })
const sf = program.getSourceFile(entry)!
if (!sf) {
  console.error('Не удалось прочитать', entry)
  process.exit(1)
}

type Schema = Record<string, unknown>

const defs: Record<string, Schema> = {}
const computing = new Set<string>()

/** текст JSDoc-комментария объявления (для description схемы) */
function jsdocText(node: ts.Node): string | undefined {
  const anyNode = node as unknown as { jsDoc?: Array<{ comment?: string | ts.NodeArray<ts.JSDocComment> }> }
  const doc = anyNode.jsDoc?.[anyNode.jsDoc.length - 1]
  if (!doc?.comment) return undefined
  if (typeof doc.comment === 'string') return doc.comment.trim()
  return doc.comment
    .map((c) => ('text' in c ? c.text : c.getText()))
    .join('')
    .trim()
}

function withDoc(node: ts.Node, schema: Schema): Schema {
  const doc = jsdocText(node)
  return doc && !schema.description ? { ...schema, description: doc } : schema
}

/** литерал → схема */
function literalSchema(node: ts.LiteralTypeNode): Schema | undefined {
  const lit = node.literal
  if (lit.kind === ts.SyntaxKind.TrueKeyword) return { const: true }
  if (lit.kind === ts.SyntaxKind.FalseKeyword) return { const: false }
  if (lit.kind === ts.SyntaxKind.NullKeyword) return { const: null }
  if (ts.isStringLiteral(lit)) return { const: lit.text }
  if (ts.isNumericLiteral(lit)) return { const: Number(lit.text) }
  if (ts.isPrefixUnaryExpression(lit) && ts.isNumericLiteral(lit.operand)) {
    return { const: lit.operator === ts.SyntaxKind.MinusToken ? -Number(lit.operand.text) : Number(lit.operand.text) }
  }
  return undefined
}

function isUndefinedNode(node: ts.TypeNode): boolean {
  return node.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.UndefinedKeyword)
}

/** union → enum (если всё — литералы одного типа) либо anyOf */
function unionSchema(nodes: ts.TypeNode[]): Schema {
  const parts = nodes.filter((n) => !isUndefinedNode(n))
  const lits = parts.map((n) => (ts.isLiteralTypeNode(n) ? literalSchema(n) : undefined))
  if (lits.every((l) => l && 'const' in l)) {
    const values = lits.map((l) => (l as { const: unknown }).const)
    const t = typeof values[0]
    return values.every((v) => typeof v === t) && (t === 'string' || t === 'number')
      ? { type: t, enum: values }
      : { enum: values }
  }
  return { anyOf: parts.map(typeSchema) }
}

function membersSchema(members: ts.NodeArray<ts.TypeElement>): Schema {
  const properties: Record<string, Schema> = {}
  const required: string[] = []
  let additional: Schema | undefined

  for (const m of members) {
    if (ts.isPropertySignature(m) && m.name) {
      const name = ts.isStringLiteral(m.name) ? m.name.text : (m.name as ts.Identifier).text
      const schema = m.type ? typeSchema(m.type) : {}
      properties[name] = withDoc(m, schema)
      if (!m.questionToken) required.push(name)
    } else if (ts.isIndexSignatureDeclaration(m)) {
      additional = m.type ? typeSchema(m.type) : {}
    }
  }
  const out: Schema = { type: 'object', properties }
  if (required.length) out.required = required
  if (additional) out.additionalProperties = additional
  else out.additionalProperties = false
  return out
}

/** интерфейс: свойства предков + свои */
function collectHeritage(decl: ts.InterfaceDeclaration, members: ts.TypeElement[], seen = new Set<string>()): void {
  for (const clause of decl.heritageClauses ?? []) {
    for (const ext of clause.types) {
      const name = ext.expression.getText(sf)
      if (seen.has(name)) continue
      seen.add(name)
      const src = findTypeDecl(name)
      if (src && ts.isInterfaceDeclaration(src)) {
        collectHeritage(src, members, seen)
        members.push(...src.members)
      }
    }
  }
}

function interfaceSchema(decl: ts.InterfaceDeclaration): Schema {
  const members: ts.TypeElement[] = []
  collectHeritage(decl, members)
  members.push(...decl.members)
  return withDoc(decl, membersSchema(ts.factory.createNodeArray(members)))
}

function findTypeDecl(name: string): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined {
  let found: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined
  sf.forEachChild((node) => {
    if (found) return
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text === name) found = node
  })
  return found
}

function register(name: string): void {
  if (defs[name] || computing.has(name)) return
  computing.add(name)
  const decl = findTypeDecl(name)
  if (!decl) {
    defs[name] = {}
    computing.delete(name)
    return
  }
  defs[name] = withDoc(decl, declKind(decl))
  computing.delete(name)
}

function declKind(decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): Schema {
  if (ts.isInterfaceDeclaration(decl)) return interfaceSchema(decl)
  return typeSchema(decl.type)
}

function typeSchema(node: ts.TypeNode): Schema {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { type: 'string' }
    case ts.SyntaxKind.NumberKeyword:
      return { type: 'number' }
    case ts.SyntaxKind.BooleanKeyword:
      return { type: 'boolean' }
    case ts.SyntaxKind.NullKeyword:
      return { type: 'null' }
    case ts.SyntaxKind.AnyKeyword:
    case ts.SyntaxKind.UnknownKeyword:
      return {}
    case ts.SyntaxKind.UndefinedKeyword:
      return {}
    default:
      break
  }
  if (ts.isLiteralTypeNode(node)) {
    const l = literalSchema(node)
    return l ?? {}
  }
  if (ts.isArrayTypeNode(node)) return { type: 'array', items: typeSchema(node.elementType) }
  if (ts.isTupleTypeNode(node)) {
    return {
      type: 'array',
      prefixItems: node.elements.map((e) => typeSchema((e as ts.NamedTupleMember).type ?? (e as ts.TypeNode))),
      minItems: node.elements.length,
      maxItems: node.elements.length,
    }
  }
  if (ts.isParenthesizedTypeNode(node)) return typeSchema(node.type)
  if (ts.isUnionTypeNode(node)) return unionSchema(node.types)
  if (ts.isIntersectionTypeNode(node)) return { allOf: node.types.map(typeSchema) }
  if (ts.isTypeLiteralNode(node)) return membersSchema(node.members)
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText(sf)
    const args = node.typeArguments ?? []
    if (name === 'Array' || name === 'ReadonlyArray') {
      return { type: 'array', items: args[0] ? typeSchema(args[0]) : {} }
    }
    if (name === 'Record') {
      return { type: 'object', additionalProperties: args[1] ? typeSchema(args[1]) : {} }
    }
    if (name === 'Partial' && args[0]) {
      const inner = typeSchema(args[0])
      if (inner.required) delete inner.required
      return inner
    }
    // ссылка на локальный тип
    register(name)
    return { $ref: `#/$defs/${name}` }
  }
  console.warn('Неизвестный узел типа:', ts.SyntaxKind[node.kind], '— схема «что угодно»')
  return {}
}

// ── сборка ──
register(ROOT_TYPE)
// Пакетные файлы валидируются отдельно по этим же определениям.
register('CampaignManifest')
register('CampaignIndexEntry')
register('EncounterFileDef')

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://chronicle-forge.local/docs/campaign.schema.json',
  title: 'Chronicle Forge — монолитная кампания и схемы файлов пакета',
  description:
    'Монолитный JSON Chronicle Forge: обязательные ключи campaign, world, scenes, entities, rules, quests, arenas, cutscenes, dialogues; необязательные encounters, recipes, codex. ' +
    'В $defs также CampaignIndexEntry, CampaignManifest и EncounterFileDef для реестра и отдельных файлов Campaign Package. ' +
    'Сгенерировано из src/shared/types.ts (scripts/gen-schema.mts). Гайд для ИИ-генераторов: docs/ai-campaign-guide.md.',
  $ref: `#/$defs/${ROOT_TYPE}`,
  $defs: defs,
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(schema, null, 2) + '\n')
console.log(`OK: ${outFile} ($defs: ${Object.keys(defs).length})`)

// ── Автогенерация каталога форм Effect / Condition / DlgEffect / DlgCond в гайд ──
function sampleValue(propName: string, propSchema: Schema, depth = 0): unknown {
  if ('const' in propSchema) return propSchema.const
  if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) return propSchema.enum[0]
  if (typeof propSchema.$ref === 'string') {
    const refName = propSchema.$ref.replace('#/$defs/', '')
    if (refName === 'TimeOfDay') return 'night'
    if (refName === 'SkillDifficulty') return 50
    if (refName === 'Condition') return { type: 'flag_set', flag: 'flag_example' }
    if (refName === 'Effect') return { type: 'set_flag', flag: 'flag_example' }
    if (refName === 'ArtDoc') return { background: '#1a2230', layers: [] }
    if (refName === 'CameraDoc') return { zoom: 1.1, duration: 6 }
    const target = defs[refName]
    if (target && depth < 2) return sampleValue(propName, target, depth + 1)
    return 'example'
  }
  if (Array.isArray(propSchema.anyOf) && propSchema.anyOf.length > 0) {
    return sampleValue(propName, propSchema.anyOf[0] as Schema, depth + 1)
  }
  if (propSchema.type === 'string') {
    const byName: Record<string, string> = {
      flag: 'flag_done',
      skill: 'stealth',
      against_skill: 'spot',
      entity: 'npc_guard',
      npc: 'npc_guard',
      target: 'faction_town',
      item: 'item_bread',
      quest: 'quest_main',
      stage: 'stage_start',
      text_key: 'j_start',
      scene: 'scene_tavern',
      state: 'state_default',
      location: 'loc_town',
      from: 'loc_town',
      to: 'loc_forest',
      arena: 'arena_road',
      cutscene: 'cutscene_intro',
      status: 'status_poison',
      weather: 'weather_ashfall',
      entry: 'codex_lore',
      recipe: 'recipe_bandage',
      rule: 'rule_event',
      stat: 'STR',
      need: 'need_hunger',
      var: 'counter',
      currency: 'shards',
      table: 'table_road',
      generator: 'gen_npc',
      key: 'endings_seen',
      id: 'id_example',
      label: 'Стража',
      text: 'Текст сообщения',
    }
    return byName[propName] ?? `${propName}_id`
  }
  if (propSchema.type === 'number') {
    const byName: Record<string, number> = {
      probability: 0.5,
      delta: 5,
      threshold: 30,
      value: 10,
      count: 1,
      qty: 1,
      quantity: 1,
      min_tick: 1,
      ticks: 2,
      every_ticks: 3,
      fails_to_catch: 2,
      meters: 6,
      points: 10,
      amount: 1,
      level: 2,
      levels: 1,
      ge: 1,
    }
    return byName[propName] ?? 1
  }
  if (propSchema.type === 'boolean') return true
  if (propSchema.type === 'array') {
    const itemSchema = (propSchema.items as Schema) ?? { type: 'string' }
    return [sampleValue(propName, itemSchema, depth + 1)]
  }
  if (propSchema.type === 'object') {
    const props = (propSchema.properties as Record<string, Schema>) ?? {}
    const req = new Set<string>(Array.isArray(propSchema.required) ? (propSchema.required as string[]) : Object.keys(props))
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(props)) {
      if (req.has(k) || Object.keys(props).length <= 4) {
        obj[k] = sampleValue(k, v, depth + 1)
      }
    }
    return obj
  }
  return 'example'
}

function buildAutoCatalogMarkdown(): string {
  const groups: Array<{ key: string; title: string }> = [
    { key: 'Condition', title: 'Условия правил и квестов (`Condition`)' },
    { key: 'Effect', title: 'Эффекты правил, предметов и событий (`Effect`)' },
    { key: 'DlgCond', title: 'Условия в диалогах (`DlgCond`)' },
    { key: 'DlgEffect', title: 'Эффекты в диалогах (`DlgEffect`)' },
  ]
  const lines: string[] = [
    '## 21. Полный справочник форм условий и эффектов (автогенерация из схемы)',
    '',
    'Раздел синхронизируется автоматически скриптом `scripts/gen-schema.mts` из `src/shared/types.ts`. Каждая строка — валидный по `campaign.schema.json` JSON-образец:',
    '',
  ]
  for (const g of groups) {
    const def = defs[g.key] as { anyOf?: Array<Schema> } | undefined
    lines.push(`### ${g.title}`, '')
    for (const variant of def?.anyOf ?? []) {
      const props = (variant.properties as Record<string, Schema>) ?? {}
      const req = new Set<string>(Array.isArray(variant.required) ? (variant.required as string[]) : [])
      const sample: Record<string, unknown> = {}
      // Сначала type, затем обязательные поля, а если обязательных кроме type нет — информативные опциональные
      if (props.type) sample.type = sampleValue('type', props.type)
      for (const [k, v] of Object.entries(props)) {
        if (k === 'type') continue
        if (req.has(k)) sample[k] = sampleValue(k, v)
      }
      if (Object.keys(sample).length === 1) {
        for (const [k, v] of Object.entries(props)) {
          if (k === 'type') continue
          sample[k] = sampleValue(k, v)
          break
        }
      }
      const optionalKeys = Object.keys(props).filter((k) => k !== 'type' && !req.has(k) && !(k in sample))
      const optNote = optionalKeys.length ? ` *(необяз.: ${optionalKeys.map((k) => `\`${k}\``).join(', ')})*` : ''
      lines.push(`- \`${JSON.stringify(sample)}\`${optNote}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

const guideFile = join(process.cwd(), 'docs', 'ai-campaign-guide.md')
let guideText = readFileSync(guideFile, 'utf8')
const catalogStart = '<!-- AUTO-SCHEMA-CATALOG:START -->'
const catalogEnd = '<!-- AUTO-SCHEMA-CATALOG:END -->'
if (guideText.includes(catalogStart) && guideText.includes(catalogEnd)) {
  const startIdx = guideText.indexOf(catalogStart) + catalogStart.length
  const endIdx = guideText.indexOf(catalogEnd)
  guideText = guideText.slice(0, startIdx) + '\n\n' + buildAutoCatalogMarkdown() + '\n\n' + guideText.slice(endIdx)
  writeFileSync(guideFile, guideText)
  console.log('OK: docs/ai-campaign-guide.md — автокаталог синхронизирован')
}

// дублируем схему в публичный «чемодан для ИИ-агента» (синхронный образ public/ai)
const aiKit = join(process.cwd(), 'public', 'ai')
mkdirSync(aiKit, { recursive: true })
writeFileSync(join(aiKit, 'campaign.schema.json'), JSON.stringify(schema, null, 2) + '\n')
writeFileSync(join(aiKit, 'campaign-guide.md'), guideText)
console.log('OK: public/ai/campaign.schema.json + campaign-guide.md — синк')
