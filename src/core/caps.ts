export type CapabilityStatus = 'stable' | 'experimental' | 'planned' | 'deprecated' | 'reserved'

export interface CapabilityDefinition {
  id: string
  title: string
  pack: string | null
  status: CapabilityStatus
  since: number
  enables: string
  probe: string | null
}

/** Runtime capability registry. docs/contracts/caps.json is checked against this list. */
export const CAPABILITY_REGISTRY = [
  {"id": "narrative", "title": "Граф сцен, флаги, ветвление", "pack": "narrative", "status": "stable", "since": 2, "enables": "campaign story graph and branching", "probe": "smoke:core"},
  {"id": "scenes", "title": "Сцены и переходы между ними", "pack": "narrative", "status": "stable", "since": 2, "enables": "scene state and navigation", "probe": "smoke:scene-editor"},
  {"id": "dialogue", "title": "Диалоги и ветвящиеся реплики", "pack": "narrative", "status": "stable", "since": 2, "enables": "Ink dialogue and choices", "probe": "smoke:dlg-ui"},
  {"id": "map", "title": "Карта мира и локации", "pack": "narrative", "status": "stable", "since": 2, "enables": "world map and location travel", "probe": "smoke:travel-transition"},
  {"id": "inventory", "title": "Инвентарь и предметы", "pack": "narrative", "status": "stable", "since": 2, "enables": "inventory, equipment, and item use", "probe": "smoke:encumbrance"},
  {"id": "needs", "title": "Потребности и их убывание", "pack": "narrative", "status": "stable", "since": 2, "enables": "tracked needs and their recovery", "probe": "smoke:time-semantics"},
  {"id": "skills", "title": "Навыки и проверки", "pack": "narrative", "status": "stable", "since": 2, "enables": "skill checks and character growth", "probe": "smoke:core"},
  {"id": "relationships", "title": "Отношения с персонажами", "pack": "narrative", "status": "stable", "since": 2, "enables": "NPC relationships and disposition", "probe": "smoke:ai-runtime"},
  {"id": "trade", "title": "Торговля и цены", "pack": "narrative", "status": "stable", "since": 2, "enables": "trading and prices", "probe": "smoke:currency"},
  {"id": "combat", "title": "Пошаговый бой", "pack": "narrative", "status": "stable", "since": 2, "enables": "turn-based combat", "probe": "smoke:core"},
  {"id": "quests", "title": "Квесты и стадии", "pack": "narrative", "status": "stable", "since": 2, "enables": "quest stages and journal", "probe": "smoke:quest-journal-runtime"},
  {"id": "cutscenes", "title": "Катсцены", "pack": "narrative", "status": "stable", "since": 2, "enables": "queued campaign cutscenes", "probe": "smoke:cutscene-queue"},
  {"id": "codex", "title": "Кодекс и бестиарий", "pack": "narrative", "status": "stable", "since": 2, "enables": "codex entries and categories", "probe": "smoke:p2"},
  {"id": "crafting", "title": "Крафт и рецепты", "pack": "narrative", "status": "stable", "since": 2, "enables": "recipes and crafting actions", "probe": "smoke:craft-fail-time"},
  {"id": "time", "title": "Игровое время и календарь", "pack": "narrative", "status": "stable", "since": 2, "enables": "clock, calendar, and elapsed time", "probe": "smoke:time-semantics"},
  {"id": "state-machine", "title": "Пошаговый автомат состояний", "pack": "state-ui", "status": "planned", "since": 3, "enables": "generic state-machine runtime", "probe": null},
  {"id": "cards", "title": "Карты, колоды, эффекты", "pack": "state-ui", "status": "planned", "since": 3, "enables": "card collections and effects", "probe": null},
  {"id": "auto-battle", "title": "Автобатлер и симуляция партии", "pack": "state-ui", "status": "planned", "since": 3, "enables": "automated battle simulation", "probe": null},
  {"id": "turn-validation", "title": "Серверная проверка хода", "pack": "state-ui", "status": "planned", "since": 3, "enables": "authoritative server-side turn validation", "probe": null},
  {"id": "grid", "title": "Сетка и клетки", "pack": "grid-strategy", "status": "planned", "since": 3, "enables": "grid cells and coordinates", "probe": null},
  {"id": "pathfinding", "title": "Поиск пути A*", "pack": "grid-strategy", "status": "planned", "since": 3, "enables": "A-star pathfinding", "probe": null},
  {"id": "units", "title": "Отряды и юниты", "pack": "grid-strategy", "status": "planned", "since": 3, "enables": "tactical units and squads", "probe": null},
  {"id": "economy", "title": "Потоковая экономика", "pack": "grid-strategy", "status": "planned", "since": 3, "enables": "streaming strategy-game economy", "probe": null},
  {"id": "ai-director", "title": "Противник и его логика", "pack": "grid-strategy", "status": "planned", "since": 3, "enables": "opponent and director logic", "probe": null},
  {"id": "realtime-loop", "title": "Цикл реального времени", "pack": "endless-2d", "status": "planned", "since": 4, "enables": "real-time simulation loop", "probe": null},
  {"id": "physics2d", "title": "Твёрдые тела 2D", "pack": "endless-2d", "status": "planned", "since": 4, "enables": "2D rigid-body physics", "probe": null},
  {"id": "procedural-gen", "title": "Процедурная генерация", "pack": "endless-2d", "status": "planned", "since": 4, "enables": "procedural content generation", "probe": null},
  {"id": "mobile-input", "title": "Тач-управление и мобильный экран", "pack": "endless-2d", "status": "planned", "since": 4, "enables": "touch-first mobile input", "probe": null},
  {"id": "spatial3d", "title": "3D-сцена и камера", "pack": "spatial-3d", "status": "planned", "since": 5, "enables": "3D scene and camera", "probe": null},
  {"id": "character-controller", "title": "Контроллер персонажа", "pack": "spatial-3d", "status": "planned", "since": 5, "enables": "3D character movement", "probe": null},
  {"id": "skeletal-animation", "title": "Скелетная анимация", "pack": "spatial-3d", "status": "planned", "since": 5, "enables": "skeletal animation", "probe": null},
  {"id": "triggers", "title": "Триггеры и зоны", "pack": "spatial-3d", "status": "planned", "since": 5, "enables": "3D trigger volumes and zones", "probe": null},
  {"id": "multiplayer-turn", "title": "Асинхронные комнаты", "pack": null, "status": "reserved", "since": 6, "enables": "reserved asynchronous multiplayer sessions", "probe": null},
  {"id": "multiplayer-realtime", "title": "Сессии в реальном времени", "pack": null, "status": "reserved", "since": 6, "enables": "reserved real-time multiplayer sessions", "probe": null},
] as const satisfies readonly CapabilityDefinition[]

const capabilityById: ReadonlyMap<string, CapabilityDefinition> = new Map(
  CAPABILITY_REGISTRY.map((capability) => [capability.id, capability]),
)

// Legacy object profiles kept omitted mechanics enabled; list profiles are explicit caps.
const LEGACY_DEFAULT_CAPS = ['map', 'inventory', 'needs', 'skills', 'relationships', 'trade', 'combat', 'time'] as const
const ENABLED_STATUSES = new Set<CapabilityStatus>(['stable', 'experimental'])

export interface CapabilityProfile {
  caps?: unknown
  features?: unknown
  /** Transient project.json cap_options copied onto runtime meta by the loader. */
  project_cap_options?: unknown
}

/** True only for an explicit project-level off mode; legacy profiles keep prior behavior. */
export function capabilityIsOff(profile: CapabilityProfile, id: string): boolean {
  const options = profile.project_cap_options
  if (!options || typeof options !== 'object' || Array.isArray(options)) return false
  const option = (options as Record<string, unknown>)[id]
  return !!option && typeof option === 'object' && !Array.isArray(option) &&
    (option as Record<string, unknown>).mode === 'off'
}

function assertEnableable(id: string, source: string): CapabilityDefinition {
  const capability = capabilityById.get(id)
  if (!capability) {
    throw new TypeError(`Unknown capability "${id}" in campaign.meta.${source}; check the capability registry.`)
  }
  if (!ENABLED_STATUSES.has(capability.status)) {
    throw new TypeError(`Capability "${id}" cannot be enabled from campaign.meta.${source} (status: ${capability.status}).`)
  }
  return capability
}

function parseCapabilityList(value: unknown, source: string): string[] {
  if (!Array.isArray(value)) {
    const kind = value === null ? 'null' : typeof value
    throw new TypeError(`Invalid campaign.meta.${source}: expected an array of capability ids, received ${kind}.`)
  }
  const result: string[] = []
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new TypeError(`Invalid campaign.meta.${source}: every capability id must be a non-empty string.`)
    }
    assertEnableable(id, source)
    if (!seen.has(id)) {
      result.push(id)
      seen.add(id)
    }
  }
  return result
}

/** Resolve explicit caps, list profiles, or legacy boolean maps without silent fallback. */
export function campaignCaps(meta: CapabilityProfile): string[] {
  if (meta.caps !== undefined) return parseCapabilityList(meta.caps, 'caps')

  const features = meta.features
  if (features === undefined) return [...LEGACY_DEFAULT_CAPS]
  if (Array.isArray(features)) return parseCapabilityList(features, 'features')
  if (features === null || typeof features !== 'object') {
    const kind = features === null ? 'null' : typeof features
    throw new TypeError(`Unsupported campaign.meta.features format: expected string[] or a boolean map, received ${kind}.`)
  }
  const prototype = Object.getPrototypeOf(features)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Unsupported campaign.meta.features format: expected a plain boolean map.')
  }

  const enabled = new Set<string>(LEGACY_DEFAULT_CAPS)
  for (const [id, value] of Object.entries(features)) {
    if (typeof value !== 'boolean') {
      throw new TypeError(`Invalid campaign.meta.features["${id}"]: expected a boolean, received ${value === null ? 'null' : typeof value}.`)
    }
    assertEnableable(id, 'features')
    if (value) enabled.add(id)
    else enabled.delete(id)
  }
  return [...enabled]
}

/** Registry-backed compatibility wrapper for current runtime capability checks. */
export function featureOn(meta: CapabilityProfile, id: string): boolean {
  const capability = capabilityById.get(id)
  if (!capability) throw new TypeError(`Unknown runtime capability "${id}"; check the capability registry.`)
  return ENABLED_STATUSES.has(capability.status) && campaignCaps(meta).includes(id)
}
