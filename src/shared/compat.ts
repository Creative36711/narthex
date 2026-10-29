/**
 * Совместимость кампаний: инвентаризация пакета, сравнение версий и контракт
 * `compat.json` (`docs/compatibility.md`, фаза B).
 *
 * Идея: мастер не ведёт таблицы совместимости руками. Редактор сравнивает
 * пакет с предыдущей опубликованной версией, сам находит изменения и
 * предлагает `save_base_version`; от автора нужно только подтверждение.
 *
 * Классы изменений (подробно — `docs/compatibility.md`):
 *   S — косметика (названия, описания, оформление);
 *   A — добавление (новые сущности, реестры);
 *   B — правка значений (баланс, пороги) — по умолчанию совместимо;
 *   C — удаление/переименование id — ломает сохранения;
 *   D — смена смысла при том же id — ломает, решается мастером.
 */

import type { CampaignCompat, CampaignMeta, CompatChanges, WorldDef } from './types'
import { bumpVersion, stableVersion } from './versions'

export const COMPAT_FORMAT = 'chronicle-compat/1'
export const INVENTORY_FORMAT = 'chronicle-inventory/1'

/** Словарь видов объектов пакета: что сравниваем и как это назвать по-русски. */
export const CHANGE_KINDS: Record<string, { label: string; cls: 'S' | 'A' | 'B' | 'C' | 'D' }> = {
  region: { label: 'регион', cls: 'C' },
  location: { label: 'локация', cls: 'C' },
  scene: { label: 'сцена', cls: 'C' },
  npc: { label: 'персонаж', cls: 'C' },
  item: { label: 'предмет', cls: 'C' },
  rule: { label: 'правило', cls: 'C' },
  arena: { label: 'арена', cls: 'C' },
  quest: { label: 'квест', cls: 'C' },
  quest_stage: { label: 'стадия квеста', cls: 'C' },
  cutscene: { label: 'катсцена', cls: 'C' },
  recipe: { label: 'рецепт', cls: 'C' },
  codex: { label: 'запись кодекса', cls: 'C' },
  dialogue: { label: 'диалог', cls: 'B' },
  need: { label: 'потребность', cls: 'C' },
  skill: { label: 'навык', cls: 'C' },
  status: { label: 'статус', cls: 'C' },
  ability: { label: 'способность', cls: 'C' },
  equipment_slot: { label: 'слот экипировки', cls: 'C' },
  faction: { label: 'фракция', cls: 'C' },
  currency: { label: 'валюта', cls: 'C' },
  item_category: { label: 'категория предметов', cls: 'C' },
  slot_type: { label: 'тип слота сцены', cls: 'C' },
  flag: { label: 'флаг', cls: 'C' },
  emotion: { label: 'состояние портрета', cls: 'S' },
  weather: { label: 'погода', cls: 'C' },
  overlay_layer: { label: 'слой погоды', cls: 'S' },
  codex_category: { label: 'категория кодекса', cls: 'S' },
  ending: { label: 'концовка', cls: 'C' },
  profession: { label: 'происхождение', cls: 'C' },
  calling: { label: 'призвание', cls: 'C' },
  music_track: { label: 'музыкальный трек', cls: 'S' },
  sound: { label: 'звук', cls: 'S' },
  meta: { label: 'настройки кампании', cls: 'B' },
}

/** Инвентаризация пакета: какие id есть и как выглядят их данные. */
export interface CampaignInventory {
  format: typeof INVENTORY_FORMAT
  /** версия кампании, к которой относится инвентаризация */
  version: string
  /** свёртка всей инвентаризации (см. `digestOf`) */
  digest: string
  /** вид объекта → отсортированные id */
  ids: Record<string, string[]>
  /** «вид:id» → свёртка значимых полей (для класса B) */
  values: Record<string, string>
  /** «вид:id» → название (для человекочитаемого отчёта) */
  labels: Record<string, string>
}

/** Источник инвентаризации: метаданные, мир и все JSON-модули пакета. */
export interface InventorySource {
  meta: CampaignMeta
  world: WorldDef
  /** содержимое файлов пакета: `scenes/x.json` → объект (или id → объект) */
  modules?: Record<string, unknown>
  /** уже разобранные разделы (когда пакет загружен движком, а не прочитан из zip) */
  sections?: {
    scenes?: Record<string, unknown>
    entities?: Record<string, unknown>
    rules?: Record<string, unknown>
    arenas?: Record<string, unknown>
    quests?: Record<string, unknown>
    cutscenes?: Record<string, unknown>
    recipes?: Record<string, unknown>
    codex?: Record<string, unknown>
    dialogues?: Record<string, string>
  }
}

// ─────────────────────────── свёртки ───────────────────────────

/**
 * FNV-1a (32 бит) в hex. Это НЕ криптография: свёртка нужна, чтобы заметить
 * изменение данных и сравнить пакеты между собой.
 */
export function digestOf(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  // второй проход по старшим битам — меньше коллизий на коротких строках
  let g = 0x01000193
  for (let i = text.length - 1; i >= 0; i--) {
    g ^= text.charCodeAt(i)
    g = Math.imul(g, 0x811c9dc5) >>> 0
  }
  return (h >>> 0).toString(16).padStart(8, '0') + (g >>> 0).toString(16).padStart(8, '0')
}

/** Канонический JSON: ключи отсортированы, поэтому перестановка полей не влияет. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** Поля, которые не влияют на сохранения (оформление и тексты) — класс S. */
const COSMETIC_FIELDS = new Set([
  'label',
  'title',
  'description',
  'text',
  'image',
  'background',
  'portrait',
  'portraits',
  'music',
  'ambient',
  'sound',
  'sounds',
  'color',
  'accent',
  'font',
  'fonts',
  'notes',
  'caption',
  'journal_entries',
])

/** Свёртка «значимых» полей объекта: косметика исключена, остальное учитывается. */
export function valueDigest(value: unknown): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (COSMETIC_FIELDS.has(k)) continue
        out[k] = strip(x)
      }
      return out
    }
    return v
  }
  return digestOf(canonical(strip(value)))
}

// ─────────────────────────── инвентаризация ───────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function idOf(v: unknown, fallback: string): string {
  if (isObj(v) && typeof v.id === 'string' && v.id) return v.id
  return fallback
}

function labelOf(v: unknown): string {
  if (isObj(v)) {
    for (const k of ['label', 'title', 'name']) {
      const x = v[k]
      if (typeof x === 'string' && x) return x
    }
  }
  return ''
}

/** Собрать инвентаризацию пакета (из загруженной кампании или из zip). */
export function inventoryOf(source: InventorySource): CampaignInventory {
  const ids: Record<string, string[]> = {}
  const values: Record<string, string> = {}
  const labels: Record<string, string> = {}

  const add = (kind: string, id: string, value: unknown, label?: string) => {
    if (!id) return
    ;(ids[kind] ??= []).push(id)
    values[`${kind}:${id}`] = valueDigest(value)
    const text = label ?? labelOf(value)
    if (text) labels[`${kind}:${id}`] = text
  }

  const meta = source.meta
  // мир: регионы и локации
  const walk = (regions: WorldDef['regions']) => {
    for (const r of regions ?? []) {
      add('region', r.id, r)
      for (const l of r.locations ?? []) add('location', l.id, l)
      if (r.sub_regions) walk(r.sub_regions)
    }
  }
  walk(source.world.regions)

  // реестры campaign.json
  const registry: Array<[string, unknown[] | undefined]> = [
    ['need', meta.needs],
    ['skill', meta.skills],
    ['status', meta.statuses],
    ['ability', meta.abilities],
    ['equipment_slot', meta.equipment_slots],
    ['faction', meta.factions],
    ['currency', meta.currencies],
    ['item_category', meta.item_categories],
    ['slot_type', meta.slot_types],
    ['flag', meta.flags],
    ['emotion', meta.emotions],
    ['weather', meta.weathers],
    ['overlay_layer', meta.overlay_layers],
    ['codex_category', meta.codex_categories],
    ['ending', meta.endings],
    ['music_track', meta.music_tracks],
    ['sound', meta.sounds],
    ['profession', (meta.char_creation as { professions?: unknown[] } | undefined)?.professions],
    ['calling', (meta.char_creation as { callings?: unknown[] } | undefined)?.callings],
  ]
  for (const [kind, list] of registry) {
    for (const entry of list ?? []) {
      if (isObj(entry)) add(kind, idOf(entry, ''), entry)
    }
  }

  // «настройки кампании» целиком (без реестров: они учтены выше)
  const settings: Record<string, unknown> = {}
  const skipMeta = new Set([
    'needs', 'skills', 'statuses', 'abilities', 'equipment_slots', 'factions', 'currencies',
    'item_categories', 'slot_types', 'flags', 'emotions', 'weathers', 'overlay_layers',
    'codex_categories', 'endings', 'music_tracks', 'sounds', 'char_creation', 'version',
    'description', 'title', 'author', 'theme',
  ])
  for (const [k, v] of Object.entries(meta)) if (!skipMeta.has(k)) settings[k] = v
  add('meta', 'campaign', settings, 'Настройки кампании')

  // модули: сцены, сущности, правила, арены, квесты, катсцены, рецепты, кодекс
  const sections = source.sections ?? {}
  const pushSection = (kind: string, dict: Record<string, unknown> | undefined, extra?: (id: string, value: unknown) => void) => {
    for (const [key, value] of Object.entries(dict ?? {})) {
      const id = idOf(value, key)
      add(kind, id, value)
      extra?.(id, value)
    }
  }

  pushSection('scene', sections.scenes)
  pushSection('arena', sections.arenas)
  pushSection('cutscene', sections.cutscenes)
  pushSection('recipe', sections.recipes)
  pushSection('codex', sections.codex)
  pushSection('rule', sections.rules)
  pushSection('quest', sections.quests, (_id, value) => {
    const stages = isObj(value) && Array.isArray(value.stages) ? (value.stages as unknown[]) : []
    for (const st of stages) {
      if (isObj(st)) add('quest_stage', idOf(st, ''), st, `${labelOf(value)}: ${labelOf(st)}`)
    }
  })
  for (const [key, value] of Object.entries(sections.entities ?? {})) {
    const kind = isObj(value) && value.type === 'npc' ? 'npc' : 'item'
    add(kind, idOf(value, key), value)
  }
  for (const [key, ink] of Object.entries(sections.dialogues ?? {})) {
    add('dialogue', key.replace(/\.(ink|dlg\.json)$/, ''), { ink: typeof ink === 'string' ? ink : canonical(ink) })
  }

  // «сырые» модули из zip (когда пакет не загружен движком)
  for (const [path, value] of Object.entries(source.modules ?? {})) {
    const kind = kindFromPath(path)
    if (!kind) continue
    if (kind === 'quest' && isObj(value) && Array.isArray(value.stages)) {
      add('quest', idOf(value, path), value)
      for (const st of value.stages as unknown[]) {
        if (isObj(st)) add('quest_stage', idOf(st, ''), st, `${labelOf(value)}: ${labelOf(st)}`)
      }
      continue
    }
    if (kind === 'npc' || kind === 'item') {
      add(isObj(value) && value.type === 'npc' ? 'npc' : 'item', idOf(value, path), value)
      continue
    }
    add(kind, idOf(value, path), value)
  }

  for (const list of Object.values(ids)) list.sort()
  const digest = digestOf(canonical({ ids, values }))
  return { format: INVENTORY_FORMAT, version: meta.version, digest, ids, values, labels }
}

/** Вид объекта по пути файла в пакете. */
export function kindFromPath(path: string): string | null {
  const p = path.replace(/^\/+/, '')
  if (p.startsWith('scenes/')) return 'scene'
  if (p.startsWith('entities/')) return 'item' // уточняется по полю type
  if (p.startsWith('rules/')) return 'rule'
  if (p.startsWith('arenas/')) return 'arena'
  if (p.startsWith('quests/')) return 'quest'
  if (p.startsWith('cutscenes/')) return 'cutscene'
  if (p.startsWith('recipes/')) return 'recipe'
  if (p.startsWith('codex/')) return 'codex'
  if (p.startsWith('dialogues/') && p.endsWith('.ink')) return 'dialogue'
  return null
}

// ─────────────────────────── сравнение версий ───────────────────────────

export interface DiffEntry {
  kind: string
  op: 'added' | 'removed' | 'changed'
  id: string
  label?: string
  /** класс изменения: S/A/B/C/D */
  cls: 'S' | 'A' | 'B' | 'C' | 'D'
}

export interface CompatDiff {
  from_version: string
  to_version: string
  entries: DiffEntry[]
  changes: CompatChanges
  /** id, из-за которых сохранения ломаются (класс C и отмеченные мастером D) */
  breaks: Array<{ kind: string; id: string; label?: string; impact: string }>
  /** есть ли ломающие изменения */
  breaking: boolean
  summary: string[]
}

/** Последствие для сохранений — текст в отчёте и в `compat.json`. */
const IMPACT_BY_KIND: Record<string, string> = {
  npc: 'Персонаж исчезнет из сцен и отряда, связанные диалоги и квесты могут не сработать',
  item: 'Предмет исчезнет из инвентаря и экипировки героя',
  scene: 'Сцены больше нет — герой окажется в другой сцене локации',
  location: 'Локация исчезнет с карты, дороги к ней будут убраны',
  region: 'Регион удалён — карта мира изменится',
  rule: 'Правило может сработать повторно или перестать работать',
  quest: 'Квест исчезнет из журнала',
  quest_stage: 'Квест вернётся на первую стадию',
  need: 'Шкала потребности исчезнет из интерфейса',
  skill: 'Навык пропадёт у героя и в проверках',
  status: 'Активный статус будет снят',
  ability: 'Способность исчезнет из боя',
  equipment_slot: 'Вещь из этого слота будет снята',
  faction: 'Отношения с фракцией будут сброшены',
  currency: 'Баланс валюты может измениться',
  arena: 'Бои на этой арене станут невозможны',
  recipe: 'Рецепт исчезнет из крафта',
  codex: 'Запись исчезнет из кодекса',
  flag: 'Условия, завязанные на флаг, перестанут срабатывать',
  ending: 'Концовка перестанет подбираться',
  weather: 'Погода будет сброшена',
  profession: 'Происхождение героя будет сброшено',
  calling: 'Призвание героя будет сброшено',
}

function impactOf(kind: string): string {
  return IMPACT_BY_KIND[kind] ?? 'Сохранения, завязанные на этот объект, будут почищены'
}

/** Сравнение двух инвентаризаций: что добавлено, удалено и изменено. */
export function diffInventories(prev: CampaignInventory, next: CampaignInventory, breakingKinds: string[] = []): CompatDiff {
  const entries: DiffEntry[] = []
  const breaking = new Set(breakingKinds)

  const kinds = new Set([...Object.keys(prev.ids), ...Object.keys(next.ids)])
  for (const kind of [...kinds].sort()) {
    const cls = CHANGE_KINDS[kind]?.cls ?? 'B'
    const before = new Set(prev.ids[kind] ?? [])
    const after = new Set(next.ids[kind] ?? [])
    for (const id of [...after].sort()) {
      if (!before.has(id)) entries.push({ kind, op: 'added', id, label: next.labels[`${kind}:${id}`], cls: 'A' })
    }
    for (const id of [...before].sort()) {
      if (!after.has(id)) {
        entries.push({ kind, op: 'removed', id, label: prev.labels[`${kind}:${id}`], cls })
      }
    }
    for (const id of [...before].sort()) {
      if (!after.has(id)) continue
      const a = prev.values[`${kind}:${id}`]
      const b = next.values[`${kind}:${id}`]
      if (a !== b) entries.push({ kind, op: 'changed', id, label: next.labels[`${kind}:${id}`], cls })
    }
  }

  const breaks = entries
    .filter((e) => e.op === 'removed' || breaking.has(`${e.kind}:${e.id}`))
    .map((e) => ({ kind: e.kind, id: e.id, label: e.label, impact: impactOf(e.kind) }))

  const changes: CompatChanges = {
    added: entries.filter((e) => e.op === 'added').length,
    removed: entries.filter((e) => e.op === 'removed').length,
    changed: entries.filter((e) => e.op === 'changed').length,
    details: entries.map(({ kind, op, id, label }) => ({ kind, op, id, label })),
  }

  const summary: string[] = []
  const byKind = (op: DiffEntry['op']) => {
    const grouped = new Map<string, number>()
    for (const e of entries.filter((x) => x.op === op)) grouped.set(e.kind, (grouped.get(e.kind) ?? 0) + 1)
    return [...grouped.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, n]) => `${n} × ${CHANGE_KINDS[kind]?.label ?? kind}`)
  }
  if (changes.added) summary.push(`добавлено: ${byKind('added').join(', ')}`)
  if (changes.changed) summary.push(`изменено: ${byKind('changed').join(', ')}`)
  if (changes.removed) summary.push(`удалено: ${byKind('removed').join(', ')}`)
  if (!summary.length) summary.push('изменений в структуре кампании нет')

  return {
    from_version: prev.version,
    to_version: next.version,
    entries,
    changes,
    breaks,
    breaking: breaks.length > 0,
    summary,
  }
}

/**
 * Какую `save_base_version` записать в контракт.
 * Ломающих изменений нет — поддерживаем прежнюю базу (или всю историю);
 * есть — сохранения поддерживаются только с новой версии.
 */
export function suggestSaveBaseVersion(diff: CompatDiff, previousBase: string | undefined, nextVersion: string): string {
  if (!diff.breaking) return previousBase ?? ''
  return stableVersion(nextVersion)
}

/** Сборка `compat.json` из сравнения. */
export function buildCompat(params: {
  version: string
  diff?: CompatDiff
  inventory: CampaignInventory
  previous?: CampaignCompat | null
  minEngine?: string
  packageFormat?: number
  notes?: string
}): CampaignCompat {
  const { version, diff, inventory, previous, minEngine, packageFormat, notes } = params
  const base = diff
    ? suggestSaveBaseVersion(diff, previous?.save_base_version, version)
    : (previous?.save_base_version ?? '')
  return {
    format: COMPAT_FORMAT,
    version: stableVersion(version),
    save_base_version: base,
    min_engine: minEngine,
    package_format: packageFormat,
    updated_at: new Date().toISOString(),
    inventory_digest: inventory.digest,
    breaks: diff?.breaks ?? [],
    changes: diff?.changes,
    notes: notes ?? previous?.notes,
  }
}

/** Следующая версия кампании по характеру изменений (подсказка мастеру). */
export function suggestNextVersion(current: string, diff: CompatDiff): string {
  if (diff.breaking) return bumpVersion(current, 'major')
  if (diff.changes.added) return bumpVersion(current, 'minor')
  return bumpVersion(current, 'patch')
}

/** Человекочитаемый отчёт по-русски (для модалки редактора и для консоли). */
export function diffReportLines(diff: CompatDiff): string[] {
  const out: string[] = [
    `Сравнение: ${diff.from_version} → ${diff.to_version}`,
    ...diff.summary.map((s) => `· ${s}`),
  ]
  if (diff.breaking) {
    out.push('', 'Ломающие изменения (сохранения до этой версии не поддержатся):')
    for (const b of diff.breaks.slice(0, 40)) {
      out.push(`· ${CHANGE_KINDS[b.kind]?.label ?? b.kind} «${b.label ?? b.id}» — ${b.impact}`)
    }
    if (diff.breaks.length > 40) out.push(`· …и ещё ${diff.breaks.length - 40}`)
  } else {
    out.push('', 'Ломающих изменений нет: сохранения поддерживаются.')
  }
  return out
}
