import type {
  Condition,
  DiceRules,
  EntityDef,
  LocationDef,
  NavigationZone,
  PresenceOverride,
  RegionDef,
  SceneDef,
  SceneStateDef,
  SlotDef,
  TravelConnection,
} from '../shared/types'
import { DEFAULT_DICE_RULES } from '../shared/types'
import { evalCondition, evalSceneCondition } from './conditions'
import type { EngineCtx } from './context'
import { hourOfDay, inTimeRange } from './time'
import { playInteraction, playUi } from '../shared/audio'
import { stopVoiceAudio } from '../shared/voiceAudio'

export interface SlotOccupant {
  slot: SlotDef
  entity: EntityDef | null
}

/** Регионы, сцены, переходы и присутствие NPC в мире кампании. */
export const world = {
  // ─────────────── мир: регионы, локации, сцены ───────────────
  allRegions(ctx: EngineCtx): RegionDef[] {
    const out: RegionDef[] = []
    const walk = (rs: RegionDef[]) => {
      for (const r of rs) {
        out.push(r)
        if (r.sub_regions) walk(r.sub_regions)
      }
    }
    walk(ctx.campaign.world.regions)
    return out
  },

  findRegion(ctx: EngineCtx, id: string): RegionDef | undefined {
    return world.allRegions(ctx).find((r) => r.id === id)
  },

  findLocation(ctx: EngineCtx, id: string): { region: RegionDef; location: LocationDef } | undefined {
    for (const region of world.allRegions(ctx)) {
      const location = region.locations.find((l) => l.id === id)
      if (location) return { region, location }
    }
    return undefined
  },

  currentScene(ctx: EngineCtx): SceneDef {
    return ctx.campaign.scenes[ctx.state.scene]
  },

  /**
  * Сцена, в которую игрок попадает при входе в локацию (итерация 8, А5):
  * arrival_scene локации, если она есть среди её сцен, иначе первая.
  */
  arrivalSceneOf(_ctx: EngineCtx, location: LocationDef): string | undefined {
    const arrival = location.arrival_scene
    if (arrival && location.scenes.includes(arrival)) return arrival
    return location.scenes[0]
  },

  /** Правила бросков d100 этой кампании (итерация 8, А7). */
  diceRules(ctx: EngineCtx): DiceRules {
    return ctx.campaign.meta.dice_rules ?? DEFAULT_DICE_RULES
  },

  /** Активное состояние сцены: первое, чьё условие истинно; иначе первое. */
  activeSceneState(ctx: EngineCtx, scene: SceneDef): SceneStateDef {
    // 1. Приоритет явно переключенному состоянию scene_state:<scene>:<state>
    for (const st of scene.states) {
      if (ctx.state.flags[`scene_state:${scene.id}:${st.id}`]) return st
    }
    // 2. Специфические условия (время суток, флаги, погода)
    for (const st of scene.states) {
      if (st.condition && evalSceneCondition(st.condition, ctx)) return st
    }
    // 3. Базовое состояние (без условий) либо первое в списке
    const base = scene.states.find((st) => !st.condition)
    return base ?? scene.states[0]
  },

  changeSceneState(ctx: EngineCtx, sceneIdOrState: string, maybeState?: string): void {
    const sceneId = maybeState ? sceneIdOrState : ctx.state.scene
    const stateId = maybeState ?? sceneIdOrState
    const sc = ctx.campaign.scenes[sceneId]
    if (sc) {
      for (const st of sc.states) {
        delete ctx.state.flags[`scene_state:${sceneId}:${st.id}`]
      }
      ctx.state.flags[`scene_state:${sceneId}:${stateId}`] = true
      ctx.notify()
    }
  },

  goToSceneFromDialogue(ctx: EngineCtx, sceneId: string, closeDialogue = true): void {
    if (closeDialogue) {
      ctx.endDialogue()
    }
    ctx.goToScene(sceneId, 0)
  },

  startCombatFromDialogue(ctx: EngineCtx, arenaId: string): void {
    const enemyId = ctx.activeNpc?.id || Object.keys(ctx.campaign.entities).find((k) => ctx.campaign.entities[k]?.type === 'npc') || ''
    ctx.endDialogue()
    ctx.startCombat({
      type: 'start_combat',
      arena: arenaId,
      enemies: [{ entity: enemyId, count: 1 }],
      intro: `Бой с ${ctx.activeNpc?.label ?? 'противником'}!`,
    })
  },

  /** Активное «особое место» НПС: первый оверрайд, чей флаг-условие выполнено. */
  activePresenceOverride(ctx: EngineCtx, def: EntityDef): PresenceOverride | undefined {
    if (def.type !== 'npc' || !def.presence_overrides) return undefined
    return def.presence_overrides.find(
      (o) => (!o.flag || !!ctx.state.flags[o.flag]) && (!o.not_flag || !ctx.state.flags[o.not_flag]),
    )
  },

  /**
  * Есть ли у NPC реальное расписание (непустой массив). Пустой `schedule: []`
  * — частый артефакт редактора/ИИ: это «расписания нет», а не «занят всегда
  * где-то ещё». Иначе default_entity в слоте никогда не появляется.
  */
  npcHasSchedule(_ctx: EngineCtx, def: EntityDef): boolean {
    return def.type === 'npc' && Array.isArray(def.schedule) && def.schedule.length > 0
  },

  npcHasPresenceOverrides(_ctx: EngineCtx, def: EntityDef): boolean {
    return def.type === 'npc' && Array.isArray(def.presence_overrides) && def.presence_overrides.length > 0
  },

  /** Занятость слотов с учётом расписаний NPC (ТЗ 4.1: обновление расписания). */
  slotOccupants(ctx: EngineCtx, scene: SceneDef): SlotOccupant[] {
    const hour = hourOfDay(ctx.state.tick, ctx.campaign.meta)
    const out: SlotOccupant[] = []
    for (const slot of scene.slots) {
      if (!evalSceneCondition(slot.condition, ctx)) continue
      let entity: EntityDef | null = null

      // 1. заспавненные эффектами
      const spawned = ctx.state.spawned.find((s) => s.scene === scene.id && s.slot === slot.id)
      if (spawned) entity = ctx.campaign.entities[spawned.entity] ?? null

      // 2. NPC по событиям (важнее расписания) и по расписанию
      if (!entity) {
        for (const def of Object.values(ctx.campaign.entities)) {
          if (def.type !== 'npc' || (!world.npcHasSchedule(ctx, def) && !world.npcHasPresenceOverrides(ctx, def))) continue
          if (ctx.state.dead_entities.includes(def.id)) continue
          if (ctx.state.removed_entities.includes(def.id)) continue
          if (ctx.isInParty(def.id)) continue // напарник ходит с игроком
          const ov = world.activePresenceOverride(ctx, def)
          if (ov) {
            // пока активен флаг события — персонаж только в этом месте
            if (ov.scene === scene.id && ov.slot === slot.id) {
              entity = def
              break
            }
            continue
          }
          const entry = def.schedule?.find(
            (e) => e.scene === scene.id && e.slot === slot.id && inTimeRange(hour, e.time_range),
          )
          if (entry) {
            entity = def
            break
          }
        }
      }

      // 3. default_entity (сущности без расписания и активных событий)
      if (!entity && slot.default_entity) {
        const def = ctx.campaign.entities[slot.default_entity]
        // NPC с непустым расписанием/оверрайдом «живёт» только там — default
        // слот его не дублирует. Пустой schedule[] busyElsewhere НЕ считает.
        const busyElsewhere =
          def?.type === 'npc' && (world.npcHasSchedule(ctx, def) || !!world.activePresenceOverride(ctx, def))
        const gone =
          ctx.state.dead_entities.includes(slot.default_entity) ||
          ctx.state.removed_entities.includes(slot.default_entity) ||
          ctx.isInParty(slot.default_entity)
        if (def && !busyElsewhere && !gone) entity = def
      }

      out.push({ slot, entity })
    }
    return out
  },

  /** Переход между сценами внутри локации (или в сцену другой локации). */
  goToScene(ctx: EngineCtx, sceneId: string, costTicks = 0): void {
    const scene = ctx.campaign.scenes[sceneId]
    if (!scene) return
    stopVoiceAudio()
    if (costTicks > 0) ctx.advanceTicks(costTicks)
    if (ctx.state.game_over) return ctx.notify()
    playInteraction('travel') // «переход по зоне» (H3); тема — ui_sounds travel/scene_transition
    const prevLocation = ctx.state.location
    ctx.state.scene = sceneId
    ctx.state.location = scene.location
    // скрытность: новая сцена — новые глаза; замеченным остаётся только по факту проверки
    if (ctx.state.stealth) ctx.state.stealth.detected = false
    if (ctx.isSneaking()) ctx.detectCheck('смена сцены')
    if (scene.location !== prevLocation) {
      world.onEnterLocation(ctx, scene.location)
    } else {
      ctx.checkRules()
      ctx.autosave()
    }
    ctx.fireTrigger('enter_scene', { sceneId })
    ctx.notify()
  },

  /**
  * Проверка и выполнение перехода по зоне навигации (с поддержкой условий блокировки,
  * сообщений, окликов персонажей и правил-перехватчиков).
  */
  navigate(ctx: EngineCtx, nav: NavigationZone): boolean {
    if (nav.open_map) return false
    // 1. Условия блокировки перехода
    if (nav.conditions && nav.conditions.length > 0) {
      const ok = nav.conditions.every((c: Condition) => evalCondition(c, ctx))
      if (!ok) {
        if (nav.blocked_message) {
          ctx.pushLog(nav.blocked_message)
          ctx.messages.push({ text: nav.blocked_message })
          ctx.notify()
        }
        return false
      }
    }
    // 2. Оклик-диалог перед уходом со сцены
    if (nav.intercept_dialogue) {
      ctx.startDialogue(nav.intercept_dialogue)
      return false
    }
    // 3. Вызов правила-перехватчика
    if (nav.intercept_rule) {
      const fired = ctx.tryFireRule(nav.intercept_rule)
      if (fired) return false
    }
    // 4. Событийный триггер попытки ухода со сцены
    const blocked = ctx.fireTrigger('leave_scene', { sceneId: ctx.state.scene })
    if (blocked) return false

    // 5. Разрешённый переход
    if (nav.go_to_scene) {
      ctx.goToScene(nav.go_to_scene, nav.cost_ticks ?? 0)
      return true
    }
    return false
  },

  /** Путешествие между локациями по travel_connections (ТЗ 4.9). */
  travelTo(ctx: EngineCtx, locationId: string, rollEncounter: (conn: TravelConnection) => void): void {
    if (ctx.isTravelBlockedByOverload()) {
      const load = ctx.currentLoad()
      const max = ctx.maxLoad()
      ctx.messages.push({
        text: `Груз слишком велик (${load.toFixed(1)} кг при лимите ${max.toFixed(1)} кг). Вы не можете отправиться в путь с критическим перегрузом — сбросьте лишние вещи.`,
      })
      ctx.notify()
      return
    }

    const from = world.findLocation(ctx, ctx.state.location)
    const conn = from?.location.travel_connections.find((c) => c.to === locationId)
    const cost = ctx.travelCost(locationId) ?? conn?.cost_ticks ?? 1
    if (ctx.state.blocked_paths.includes(`${ctx.state.location}->${locationId}`)) {
      ctx.messages.push({ text: 'Путь закрыт.' })
      ctx.notify()
      return
    }
    if (conn?.requirements && !conn.requirements.every((c) => evalCondition(c, ctx))) {
      ctx.messages.push({ text: 'Путь закрыт.' })
      ctx.notify()
      return
    }
    if (conn?.depart_sound) playInteraction(conn.depart_sound, { sound: conn.depart_sound }, conn.depart_sound_volume ?? 1)
    else if (conn?.sound) playInteraction(conn.sound, { sound: conn.sound }, conn.sound_volume ?? 1)
    else playUi('travel_depart')
    ctx.advanceTicks(cost)
    ctx.state.stats_run.travels += 1
    if (ctx.state.game_over) return ctx.notify()

    const target = world.findLocation(ctx, locationId)
    if (!target) return
    ctx.state.region = target.region.id
    ctx.state.location = locationId
    const firstScene = world.arrivalSceneOf(ctx, target.location)
    if (firstScene) ctx.state.scene = firstScene
    if (conn?.arrive_sound) playInteraction(conn.arrive_sound, { sound: conn.arrive_sound }, conn.arrive_sound_volume ?? 1)
    else playUi('travel_arrive')
    world.onEnterLocation(ctx, locationId)
    // случайная встреча в пути (после прибытия)
    if (conn && !ctx.state.game_over && !ctx.combat) rollEncounter(conn)
    ctx.notify()
  },

  onEnterLocation(ctx: EngineCtx, locationId: string): void {
    ctx.state.location = locationId
    ctx.runLocationRules(locationId)
    ctx.checkRules()
    ctx.autosave()
  },

  /** Локации региона, доступные/видимые на карте. */
  visibleLocations(ctx: EngineCtx, region: RegionDef): LocationDef[] {
    return region.locations.filter(
      (l) => !l.hidden || ctx.state.revealed_locations.includes(l.id),
    )
  },

  /**
  * Время пути до локации в тиках с учётом штрафов перегруза
  */
  travelCost(ctx: EngineCtx, toLocation: string): number | null {
    const from = world.findLocation(ctx, ctx.state.location)
    const conn = from?.location.travel_connections.find((c) => c.to === toLocation)
    if (!conn) return null
    const baseCost = conn.cost_ticks ?? 1

    const encRules = ctx.campaign.meta.encumbrance
    if (encRules?.enabled === false || encRules?.travel_penalty === false) {
      return baseCost
    }

    const status = ctx.encumbranceStatus()
    if (status === 'critical') {
      return null // заблокировано
    }
    if (status === 'heavy') {
      const mult = encRules?.heavy_travel_multiplier ?? 2.0
      return Math.max(baseCost + 1, Math.round(baseCost * mult))
    }
    if (status === 'light') {
      const mult = encRules?.light_travel_multiplier ?? 1.5
      return Math.max(baseCost + 1, Math.round(baseCost * mult))
    }
    return baseCost
  },

  /**
  * Базовая стоимость пути без учёта штрафа перегруза (для отображения в UI)
  */
  travelBaseCost(ctx: EngineCtx, toLocation: string): number | null {
    const from = world.findLocation(ctx, ctx.state.location)
    const conn = from?.location.travel_connections.find((c) => c.to === toLocation)
    return conn ? (conn.cost_ticks ?? 1) : null
  },
}
