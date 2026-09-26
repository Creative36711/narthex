import type { Condition, SceneCondition, TimeOfDay } from '../shared/types'
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
    case 'quest_at_stage':
      return s.quests[c.quest]?.stage === c.stage
    case 'has_item': {
      const entry = s.player.inventory.find((i) => i.item === c.item)
      return !!entry && entry.quantity >= (c.min_quantity ?? 1)
    }
    case 'skill_ge':
      return (s.player.skills[c.skill] ?? 0) >= c.threshold
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
    case 'has_status':
      return engine.hasStatus(c.status)
    case 'random_chance':
      return engine.rng.chance(c.probability)
    case 'and':
      return c.conditions.every((x) => evalCondition(x, engine))
    case 'or':
      return c.conditions.some((x) => evalCondition(x, engine))
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
  return true
}
