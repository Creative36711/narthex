/**
 * Создание персонажа (блок 11 ТЗ «Гибкий движок»).
 *
 * Хелперы выбора: структура, валидация бюджетов и применение к шаблону
 * `default_player`. Экран выбора живёт в `player/CharacterCreation.tsx`,
 * применение — `GameEngine.applyCharCreation`.
 */
import { derivedHP, derivedMP } from './brp'
import { BUILTIN_SKILL_LABELS } from '../shared/skills'
import type { CampaignMeta, CharCreationDef, NpcDef, StatBlock } from '../shared/types'

export const STAT_KEYS: Array<keyof StatBlock> = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA']

/** выбор игрока на экране создания персонажа */
export interface CharChoice {
  name: string
  stats: Record<string, number>
  /** id профессии или '' */
  profession: string
  /** итоговые значения навыков (база + покупки + бонусы профессии) */
  skills: Record<string, number>
}

/** полный список навыков кампании: реестр + встроенные */
export function allSkillIds(meta: CampaignMeta): Array<{ id: string; label: string }> {
  const reg = (meta.skills ?? []).map((s) => ({ id: s.id, label: s.label || s.id }))
  const regIds = new Set(reg.map((s) => s.id))
  for (const [id, label] of Object.entries(BUILTIN_SKILL_LABELS)) {
    if (!regIds.has(id)) reg.push({ id, label })
  }
  return reg.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

/** стартовый выбор: все характеристики на минимуме, навыки — база шаблона + обязательные 25% */
export function newCharChoice(creation: CharCreationDef, template: NpcDef): CharChoice {
  const stats: Record<string, number> = {}
  for (const k of STAT_KEYS) stats[k] = creation.stat_limits.min
  const skills = { ...template.skills }
  for (const id of creation.mandatory_skills ?? []) skills[id] = Math.max(skills[id] ?? 0, 25)
  return {
    name: template.label,
    stats,
    profession: creation.professions?.[0]?.id ?? '',
    skills,
  }
}

/** потрачено очков характеристик */
export function statPointsUsed(creation: CharCreationDef, choice: CharChoice): number {
  let sum = 0
  for (const k of STAT_KEYS) sum += (choice.stats[k] ?? creation.stat_limits.min) - creation.stat_limits.min
  return sum
}

/** базовая стоимость навыков: что уже оплачено шаблоном и обязательными 25% */
function skillBaseline(creation: CharCreationDef, template: NpcDef): Record<string, number> {
  const base: Record<string, number> = {}
  for (const [id, v] of Object.entries(template.skills)) base[id] = v
  for (const id of creation.mandatory_skills ?? []) base[id] = Math.max(base[id] ?? 0, 25)
  return base
}

/** потрачено очков навыков (сверх базы шаблона и обязательных 25%) */
export function skillPointsUsed(creation: CharCreationDef, template: NpcDef, choice: CharChoice): number {
  const base = skillBaseline(creation, template)
  const bonus = creation.professions?.find((p) => p.id === choice.profession)?.skill_bonus ?? {}
  let used = 0
  for (const [id, v] of Object.entries(choice.skills)) {
    const free = (base[id] ?? 0) + (bonus[id] ?? 0)
    if (v > free) used += v - free
  }
  return used
}

/**
 * Проблемы выбора (по-русски). Пустой список — выбор валиден.
 * Кнопка «Начать забег» активна, только когда проблем нет.
 */
export function charChoiceProblems(creation: CharCreationDef, template: NpcDef, choice: CharChoice): string[] {
  const problems: string[] = []
  const { min, max } = creation.stat_limits

  if (creation.choose_name && !choice.name.trim()) problems.push('Введите имя героя.')
  for (const k of STAT_KEYS) {
    const v = choice.stats[k] ?? min
    if (v < min || v > max) problems.push(`Характеристика ${k} вне рамок ${min}–${max}.`)
  }
  const statLeft = creation.total_points - statPointsUsed(creation, choice)
  if (statLeft > 0) problems.push(`Осталось очков характеристик: ${statLeft} — распределите весь бюджет.`)
  if (statLeft < 0) problems.push('Бюджет характеристик превышен.')

  const forbidden = new Set(creation.forbidden_skills ?? [])
  const base = skillBaseline(creation, template)
  const cap = creation.skill_cap
  for (const [id, v] of Object.entries(choice.skills)) {
    if (forbidden.has(id) && v > (template.skills[id] ?? 0)) problems.push(`Навык «${id}» покупать нельзя.`)
    if (cap !== undefined && v > cap) problems.push(`Навык «${id}» выше предела ${cap}.`)
    const floor = base[id] ?? 0
    if (v < floor) problems.push(`Навык «${id}» нельзя опустить ниже ${floor}.`)
  }
  if (creation.skill_points !== undefined) {
    const skillLeft = creation.skill_points - skillPointsUsed(creation, template, choice)
    if (skillLeft > 0) problems.push(`Осталось очков навыков: ${skillLeft} — потратьте весь бюджет.`)
    if (skillLeft < 0) problems.push('Бюджет навыков превышен.')
  }
  return problems
}

/** производные характеристики от выбранных значений */
export function derivedFromChoice(choice: CharChoice): { hp: number; mp: number } {
  const stats = { ...choice.stats } as unknown as StatBlock
  return { hp: derivedHP(stats), mp: derivedMP(stats) }
}
