/**
 * Публикация версии кампании из редактора (`docs/compatibility.md`, фаза B).
 *
 * Мастер не заполняет таблицы совместимости: редактор сам сравнивает пакет с
 * предыдущей опубликованной версией (`compat.json`), находит изменения,
 * предлагает новую версию и `save_base_version`. От автора нужны только
 * подтверждение и, при желании, пометка «это изменение ломает сохранения».
 */

import type { EditorStore } from './store'
import type { CampaignCompat } from '../shared/types'
import { COMPAT_FORMAT, buildCompat, diffInventories, inventoryOf, suggestNextVersion, type CampaignInventory, type CompatDiff } from '../shared/compat'
import { ENGINE_VERSION, PACKAGE_FORMAT, stableVersion } from '../shared/versions'

/** `compat.json` предыдущей публикации (если кампания уже публиковалась). */
export async function loadCompat(store: EditorStore): Promise<CampaignCompat | null> {
  try {
    const res = await fetch(`${store.basePath}/compat.json?t=${Date.now()}`)
    if (!res.ok) return null
    const text = await res.text()
    if (text.trim().startsWith('<')) return null // dev-сервер отдал html — файла нет
    const data = JSON.parse(text) as CampaignCompat
    return data && data.format === COMPAT_FORMAT ? data : null
  } catch {
    return null
  }
}

/** Инвентаризация текущего состояния пакета в редакторе. */
export function storeInventory(store: EditorStore): CampaignInventory {
  const byPrefix = (prefix: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [path, value] of store.jsonFiles) {
      if (!path.startsWith(prefix)) continue
      const doc = value as Record<string, unknown>
      out[String(doc.id ?? path)] = value
    }
    return out
  }
  const dialogues: Record<string, string> = {}
  for (const [path, text] of store.textFiles) {
    if (!path.startsWith('dialogues/') || !path.endsWith('.ink')) continue
    dialogues[path.replace(/^dialogues\//, '').replace(/\.ink$/, '')] = text
  }
  return inventoryOf({
    meta: store.meta,
    world: store.world,
    sections: {
      scenes: byPrefix('scenes/'),
      entities: byPrefix('entities/'),
      rules: byPrefix('rules/'),
      arenas: byPrefix('arenas/'),
      quests: byPrefix('quests/'),
      cutscenes: byPrefix('cutscenes/'),
      recipes: byPrefix('recipes/'),
      codex: byPrefix('codex/'),
      dialogues,
    },
  })
}

export interface PublishPlan {
  diff: CompatDiff
  inventory: CampaignInventory
  previous: CampaignCompat | null
  suggestedVersion: string
  suggestedBase: string
  compat: CampaignCompat
}

/** Сравнить пакет с предыдущей публикацией и собрать план обновления. */
export async function planPublish(store: EditorStore, breaking: string[] = []): Promise<PublishPlan> {
  const previous = await loadCompat(store)
  const inventory = storeInventory(store)
  const version = stableVersion(store.meta.version)

  if (!previous) {
    // первой публикации сравнивать не с чем: контракт просто фиксирует базу
    const compat = buildCompat({
      version,
      inventory,
      previous: null,
      minEngine: store.meta.min_engine ?? ENGINE_VERSION,
      packageFormat: PACKAGE_FORMAT,
    })
    return {
      diff: { from_version: '—', to_version: version, entries: [], changes: { added: 0, removed: 0, changed: 0 }, breaks: [], breaking: false, summary: ['первая публикация: сравнивать не с чем'] },
      inventory,
      previous: null,
      suggestedVersion: version,
      suggestedBase: compat.save_base_version,
      compat,
    }
  }

  // инвентаризация предыдущей версии восстанавливается из сохранённых id;
  // подробности (значения полей) берём из текущего пакета — для удалённых
  // объектов важны сами факты наличия, а не их прежнее содержимое
  const prevInventory: CampaignInventory = {
    format: inventory.format,
    version: previous.version,
    digest: previous.inventory_digest,
    ids: previousIds(previous, inventory),
    values: {},
    labels: {},
  }
  const diff = diffInventories(prevInventory, inventory, breaking)
  const suggestedVersion = suggestNextVersion(previous.version, diff)
  const compat = buildCompat({
    version: suggestedVersion,
    diff,
    inventory,
    previous,
    minEngine: store.meta.min_engine ?? ENGINE_VERSION,
    packageFormat: PACKAGE_FORMAT,
  })
  return { diff, inventory, previous, suggestedVersion, suggestedBase: compat.save_base_version, compat }
}

/**
 * `compat.json` хранит только свёртку, поэтому список id предыдущей версии
 * восстанавливается так: текущие id + удалённые из `breaks`. Полное сравнение
 * «поле в поле» доступно в CLI (`scripts/compat-report.mts`) и при импорте
 * старого пакета в редактор.
 */
function previousIds(previous: CampaignCompat, current: CampaignInventory): Record<string, string[]> {
  const ids: Record<string, string[]> = {}
  for (const [kind, list] of Object.entries(current.ids)) ids[kind] = [...list]
  for (const br of previous.breaks ?? []) {
    const list = ids[br.kind] ??= []
    if (!list.includes(br.id)) list.push(br.id)
  }
  for (const list of Object.values(ids)) list.sort()
  return ids
}

/**
 * Записать контракт в пакет и поднять версию кампании.
 * Возвращает пути, которые нужно сохранить на диск.
 */
export function applyPublish(store: EditorStore, plan: PublishPlan, version: string, notes?: string): string[] {
  const compat: CampaignCompat = {
    ...plan.compat,
    version: stableVersion(version),
    notes: notes ?? plan.compat.notes,
    updated_at: new Date().toISOString(),
  }
  store.setJson('compat.json', compat)
  // поля, которые читает рантайм, дублируются в campaign.json: движок не
  // обязан открывать compat.json, чтобы решить судьбу сохранения
  store.meta.version = compat.version
  store.meta.min_engine = compat.min_engine ?? store.meta.min_engine ?? ENGINE_VERSION
  store.meta.package_format = PACKAGE_FORMAT
  if (compat.save_base_version) store.meta.save_base_version = compat.save_base_version
  else delete store.meta.save_base_version
  store.touch('campaign.json')
  return ['compat.json', 'campaign.json']
}
