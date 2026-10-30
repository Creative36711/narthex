/**
 * Инвентаризация пакета кампании и свёртки данных (`docs/compatibility.md`).
 *
 * Вынесено из `compat.ts`, чтобы модуль сравнения версий оставался в пределах
 * лимита размера: здесь только «что есть в пакете и как оно выглядит», а
 * классификация изменений и контракт `compat.json` — в `compat.ts`.
 */

import type { CampaignMeta, WorldDef } from './types'

export const INVENTORY_FORMAT = 'chronicle-inventory/1'

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
