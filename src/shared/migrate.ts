/**
 * Мягкие миграции формата кампании (итерация 8).
 *
 * Правило проекта: старый контент не ломается. Всё, что меняет форму данных
 * (множественные значения в условиях потребностей, отказ от переходов
 * «в локацию» из сцен), приводится к новому виду на лету — при загрузке
 * пакета движком (`core/loader.ts`) и редактором (`editor/store.ts`).
 */

import type { CampaignMeta, LocationDef, MusicRule, NavigationZone, NeedCondition, SceneDef, WorldDef } from './types'

/**
 * А3: условия потребностей со множественными значениями.
 * Старый формат: `{ type: 'in_location', location: 'x' }` / `{ type: 'has_item', item: 'y' }`.
 * Новый: `locations: [...]` / `items: [...]`.
 */
export function migrateNeedCondition(c: NeedCondition): NeedCondition {
  const any = c as NeedCondition & { location?: string; item?: string; locations?: string[]; items?: string[] }
  switch (any.type) {
    case 'in_location': {
      // уже новый формат — возвращаем тот же объект (без лишнего копирования)
      if (Array.isArray(any.locations)) return c
      const one = any.location ?? (any.locations as unknown as string) ?? ''
      return { type: 'in_location', locations: one ? [one] : [], not: any.not }
    }
    case 'has_item':
    case 'equipped': {
      if (Array.isArray(any.items)) return c
      const one = any.item ?? (any.items as unknown as string) ?? ''
      return { type: any.type, items: one ? [one] : [], not: any.not }
    }
    default:
      return c
  }
}

export function migrateNeedConditions(list: NeedCondition[] | undefined): NeedCondition[] | undefined {
  if (!list) return list
  return list.map(migrateNeedCondition)
}

export function migrateMeta(meta: CampaignMeta): CampaignMeta {
  for (const need of meta.needs ?? []) {
    if (need.decay_when) need.decay_when = migrateNeedConditions(need.decay_when)
    if (need.restore_when) need.restore_when = migrateNeedConditions(need.restore_when)
  }
  return meta
}

/**
 * Блок H: `location.music` старого формата (строка — id трека или ссылка)
 * приводится к списку правил `[{ tracks: [s] }]`.
 */
export function migrateMusicRules(music: string | MusicRule[] | undefined): MusicRule[] | undefined {
  if (music === undefined) return undefined
  if (typeof music === 'string') return music ? [{ tracks: [music] }] : undefined
  return music
}

/**
 * А6: из зон навигации убран тип «в локацию» — между локациями ходим только
 * через глобальную карту. Старые переходы превращаются в «открыть карту»;
 * если.target-локация совпадает с текущей — во внутреннюю сцену.
 */
export function migrateNavigation(scene: SceneDef, world: WorldDef): NavigationZone[] {
  let changed = false
  const out = scene.navigation.map((nav) => {
    const legacy = (nav as NavigationZone & { go_to_location?: string }).go_to_location
    if (!legacy) return nav
    changed = true
    const next: NavigationZone & { go_to_location?: string } = { ...nav }
    delete next.go_to_location
    if (legacy === scene.location) {
      // переход внутри той же локации — это просто другая сцена
      const loc = findLocation(world, legacy)
      const target = loc?.arrival_scene ?? loc?.scenes[0]
      if (target && target !== scene.id) next.go_to_scene = target
      else next.open_map = true
    } else {
      next.open_map = true
    }
    return next
  })
  if (changed) scene.navigation = out
  return out
}

export function findLocation(world: WorldDef, id: string): LocationDef | undefined {
  const walk = (regions: WorldDef['regions']): LocationDef | undefined => {
    for (const r of regions) {
      const l = r.locations.find((x) => x.id === id)
      if (l) return l
      const sub = r.sub_regions ? walk(r.sub_regions) : undefined
      if (sub) return sub
    }
    return undefined
  }
  return walk(world.regions)
}

/** все локации мира плоским списком */
export function allLocations(world: WorldDef): LocationDef[] {
  const out: LocationDef[] = []
  const walk = (regions: WorldDef['regions']) => {
    for (const r of regions) {
      out.push(...r.locations)
      if (r.sub_regions) walk(r.sub_regions)
    }
  }
  walk(world.regions)
  return out
}

/** Полная миграция загруженного пакета (вызывается сразу после чтения JSON). */
export function migrateCampaign(meta: CampaignMeta, world: WorldDef, scenes: Record<string, SceneDef>): void {
  migrateMeta(meta)
  for (const scene of Object.values(scenes)) migrateNavigation(scene, world)
  for (const loc of allLocations(world)) {
    const rules = migrateMusicRules(loc.music)
    if (rules === undefined) delete loc.music
    else loc.music = rules
  }
}
