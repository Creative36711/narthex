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
import { rollDice } from './dice'
import { PRNG } from './prng'
import { skillLabel, type SkillDef } from '../shared/skills'
import type { CampaignMeta, CharCreationDef, NpcDef, StatBlock } from '../shared/types'

export const STAT_KEYS: Array<keyof StatBlock> = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA']

/** источник случайности бросков экрана создания (не привязан к seed забега) */
const screenRng = new PRNG()

/**
 * Бросок одной характеристики по конфигу `char_creation.roll` (аудит §5.6
 * п.5): per_stat переопределяет базовую формулу; результат прижимается к
 * рамкам stat_limits мастера.
 */
export function rollStat(creation: CharCreationDef, stat: string): number {
  const roll = creation.roll
  const notation = roll?.per_stat?.[stat] ?? roll?.notation ?? '3d6'
  const v = rollDice(notation, screenRng)
  const { min, max } = creation.stat_limits
  return Math.min(max, Math.max(min, v))
}

/** Бросок полного набора характеристик (все семь). */
export function rollStatSet(creation: CharCreationDef): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const k of STAT_KEYS) stats[k] = rollStat(creation, k)
  return stats
}

/** выбор игрока на экране создания персонажа */
export interface CharChoice {
  name: string
  /** возраст и биография (если мастер включил choose_age/choose_bio) */
  age?: number
  bio?: string
  stats: Record<string, number>
  /** id профессии (происхождение → характеристики) или '' */
  profession: string
  /** id призвания (шаблон навыков) или '' */
  calling: string
  /** итоговые значения навыков (порог + бонусы происхождения + покупки) */
  skills: Record<string, number>
  /** id выбранного уровня сложности (если мастер задал meta.difficulties) */
  difficulty?: string
  /** id портрета из галереи мастера (char_creation.portraits) */
  portrait?: string
  /** выбор по сегментам портрета (char_creation.portrait_layers): id сегмента → id варианта */
  portrait_layers?: Record<string, string>
}

/**
 * Полный список навыков кампании: ТОЛЬКО реестр кампании (фидбек 19 — навыки
 * это чисто json кампании, никакого хардкода движка). Встроенный словарь
 * используется только для подписей (skillLabel), но не добавляет навыков.
 */
export function allSkillIds(meta: CampaignMeta): Array<{ id: string; label: string }> {
  const reg = (meta.skills ?? []).map((s) => ({ id: s.id, label: s.label || s.id }))
  return reg.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

function prof(creation: CharCreationDef, choice: CharChoice) {
  return creation.professions?.find((p) => p.id === choice.profession)
}

function calling(creation: CharCreationDef, choice: CharChoice) {
  return creation.callings?.find((c) => c.id === choice.calling)
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

/** Подгоняет стартовый шаблон под точный бюджет, сохраняя его приоритеты. */
function allocateExactBudget(
  ids: string[],
  budgetValue: number,
  bases: Record<string, number>,
  desired: Record<string, number>,
  caps: Record<string, number>,
  excluded: Set<string> = new Set(),
): Record<string, number> {
  const budget = Math.max(0, Math.floor(Number.isFinite(budgetValue) ? budgetValue : 0))
  const values: Record<string, number> = {}
  const weights: Record<string, number> = {}
  for (const id of ids) {
    const base = Number.isFinite(bases[id]) ? bases[id] : 0
    values[id] = base
    weights[id] = excluded.has(id) ? 0 : Math.max(0, Math.round(Number.isFinite(desired[id]) ? desired[id] : base) - base)
  }

  let remaining = budget
  while (remaining > 0) {
    const active = ids.filter((id) => values[id] < caps[id])
    if (!active.length) break
    const focused = active.filter((id) => weights[id] > 0)
    const pool = focused.length ? focused : active
    const weightOf = (id: string) => focused.length ? weights[id] : 1
    const totalWeight = pool.reduce((sum, id) => sum + weightOf(id), 0)
    if (!totalWeight) break

    let placed = 0
    const fractions: Array<{ id: string; fraction: number }> = []
    for (const id of pool) {
      const share = remaining * weightOf(id) / totalWeight
      const whole = Math.min(Math.floor(share), Math.max(0, caps[id] - values[id]))
      values[id] += whole
      placed += whole
      if (values[id] < caps[id]) fractions.push({ id, fraction: share - Math.floor(share) })
    }
    remaining -= placed
    if (!remaining) break

    fractions.sort((a, b) => b.fraction - a.fraction || ids.indexOf(a.id) - ids.indexOf(b.id))
    let remainderPlaced = 0
    for (const { id } of fractions) {
      if (!remaining) break
      if (values[id] >= caps[id]) continue
      values[id]++
      remaining--
      remainderPlaced++
    }
    if (!placed && !remainderPlaced) break
  }
  return values
}

function fitStatTemplate(creation: CharCreationDef, target: Record<string, number> | undefined): Record<string, number> {
  const ids = STAT_KEYS.map(String)
  const base = statMin(creation)
  const bases = Object.fromEntries(ids.map((id) => [id, base]))
  const caps = Object.fromEntries(ids.map((id) => [id, Math.max(base, creation.stat_limits.max)]))
  return allocateExactBudget(ids, creation.total_points, bases, target ?? {}, caps)
}

function fitCallingTemplate(
  creation: CharCreationDef,
  choice: CharChoice,
  ids: string[],
  target: Record<string, number>,
): Record<string, number> {
  if (creation.skill_points === undefined) return { ...choice.skills }
  const bases = Object.fromEntries(ids.map((id) => [id, skillMinVal(creation, choice, id)]))
  const defaultCap = Math.max(...Object.values(bases), 0) + Math.max(0, creation.skill_points)
  const caps = Object.fromEntries(ids.map((id) => {
    const base = bases[id]
    const cap = creation.skill_cap ?? defaultCap
    return [id, (creation.forbidden_skills ?? []).includes(id) ? base : Math.max(base, cap)]
  }))
  return allocateExactBudget(ids, creation.skill_points, bases, target, caps, new Set(creation.forbidden_skills ?? []))
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
  const firstCall = creation.callings?.[0]
  const stats: Record<string, number> = {}
  if (creation.roll) {
    // режим кубиков (аудит §5.6 п.5): старт — первый бросок набора
    for (const k of STAT_KEYS) stats[k] = rollStat(creation, k)
  } else {
    Object.assign(stats, fitStatTemplate(creation, first?.stats))
  }
  // список навыков: реестр кампании + навыки шаблона
  const ids = new Set<string>([...allSkillIds(meta).map((s) => s.id), ...Object.keys(template.skills)])
  const choice: CharChoice = {
    name: template.label, stats, profession: first?.id ?? '', calling: firstCall?.id ?? '', skills: {},
    ...(creation.portraits?.[0] ? { portrait: creation.portraits[0].id } : {}),
    ...(creation.portrait_layers?.length ? { portrait_layers: Object.fromEntries(creation.portrait_layers.filter((l) => l.options[0]).map((l) => [l.id, l.options[0].id])) } : {}),
  }
  for (const id of ids) choice.skills[id] = skillMinVal(creation, choice, id)
  return withCalling(creation, choice, choice.calling)
}

/**
 * Сменить призвание: навыки — из распределения мастера (или на нижнем пороге),
 * бонусы происхождения сохраняются. Характеристики не трогает.
 */
export function withCalling(creation: CharCreationDef, choice: CharChoice, callingId: string): CharChoice {
  const next: CharChoice = { ...choice, calling: callingId, skills: { ...choice.skills } }
  const c = calling(creation, next)
  // все навыки из реестра + из шаблона призвания
  const ids = new Set<string>([...Object.keys(next.skills), ...Object.keys(c?.skills ?? {})])
  for (const id of ids) {
    const fromCall = c?.skills?.[id]
    const v = fromCall !== undefined ? fromCall : skillBaseFloor(creation, id)
    next.skills[id] = Math.max(skillMinVal(creation, next, id), Math.round(Number.isFinite(v) ? v : skillMinVal(creation, next, id)))
    const cap = creation.skill_cap
    if (cap !== undefined && next.skills[id] > cap) next.skills[id] = cap
  }
  if (c && creation.skill_points !== undefined) {
    next.skills = fitCallingTemplate(creation, next, [...ids], c.skills)
  }
  return next
}

/**
 * Сменить происхождение: характеристики — из распределения мастера
 * (или на минимум), навыки сохраняют ПОКУПКИ игрока и сдвигаются вместе
 * с бонусами нового происхождения.
 */
export function withProfession(creation: CharCreationDef, choice: CharChoice, profId: string): CharChoice {
  const next: CharChoice = { ...choice, profession: profId, stats: { ...choice.stats }, skills: { ...choice.skills } }
  const p = creation.professions?.find((x) => x.id === profId)
  if (!creation.roll) {
    next.stats = fitStatTemplate(creation, p?.stats)
  }
  // режим кубиков: происхождение не трогает выброшенные характеристики,
  // бонусы к навыкам и снаряжение работают как прежде
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
  if (!creation.roll) {
    // бюджет очков — только в режиме покупки; кубики бюджета не знают
    const statLeft = creation.total_points - statPointsUsed(creation, choice)
    if (statLeft < 0) problems.push(`Бюджет характеристик превышен на ${-statLeft}.`)
  }

  const forbidden = new Set(creation.forbidden_skills ?? [])
  for (const [id, v] of Object.entries(choice.skills)) {
    const floor = skillMinVal(creation, choice, id)
    const cap = creation.skill_cap
    if (forbidden.has(id) && v > skillMinVal(creation, choice, id)) {
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

/** Проверяет исходные AI-шаблоны до их безопасной подгонки на экране создания. */
export function charCreationTemplateFindings(creation: CharCreationDef): string[] {
  const findings: string[] = []
  if (!creation.roll) {
    for (const profession of creation.professions ?? []) {
      const stats = profession.stats ?? {}
      const choice = { stats, skills: {}, profession: profession.id, calling: '', name: '' } as CharChoice
      const used = statPointsUsed(creation, choice)
      if (used !== creation.total_points) {
        const delta = creation.total_points - used
        findings.push(`Происхождение «${profession.label}»: распределено ${used} из ${creation.total_points} очков характеристик (${delta > 0 ? `не хватает ${delta}` : `перерасход ${-delta}`}).`)
      }
    }
  }

  if (creation.skill_points === undefined || !(creation.callings?.length)) return findings
  const professions = creation.professions?.length ? creation.professions : [{ id: '', label: 'без происхождения', skill_bonus: {} }]
  for (const profession of professions) {
    for (const call of creation.callings) {
      let used = 0
      const ids = new Set([...Object.keys(call.skills ?? {}), ...(creation.mandatory_skills ?? []), ...Object.keys(profession.skill_bonus ?? {})])
      for (const id of ids) {
        const floor = skillBaseFloor(creation, id) + (profession.skill_bonus?.[id] ?? 0)
        const target = call.skills?.[id] ?? floor
        const value = Math.max(floor, Math.round(Number.isFinite(target) ? target : floor))
        const capped = creation.skill_cap === undefined ? value : Math.min(creation.skill_cap, value)
        used += Math.max(0, capped - floor)
      }
      if (used !== creation.skill_points) {
        const delta = creation.skill_points - used
        findings.push(`Сочетание «${profession.label}» + «${call.label}»: распределено ${used} из ${creation.skill_points} очков навыков (${delta > 0 ? `не хватает ${delta}` : `перерасход ${-delta}`}); бонусы происхождения не входят в бюджет.`)
      }
    }
  }
  return findings
}

/** производные характеристики от выбранных значений */
export function derivedFromChoice(choice: CharChoice): { hp: number; mp: number } {
  const stats = { ...choice.stats } as unknown as StatBlock
  return { hp: derivedHP(stats), mp: derivedMP(stats) }
}
