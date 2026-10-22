import type { Condition, SceneCondition, TimeOfDay } from '../shared/types'
import { startTick } from '../shared/types'
import type { GameEngine } from './engine'
import { timeOfDay } from './time'

/** Trigger/Effect System — условия (ТЗ 4.4). */

export function evalCondition(c: Condition, engine: GameEngine): boolean {
  const s = engine.state
  switch (c.type) {
    case 'player_enters_location':
      return s.location === c.location
    case 'player_enters_scene':
      return s.scene === c.scene
    case 'flag_set':
      return !!s.flags[c.flag]
    case 'flag_not_set':
      return !s.flags[c.flag]
    case 'variable_compare': {
      const v = s.variables[c.var] ?? 0
      switch (c.operator) {
        case '==': return v === c.value
        case '!=': return v !== c.value
        case '<': return Number(v) < Number(c.value)
        case '>': return Number(v) > Number(c.value)
        case '<=': return Number(v) <= Number(c.value)
        case '>=': return Number(v) >= Number(c.value)
      }
      return false
    }
    case 'time_of_day': {
      const tod = timeOfDay(s.tick, engine.campaign.meta)
      const vals = Array.isArray(c.value) ? c.value : [c.value]
      return vals.includes(tod)
    }
    case 'tick_elapsed':
      return s.tick >= c.min_tick
    case 'elapsed_ge':
      // семантика «прошло с начала забега»: учитывает ненулевой starting_tick,
      // которого у tick_elapsed (абсолютного) исторически нет; умолчание —
      // как у движка (startTick), иначе день 8:00 считался бы «8 часов прошло»
      return s.tick - startTick(engine.campaign.meta) >= c.min
    case 'quest_at_stage':
      return s.quests[c.quest]?.stage === c.stage
    case 'has_item': {
      const entry = s.player.inventory.find((i) => i.item === c.item)
      return !!entry && entry.quantity >= (c.min_quantity ?? 1)
    }
    case 'equipped':
      return engine.isEquipped(c.item)
    case 'skill_ge':
      return (s.player.skills[c.skill] ?? 0) >= c.threshold
    case 'stat_ge':
      return ((s.player.stats as unknown as Record<string, number>)[c.stat] ?? 0) >= c.threshold
    case 'hp_le':
      return s.player.hp <= c.threshold
    case 'hp_ge':
      return s.player.hp >= c.threshold
    case 'luck_ge':
      return engine.luck() >= c.threshold
    case 'fatigue_ge':
      return engine.fatigue() >= c.threshold
    case 'fatigue_le':
      return engine.fatigue() <= c.threshold
    case 'sanity_ge':
      return engine.sanity() >= c.threshold
    case 'sanity_le':
      return engine.sanity() <= c.threshold
    case 'reputation_ge':
      return engine.reputation() >= c.threshold
    case 'wealth_ge':
      return engine.wealthLevel() >= c.level
    case 'passion_ge':
      return (s.player.passions?.[c.id] ?? 0) >= c.value
    case 'allegiance_ge':
      return (s.player.allegiance?.[c.id] ?? 0) >= c.points
    case 'power_level_ge': {
      const order = ['normal', 'heroic', 'epic', 'superhuman']
      return order.indexOf(engine.campaign.meta.power_level ?? 'normal') >= order.indexOf(c.level)
    }
    case 'need_le':
      return (s.player.needs[c.need] ?? 0) <= c.threshold
    case 'need_ge':
      return (s.player.needs[c.need] ?? 0) >= c.threshold
    case 'entity_alive':
      return !s.dead_entities.includes(c.entity)
    case 'entity_dead':
      return s.dead_entities.includes(c.entity)
    case 'disposition_ge':
      return engine.getDisposition(c.target) >= c.threshold
    case 'disposition_le':
      return engine.getDisposition(c.target) <= c.threshold
    case 'in_party':
      return engine.isInParty(c.entity)
    case 'companion_need_le': {
      const v = engine.companionNeed(c.entity, c.need)
      return v != null && v <= c.threshold
    }
    case 'companion_need_ge': {
      const v = engine.companionNeed(c.entity, c.need)
      return v == null || v >= c.threshold
    }
    case 'has_status':
      return engine.hasStatus(c.status)
    case 'weather_is':
      return (s.weather ?? '') === c.weather
    case 'npc_known': {
      const known = engine.isNpcNameKnown(c.entity)
      return c.known === false ? !known : known
    }
    case 'random_chance':
      return engine.rng.chance(c.probability)
    case 'crime_committed':
      return engine.hasCrime(c.id, c.min_bounty ?? 0)
    case 'bounty_total_ge':
      return engine.bountyTotal() >= c.threshold
    case 'level_ge':
      return engine.level() >= c.level
    case 'meta_currency_ge':
      return engine.metaCurrency(c.currency) >= c.threshold
    case 'meta_achievement':
      return engine.metaAchievementDone(c.id)
    case 'meta_counter':
      return engine.metaCounter(c.key) >= c.ge
    case 'has_feat':
      return (engine.state.player.feats ?? []).includes(c.id)
    case 'and':
      return (c.conditions ?? []).every((x) => evalCondition(x, engine))
    case 'or':
      return (c.conditions ?? []).some((x) => evalCondition(x, engine))
    case 'not':
      return !evalCondition(c.condition, engine)
    default:
      return false
  }
}

/** Простые условия сцен/слотов (time_of_day / flag / not_flag). */
export function evalSceneCondition(c: SceneCondition | null | undefined, engine: GameEngine): boolean {
  if (!c) return true
  if (c.time_of_day) {
    const tod = timeOfDay(engine.state.tick, engine.campaign.meta)
    const vals: TimeOfDay[] = Array.isArray(c.time_of_day) ? c.time_of_day : [c.time_of_day]
    if (!vals.includes(tod)) return false
  }
  if (c.flag && !engine.state.flags[c.flag]) return false
  if (c.not_flag && engine.state.flags[c.not_flag]) return false
  if (c.weather !== undefined && (engine.state.weather ?? '') !== c.weather) return false
  return true
}
