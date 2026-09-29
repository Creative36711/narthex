/**
 * Монолитный JSON кампании (итерация 8, блок F): экспорт Campaign Package
 * одним объектом, импорт с валидацией и автопочинкой.
 *
 * Формат — см. MonolithDoc в shared/types.ts, схему — docs/campaign.schema.json,
 * гайд для ИИ-генераторов — docs/ai-campaign-guide.md.
 *
 * Принцип автопочинки: ошибки НЕ валят импорт. Ссылки на несуществующие
 * объекты получают заглушки, битые куски отключаются, всё фиксируется
 * отчётом по-русски: «импортировано с N предупреждениями».
 */

import type {
  ArenaDef,
  CodexEntryDef,
  Condition,
  CutsceneDef,
  DlgCheck,
  DlgCond,
  DlgDoc,
  DlgEffect,
  DlgNode,
  DlgSection,
  DlgStep,
  Effect,
  EncounterFileDef,
  EncounterTableDef,
  EntityDef,
  ItemDef,
  LocationDef,
  MonolithDialogue,
  MonolithDoc,
  MonolithRawInk,
  NeedDef,
  NpcDef,
  QuestDef,
  RecipeDef,
  RegionDef,
  RuleDef,
  SceneDef,
  StatBlock,
  WorldDef,
} from '../shared/types'
import { migrateMeta, migrateNavigation, migrateNeedConditions } from '../shared/migrate'
import { generateInk, migrateDlgDoc } from './dialogueDoc'
import type { EditorStore, ManifestDef } from './store'
import { slugify } from './ids'
import { ENGINE_VERSION, PACKAGE_FORMAT } from '../shared/versions'

// ─────────────── служебное ───────────────

export function isRawInk(d: MonolithDialogue): d is MonolithRawInk {
  return typeof (d as MonolithRawInk).ink === 'string' && !Array.isArray((d as DlgDoc).nodes)
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function labelOf(v: Record<string, unknown>, fallback: string): string {
  return typeof v.label === 'string' && v.label ? v.label : fallback
}

/** имя файла для объекта внутри пакета */
function fileSlug(id: string): string {
  return slugify(id).replace(/[^a-z0-9_]/g, '') || 'unnamed'
}

// ─────────────── экспорт: store → MonolithDoc ───────────────

function collectById<T extends { id: string }>(list: Array<[string, T | undefined]>, kind: string, warnings: string[]): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [path, def] of list) {
    if (!def || typeof def !== 'object') {
      warnings.push(`Файл ${path} повреждён и не попал в JSON-экспорт`)
      continue
    }
    const id = def.id || path.split('/').pop()!.replace(/\.json$/, '')
    if (out[id]) warnings.push(`Дубликат id «${id}» (${kind}): взято первое определение`)
    else out[id] = def
  }
  return out
}

/** Campaign Package в памяти редактора → один JSON */
export function exportMonolith(store: EditorStore): { doc: MonolithDoc; warnings: string[] } {
  const warnings: string[] = []
  const scenes = collectById(
    store.scenePaths().map((p) => [p, store.scene(p)] as [string, SceneDef]),
    'сцены',
    warnings,
  )
  const entities = collectById(
    store.entityPaths().map((p) => [p, store.entity(p)] as [string, EntityDef]),
    'сущности',
    warnings,
  )
  const rules = collectById(
    store.rulePaths().map((p) => [p, store.rule(p)] as [string, RuleDef]),
    'правила',
    warnings,
  )
  const quests = collectById(
    store.questPaths().map((p) => [p, store.quest(p)] as [string, QuestDef]),
    'квесты',
    warnings,
  )
  const arenas = collectById(
    store.arenaPaths().map((p) => [p, store.arena(p)] as [string, ArenaDef]),
    'арены',
    warnings,
  )
  const cutscenes = collectById(
    store.cutscenePaths().map((p) => [p, store.cutscene(p)] as [string, CutsceneDef]),
    'катсцены',
    warnings,
  )
  const recipes = collectById(
    store.recipePaths().map((p) => [p, store.recipe(p)] as [string, RecipeDef]),
    'рецепты',
    warnings,
  )
  const codex = collectById(
    store.codexPaths().map((p) => [p, store.codexEntry(p)] as [string, CodexEntryDef]),
    'кодекс',
    warnings,
  )

  // таблицы встреч: файлы rules/encounters.json с обёрткой { encounter_tables: [...] }
  const encounters: Record<string, EncounterTableDef> = {}
  for (const p of store.manifest.encounters ?? []) {
    const path = `rules/${p}`
    const raw = store.jsonFiles.get(path) as EncounterFileDef | EncounterTableDef | undefined
    if (!raw) continue
    const tables = 'encounter_tables' in raw ? raw.encounter_tables : [raw]
    for (const t of tables) {
      if (t && t.id) encounters[t.id] = t
    }
  }

  // диалоги: .dlg.json (или «сырой» ink, если конструктора нет)
  const dialogues: Record<string, MonolithDialogue> = {}
  for (const f of store.manifest.dialogues) {
    const key = f.replace(/\.ink$/, '')
    const doc = store.jsonFiles.get(`dialogues/${key}.dlg.json`) as DlgDoc | undefined
    if (doc && Array.isArray(doc.nodes)) {
      dialogues[key] = migrateDlgDoc(JSON.parse(JSON.stringify(doc)))
    } else {
      const ink = store.textFiles.get(`dialogues/${f}`)
      dialogues[key] = { label: key, ink: ink ?? '' }
    }
  }

  const doc: MonolithDoc = {
    campaign: JSON.parse(JSON.stringify(store.meta)),
    world: JSON.parse(JSON.stringify(store.world)),
    scenes,
    entities,
    rules,
    quests,
    arenas,
    cutscenes,
    encounters,
    recipes,
    codex,
    dialogues,
  }
  return { doc, warnings }
}

// ─────────────── заглушки ───────────────

const DEFAULT_STATS: StatBlock = { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 }

function stubNpc(id: string): NpcDef {
  return {
    id,
    type: 'npc',
    label: `Заглушка: ${id}`,
    description: '',
    portrait: {},
    stats: { ...DEFAULT_STATS },
    skills: {},
    inventory: [],
    equipment: {},
  }
}

function stubItem(id: string): ItemDef {
  return {
    id,
    type: 'item',
    category: 'misc',
    label: `Заглушка: ${id}`,
    description: 'Предмет создан автоматически при импорте — заполните описание.',
    weight: 0,
    stackable: true,
  }
}

function stubQuest(id: string): QuestDef {
  return {
    id,
    label: `Заглушка: ${id}`,
    description: 'Квест создан автоматически при импорте — заполните описание.',
    journal_entries: {},
    stages: [{ id: 'start', label: 'Начало' }],
  }
}

function stubArena(id: string): ArenaDef {
  const hexes = (cols: number[], rows = [0, 1, 2, 3, 4, 5, 6, 7]): Array<[number, number]> => {
    const out: Array<[number, number]> = []
    for (const c of cols) for (const r of rows) out.push([c, r])
    return out
  }
  return {
    id,
    label: `Заглушка: ${id}`,
    image: '',
    canvas: { w: 1280, h: 720 },
    hex_grid: { cols: 12, rows: 8, hex_size: 36, offset: 'odd-r', blocked_hexes: [], difficult_terrain: [] },
    spawn_zones: { player: { hexes: hexes([0, 1]) }, enemy: { hexes: hexes([10, 11]) } },
  }
}

function stubRule(id: string): RuleDef {
  return {
    id,
    label: `Заглушка: ${id}`,
    once: false,
    manual: true,
    conditions: [],
    effects: [{ type: 'show_message', text: `Правило «${id}» создано автоматически при импорте.` }],
  }
}

function ensureCutscene(ctx: RepairCtx, id: string): CutsceneDef {
  const existing = ctx.doc.cutscenes[id]
  if (existing) return existing
  const c = stubCutscene(id)
  ctx.doc.cutscenes[id] = c
  ctx.warn(`Катсцена «${id}» не найдена — создана заглушка`)
  return c
}

function stubCutscene(id: string): CutsceneDef {
  return {
    id,
    label: `Заглушка: ${id}`,
    slides: [{ text: `Катсцена «${id}» не была передана — слайд-заглушка.`, transition: 'fade' }],
  }
}

function stubScene(id: string, location: string): SceneDef {
  return {
    id,
    label: `Заглушка: ${id}`,
    location,
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_default', label: 'Обычное', art: { background: '#3d3d3d', layers: [] }, condition: null }],
    slots: [],
    navigation: [],
  }
}

function stubLocation(id: string): LocationDef {
  return {
    id,
    label: `Заглушка: ${id}`,
    position: { x: 640, y: 360 },
    travel_connections: [],
    scenes: [],
  }
}

function stubRegion(id: string): RegionDef {
  return {
    id,
    label: `Заглушка: ${id}`,
    map_image: '',
    map_size: { w: 1280, h: 720 },
    parent_region: null,
    locations: [],
  }
}

function stubDialogue(): DlgDoc {
  return {
    version: 2,
    nodes: [
      {
        id: 'main',
        label: 'Начало разговора',
        sections: [{ steps: [{ kind: 'line', line: { text: '…' } }] }],
        choices: [{ text: 'Прощай.', sections: [], goto: 'end' }],
      },
    ],
  }
}

// ─────────────── автопочинка ───────────────

export const PROP_RECIPE_HINT = 'Как правильно: см. рецепт «интерактивный проп» в гайде'

/**
 * Схлопывание однотипных предупреждений «предмет используется как персонаж» (Задача 3):
 * вместо N одинаковых строк выдаёт одну сводку с обучающей отсылкой к рецепту в гайде.
 */
export function formatItemUsedAsNpcWarning(ids: Iterable<string>): string | null {
  const list = [...new Set(ids)]
  if (list.length === 0) return null
  if (list.length === 1) {
    return `Сущность «${list[0]}» используется как персонаж, но описана как предмет — оставлено как есть. ${PROP_RECIPE_HINT}`
  }
  const shown = list.length > 5 ? `${list.slice(0, 5).join(', ')}, …` : list.join(', ')
  return `Сущности ${shown} (${list.length} шт.) используются как персонажи, но описаны как предметы — оставлено как есть. ${PROP_RECIPE_HINT}`
}

interface RepairCtx {
  doc: MonolithDoc
  warnings: string[]
  /** id сущности → какой заглушкой его создавать при разных ссылках */
  entityKind: Map<string, 'npc' | 'item'>
  /** id предметов, на которые ссылаются как на персонажей (схлопываются в одну сводку) */
  itemUsedAsNpc: Set<string>
  warn(msg: string): void
}

/**
 * Проверка и автопочинка монолитного документа. Возвращает готовый к импорту
 * doc и список предупреждений по-русски (он же — отчёт для мастера).
 */
export function repairMonolith(raw: unknown): { doc: MonolithDoc; warnings: string[] } {
  const warnings: string[] = []
  const warn = (msg: string) => {
    if (!warnings.includes(msg)) warnings.push(msg)
  }

  const src = isObj(raw) ? raw : {}
  if (!isObj(raw)) warn('В документе нет объекта кампании — создан пустой шаблон')

  // campaign
  const meta = (isObj(src.campaign) ? JSON.parse(JSON.stringify(src.campaign)) : {}) as MonolithDoc['campaign']
  meta.id = typeof meta.id === 'string' && meta.id ? meta.id : 'imported_campaign'
  meta.title = typeof meta.title === 'string' && meta.title ? meta.title : 'Импортированная кампания'
  meta.version = typeof meta.version === 'string' && meta.version ? meta.version : '0.1.0'
  // минимальная версия движка: устаревшее engine_version и новое min_engine
  meta.engine_version = typeof meta.engine_version === 'string' && meta.engine_version ? meta.engine_version : ENGINE_VERSION
  if (typeof meta.min_engine !== 'string' || !meta.min_engine) meta.min_engine = meta.engine_version
  if (typeof meta.package_format !== 'number') meta.package_format = PACKAGE_FORMAT
  meta.author = typeof meta.author === 'string' ? meta.author : ''
  meta.description = typeof meta.description === 'string' ? meta.description : ''
  meta.tick_label = typeof meta.tick_label === 'string' && meta.tick_label ? meta.tick_label : 'час'
  if (typeof meta.ticks_per_day !== 'number' || meta.ticks_per_day <= 0) meta.ticks_per_day = 24
  meta.needs = Array.isArray(meta.needs) ? meta.needs.filter(isObj) : []
  for (const n of meta.needs as NeedDef[]) {
    n.decay_when = migrateNeedConditions(n.decay_when)
    n.restore_when = migrateNeedConditions(n.restore_when)
  }
  meta.currencies = Array.isArray(meta.currencies) ? meta.currencies.filter(isObj) : []
  if (meta.skills !== undefined && !Array.isArray(meta.skills)) meta.skills = []
  if (meta.factions !== undefined && !Array.isArray(meta.factions)) meta.factions = []
  if (meta.flags !== undefined && !Array.isArray(meta.flags)) meta.flags = []
  if (meta.item_categories !== undefined && !Array.isArray(meta.item_categories)) meta.item_categories = []
  meta.item_categories = meta.item_categories ?? []
  if (!meta.item_categories.some((c) => c.id === 'misc')) {
    if (!src.campaign || !isObj(src.campaign) || !Array.isArray((src.campaign as { item_categories?: unknown[] }).item_categories)) {
      // реестра не было — мягко добавляем служебную категорию
      meta.item_categories.push({ id: 'misc', label: 'Разное' })
    }
  }

  // world
  const world = (isObj(src.world) ? JSON.parse(JSON.stringify(src.world)) : {}) as WorldDef
  world.regions = Array.isArray(world.regions) ? world.regions.filter(isObj) : []
  if (!world.regions.length) {
    world.regions.push(stubRegion('region_imported'))
    warn('В мире не было ни одного региона — создан «region_imported»')
  }

  const doc: MonolithDoc = {
    campaign: meta,
    world,
    scenes: pickMap(src.scenes),
    entities: pickMap(src.entities),
    rules: pickMap(src.rules),
    quests: pickMap(src.quests),
    arenas: pickMap(src.arenas),
    cutscenes: pickMap(src.cutscenes),
    encounters: pickMap(src.encounters),
    recipes: pickMap(src.recipes),
    codex: pickMap(src.codex),
    dialogues: pickMap(src.dialogues) as Record<string, MonolithDialogue>,
  }

  const ctx: RepairCtx = { doc, warnings, entityKind: new Map(), itemUsedAsNpc: new Set(), warn }

  // ── 1. нормализация самих определений (id, обязательные поля) ──
  normalizeDefs(ctx)
  // ── 2. регистры (флаги, категории, фракции) дозаполняются по контенту ──
  // ── 3. ссылки: заглушки и отключение битого ──
  repairWorld(ctx)
  repairScenes(ctx)
  repairEntities(ctx)
  repairRules(ctx)
  repairQuests(ctx)
  repairEncounters(ctx)
  repairDialogues(ctx)
  repairMeta(ctx)

  const propSummary = formatItemUsedAsNpcWarning(ctx.itemUsedAsNpc)
  if (propSummary) warn(propSummary)

  return { doc, warnings }
}

function pickMap(v: unknown): Record<string, never> {
  const out: Record<string, unknown> = {}
  if (!isObj(v)) return out as Record<string, never>
  for (const [key, val] of Object.entries(v)) {
    if (val === undefined || val === null) continue
    // «сырой» ink-диалог строкой заворачиваем в объект
    if (typeof val === 'string') out[key] = { ink: val }
    else if (isObj(val)) out[key] = JSON.parse(JSON.stringify(val))
  }
  return out as Record<string, never>
}

function normalizeDefs(ctx: RepairCtx): void {
  const fix = <T extends { id: string; label: string }>(
    map: Record<string, T>,
    kind: string,
    prefix: string,
    extra?: (def: T, key: string) => void,
    ensureLabel = true,
  ): void => {
    const used = new Set<string>()
    for (const [key, def] of Object.entries(map)) {
      let id = typeof def.id === 'string' && def.id ? def.id : key || ''
      if (!id || typeof id !== 'string') id = `${prefix}_${used.size + 1}`
      if (ensureLabel && !def.label) def.label = labelOf(def as unknown as Record<string, unknown>, id)
      if (used.has(id)) {
        let n = 2
        while (used.has(`${id}_${n}`)) n++
        const newId = `${id}_${n}`
        ctx.warn(`${kind}: дубликат id «${id}» переименован в «${newId}»`)
        id = newId
        def.id = id
      }
      used.add(id)
      if (key !== id) {
        delete map[key]
        map[id] = def
      }
      def.id = id
      extra?.(def, id)
    }
  }

  fix(ctx.doc.scenes as Record<string, SceneDef & { label: string }>, 'Сцена', 'scene', (sc) => {
    sc.states = Array.isArray(sc.states) ? sc.states.filter(isObj) : []
    if (!sc.states.length) {
      sc.states.push({ id: 'state_default', label: 'Обычное', art: { background: '#3d3d3d', layers: [] }, condition: null })
      ctx.warn(`Сцена «${sc.label}»: не было ни одного состояния фона — добавлено «Обычное»`)
    }
    for (const st of sc.states) {
      if (!st.image && !st.art) {
        st.art = { background: '#3d3d3d', layers: [] }
        ctx.warn(`Сцена «${sc.label}»: у состояния «${st.label}» не было фона — добавлена заглушка фона`)
      }
    }
    sc.slots = Array.isArray(sc.slots) ? sc.slots.filter(isObj) : []
    sc.navigation = Array.isArray(sc.navigation) ? sc.navigation.filter(isObj) : []
    if (!sc.canvas) sc.canvas = { w: 1280, h: 720 }
  })
  fix(ctx.doc.entities as Record<string, EntityDef & { label: string }>, 'Сущность', 'ent', (e, id) => {
    // тип по умолчанию — по префиксу id (item_…, npc_…, player_…)
    if (e.type !== 'item' && e.type !== 'npc') {
      ;(e as { type: string }).type = id.startsWith('item') ? 'item' : 'npc'
    }
    if (e.type === 'item') {
      const it = e as ItemDef
      if (typeof it.weight !== 'number') it.weight = 0
      if (typeof it.stackable !== 'boolean') it.stackable = true
      if (!it.description) it.description = ''
      // блок 7 ТЗ: старым оружию/броне без слота — встроенный слот
      if (!it.equip_slot && it.weapon_data) it.equip_slot = 'weapon'
      else if (!it.equip_slot && it.armor_data) it.equip_slot = 'armor'
    } else {
      const npc = e as NpcDef
      npc.stats = isObj(npc.stats) ? { ...DEFAULT_STATS, ...npc.stats } : { ...DEFAULT_STATS }
      npc.skills = isObj(npc.skills) ? npc.skills : {}
      npc.portrait = isObj(npc.portrait) ? npc.portrait : {}
    }
  })
  fix(ctx.doc.rules as Record<string, RuleDef & { label: string }>, 'Правило', 'rule', (r) => {
    r.conditions = Array.isArray(r.conditions) ? r.conditions.filter(isObj) : []
    r.effects = Array.isArray(r.effects) ? r.effects.filter(isObj) : []
    if (typeof r.once !== 'boolean') r.once = false
  })
  fix(ctx.doc.quests as Record<string, QuestDef & { label: string }>, 'Квест', 'quest', (q) => {
    q.stages = Array.isArray(q.stages) ? q.stages.filter(isObj) : []
    if (!q.stages.length) {
      q.stages.push({ id: 'start', label: 'Начало' })
      ctx.warn(`Квест «${q.label}»: не было ни одной стадии — добавлена «Начало»`)
    }
    if (!isObj(q.journal_entries)) q.journal_entries = {}
    if (!q.description) q.description = ''
  })
  fix(ctx.doc.arenas as Record<string, ArenaDef & { label: string }>, 'Арена', 'arena', (a) => {
    if (!isObj(a.hex_grid)) {
      const stub = stubArena(a.id)
      a.hex_grid = stub.hex_grid
      a.canvas = a.canvas ?? stub.canvas
      ctx.warn(`Арена «${a.label}»: не было сетки гексов — добавлена сетка 12×8`)
    }
    if (!isObj(a.spawn_zones)) {
      a.spawn_zones = stubArena(a.id).spawn_zones
      ctx.warn(`Арена «${a.label}»: не было зон появления — добавлены базовые`)
    }
  })
  fix(ctx.doc.cutscenes as Record<string, CutsceneDef & { label: string }>, 'Катсцена', 'cutscene', (c) => {
    c.slides = Array.isArray(c.slides) ? c.slides.filter(isObj) : []
    if (!c.slides.length) {
      c.slides.push({ text: c.label, transition: 'fade' })
      ctx.warn(`Катсцена «${c.label}»: не было ни одного слайда — добавлен пустой`)
    }
    for (const s of c.slides) {
      if (!s.transition) s.transition = 'fade'
    }
  })
  fix(ctx.doc.recipes as Record<string, RecipeDef & { label: string }>, 'Рецепт', 'recipe', (r) => {
    r.inputs = Array.isArray(r.inputs) ? r.inputs.filter(isObj) : []
    r.tools = Array.isArray(r.tools) ? r.tools.filter((t) => typeof t === 'string') : undefined
    r.requires = Array.isArray(r.requires) ? r.requires.filter(isObj) : undefined
    if (!isObj(r.output) || typeof (r.output as { item?: unknown }).item !== 'string') {
      r.output = { item: '', quantity: 1 }
      ctx.warn(`Рецепт «${r.label}»: не было результата — очищен`)
    }
  })
  const encounters = (ctx.doc.encounters ??= {})
  fix(encounters as Record<string, EncounterTableDef & { label: string }>, 'Таблица встреч', 'encounter', (t) => {
    t.entries = Array.isArray(t.entries) ? t.entries.filter(isObj) : []
    if (typeof t.rolls !== 'number') t.rolls = 1
    if (!t.entries.length) {
      t.entries.push({ weight: 1, type: 'nothing' })
      ctx.warn(`Таблица встреч «${t.id}»: пуста — добавлено «ничего не происходит»`)
    }
  }, false)
  // диалоги: ключи приводим к именам файлов
  const dls = ctx.doc.dialogues
  for (const [key, val] of Object.entries(dls)) {
    const clean = key.replace(/^dialogues\//, '').replace(/\.(dlg\.json|ink|json)$/i, '')
    if (clean !== key) {
      delete dls[key]
      dls[clean] = val
    }
  }
}

// ── реестры по контенту ──

function registerFlag(ctx: RepairCtx, flag: string): void {
  if (!flag) return
  ctx.doc.campaign.flags = ctx.doc.campaign.flags ?? []
  if (!ctx.doc.campaign.flags.some((f) => f.id === flag)) {
    ctx.doc.campaign.flags.push({ id: flag, label: flag })
    ctx.warn(`Флаг «${flag}» не был в реестре кампании — добавлен`)
  }
}

function registerFaction(ctx: RepairCtx, target: string): void {
  if (!target) return
  ctx.doc.campaign.factions = ctx.doc.campaign.factions ?? []
  const isNpc = !!ctx.doc.entities[target] && ctx.doc.entities[target].type === 'npc'
  if (isNpc) return
  if (!ctx.doc.campaign.factions.some((f) => f.id === target)) {
    ctx.doc.campaign.factions.push({ id: target, label: target, base_disposition: 0 })
    ctx.warn(`Фракция «${target}» не была в реестре кампании — добавлена`)
  }
}

function registerSkill(ctx: RepairCtx, skill: string): void {
  if (!skill) return
  if (!Array.isArray(ctx.doc.campaign.skills)) return // undefined — действует встроенный словарь
  if (!ctx.doc.campaign.skills.some((s) => s.id === skill)) {
    ctx.doc.campaign.skills.push({ id: skill, label: skill })
    ctx.warn(`Навык «${skill}» не был в реестре кампании — добавлен`)
  }
}

function registerCategory(ctx: RepairCtx, category: string): void {
  if (!category) return
  const cats = (ctx.doc.campaign.item_categories = ctx.doc.campaign.item_categories ?? [])
  if (!cats.some((c) => c.id === category)) {
    cats.push({ id: category, label: category })
    ctx.warn(`Категория предметов «${category}» не была в реестре — добавлена`)
  }
}

// ── справочные id с заглушками ──

function allLocationsList(world: WorldDef): LocationDef[] {
  const out: LocationDef[] = []
  const walk = (regions: RegionDef[]) => {
    for (const r of regions) {
      out.push(...r.locations)
      if (r.sub_regions) walk(r.sub_regions)
    }
  }
  walk(world.regions)
  return out
}

function firstRegion(ctx: RepairCtx): RegionDef {
  return ctx.doc.world.regions[0]
}

function ensureLocation(ctx: RepairCtx, id: string): LocationDef {
  const found = allLocationsList(ctx.doc.world).find((l) => l.id === id)
  if (found) return found
  const loc = stubLocation(id)
  firstRegion(ctx).locations.push(loc)
  ctx.warn(`Локация «${id}» не найдена — создана заглушка`)
  return loc
}

function ensureScene(ctx: RepairCtx, id: string, locationId?: string): SceneDef {
  const existing = ctx.doc.scenes[id]
  if (existing) return existing
  const locId = locationId && allLocationsList(ctx.doc.world).some((l) => l.id === locationId) ? locationId : allLocationsList(ctx.doc.world)[0]?.id
  const loc = locId ? ensureLocation(ctx, locId) : ensureLocation(ctx, 'loc_imported')
  const sc = stubScene(id, loc.id)
  ctx.doc.scenes[id] = sc
  if (!loc.scenes.includes(id)) loc.scenes.push(id)
  ctx.warn(`Сцена «${id}» не найдена — создана заглушка в локации «${loc.label}»`)
  return sc
}

function entityReferenced(id: string, kind: 'npc' | 'item', ctx: RepairCtx): void {
  const prev = ctx.entityKind.get(id)
  // npc-ссылка приоритетнее: бой/отряд требуют персонажа
  if (!prev || (kind === 'npc' && prev === 'item')) ctx.entityKind.set(id, kind)
}

function ensureEntity(ctx: RepairCtx, id: string, kind: 'npc' | 'item'): EntityDef {
  const existing = ctx.doc.entities[id]
  if (existing) {
    if (kind === 'npc' && existing.type === 'item') {
      ctx.itemUsedAsNpc.add(id)
    }
    return existing
  }
  const useItem = kind === 'item' ? true : kind === 'npc' ? false : id.startsWith('item')
  const e = useItem ? stubItem(id) : stubNpc(id)
  ctx.doc.entities[id] = e
  ctx.warn(`Сущность «${id}» не найдена — создана заглушка (${useItem ? 'предмет' : 'персонаж'})`)
  return e
}

function ensureQuest(ctx: RepairCtx, id: string): QuestDef {
  const existing = ctx.doc.quests[id]
  if (existing) return existing
  const q = stubQuest(id)
  ctx.doc.quests[id] = q
  ctx.warn(`Квест «${id}» не найден — создана заглушка`)
  return q
}

function ensureQuestStage(ctx: RepairCtx, quest: QuestDef, stage: string, where: string): void {
  if (!stage) return
  if (!quest.stages.some((s) => s.id === stage)) {
    quest.stages.push({ id: stage, label: stage })
    ctx.warn(`${where}: у квеста «${quest.label}» не было стадии «${stage}» — добавлена`)
  }
}

function ensureArena(ctx: RepairCtx, id: string): ArenaDef {
  const existing = ctx.doc.arenas[id]
  if (existing) return existing
  const a = stubArena(id)
  ctx.doc.arenas[id] = a
  ctx.warn(`Арена «${id}» не найдена — создана заглушка`)
  return a
}

function ensureRule(ctx: RepairCtx, id: string): RuleDef {
  const existing = ctx.doc.rules[id]
  if (existing) return existing
  const r = stubRule(id)
  ctx.doc.rules[id] = r
  ctx.warn(`Правило «${id}» не найдено — создана заглушка`)
  return r
}

// ── условия и эффекты ──

/**
 * Инвариант: keep вызывается РОВНО ОДИН РАЗ — с исправленным условием
 * или с null (условие/действие отключено как битое).
 */
function fixCondition(ctx: RepairCtx, c: Condition, where: string, keep: (c: Condition | null) => void): void {
  switch (c.type) {
    case 'player_enters_location':
      ensureLocation(ctx, c.location)
      break
    case 'player_enters_scene':
      ensureScene(ctx, c.scene)
      break
    case 'flag_set':
    case 'flag_not_set':
      registerFlag(ctx, c.flag)
      break
    case 'quest_at_stage': {
      const q = ensureQuest(ctx, c.quest)
      ensureQuestStage(ctx, q, c.stage, where)
      break
    }
    case 'has_item':
      entityReferenced(c.item, 'item', ctx)
      ensureEntity(ctx, c.item, 'item')
      break
    case 'skill_ge':
      registerSkill(ctx, c.skill)
      break
    case 'need_le':
    case 'need_ge':
      if (!ctx.doc.campaign.needs.some((n) => n.id === c.need)) {
        ctx.warn(`${where}: условие ссылается на несуществующую потребность «${c.need}» — условие удалено`)
        keep(null)
        return
      }
      break
    case 'entity_alive':
    case 'entity_dead':
    case 'in_party':
      entityReferenced(c.entity, 'npc', ctx)
      ensureEntity(ctx, c.entity, 'npc')
      break
    case 'disposition_ge':
    case 'disposition_le':
      registerFaction(ctx, c.target)
      break
    case 'and':
    case 'or': {
      const out: Condition[] = []
      for (const sub of c.conditions) fixCondition(ctx, sub, where, (s) => s && out.push(s))
      c.conditions = out
      break
    }
    case 'not': {
      let replacement: Condition | null | undefined
      fixCondition(ctx, c.condition, where, (s) => (replacement = s))
      keep(replacement ? { type: 'not', condition: replacement } : null)
      return
    }
    default:
      break
  }
  keep(c)
}

function fixConditionList(ctx: RepairCtx, list: Condition[], where: string): Condition[] {
  const out: Condition[] = []
  for (const c of list) fixCondition(ctx, c, where, (s) => s && out.push(s))
  return out
}

/** Инвариант тот же, что у fixCondition: keep — ровно один раз. */
function fixEffect(ctx: RepairCtx, e: Effect, where: string, keep: (e: Effect | null) => void): void {
  switch (e.type) {
    case 'set_flag':
    case 'clear_flag':
      registerFlag(ctx, e.flag)
      break
    case 'start_dialogue':
      entityReferenced(e.entity, 'npc', ctx)
      ensureEntity(ctx, e.entity, 'npc')
      break
    case 'start_combat': {
      for (const en of e.enemies ?? []) {
        entityReferenced(en.entity, 'npc', ctx)
        ensureEntity(ctx, en.entity, 'npc')
      }
      for (const al of e.allies ?? []) {
        entityReferenced(al.entity, 'npc', ctx)
        ensureEntity(ctx, al.entity, 'npc')
      }
      ensureArena(ctx, e.arena)
      if (e.on_victory) e.on_victory = fixEffectList(ctx, e.on_victory, where)
      break
    }
    case 'teleport_player':
      ensureLocation(ctx, e.location)
      if (e.scene) ensureScene(ctx, e.scene, e.location)
      break
    case 'change_scene_state': {
      const sc = ctx.doc.scenes[e.scene]
      if (!sc) {
        ctx.warn(`${where}: действие ссылается на несуществующую сцену «${e.scene}» — действие удалено`)
        keep(null)
        return
      }
      if (!sc.states.some((s) => s.id === e.state)) {
        ctx.warn(`${where}: в сцене «${sc.label}» нет состояния «${e.state}» — действие удалено`)
        keep(null)
        return
      }
      break
    }
    case 'add_item':
    case 'remove_item':
      entityReferenced(e.item, 'item', ctx)
      ensureEntity(ctx, e.item, 'item')
      break
    case 'set_description':
      ensureEntity(ctx, e.entity, e.entity.startsWith('item') ? 'item' : 'npc')
      break
    case 'change_need':
      if (!ctx.doc.campaign.needs.some((n) => n.id === e.need)) {
        ctx.warn(`${where}: действие ссылается на несуществующую потребность «${e.need}» — действие удалено`)
        keep(null)
        return
      }
      break
    case 'change_skill':
      registerSkill(ctx, e.skill)
      break
    case 'skill_check_gate':
      registerSkill(ctx, e.skill)
      e.success_effects = fixEffectList(ctx, e.success_effects ?? [], where)
      e.fail_effects = fixEffectList(ctx, e.fail_effects ?? [], where)
      break
    case 'stat_check':
      e.success_effects = fixEffectList(ctx, e.success_effects ?? [], where)
      e.fail_effects = fixEffectList(ctx, e.fail_effects ?? [], where)
      break
    case 'start_pursuit':
      if (e.skill) registerSkill(ctx, e.skill)
      e.on_fail = fixEffectList(ctx, e.on_fail ?? [], where)
      break
    case 'group_stat_check':
      if (e.skill) registerSkill(ctx, e.skill)
      e.success_effects = fixEffectList(ctx, e.success_effects ?? [], where)
      e.fail_effects = fixEffectList(ctx, e.fail_effects ?? [], where)
      break
    case 'opposed_check':
      registerSkill(ctx, e.skill)
      if (e.against_skill) registerSkill(ctx, e.against_skill)
      if (e.entity) entityReferenced(e.entity, 'npc', ctx)
      e.success_effects = fixEffectList(ctx, e.success_effects ?? [], where)
      e.fail_effects = fixEffectList(ctx, e.fail_effects ?? [], where)
      break
    case 'change_disposition':
      registerFaction(ctx, e.target)
      break
    case 'start_quest':
      ensureQuest(ctx, e.quest)
      break
    case 'advance_quest': {
      const q = ensureQuest(ctx, e.quest)
      ensureQuestStage(ctx, q, e.stage, where)
      break
    }
    case 'fail_quest':
      ensureQuest(ctx, e.quest)
      break
    case 'journal_update': {
      const q = ensureQuest(ctx, e.quest)
      if (!q.journal_entries[e.text_key]) {
        q.journal_entries[e.text_key] = e.text_key
        ctx.warn(`${where}: у квеста «${q.label}» нет записи журнала «${e.text_key}» — добавлена заглушка`)
      }
      break
    }
    case 'give_reward':
      for (const it of e.items ?? []) {
        entityReferenced(it.item, 'item', ctx)
        ensureEntity(ctx, it.item, 'item')
      }
      break
    case 'join_party':
    case 'leave_party':
      entityReferenced(e.entity, 'npc', ctx)
      ensureEntity(ctx, e.entity, 'npc')
      break
    case 'block_path':
    case 'unblock_path':
      ensureLocation(ctx, e.from)
      ensureLocation(ctx, e.to)
      break
    case 'reveal_location':
      ensureLocation(ctx, e.location)
      break
    case 'remove_entity':
      entityReferenced(e.entity, 'item', ctx)
      ensureEntity(ctx, e.entity, 'item')
      break
    case 'spawn_entity': {
      entityReferenced(e.entity, 'item', ctx)
      ensureEntity(ctx, e.entity, 'item')
      const sc = ctx.doc.scenes[e.scene]
      if (!sc) {
        ctx.warn(`${where}: действие ссылается на несуществующую сцену «${e.scene}» — действие удалено`)
        keep(null)
        return
      }
      if (!sc.slots.some((s) => s.id === e.slot)) {
        ctx.warn(`${where}: в сцене «${sc.label}» нет слота «${e.slot}» — действие удалено`)
        keep(null)
        return
      }
      break
    }
    case 'play_cutscene':
      ensureCutscene(ctx, e.cutscene)
      break
    default:
      break
  }
  keep(e)
}

function fixEffectList(ctx: RepairCtx, list: Effect[], where: string): Effect[] {
  const out: Effect[] = []
  for (const e of list) fixEffect(ctx, e, where, (s) => s && out.push(s))
  return out
}

// ── секции кампании ──

function repairWorld(ctx: RepairCtx): void {
  const sceneIds = new Set(Object.keys(ctx.doc.scenes))
  const walk = (regions: RegionDef[], parent: string | null): void => {
    for (const r of regions) {
      if (!r.id) r.id = makeSimpleId('region', regions)
      if (!r.label) r.label = r.id
      r.locations = Array.isArray(r.locations) ? r.locations.filter(isObj) : []
      r.parent_region = r.parent_region ?? parent
      for (const loc of r.locations) {
        if (!loc.id) loc.id = makeSimpleId('loc', r.locations)
        if (!loc.label) loc.label = loc.id
        loc.position = isObj(loc.position) ? loc.position : { x: 640, y: 360 }
        loc.scenes = Array.isArray(loc.scenes) ? loc.scenes.filter((s) => typeof s === 'string') : []
        loc.travel_connections = Array.isArray(loc.travel_connections) ? loc.travel_connections.filter(isObj) : []

        // сцены локации: битое выключаем, отсутствующие создаём заглушками
        const kept: string[] = []
        for (const sid of loc.scenes) {
          if (!sceneIds.has(sid)) {
            const sc = ensureScene(ctx, sid, loc.id)
            sceneIds.add(sid)
            kept.push(sc.id)
          } else {
            const sc = ctx.doc.scenes[sid]
            if (sc.location && sc.location !== loc.id) {
              ctx.warn(`Локация «${loc.label}»: сцена «${sid}» принадлежит другой локации — убрана из списка`)
            } else {
              sc.location = loc.id
              kept.push(sid)
            }
          }
        }
        loc.scenes = [...new Set(kept)]
        if (loc.arrival_scene && !loc.scenes.includes(loc.arrival_scene)) {
          ctx.warn(`Локация «${loc.label}»: сцена по прибытии «${loc.arrival_scene}» не входит в её сцены — сброшена`)
          delete loc.arrival_scene
        }
        if (loc.arena) ensureArena(ctx, loc.arena)
        loc.on_enter_rules = (loc.on_enter_rules ?? []).filter((rid) => {
          if (ctx.doc.rules[rid]) return true
          ctx.warn(`Локация «${loc.label}»: правило «${rid}» не найдено — убрано из списка`)
          return false
        })
        loc.travel_connections = loc.travel_connections.filter((tc) => {
          if (!allLocationsList(ctx.doc.world).some((l) => l.id === tc.to)) {
            ctx.warn(`Локация «${loc.label}»: дорога ведёт в несуществующую локацию «${tc.to}» — удалена`)
            return false
          }
          tc.requirements = fixConditionList(ctx, tc.requirements ?? [], `дорога из «${loc.label}»`)
          return true
        })
      }
      if (r.sub_regions) walk(r.sub_regions, r.id)
    }
  }
  walk(ctx.doc.world.regions, null)
}

function repairScenes(ctx: RepairCtx): void {
  const scenesByLoc = new Map<string, SceneDef[]>()
  for (const sc of Object.values(ctx.doc.scenes)) {
    if (!sc.location || !allLocationsList(ctx.doc.world).some((l) => l.id === sc.location)) {
      const loc = ensureLocation(ctx, sc.location || 'loc_imported')
      sc.location = loc.id
    }
    const list = scenesByLoc.get(sc.location) ?? []
    list.push(sc)
    scenesByLoc.set(sc.location, list)

    for (const slot of sc.slots) {
      if (!slot.id) slot.id = `slot_${sc.slots.indexOf(slot) + 1}`
      if (!slot.label) slot.label = slot.id
      if (!Array.isArray(slot.type) || !slot.type.length) slot.type = ['person', 'item', 'container']
      for (const k of ['x', 'y', 'w', 'h'] as const) {
        if (typeof slot[k] !== 'number') (slot as unknown as Record<string, number>)[k] = 0
      }
      if (!isObj(slot.condition) && slot.condition !== null) slot.condition = null
      if (slot.default_entity) {
        const kind = slot.default_entity.startsWith('item') ? 'item' : 'npc'
        entityReferenced(slot.default_entity, kind, ctx)
        ensureEntity(ctx, slot.default_entity, kind)
      }
    }

    sc.navigation = sc.navigation.filter((nav) => {
      // старый формат «в локацию» → «открыть карту»
      const legacy = (nav as { go_to_location?: string }).go_to_location
      if (legacy) {
        migrateNavigation(sc, ctx.doc.world)
        ctx.warn(`Сцена «${sc.label}»: переход «в локацию» заменён на «открыть карту» (между локациями — только через карту)`)
        return true
      }
      if (nav.go_to_scene) {
        const target = ctx.doc.scenes[nav.go_to_scene]
        if (!target) {
          ctx.warn(`Сцена «${sc.label}»: переход «${nav.label ?? nav.go_to_scene}» ведёт в несуществующую сцену — зона отключена`)
          return false
        }
        if (target.location !== sc.location) {
          delete nav.go_to_scene
          nav.open_map = true
          ctx.warn(
            `Сцена «${sc.label}»: переход «${nav.label ?? 'без названия'}» вёл в сцену другой локации — заменён на «открыть карту»`,
          )
          return true
        }
        return true
      }
      if (!nav.open_map) {
        ctx.warn(`Сцена «${sc.label}»: пустая зона перехода «${nav.label ?? 'без названия'}» отключена`)
        return false
      }
      return true
    })
  }
}

function repairEntities(ctx: RepairCtx): void {
  for (const e of Object.values(ctx.doc.entities)) {
    if (e.type === 'item') {
      const it = e as ItemDef
      registerCategory(ctx, it.category || 'misc')
      if (!it.category) it.category = 'misc'
      for (const use of [it.on_use, it.on_interact]) {
        if (use && Array.isArray(use.effects)) use.effects = fixEffectList(ctx, use.effects, `предмет «${it.label}»`)
      }
      continue
    }
    const npc = e as NpcDef
    for (const inv of npc.inventory ?? []) {
      entityReferenced(inv.item, 'item', ctx)
      ensureEntity(ctx, inv.item, 'item')
      if (typeof inv.quantity !== 'number') inv.quantity = 1
    }
    for (const slot of ['weapon', 'armor'] as const) {
      const id = npc.equipment?.[slot]
      if (id) {
        entityReferenced(id, 'item', ctx)
        ensureEntity(ctx, id, 'item')
      }
    }
    for (const l of npc.loot_table ?? []) {
      entityReferenced(l.item, 'item', ctx)
      ensureEntity(ctx, l.item, 'item')
    }
    if (npc.faction) registerFaction(ctx, npc.faction)
    if (npc.natural_weapon) registerSkill(ctx, npc.natural_weapon.skill)
    for (const sk of Object.keys(npc.skills ?? {})) registerSkill(ctx, sk)

    if (npc.dialogue) {
      const key = npc.dialogue.replace(/^dialogues\//, '').replace(/\.(dlg\.json|ink|json)$/i, '')
      if (!ctx.doc.dialogues[key]) {
        ctx.doc.dialogues[key] = { label: npc.label, ...stubDialogue() }
        ctx.warn(`Персонаж «${npc.label}»: диалог «${key}» не найден — создан пустой диалог`)
      }
      npc.dialogue = `dialogues/${key}.ink`
    }

    npc.schedule = (npc.schedule ?? []).filter((s) => {
      const sc = ctx.doc.scenes[s.scene]
      if (!sc) {
        ctx.warn(`Персонаж «${npc.label}»: расписание ссылается на несуществующую сцену «${s.scene}» — запись удалена`)
        return false
      }
      if (!sc.slots.some((sl) => sl.id === s.slot)) {
        ctx.warn(`Персонаж «${npc.label}»: в сцене «${sc.label}» нет слота «${s.slot}» — запись расписания удалена`)
        return false
      }
      return true
    })
    npc.presence_overrides = (npc.presence_overrides ?? []).filter((o) => {
      const sc = ctx.doc.scenes[o.scene]
      if (!sc) {
        ctx.warn(`Персонаж «${npc.label}»: особое место ссылается на несуществующую сцену «${o.scene}» — запись удалена`)
        return false
      }
      if (!sc.slots.some((sl) => sl.id === o.slot)) {
        ctx.warn(`Персонаж «${npc.label}»: в сцене «${sc.label}» нет слота «${o.slot}» — запись удалена`)
        return false
      }
      return true
    })
    if (npc.trader) {
      for (const s of npc.trader.sells ?? []) {
        entityReferenced(s.item, 'item', ctx)
        ensureEntity(ctx, s.item, 'item')
      }
    }
  }
}

function repairRules(ctx: RepairCtx): void {
  for (const r of Object.values(ctx.doc.rules)) {
    const where = `Правило «${r.label}»`
    const conds: Condition[] = []
    for (const c of r.conditions) fixCondition(ctx, c, where, (s) => s && conds.push(s))
    r.conditions = conds
    r.effects = fixEffectList(ctx, r.effects, where)
  }
}

function repairQuests(ctx: RepairCtx): void {
  for (const q of Object.values(ctx.doc.quests)) {
    const where = `Квест «${q.label}»`
    const stageIds = new Set(q.stages.map((s) => s.id))
    for (const st of q.stages) {
      st.on_enter_effects = fixEffectList(ctx, st.on_enter_effects ?? [], `${where}, стадия «${st.label ?? st.id}»`)
      st.transitions = (st.transitions ?? []).filter((t) => {
        if (stageIds.has(t.to)) {
          const conds: Condition[] = []
          for (const c of t.conditions ?? []) fixCondition(ctx, c, where, (s) => s && conds.push(s))
          t.conditions = conds
          return true
        }
        ctx.warn(`${where}: переход стадии «${st.label ?? st.id}» в несуществующую стадию «${t.to}» удалён`)
        return false
      })
    }
  }
}

function repairEncounters(ctx: RepairCtx): void {
  for (const t of Object.values(ctx.doc.encounters ?? {})) {
    const where = `Таблица встреч «${t.id}»`
    for (const en of t.entries) {
      if (en.type === 'combat') {
        for (const e of en.enemies ?? []) {
          entityReferenced(e.entity, 'npc', ctx)
          ensureEntity(ctx, e.entity, 'npc')
        }
        ensureArena(ctx, en.arena)
      } else if (en.type === 'dialogue') {
        entityReferenced(en.entity, 'npc', ctx)
        ensureEntity(ctx, en.entity, 'npc')
      } else if (en.type === 'skill_check') {
        registerSkill(ctx, en.skill)
        en.success_effects = fixEffectList(ctx, en.success_effects ?? [], where)
        en.fail_effects = fixEffectList(ctx, en.fail_effects ?? [], where)
      } else if (en.type === 'event') {
        en.effects = fixEffectList(ctx, en.effects ?? [], where)
      }
    }
  }
}

// ── диалоги ──

function fixDlgGotos(ctx: RepairCtx, nodes: DlgNode[], where: string): void {
  const ids = new Set(nodes.map((n) => n.id))
  const fixGoto = (g: string | undefined, allowStay: boolean, set: (v: string) => void): void => {
    const t = (g ?? 'end').trim()
    if (t === '' || t === 'end' || (allowStay && (t === 'stay' || t === ''))) return
    if (ids.has(t)) return
    const stayHint = t === 'stay' ? ' («stay» допустим только в вариантах ответа)' : ''
    ctx.warn(`${where}: переход «${t}» ведёт в несуществующий узел диалога — заменён на «конец»${stayHint}`)
    set('end')
  }
  const fixCond = (c: DlgCond): void => {
    switch (c.type) {
      case 'flag':
        registerFlag(ctx, c.flag)
        break
      case 'item_ge':
      case 'has_item':
        entityReferenced(c.item, 'item', ctx)
        ensureEntity(ctx, c.item, 'item')
        break
      case 'disp_ge':
        registerFaction(ctx, c.target)
        break
      case 'quest': {
        const q = ensureQuest(ctx, c.quest)
        if (c.stage) ensureQuestStage(ctx, q, c.stage, where)
        break
      }
      case 'in_party':
        entityReferenced(c.npc, 'npc', ctx)
        ensureEntity(ctx, c.npc, 'npc')
        break
      default:
        break
    }
  }
  const fixDlgEffect = (e: DlgEffect): DlgEffect | null => {
    switch (e.type) {
      case 'set_flag':
        registerFlag(ctx, e.flag)
        return e
      case 'add_item':
      case 'remove_item':
        entityReferenced(e.item, 'item', ctx)
        ensureEntity(ctx, e.item, 'item')
        return e
      case 'fire_rule':
        ensureRule(ctx, e.rule)
        return e
      case 'join_party':
      case 'open_trade':
        entityReferenced(e.npc, 'npc', ctx)
        ensureEntity(ctx, e.npc, 'npc')
        return e
      case 'start_quest':
        ensureQuest(ctx, e.quest)
        return e
      case 'change_need':
        if (!ctx.doc.campaign.needs.some((n) => n.id === e.need)) {
          ctx.warn(`${where}: действие ссылается на несуществующую потребность «${e.need}» — удалено`)
          return null
        }
        return e
      case 'change_disposition':
        registerFaction(ctx, e.target)
        return e
      case 'play_cutscene':
        ensureCutscene(ctx, e.cutscene)
        return e
      case 'set_description':
        ensureEntity(ctx, e.entity, e.entity.startsWith('item') ? 'item' : 'npc')
        return e
      default:
        return e
    }
  }
  const fixSection = (s: DlgSection, nodeId: string): void => {
    for (const c of s.conds ?? []) fixCond(c)
    const fixSteps = (steps: DlgStep[] | undefined): DlgStep[] =>
      (steps ?? []).map((st) => {
        if (st.kind === 'effect') {
          const e = fixDlgEffect(st.effect)
          return e ? { ...st, effect: e } : null
        }
        return st
      }).filter((x): x is DlgStep => x !== null)
    s.steps = fixSteps(s.steps)
    s.else_steps = s.else_steps ? fixSteps(s.else_steps) : s.else_steps
    if (s.goto !== undefined) fixGoto(s.goto, false, (v) => (s.goto = v))
    if (s.else_goto !== undefined) fixGoto(s.else_goto, false, (v) => (s.else_goto = v))
    void nodeId
  }
  const fixCheck = (ch: DlgCheck): void => {
    registerSkill(ctx, ch.skill)
    for (const m of ch.mods ?? []) for (const c of m.conds) fixCond(c)
    for (const side of [ch.success, ch.fail]) {
      for (const s of side.sections ?? []) fixSection(s, '')
      fixGoto(side.goto, true, (v) => (side.goto = v))
    }
  }

  for (const node of nodes) {
    for (const s of node.sections) fixSection(s, node.id)
    for (const c of node.choices) {
      for (const cond of c.conds ?? []) fixCond(cond)
      for (const s of c.sections) fixSection(s, node.id)
      if (c.check) fixCheck(c.check)
      else fixGoto(c.goto, true, (v) => (c.goto = v))
    }
    if (node.goto !== undefined) fixGoto(node.goto, false, (v) => (node.goto = v))
  }
}

function repairDialogues(ctx: RepairCtx): void {
  for (const [key, raw] of Object.entries(ctx.doc.dialogues)) {
    const where = `Диалог «${key}»`
    if (isRawInk(raw)) {
      if (typeof raw.ink !== 'string') {
        raw.ink = ''
        ctx.warn(`${where}: пустой ink-исходник`)
      }
      continue
    }
    let doc: DlgDoc
    try {
      doc = migrateDlgDoc(raw)
    } catch {
      ctx.warn(`${where}: документ повреждён — создан пустой диалог`)
      doc = stubDialogue()
    }
    if (!Array.isArray(doc.nodes) || !doc.nodes.length) {
      ctx.warn(`${where}: нет ни одного узла — создан узел «Начало разговора»`)
      doc = stubDialogue()
    }
    // уникальность узлов
    const seen = new Set<string>()
    doc.nodes.forEach((n, i) => {
      if (!n.id) n.id = i === 0 ? 'main' : `node_${i + 1}`
      if (!n.label) n.label = n.id
      if (seen.has(n.id)) {
        let k = 2
        while (seen.has(`${n.id}_${k}`)) k++
        const newId = `${n.id}_${k}`
        ctx.warn(`${where}: дубликат узла «${n.id}» переименован в «${newId}»`)
        n.id = newId
      }
      seen.add(n.id)
      n.sections = Array.isArray(n.sections) ? n.sections : []
      n.choices = Array.isArray(n.choices) ? n.choices : []
    })
    fixDlgGotos(ctx, doc.nodes, where)
    ctx.doc.dialogues[key] = doc
  }
}

function repairMeta(ctx: RepairCtx): void {
  const meta = ctx.doc.campaign
  const scenes = Object.values(ctx.doc.scenes)
  const locations = allLocationsList(ctx.doc.world)

  if (!meta.default_player || !ctx.doc.entities[meta.default_player]) {
    const id = meta.default_player || 'player_hero'
    meta.default_player = id
    if (!ctx.doc.entities[id]) {
      ctx.doc.entities[id] = stubNpc(id)
      ctx.warn(`Персонаж игрока «${id}» не найден — создана заглушка`)
    }
  }

  if (!meta.starting_scene || !ctx.doc.scenes[meta.starting_scene]) {
    const loc = locations.find((l) => l.id === meta.starting_location) ?? locations[0]
    const next = (loc?.scenes.length ? ctx.doc.scenes[loc.scenes[0]] : scenes[0])?.id
    if (next) {
      ctx.warn(`Стартовая сцена «${meta.starting_scene || '—'}» не найдена — выбрана «${next}»`)
      meta.starting_scene = next
    }
  }
  const startScene = ctx.doc.scenes[meta.starting_scene]
  if (!meta.starting_location || !locations.some((l) => l.id === meta.starting_location)) {
    meta.starting_location = startScene?.location ?? locations[0]?.id ?? 'loc_imported'
    if (!locations.some((l) => l.id === meta.starting_location)) ensureLocation(ctx, meta.starting_location)
  }
  const startLoc = locations.find((l) => l.id === meta.starting_location)
  const regionOf = (locId: string): string | undefined => {
    const find = (regions: RegionDef[]): string | undefined => {
      for (const r of regions) {
        if (r.locations.some((l) => l.id === locId)) return r.id
        const sub = r.sub_regions ? find(r.sub_regions) : undefined
        if (sub) return sub
      }
      return undefined
    }
    return find(ctx.doc.world.regions)
  }
  const startRegion = regionOf(startLoc?.id ?? '')
  if (!startRegion || meta.starting_region !== startRegion) {
    const reg = startRegion ?? ctx.doc.world.regions[0].id
    if (meta.starting_region !== reg) ctx.warn(`Стартовый регион «${meta.starting_region || '—'}» не найден — выбран «${reg}»`)
    meta.starting_region = reg
  }

  for (const need of meta.needs) {
    if (need.on_zero_effect && need.on_zero_effect !== 'death' && !ctx.doc.rules[need.on_zero_effect]) {
      ctx.warn(`Потребность «${need.label}»: правило «${need.on_zero_effect}» не найдено — эффект сброшен`)
      delete need.on_zero_effect
    }
    for (const list of [need.decay_when, need.restore_when]) {
      if (!list) continue
      const kept = list.map((c) => c).filter(Boolean)
      list.length = 0
      list.push(...kept)
    }
  }
  if (meta.dice_rules) {
    const d = meta.dice_rules
    if (typeof d.critical_divisor !== 'number' || d.critical_divisor < 1) d.critical_divisor = 5
    if (typeof d.special_divisor !== 'number' || d.special_divisor < 1) d.special_divisor = 2
    if (typeof d.fumble_from !== 'number' || d.fumble_from < 1) d.fumble_from = 96
  }
  migrateMeta(meta)
}

function makeSimpleId(prefix: string, list: Array<{ id?: string }>): string {
  const used = new Set(list.map((x) => x.id ?? ''))
  if (!used.has(prefix)) return prefix
  let n = 2
  while (used.has(`${prefix}_${n}`)) n++
  return `${prefix}_${n}`
}

// ─────────────── импорт: MonolithDoc → store ───────────────

/** разбор текста (из файла или поля «вставьте текст») */
export function parseMonolith(text: string): MonolithDoc {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Пустой текст — вставьте JSON кампании')
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch (e) {
    throw new Error(`Не удалось разобрать JSON: ${(e as Error).message}`)
  }
  return raw as MonolithDoc
}

/**
 * Импорт монолитного JSON в редактор: валидация с автопочинкой, раскладка
 * в файлы Campaign Package (ink для диалогов генерируется из DlgDoc).
 * Возвращает итоговый отчёт предупреждений по-русски.
 */
export function importMonolith(store: EditorStore, raw: unknown): string[] {
  const { doc, warnings } = repairMonolith(raw)

  // полная замена содержимого пакета (кампания приходит целиком)
  store.jsonFiles.clear()
  store.textFiles.clear()
  store.dirty.clear()

  store.meta = doc.campaign
  store.world = doc.world

  const manifest: ManifestDef = {
    scenes: [],
    entities: [],
    rules: [],
    arenas: [],
    quests: [],
    encounters: [],
    cutscenes: [],
    recipes: [],
    codex: [],
    dialogues: [],
  }

  for (const sc of Object.values(doc.scenes)) {
    const f = `${fileSlug(sc.id)}.json`
    manifest.scenes.push(f)
    store.jsonFiles.set(`scenes/${f}`, sc)
    store.dirty.add(`scenes/${f}`)
  }
  for (const e of Object.values(doc.entities)) {
    const f = `${fileSlug(e.id)}.json`
    manifest.entities.push(f)
    store.jsonFiles.set(`entities/${f}`, e)
    store.dirty.add(`entities/${f}`)
  }
  for (const r of Object.values(doc.rules)) {
    const f = `${fileSlug(r.id)}.json`
    manifest.rules.push(f)
    store.jsonFiles.set(`rules/${f}`, r)
    store.dirty.add(`rules/${f}`)
  }
  for (const q of Object.values(doc.quests)) {
    const f = `${fileSlug(q.id)}.json`
    manifest.quests!.push(f)
    store.jsonFiles.set(`quests/${f}`, q)
    store.dirty.add(`quests/${f}`)
  }
  for (const a of Object.values(doc.arenas)) {
    const f = `${fileSlug(a.id)}.json`
    manifest.arenas!.push(f)
    store.jsonFiles.set(`arenas/${f}`, a)
    store.dirty.add(`arenas/${f}`)
  }
  for (const c of Object.values(doc.cutscenes)) {
    const f = `${fileSlug(c.id)}.json`
    manifest.cutscenes!.push(f)
    store.jsonFiles.set(`cutscenes/${f}`, c)
    store.dirty.add(`cutscenes/${f}`)
  }
  for (const r of Object.values(doc.recipes ?? {})) {
    const f = `${fileSlug(r.id)}.json`
    manifest.recipes!.push(f)
    store.jsonFiles.set(`recipes/${f}`, r)
    store.dirty.add(`recipes/${f}`)
  }
  for (const c of Object.values(doc.codex ?? {})) {
    const f = `${fileSlug(c.id)}.json`
    manifest.codex!.push(f)
    store.jsonFiles.set(`codex/${f}`, c)
    store.dirty.add(`codex/${f}`)
  }
  const tables = Object.values(doc.encounters ?? {})
  if (tables.length) {
    manifest.encounters!.push('encounters.json')
    store.jsonFiles.set('rules/encounters.json', { encounter_tables: tables })
    store.dirty.add('rules/encounters.json')
  }
  for (const [key, val] of Object.entries(doc.dialogues)) {
    const base = fileSlug(key)
    manifest.dialogues.push(`${base}.ink`)
    if (isRawInk(val)) {
      store.textFiles.set(`dialogues/${base}.ink`, val.ink)
    } else {
      store.jsonFiles.set(`dialogues/${base}.dlg.json`, val)
      store.dirty.add(`dialogues/${base}.dlg.json`)
      try {
        store.textFiles.set(`dialogues/${base}.ink`, generateInk(val))
      } catch (e) {
        store.textFiles.set(`dialogues/${base}.ink`, '')
        warnings.push(`Диалог «${key}»: не удалось сгенерировать ink (${(e as Error).message})`)
      }
    }
    store.dirty.add(`dialogues/${base}.ink`)
  }

  // сортировка списков манифеста — как принято в проекте
  manifest.scenes.sort()
  manifest.entities.sort()
  manifest.rules.sort()
  manifest.arenas!.sort()
  manifest.quests!.sort()
  manifest.cutscenes!.sort()
  manifest.recipes!.sort()
  manifest.codex!.sort()
  store.manifest = manifest
  store.dirty.add('manifest.json')
  store.dirty.add('campaign.json')
  store.dirty.add('world.json')

  // финальная проверка собранного пакета (те же правила, что у кнопки «Проверить»)
  for (const issue of store.validateContent()) {
    const msg = `Проверка пакета: ${issue}`
    if (!warnings.includes(msg)) warnings.push(msg)
  }
  store.notify()
  return warnings
}

/** импорт текста (кнопка «Импорт из JSON») */
export function importMonolithText(store: EditorStore, text: string): string[] {
  return importMonolith(store, parseMonolith(text))
}
