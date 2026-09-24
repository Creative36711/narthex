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
  claw: 'Когти',
}

/** название навыка: сначала реестр кампании, затем встроенный словарь, затем id */
export function skillLabel(id: string, campaignSkills?: SkillDef[]): string {
  const fromCampaign = campaignSkills?.find((s) => s.id === id)?.label
  return fromCampaign ?? BUILTIN_SKILL_LABELS[id] ?? id
}
