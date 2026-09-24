import type { StatBlock } from '../shared/types'
import type { PRNG } from './prng'
import { d100 } from './dice'

/** BRP Rules Engine (ТЗ 4.3). */

export type CheckResult = 'critical' | 'hard' | 'success' | 'fail' | 'fumble'

export interface SkillCheckOutcome {
  roll: number
  target: number
  result: CheckResult
  success: boolean
}

/** Бросок d100 против навыка. */
export function skillCheck(skillValue: number, rng: PRNG, modifier = 0): SkillCheckOutcome {
  const target = Math.max(0, skillValue + modifier)
  const roll = d100(rng)
  let result: CheckResult
  if (roll >= 96) result = roll === 100 || target < roll ? 'fumble' : 'fail'
  else if (roll <= Math.max(1, Math.floor(target / 20))) result = 'critical'
  else if (roll <= Math.floor(target / 2)) result = 'hard'
  else if (roll <= target) result = 'success'
  else result = 'fail'
  return { roll, target, result, success: result === 'critical' || result === 'hard' || result === 'success' }
}

/** Производные характеристики. */
export function derivedHP(stats: StatBlock): number {
  return Math.ceil((stats.CON + stats.SIZ) / 2)
}

export function derivedMP(stats: StatBlock): number {
  return stats.POW
}

/** Damage Bonus по таблице STR+SIZ (BRP). */
export function damageBonus(stats: StatBlock): string {
  const sum = stats.STR + stats.SIZ
  if (sum <= 12) return '-1d4'
  if (sum <= 16) return '-1d2'
  if (sum <= 24) return '0'
  if (sum <= 32) return '+1d4'
  if (sum <= 40) return '+1d6'
  return '+2d6'
}

/** MOV: базовое движение в гексах за раунд. */
export function movement(stats: StatBlock): number {
  const base = 8
  const bulk = stats.SIZ - (stats.STR + stats.DEX) / 2
  if (bulk > 5) return base - 2
  if (bulk > 2) return base - 1
  return base
}
