/**
 * Создание персонажа (блок 11 ТЗ «Гибкий движок»).
 *
 * Всё задаёт МАСТЕР КАМПАНИИ — встроенных «происхождений», значений
 * по умолчанию и скрытых порогов в движке нет (правка «без хардкода»):
 *  - пороги характеристик — `stat_limits`;
 *  - пороги навыков — `skill_cap` (сверху) и `skill_floor` (снизу);
 *  - «происхождения» (шаблоны героя) — `professions`, мастер сам решает,
 *    сколько их и какие; каждое может задать стартовые характеристики
 *    (распределение очков бюджета) и бонусы к навыкам;
 *  - игрок выбирает происхождение, затем докручивает очки под себя.
 *
 * Экран выбора — `player/CharacterCreation.tsx`, применение к шаблону —
 * `GameEngine.applyCharCreation`.
 */
import { derivedHP, derivedMP } from './brp'
import { BUILTIN_SKILL_LABELS, skillLabel, type SkillDef } from '../shared/skills'
import type { CampaignMeta, CharCreationDef, NpcDef, StatBlock } from '../shared/types'

export const STAT_KEYS: Array<keyof StatBlock> = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA']

/** выбор игрока на экране создания персонажа */
export interface CharChoice {
  name: string
  stats: Record<string, number>
  /** id профессии или '' */
  profession: string
  /** итоговые значения навыков (порог + бонусы происхождения + покупки) */
  skills: Record<string, number>
}

/** полный список навыков кампании: реестр + встроенные (по алфавиту) */
export function allSkillIds(meta: CampaignMeta): Array<{ id: string; label: string }> {
  const reg = (meta.skills ?? []).map((s) => ({ id: s.id, label: s.label || s.id }))
  const regIds = new Set(reg.map((s) => s.id))
  for (const [id, label] of Object.entries(BUILTIN_SKILL_LABELS)) {
    if (!regIds.has(id)) reg.push({ id, label })
  }
  return reg.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

function prof(creation: CharCreationDef, choice: CharChoice) {
  return creation.professions?.find((p) => p.id === choice.profession)
}

/** нижний порог характеристики (мастер) */
function statMin(creation: CharCreationDef): number {
  return creation.stat_limits.min
}

/** потрачено очков характеристик (сверх минимума) */
export function statPointsUsed(creation: CharCreationDef, choice: CharChoice): number {
  let sum = 0
  for (const k of STAT_KEYS) sum += Math.max(0, (choice.stats[k] ?? statMin(creation)) - statMin(creation))
  return sum
}

/** нижний порог навыка от мастера + обязательные 25% */
export function skillBaseFloor(creation: CharCreationDef, id: string): number {
  const floor = creation.skill_floor ?? 0
  return (creation.mandatory_skills ?? []).includes(id) ? Math.max(floor, 25) : floor
}

/** бесплатный бонус навыка от выбранного происхождения */
export function skillProfBonus(creation: CharCreationDef, choice: CharChoice, id: string): number {
  return prof(creation, choice)?.skill_bonus[id] ?? 0
}

/** ниже этого значения навык опустить нельзя (порог + бонус происхождения) */
export function skillMinVal(creation: CharCreationDef, choice: CharChoice, id: string): number {
  return skillBaseFloor(creation, id) + skillProfBonus(creation, choice, id)
}

/** потрачено очков навыков (только покупки сверх порога и бонусов) */
export function skillPointsUsed(creation: CharCreationDef, choice: CharChoice): number {
  let used = 0
  for (const [id, v] of Object.entries(choice.skills)) {
    used += Math.max(0, v - skillMinVal(creation, choice, id))
  }
  return used
}

/**
 * Стартовый выбор. Если у первого происхождения есть распределение
 * характеристик — берём его (мастер уже распределил очки); иначе все
 * характеристики на минимуме. Навыки стартуют с нижнего порога.
 */
export function newCharChoice(creation: CharCreationDef, template: NpcDef, meta: CampaignMeta): CharChoice {
  const first = creation.professions?.[0]
  const stats: Record<string, number> = {}
  for (const k of STAT_KEYS) {
    const fromProf = first?.stats?.[k]
    const v = fromProf !== undefined ? fromProf : statMin(creation)
    stats[k] = Math.min(creation.stat_limits.max, Math.max(statMin(creation), Math.round(v)))
  }
  // список навыков: реестр кампании + навыки шаблона
  const ids = new Set<string>([...allSkillIds(meta).map((s) => s.id), ...Object.keys(template.skills)])
  const choice: CharChoice = { name: template.label, stats, profession: first?.id ?? '', skills: {} }
  for (const id of ids) choice.skills[id] = skillMinVal(creation, choice, id)
  return choice
}

/**
 * Сменить происхождение: характеристики — из распределения мастера
 * (или на минимум), навыки сохраняют ПОКУПКИ игрока и сдвигаются вместе
 * с бонусами нового происхождения.
 */
export function withProfession(creation: CharCreationDef, choice: CharChoice, profId: string): CharChoice {
  const next: CharChoice = { ...choice, profession: profId, stats: { ...choice.stats }, skills: { ...choice.skills } }
  const p = creation.professions?.find((x) => x.id === profId)
  for (const k of STAT_KEYS) {
    const v = p?.stats?.[k] !== undefined ? p!.stats![k] : statMin(creation)
    next.stats[k] = Math.min(creation.stat_limits.max, Math.max(statMin(creation), Math.round(v)))
  }
  for (const id of Object.keys(next.skills)) {
    const bought = Math.max(0, choice.skills[id] - skillMinVal(creation, choice, id))
    next.skills[id] = skillMinVal(creation, next, id) + bought
    const cap = creation.skill_cap
    if (cap !== undefined && next.skills[id] > cap) next.skills[id] = cap
  }
  return next
}

/**
 * Проблемы выбора (по-русски, с названиями навыков). Пустой список — выбор
 * валиден, кнопку «Начать забег» можно жать.
 */
export function charChoiceProblems(
  creation: CharCreationDef,
  choice: CharChoice,
  skills?: SkillDef[],
): string[] {
  const problems: string[] = []
  const { min, max } = creation.stat_limits
  const label = (id: string) => skillLabel(id, skills)

  if (creation.choose_name && !choice.name.trim()) problems.push('Введите имя героя.')

  for (const k of STAT_KEYS) {
    const v = choice.stats[k] ?? min
    if (v < min || v > max) problems.push(`Характеристика ${k} вне рамок ${min}–${max}.`)
  }
  const statLeft = creation.total_points - statPointsUsed(creation, choice)
  if (statLeft < 0) problems.push(`Бюджет характеристик превышен на ${-statLeft}.`)

  const forbidden = new Set(creation.forbidden_skills ?? [])
  for (const [id, v] of Object.entries(choice.skills)) {
    const floor = skillMinVal(creation, choice, id)
    const cap = creation.skill_cap
    if (forbidden.has(id) && v > skillBaseFloor(creation, id)) {
      problems.push(`Навык «${label(id)}» покупать нельзя.`)
    }
    if (v < floor) problems.push(`Навык «${label(id)}» нельзя опустить ниже ${floor}.`)
    if (cap !== undefined && v > cap) problems.push(`Навык «${label(id)}» выше предела ${cap}.`)
  }
  if (creation.skill_points !== undefined) {
    const skillLeft = creation.skill_points - skillPointsUsed(creation, choice)
    if (skillLeft < 0) problems.push(`Бюджет навыков превышен на ${-skillLeft}.`)
  }
  return problems
}

/** производные характеристики от выбранных значений */
export function derivedFromChoice(choice: CharChoice): { hp: number; mp: number } {
  const stats = { ...choice.stats } as unknown as StatBlock
  return { hp: derivedHP(stats), mp: derivedMP(stats) }
}
