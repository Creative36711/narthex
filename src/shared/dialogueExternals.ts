/**
 * Внешние функции диалогов (ink `EXTERNAL`) — единый источник правды.
 *
 * Две стороны должны знать один и тот же список:
 *  • `core/dialogue.ts` — привязывает функции к Story (реальная логика);
 *  • `editor/dialogueDoc.ts` — генератор ink объявляет `EXTERNAL имя(аргументы)`
 *    для каждой использованной в диалоге функции.
 *
 * Раньше генератор держал свой сокращённый список: ИИ-кампании использовали
 * `get_player_name()`, `get_luck()`, `has_status(…)` — ink не компилировался
 * («Function call target not found»). Теперь подписи общие, а смоук
 * (`ink-import-smoke`) сверяет таблицу с реальными `bind(...)` в движке.
 *
 * Подпись важна только количеством аргументов: ink проверяет её на этапе
 * компиляции. Имена аргументов — для читаемости.
 */

export const DIALOGUE_EXTERNAL_SIGNATURES: Record<string, string> = {
  // предметы и инвентарь
  has_item: '(id)',
  item_count: '(id)',
  add_item: '(id, n)',
  remove_item: '(id, n)',
  // проверки и броски
  skill_check: '(s, d)',
  stat_roll: '(stat, mult)',
  opposed_roll: '(skill, entity)',
  // потребности, здоровье, ресурсы
  get_need: '(id)',
  change_need: '(id, d)',
  change_hp: '(d)',
  get_hp: '()',
  get_hp_max: '()',
  get_mp: '()',
  get_mp_max: '()',
  get_fatigue: '()',
  change_fatigue: '(d)',
  get_sanity: '()',
  change_sanity: '(d)',
  get_luck: '()',
  change_luck: '(d)',
  get_reputation: '()',
  change_reputation: '(d)',
  change_wealth: '(levels)',
  // флаги
  get_flag: '(f)',
  set_flag: '(f)',
  // характеристики и навыки героя
  get_stat: '(s)',
  get_skill: '(s)',
  get_player_name: '()',
  get_run_day: '()',
  get_level: '()',
  get_xp: '()',
  get_currency: '(id)',
  grant_xp: '(n)',
  grant_feat: '(id)',
  train_stat: '(stat, delta)',
  // страсти, привязанности, репутация в мире
  get_passion: '(id)',
  change_passion: '(id, delta)',
  get_allegiance: '(id)',
  change_allegiance: '(id, points)',
  // преступления и цены
  hazard_fall: '(meters, skill)',
  commit_crime: '(id, bounty)',
  get_bounty: '()',
  set_price_event: '(id)',
  clear_price_event: '(id)',
  // мета-прогресс
  meta_currency: '(id, amount)',
  get_meta_currency: '(id)',
  has_meta_achievement: '(id)',
  // генераторы кампании
  roll_table: '(table)',
  gen: '(generator, key)',
  gen_seeded: '(generator, key, seed)',
  // время и правила
  advance_time: '(t)',
  fire_rule: '(id)',
  sleep: '(t)',
  // отношения и партия
  get_disposition: '(t)',
  change_disposition: '(t, d)',
  open_trade: '(id)',
  join_party: '(id)',
  in_party: '(id)',
  set_description: '(id, text)',
  // квесты, катсцены, кодекс, рецепты
  start_quest: '(q)',
  quest_stage: '(q)',
  play_cutscene: '(id)',
  unlock_codex: '(id)',
  unlock_recipe: '(id)',
  // статусы, погода, состояние сущностей
  has_status: '(id)',
  apply_status: '(id, dur)',
  remove_status: '(id)',
  weather_is: '(id)',
  set_weather: '(id)',
  set_entity_state: '(id, st)',
  // «напряжение во времени»: таймер ответа (Уровень 2) и кризис (Уровень 3)
  set_choice_deadline: '(t, to, pick)',
  start_crisis: '(t, label, every)',
  end_crisis: '()',
  extend_crisis: '(t)',
}

/** имена всех внешних функций диалога (порядок — как в таблице) */
export const DIALOGUE_EXTERNAL_NAMES: string[] = Object.keys(DIALOGUE_EXTERNAL_SIGNATURES)

/**
 * Объявления `EXTERNAL` для функций, которые действительно встречаются в тексте.
 * Учатся только на `${имя}(` — имена в таблице не являются префиксами друг
 * друга, поэтому ложных срабатываний нет.
 */
export function externalDeclarations(body: string): string[] {
  return Object.entries(DIALOGUE_EXTERNAL_SIGNATURES)
    .filter(([name]) => body.includes(`${name}(`))
    .map(([name, sig]) => `EXTERNAL ${name}${sig}`)
}
