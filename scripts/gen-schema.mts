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

function buildStartHereCore(asGuideSection: boolean): string {
  const heading = asGuideSection
    ? '## 0. НАЧНИ С ЭТОГО — инструкция, двухфазный протокол и обратная связь'
    : '# Как работать с кампанией Chronicle Forge через ИИ-агента'
  return [
    heading,
    '',
    'Этот раздел встроен прямо в начало `campaign-guide.md` и продублирован в `НАЧНИ_С_ЭТОГО.txt` из единого источника (`scripts/gen-schema.mts`). Достаточно загрузить файлы чемодана в чат и написать задачу («сделай кампанию…» или «доработай квест…») — копировать инструкцию вручную больше не нужно (файл `НАЧНИ_С_ЭТОГО.txt` сохранён в архиве для тех, кто привык вставлять первое сообщение текстом).',
    '',
    'В архиве чемодана (**Файл → Чемодан для ИИ-агента**):',
    '',
    '- `campaign-guide.md` — полный гайд по движку и формату кампании (системный промпт со встроенной инструкцией первым разделом);',
    '- `campaign.schema.json` — формальная JSON Schema всех полей той же версии движка;',
    '- `campaign.json` — текущая кампания одним документом (`MonolithDoc`);',
    '- `design-template.md` — бланк дизайн-документа кампании для Фазы 1;',
    '- `НАЧНИ_С_ЭТОГО.txt` — этот же протокол отдельным текстовым файлом.',
    '',
    '### Двухфазный протокол создания кампании (обязателен при новой кампании)',
    '',
    'При запросе **«новая кампания с нуля»** ИИ-агент обязан работать в две фазы:',
    '',
    '1. **Фаза 1 — Дизайн-документ человеческим языком (по шаблону `design-template.md`):**',
    '   Прежде чем писать JSON-монолит, агент составляет и показывает мастеру компактный дизайн-документ:',
    '   - **Паспорт кампании:** название, жанр, визуальный профиль (`theme.profile`), тон, целевой объём;',
    '   - **Завязка и мир:** регионы (`world.regions`) и локации (`world.locations`);',
    '   - **Главы кампании:** список глав (напрямую маппится на `campaign.chapters` / `meta.chapters`);',
    '   - **Список сцен:** id, название, глава и сюжетная роль каждой сцены;',
    '   - **Таблица НПС и интерактивных объектов:** кто `type: npc` (говорящие персонажи и говорящие объекты), а кто `type: item` (осматриваемые пропы);',
    '   - **Квесты и концовки:** этапы квестов и условия финалов (`endings`);',
    '   - **Чек-лист задействованных механик:** какие именно условия и эффекты из гайда (§19 и §21) будут использованы;',
    '   - **Рамки баланса:** потребности, пороги проверок d100, ресурсы и бои.',
    '2. **Фаза 2 — Генерация монолита после «ок» мастера:**',
    '   Только после того как мастер подтвердил («ок») или скорректировал дизайн-документ, агент генерирует полный JSON-документ `MonolithDoc` строго по утверждённому плану. Далее работает штатная петля: **Файл → Импорт из JSON → Инструменты → Проверить кампанию → Скопировать отчёт для ИИ**.',
    '',
    'При точечных правках существующей кампании («поправь диалог кузнеца», «добавь квест на траву») Фазу 1 можно пропустить и сразу возвращать обновлённый монолит или фрагмент.',
    '',
    '### Строгие правила для ИИ-агента',
    '',
    '```text',
    'Ты автор кампаний для движка Chronicle Forge.',
    'Строжайшие требования:',
    '1. Формат — MonolithDoc из campaign-guide.md; формальная граница — campaign.schema.json.',
    '2. Валидация по схеме и в «Проверить кампанию» обязана быть чистой (0 ошибок): ссылайся только на существующие id, не добавляй полей вне схемы, не пропускай обязательные поля.',
    '3. Все тексты, названия и реплики — на русском языке; все id — латиницей в snake_case с префиксом секции.',
    '4. Запрещено переименовывать или переиспользовать существующие id в режиме правок.',
    '5. Запрещено выдумывать типы условий и эффектов вне перечня из campaign-guide.md (§19, §21) и campaign.schema.json.',
    '6. В диалогах переход "stay" допустим ТОЛЬКО в вариантах ответа игрока (choices[].goto = "stay"), но НЕ в структурном переходе узла (node.goto).',
    '7. Для интерактивных объектов сцены используй рецепт §8.1: говорящий объект с диалогом — это сущность type: "npc"; осматриваемый предмет без диалога — type: "item" со слотом, описанием и правилами.',
    '8. Изображения и звук файлами не требуются: используй процедурные ArtDoc, SoundDoc и MusicDoc.',
    '9. Если для замысла не хватает механики — не выдумывай несуществующие поля, используй ближайший канонический паттерн и запиши заметку в финальный блок cf-feedback.',
    '```',
    '',
    '### Конвенция `cf-feedback`: обратная связь агента для разработчиков (без телеметрии)',
    '',
    'В самом конце каждого ответа с кампанией (или итерацией правок) ИИ-агент добавляет fenced-блок ```` ```cf-feedback ```` с JSON-массивом заметок о том, каких эффектов, условий или пояснений не хватило при сборке кампании (если замечаний нет — пустой массив `[]`):',
    '',
    '````markdown',
    '```cf-feedback',
    '[',
    '  {',
    '    "id": "missing-effect:set_mood",',
    '    "kind": "missing_effect",',
    '    "detail": "Хотелось переключить настроение портрета НПС напрямую из правила",',
    '    "workaround": "Использовал выдачу статуса с портретом состояния",',
    '    "severity": "mid"',
    '  }',
    ']',
    '```',
    '````',
    '',
    '- Поле `id` — стабильный идентификатор вида `<категория>:<суть>` для автоматической склейки дублей.',
    '- Поле `kind` — одно из: `missing_effect | missing_condition | doc_gap | schema_gap | validator_wrong | other`.',
    '- Поле `severity` — `low | mid | high`.',
    '- Мастер может по желанию скопировать этот блок в редактор (**Инструменты → Заметки ИИ для разработчиков**) и одной кнопкой **«Открыть issue на GitHub»** отправить оформленную таблицу разработчикам Chronicle Forge.',
  ].join('\n')
}

function buildDesignTemplateMarkdown(): string {
  return [
    '# Дизайн-документ кампании Chronicle Forge (Фаза 1)',
    '',
    '> Заполняется ИИ-агентом человеческим языком на **Фазе 1** (до генерации JSON-монолита).',
    '> После подтверждения («ок») мастера агент переходит к **Фазе 2** и собирает `campaign.json` строго по этому документу.',
    '',
    '## 1. Паспорт кампании',
    '- **Рабочее название (`campaign.title`):** ',
    '- **Идентификатор (`campaign.id`, латиницей):** ',
    '- **Жанр и тон:** ',
    '- **Визуальный профиль (`theme.profile`):** `grimdark | high-fantasy | steampunk | wierd-west | modern | cyberpunk | sci-fi | post-apoc | clean`',
    '- **Целевой объём:** (сколько глав, сцен, НПС, примерное время прохождения)',
    '',
    '## 2. Завязка и устройство мира',
    '- **Завязка и стартовая ситуация героя:** ',
    '- **Регионы (`world.regions`) и локации (`world.locations`):** ',
    '- **Маршруты и условия перемещения:** ',
    '',
    '## 3. Главы кампании (прямо маппится на `campaign.chapters` / `meta.chapters`)',
    '| Порядок (`order`) | ID главы (`id`) | Название (`label`) | Краткая цель главы |',
    '| --- | --- | --- | --- |',
    '| 1 | `ch_1_...` | Глава I. … | … |',
    '| 2 | `ch_2_...` | Глава II. … | … |',
    '',
    '## 4. Список сцен и их роль',
    '| ID сцены (`scene_...`) | Название | Локация и глава | Роль в сюжете, ключевые слоты и интерактивные зоны |',
    '| --- | --- | --- | --- |',
    '| `scene_...` | … | … | … |',
    '',
    '## 5. Таблица НПС и интерактивных объектов',
    '> Напоминание по §8.1 гайда: говорящий объект с диалогом — это `type: "npc"` (стационарный, без боя); осматриваемый предмет без диалога — `type: "item"` в слоте сцены.',
    '',
    '| ID сущности | Название | Тип (`npc` / `item`) | Сцена / расписание | Диалог (`dlg_...`) или реакция при осмотре |',
    '| --- | --- | --- | --- | --- |',
    '| `npc_...` | … | `npc` | … | `dlg_...` |',
    '| `item_...` | … | `item` | … | Осмотр / правило |',
    '',
    '## 6. Квесты и концовки (`quests`, `endings`)',
    '- **Основные и побочные квесты (этапы и развязки):** ',
    '- **Концовки (`endings` — id, тон, условия достижения):** ',
    '',
    '## 7. Чек-лист задействованных механик (сверка со списком условий и эффектов гайда)',
    '- **Характеристики, навыки и потребности:** ',
    '- **Используемые типы условий (`Condition` / `DlgCond` из §19 и §21):** ',
    '- **Используемые типы эффектов (`Effect` / `DlgEffect` из §19 и §21):** ',
    '- **Особые механики (крафт `unlock_recipe`, погоня `start_pursuit`, тактический бой `start_combat`, стелс, состояния сцен/сущностей):** ',
    '',
    '## 8. Рамки баланса',
    '- **Стартовые ресурсы и экипировка:** ',
    '- **Диапазоны порогов проверок навыков (d100):** ',
    '- **Сложность боёв и источники восстановления (отдых, расходники, торговля):** ',
    '',
  ].join('\n')
}

const guideFile = join(process.cwd(), 'docs', 'ai-campaign-guide.md')
let guideText = readFileSync(guideFile, 'utf8')
const startHereStart = '<!-- AUTO-START-HERE:START -->'
const startHereEnd = '<!-- AUTO-START-HERE:END -->'
if (guideText.includes(startHereStart) && guideText.includes(startHereEnd)) {
  const sIdx = guideText.indexOf(startHereStart) + startHereStart.length
  const eIdx = guideText.indexOf(startHereEnd)
  guideText = guideText.slice(0, sIdx) + '\n\n' + buildStartHereCore(true) + '\n\n' + guideText.slice(eIdx)
}
const catalogStart = '<!-- AUTO-SCHEMA-CATALOG:START -->'
const catalogEnd = '<!-- AUTO-SCHEMA-CATALOG:END -->'
if (guideText.includes(catalogStart) && guideText.includes(catalogEnd)) {
  const startIdx = guideText.indexOf(catalogStart) + catalogStart.length
  const endIdx = guideText.indexOf(catalogEnd)
  guideText = guideText.slice(0, startIdx) + '\n\n' + buildAutoCatalogMarkdown() + '\n\n' + guideText.slice(endIdx)
  writeFileSync(guideFile, guideText)
  console.log('OK: docs/ai-campaign-guide.md — НАЧНИ_С_ЭТОГО и автокаталог синхронизированы')
}

// дублируем схему, гайд, инструкцию и шаблон дизайн-документа в публичный «чемодан для ИИ-агента» (синхронный образ public/ai)
const aiKit = join(process.cwd(), 'public', 'ai')
mkdirSync(aiKit, { recursive: true })
writeFileSync(join(aiKit, 'campaign.schema.json'), JSON.stringify(schema, null, 2) + '\n')
writeFileSync(join(aiKit, 'campaign-guide.md'), guideText)
writeFileSync(join(aiKit, 'НАЧНИ_С_ЭТОГО.txt'), buildStartHereCore(false) + '\n')
writeFileSync(join(aiKit, 'design-template.md'), buildDesignTemplateMarkdown())
console.log('OK: public/ai/{campaign.schema.json,campaign-guide.md,НАЧНИ_С_ЭТОГО.txt,design-template.md} — синк')
