import type { DiceRules, SkillDifficulty, StatBlock } from '../shared/types'
import { DEFAULT_DICE_RULES } from '../shared/types'
import type { PRNG } from './prng'
import { d100 } from './dice'

/** BRP Rules Engine (ТЗ 4.3). */

/**
 * Модификатор навыка по сложности мастера (аудит §5.6 п.7):
 * число-порог (50 нейтрально, больше — труднее) или книжный уровень
 * ('easy' ×2, 'normal' ×1, 'difficult' ½, 'impossible' ¼).
 */
export function difficultyModifier(skillValue: number, difficulty: SkillDifficulty): number {
  if (typeof difficulty === 'number') return 50 - difficulty
  const mult = difficulty === 'easy' ? 2 : difficulty === 'difficult' ? 0.5 : difficulty === 'impossible' ? 0.25 : 1
  return Math.round(skillValue * (mult - 1))
}

/** Русское имя книжного уровня сложности (логи и подсказки). */
export function difficultyLabel(d: SkillDifficulty): string {
  if (typeof d === 'number') return `сложность ${d}`
  return { easy: 'лёгкая', normal: 'обычная', difficult: 'трудная', impossible: 'невозможная' }[d]
}

export type CheckResult = 'critical' | 'hard' | 'success' | 'fail' | 'fumble'

export interface SkillCheckOutcome {
  roll: number
  target: number
  result: CheckResult
  success: boolean
}

/**
 * Итерация 8, А7: пороги успеха/провала — настройка кампании (`dice_rules`
 * в campaign.json), а не константа движка. По умолчанию — «щедрые»
 * (крит ≤ навык/5, особый ≤ навык/2, провал 96–100).
 *
 * @param rules правила бросков кампании; `null` — взять умолчания
 *   (для боя и прочих мест, где кампания не передаётся явно)
 */
export function skillCheck(
  skillValue: number,
  rng: PRNG,
  modifier = 0,
  rules: DiceRules | null = null,
): SkillCheckOutcome {
  const r = rules ?? DEFAULT_DICE_RULES
  const critDiv = Math.max(1, r.critical_divisor || DEFAULT_DICE_RULES.critical_divisor)
  const specDiv = Math.max(1, r.special_divisor || DEFAULT_DICE_RULES.special_divisor)
  const fumbleFrom = Math.min(100, Math.max(1, r.fumble_from ?? DEFAULT_DICE_RULES.fumble_from))
  const target = Math.max(0, skillValue + modifier)
  const roll = d100(rng)
  let result: CheckResult
  if (roll === 100) result = 'fumble'
  else if (roll >= fumbleFrom) {
    // классический BRP: при низком навыке весь хвост 96–99 — тоже крит-провал
    const wideFumble = r.fumble_low_skill != null && skillValue < r.fumble_low_skill
    result = wideFumble || target < roll ? 'fumble' : 'fail'
  } else if (roll <= Math.max(1, Math.floor(target / critDiv))) result = 'critical'
  else if (roll <= Math.floor(target / specDiv)) result = 'hard'
  else if (roll <= target) result = 'success'
  else result = 'fail'
  return { roll, target, result, success: result === 'critical' || result === 'hard' || result === 'success' }
}

/** Русские подписи результатов проверки (используются в журнале и справке). */
export const CHECK_RESULT_LABEL: Record<CheckResult, string> = {
  critical: 'критический успех',
  hard: 'уверенный успех',
  success: 'успех',
  fail: 'провал',
  fumble: 'критический провал',
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
