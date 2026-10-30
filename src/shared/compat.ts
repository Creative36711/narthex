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

import type { CampaignCompat, CompatChanges } from './types'
import { bumpVersion, stableVersion } from './versions'
import type { CampaignInventory } from './compatInventory'

export {
  INVENTORY_FORMAT,
  canonical,
  digestOf,
  inventoryOf,
  kindFromPath,
  valueDigest,
  type CampaignInventory,
  type InventorySource,
} from './compatInventory'

export const COMPAT_FORMAT = 'chronicle-compat/1'

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
