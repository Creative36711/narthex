/**
 * Реестр навыков. Кампания может объявить собственный список в
 * campaign.json → meta.skills (id + русское название); для стандартных
 * id есть встроенный словарь — чтобы навыки нигде не светились «сырыми» id.
 */

export interface SkillDef {
  id: string
  label: string
}

/** встроенные русские названия стандартных навыков */
export const BUILTIN_SKILL_LABELS: Record<string, string> = {
  sword: 'Мечи',
  axe: 'Топоры',
  spear: 'Копья',
  mace: 'Дробящее',
  dagger: 'Кинжалы',
  bow: 'Луки',
  crossbow: 'Арбалеты',
  throw: 'Метание',
  brawl: 'Кулачный бой',
  shield: 'Щиты',
  dodge: 'Уклонение',
  stealth: 'Скрытность',
  spot: 'Наблюдательность',
  listen: 'Слух',
  search: 'Обыск',
  track: 'Следопытство',
  persuade: 'Убеждение',
  bargain: 'Торговля',
  intimidate: 'Запугивание',
  charm: 'Обаяние',
  deceive: 'Обман',
  etiquette: 'Этикет',
  first_aid: 'Первая помощь',
  medicine: 'Медицина',
  herbalism: 'Травничество',
  athletics: 'Атлетика',
  climb: 'Лазание',
  swim: 'Плавание',
  jump: 'Прыжки',
  ride: 'Верховая езда',
  survival: 'Выживание',
  craft: 'Ремесло',
  repair: 'Починка',
  lore: 'Знания',
  occult: 'Оккультизм',
  navigate: 'Ориентирование',
  sleight: 'Ловкость рук',
  lockpick: 'Взлом',
  bite: 'Укус',
  club: 'Дубины',
  claw: 'Когти',
}

/** канонические обозначения главных характеристик (всегда на латинице: STR, CON, SIZ, DEX, INT, POW, CHA, EDU) */
export const BUILTIN_STAT_LABELS: Record<string, string> = {
  STR: 'STR',
  CON: 'CON',
  SIZ: 'SIZ',
  DEX: 'DEX',
  INT: 'INT',
  POW: 'POW',
  CHA: 'CHA',
  EDU: 'EDU',
}

/** подсказки-расшифровки характеристик для всплывающих подсказок */
export const STAT_HINTS: Record<string, string> = {
  STR: 'Сила',
  CON: 'Телосложение',
  SIZ: 'Размер / Телосложение',
  DEX: 'Ловкость',
  INT: 'Интеллект / Разум',
  POW: 'Сила воли / Мощь',
  CHA: 'Обаяние / Харизма',
  EDU: 'Образование',
}

/** название навыка: сначала реестр кампании, затем встроенный словарь, затем id */
export function skillLabel(id: string, campaignSkills?: SkillDef[]): string {
  const fromCampaign = campaignSkills?.find((s) => s.id === id)?.label
  return fromCampaign ?? BUILTIN_SKILL_LABELS[id] ?? id
}

/** каноническое название характеристики (всегда на латинице: STR, CON, SIZ, DEX, INT, POW, CHA, EDU) */
export function statLabel(id: string): string {
  return BUILTIN_STAT_LABELS[id] ?? id.toUpperCase()
}
