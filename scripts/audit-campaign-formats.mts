import Ajv2020 from 'ajv/dist/2020.js'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Compiler } from 'inkjs/full'
import JSZip from 'jszip'
import schemaJson from '../docs/campaign.schema.json' with { type: 'json' }
import { MONOLITH_OPTIONAL_KEYS, MONOLITH_REQUIRED_KEYS } from '../src/shared/types'
import type { CampaignManifest } from '../src/shared/types'
import { EditorStore } from '../src/editor/store'
import { exportMonolith, importMonolith, repairMonolith } from '../src/editor/monolith'
import { importChronicle } from '../src/editor/chronicle'
import { generateInk } from '../src/editor/dialogueDoc'
import { buildAiCampaignPrompt } from '../src/editor/aiPrompt'
import { AI_KIT_FILES } from '../src/editor/aiKit'

const root = process.cwd()
const campaignsDir = join(root, 'public/campaigns')
const schema = schemaJson as typeof schemaJson & { $id: string; $defs: Record<string, any> }
const ajv = new Ajv2020({ allErrors: true, strict: false })
ajv.addSchema(schema)
const validators = new Map<string, ReturnType<typeof ajv.compile>>()
function validate(typeName: string, value: unknown, label: string): void {
  let check = validators.get(typeName)
  if (!check) {
    check = ajv.compile({ $ref: `${schema.$id}#/$defs/${typeName}` })
    validators.set(typeName, check)
  }
  if (!check(value)) {
    const details = check.errors?.map((e) => `${e.instancePath || '/'} ${e.message}`).join('\n')
    throw new Error(`${label} не соответствует ${typeName}:\n${details}`)
  }
}
function json(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'))
}
function walkJsonFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // .cf-play/ — отчёты прогона (в .gitignore), не содержимое пакета
    if (entry.name === '.cf-play' || entry.name.startsWith('.')) return []
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory() ? walkJsonFiles(join(dir, entry.name), rel) : entry.name.endsWith('.json') ? [rel] : []
  })
}
function moduleFiles<T extends keyof CampaignManifest>(manifest: CampaignManifest, key: T): string[] {
  return (manifest[key] ?? []) as string[]
}

const schemaRoot = schema.$defs.MonolithDoc
assert.deepEqual(schemaRoot.required, [...MONOLITH_REQUIRED_KEYS], 'Обязательные ключи MonolithDoc расходятся со схемой')
assert.deepEqual(
  Object.keys(schemaRoot.properties).filter((key) => !schemaRoot.required.includes(key)).sort(),
  [...MONOLITH_OPTIONAL_KEYS].sort(),
  'Необязательные ключи MonolithDoc расходятся со схемой',
)
for (const key of [...MONOLITH_REQUIRED_KEYS, ...MONOLITH_OPTIONAL_KEYS]) {
  assert.ok(schema.description.includes(key), `Описание JSON Schema не перечисляет ключ ${key}`)
}
for (const typeName of ['CampaignMeta', 'WorldDef', 'CampaignManifest', 'CampaignIndexEntry', 'SceneDef', 'EntityDef', 'RuleDef', 'QuestDef', 'ArenaDef', 'CutsceneDef', 'RecipeDef', 'CodexEntryDef', 'DlgDoc', 'EncounterFileDef']) {
  assert.ok(schema.$defs[typeName], `В JSON Schema отсутствует модульный тип ${typeName}`)
}

const dirs = readdirSync(campaignsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
const index = json(join(campaignsDir, 'index.json')) as Array<{ id?: unknown }>
assert.ok(Array.isArray(index), 'public/campaigns/index.json должен быть массивом')
for (const [i, entry] of index.entries()) validate('CampaignIndexEntry', entry, `campaigns/index.json[${i}]`)
assert.equal(new Set(index.map((entry) => entry.id)).size, index.length, 'В campaigns/index.json повторяются id кампаний')
// Реестр — это то, что доступно ИГРОКУ. На диске рядом может лежать
// полигон разработки: каталог без записи в index.json, но обязательно с
// маркером dev-fixture.json (старое имя smoke-fixture.json тоже годится —
// docs/agents/dev-campaigns.md). Без маркера это забытая кампания.
const registered = index.map((entry) => entry.id as string)
for (const id of registered) {
  assert.ok(dirs.includes(id), `Кампания «${id}» внесена в campaigns/index.json, но каталога нет`)
}
for (const id of dirs) {
  if (registered.includes(id)) continue
  const modern = join(campaignsDir, id, 'dev-fixture.json')
  const legacy = join(campaignsDir, id, 'smoke-fixture.json')
  const marker = existsSync(modern) ? modern : legacy
  assert.ok(existsSync(marker), `Каталог campaigns/${id} не внесён в реестр и не помечен как внутренний полигон (dev-fixture.json)`)
  const fixture = json(marker) as { reason?: unknown; visibility?: unknown }
  assert.ok(typeof fixture.reason === 'string' && fixture.reason, `campaigns/${id}: в маркере нет описания, зачем лежит каталог`)
  assert.equal(fixture.visibility, 'internal', `campaigns/${id}: маркер обязан явно указывать visibility: internal`)
  const meta = json(join(campaignsDir, id, 'campaign.json')) as { title?: unknown }
  assert.ok(typeof meta.title === 'string' && meta.title.startsWith('[DEV]'), `campaigns/${id}: заголовок внутреннего полигона обязан начинаться с «[DEV]» — иначе агент примет его за играбельную кампанию`)
}
let moduleCount = 0
for (const campaignId of dirs) {
  const base = join(campaignsDir, campaignId)
  const meta = json(join(base, 'campaign.json'))
  const world = json(join(base, 'world.json'))
  const manifest = json(join(base, 'manifest.json')) as CampaignManifest & { fmv?: string[] }
  // FMV-пак расширяет манифест и сцену полями `fmv`, которых нет в базовом
  // контракте narrative (там additionalProperties: false). Типы не расширяем —
  // это дело отдельного пакета; здесь снимаем расширения перед валидацией и
  // проверяем их отдельно, чтобы не ослаблять оракул.
  const fmvFiles = manifest.fmv ?? []
  assert.ok(Array.isArray(fmvFiles) && fmvFiles.every((f) => typeof f === 'string'),
    `${campaignId}/manifest.json: fmv должен быть массивом имён файлов`)
  const { fmv: _fmvInManifest, ...narrativeManifest } = manifest
  validate('CampaignMeta', meta, `${campaignId}/campaign.json`)
  validate('WorldDef', world, `${campaignId}/world.json`)
  validate('CampaignManifest', narrativeManifest, `${campaignId}/manifest.json`)
  assert.equal(meta.id, campaignId, `${campaignId}/campaign.json: id кампании не совпадает с каталогом`)

  const store = new EditorStore(`/campaigns/${campaignId}`)
  store.meta = meta
  store.world = world
  store.manifest = manifest
  const referencedJson = new Set(['campaign.json', 'world.json', 'manifest.json'])
  const registerJson = (rel: string) => {
    assert.ok(!rel.startsWith('/') && !rel.split('/').includes('..'), `${campaignId}/manifest.json содержит небезопасный путь ${rel}`)
    assert.ok(!referencedJson.has(rel), `${campaignId}/manifest.json перечисляет файл повторно: ${rel}`)
    referencedJson.add(rel)
  }

  // FMV-фрагменты не входят в MonolithDoc и не имеют валидатора в общей схеме —
  // их проверяет scripts/fmv-probe.mts. Но файлы обязаны числиться в manifest,
  // иначе они станут сиротами при публикации пакета.
  for (const file of fmvFiles) {
    const rel = `fmv/${file}`
    registerJson(rel)
    assert.ok(existsSync(join(base, rel)), `${campaignId}: FMV-фрагмент ${rel} указан в manifest, но файла нет`)
  }

  const buckets: Array<[keyof CampaignManifest, string, string]> = [
    ['scenes', 'scenes', 'SceneDef'],
    ['entities', 'entities', 'EntityDef'],
    ['rules', 'rules', 'RuleDef'],
    ['arenas', 'arenas', 'ArenaDef'],
    ['quests', 'quests', 'QuestDef'],
    ['cutscenes', 'cutscenes', 'CutsceneDef'],
    ['recipes', 'recipes', 'RecipeDef'],
    ['codex', 'codex', 'CodexEntryDef'],
  ]
  for (const [key, directory, typeName] of buckets) {
    for (const file of moduleFiles(manifest, key)) {
      const rel = `${directory}/${file}`
      registerJson(rel)
      const value = json(join(base, rel))
      // `fmv` на сцене — ссылка на видеофрагмент FMV-пака; базовый SceneDef
      // его не знает. Проверяем отдельно, общую схему не ослабляем.
      if (typeName === 'SceneDef' && typeof value.fmv === 'string') {
        assert.ok(fmvFiles.length > 0,
          `${campaignId}/${rel}: сцена ссылается на FMV, но manifest.fmv пуст`)
        const { fmv: _sceneFmv, ...narrativeScene } = value
        validate(typeName, narrativeScene, `${campaignId}/${rel}`)
      } else {
        validate(typeName, value, `${campaignId}/${rel}`)
      }
      store.jsonFiles.set(rel, value)
      moduleCount++
    }
  }

  // Валюта — это denomination id в ценах, но живой баланс всегда является
  // количеством одного предмета в инвентаре. Старым кампаниям разрешён fallback item_<id>.
  const currencyIds = meta.currencies.map((currency: { id: string }) => currency.id)
  assert.equal(new Set(currencyIds).size, currencyIds.length, `${campaignId}/campaign.json: id валют повторяется`)
  const currencyItems = meta.currencies.map((currency: { id: string; item_id?: string }) => currency.item_id || `item_${currency.id}`)
  assert.equal(new Set(currencyItems).size, currencyItems.length, `${campaignId}/campaign.json: несколько валют привязаны к одному предмету`)
  const entityIds = new Set(moduleFiles(manifest, 'entities').map((file) => file.replace(/\.json$/, '')))
  for (const [index, currency] of meta.currencies.entries()) {
    const itemId = currencyItems[index]
    assert.ok(entityIds.has(itemId), `${campaignId}/campaign.json: валюта ${currency.id} ссылается на отсутствующий предмет ${itemId}`)
    assert.equal(store.jsonFiles.get(`entities/${itemId}.json`)?.type, 'item', `${campaignId}/campaign.json: ${itemId} должен быть предметом-монетой`)
  }
  for (const entityId of entityIds) {
    const item = store.jsonFiles.get(`entities/${entityId}.json`)
    for (const valueCurrency of Object.keys(item?.value ?? {})) {
      assert.ok(currencyIds.includes(valueCurrency), `${campaignId}/entities/${entityId}: value содержит неизвестный id валюты ${valueCurrency}`)
    }
  }

  for (const file of moduleFiles(manifest, 'encounters')) {
    const rel = `rules/${file}`
    registerJson(rel)
    const value = json(join(base, rel))
    validate('EncounterFileDef', value, `${campaignId}/${rel}`)
    store.jsonFiles.set(rel, value)
    moduleCount++
  }
  for (const file of manifest.dialogues) {
    const rel = `dialogues/${file}`
    const inkPath = join(base, rel)
    const ink = readFileSync(inkPath, 'utf8')
    new Compiler(ink).Compile()
    store.textFiles.set(rel, ink)
    const dlgRel = rel.replace(/\.ink$/, '.dlg.json')
    const dlgPath = join(base, dlgRel)
    if (existsSync(dlgPath)) {
      registerJson(dlgRel)
      const doc = json(dlgPath)
      validate('DlgDoc', doc, `${campaignId}/${dlgRel}`)
      assert.equal(generateInk(doc), ink, `${campaignId}/${dlgRel} и ${rel} рассинхронизированы: Ink должен генерироваться из DlgDoc`)
      store.jsonFiles.set(dlgRel, doc)
      moduleCount++
    }
    moduleCount++
  }
  // Служебные файлы полигона разработки — не модули narrative-пакета:
  //   dev-fixture.json / smoke-fixture.json — маркер «внутренний полигон»;
  //   adventure.json — данные пака adventure (его читает
  //     scripts/adventure-mechanics-probe.mts, а не manifest.json);
  //   project.json — метаданные проекта формата 2 (kind/caps), не копируются
  //     в public через publish:campaigns и не числятся в manifest.json.
  // В manifest.json их быть не может.
  const nonModuleJson = new Set(['dev-fixture.json', 'smoke-fixture.json', 'adventure.json', 'project.json'])
  const allJson = walkJsonFiles(base).filter((rel) => !nonModuleJson.has(rel)).sort()
  assert.deepEqual(allJson, [...referencedJson].sort(), `${campaignId}: JSON-файлы и manifest.json не синхронизированы (есть сироты/пропуски)` )

  const issues = store.validateContent()
  assert.deepEqual(issues, [], `${campaignId}: модульный Campaign Package имеет битые ссылки:\n${issues.join('\n')}`)
  const { doc, warnings } = exportMonolith(store)
  assert.deepEqual(warnings, [], `${campaignId}: экспорт потерял/пропустил модульные данные:\n${warnings.join('\n')}`)
  // FMV-поле сцены — расширение пака, а не часть MonolithDoc. Снимаем его
  // перед валидацией базового формата; само расширение уже проверено выше.
  const stripFmv = (d: unknown) => {
    const copy = JSON.parse(JSON.stringify(d))
    if (copy?.scenes) for (const scene of Object.values(copy.scenes) as Array<{ fmv?: string }>) delete scene.fmv
    return copy
  }
  validate('MonolithDoc', stripFmv(doc), `${campaignId}: экспортированный MonolithDoc`)

  const imported = new EditorStore(`/campaigns/${campaignId}`)
  const importWarnings = importMonolith(imported, doc)
  assert.deepEqual(importWarnings, [], `${campaignId}: импорт MonolithDoc создал предупреждения:\n${importWarnings.join('\n')}`)
  const roundTrip = exportMonolith(imported).doc
  validate('MonolithDoc', stripFmv(roundTrip), `${campaignId}: MonolithDoc после импорта`)
  const expectedCanonical = stripFmv(JSON.parse(JSON.stringify(repairMonolith(doc).doc)))
  assert.deepEqual(stripFmv(JSON.parse(JSON.stringify(roundTrip))), expectedCanonical, `${campaignId}: Campaign Package → MonolithDoc → Campaign Package → MonolithDoc изменил данные вне нормализованных значений по умолчанию`)

  // .narthex — ZIP того же модульного пакета; повторный импорт обязан
  // полностью удалить старые модули, отсутствующие в новом manifest.
  const archive = new JSZip()
  for (const path of store.allPaths()) archive.file(path, store.fileText(path))
  const archiveBuffer = await archive.generateAsync({ type: 'nodebuffer' })
  const archiveStore = new EditorStore(`/campaigns/${campaignId}`)
  archiveStore.jsonFiles.set('scenes/orphan_from_previous_package.json', { id: 'orphan' })
  await importChronicle(archiveStore, archiveBuffer as unknown as File)
  assert.equal(archiveStore.jsonFiles.has('scenes/orphan_from_previous_package.json'), false, `${campaignId}: импорт .narthex оставил старый модуль-сироту`)
  assert.deepEqual(exportMonolith(archiveStore).doc, doc, `${campaignId}: архив .narthex отличается от модульного пакета`)
}

const guide = readFileSync(join(root, 'docs/ai-campaign-guide.md'), 'utf8')
const rootExample = guide.match(/## 2\. Структура документа[\s\S]*?```json\n([\s\S]*?)\n```/)?.[1]
assert.ok(rootExample, 'В AI-руководстве не найден пример структуры MonolithDoc')
for (const key of Object.keys(schemaRoot.properties)) {
  assert.ok(rootExample.includes(`"${key}"`), `Ключ ${key} отсутствует в примере AI-руководства`)
}
const copiedPrompt = buildAiCampaignPrompt({}, guide)
for (const key of [...MONOLITH_REQUIRED_KEYS, ...MONOLITH_OPTIONAL_KEYS]) {
  assert.ok(copiedPrompt.includes(key), `Копируемый prompt не перечисляет ключ ${key}`)
}
assert.ok(copiedPrompt.includes('ТОЛЬКО JSON'), 'Копируемый prompt не запрещает markdown/текст вокруг JSON')
assert.ok(copiedPrompt.includes('campaign.schema.json'), 'Копируемый prompt не отсылает к JSON Schema')
assert.ok(copiedPrompt.includes('не задавай уточняющих вопросов'), 'Копируемый prompt допускает дополнительные вопросы')
assert.ok(copiedPrompt.includes('в этом же ответе'), 'Копируемый prompt не требует выполнить задачу целиком сразу')
assert.ok(!/дождись «ок»|пока мастер не сказал «ок»|только после\s+«ок»/i.test(copiedPrompt), 'Копируемый prompt всё ещё требует подтверждения «ок»')

console.log(`✓ Проверена JSON Schema Draft 2020-12: ${Object.keys(schema.$defs).length} типов`)
// образы «чемодана для ИИ-агента» в public/ai: состав — ровно манифест
// AI_KIT_FILES (файл в public/ai, но не в архиве — больше невозможно молча),
// содержимое — копии первоисточников из docs/
{
  const guide = readFileSync(join(root, 'docs/ai-campaign-guide.md'), 'utf8')
  const schemaText = readFileSync(join(root, 'docs/campaign.schema.json'), 'utf8')
  const designTemplate = readFileSync(join(root, 'docs/ai-design-template.md'), 'utf8')
  const playkitDoc = readFileSync(join(root, 'docs/playkit-agent.md'), 'utf8')
  assert.equal(
    readFileSync(join(root, 'public/ai/PLAYKIT.md'), 'utf8'),
    playkitDoc,
    'public/ai/PLAYKIT.md рассинхронизирован: копия docs/playkit-agent.md',
  )
  for (const [src, dst] of [
    [guide, join(root, 'public/ai/campaign-guide.md')],
    [schemaText, join(root, 'public/ai/campaign.schema.json')],
    [designTemplate.trim() + '\n', join(root, 'public/ai/design-template.md')],
  ]) {
    assert.ok(existsSync(dst), `public/ai: отсутствует ${dst} (файл из манифеста AI_KIT_FILES)`)
    assert.equal(readFileSync(dst, 'utf8'), src, `public/ai/${dst.split('/').pop()} рассинхронизирован: запустите npx tsx scripts/gen-schema.mts`)
  }
  // состав каталога ↔ манифест: лишний файл или пропуск — падение (§R3)
  const actual = readdirSync(join(root, 'public/ai')).sort()
  const manifest = AI_KIT_FILES.map((f) => f.name).sort()
  const extra = actual.filter((name) => !manifest.includes(name))
  const missing = manifest.filter((name) => !actual.includes(name))
  assert.deepEqual(extra, [], `public/ai: файлы вне манифеста чемодана AI_KIT_FILES: ${extra.join(', ')}`)
  assert.deepEqual(missing, [], `public/ai: файлы манифеста AI_KIT_FILES отсутствуют: ${missing.join(', ')}`)
}
console.log(`✓ Проверены отдельные JSON/Ink-модули и ссылки: ${moduleCount} файлов в ${dirs.length} кампаниях`)
console.log('✓ Campaign Package ↔ MonolithDoc: round-trip без потерь и предупреждений')
console.log('✓ Структура AI-руководства и копируемый промпт синхронизированы с MonolithDoc')
