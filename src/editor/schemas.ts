import type { Condition, Effect } from '../shared/types'

/**
 * Схемы полей условий и эффектов для визуальных конструкторов (ТЗ 5.2.4).
 * kind задаёт редактор поля; ref-виды дают datalist-подсказки из EditorStore.
 */

export type FieldKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'conditions' // вложенный список условий
  | 'effects' // вложенный список эффектов
  | 'json' // произвольный JSON (массивы врагов и т.п.)
  | 'entityRef'
  | 'npcRef'
  | 'itemRef'
  | 'locationRef'
  | 'sceneRef'
  | 'questRef'
  | 'arenaRef'
  | 'ruleRef'
  | 'needRef' // потребность из реестра кампании
  | 'skillRef' // навык из реестра кампании
  | 'dispRef' // фракция или NPC
  | 'timeOfDay' // мультивыбор периодов суток
  | 'units' // список {entity, count} — отряды для боя
  | 'rewardItems' // список {item, quantity}
  | 'flagRef' // флаг из реестра кампании (с созданием нового)
  | 'questStageRef' // стадия квеста из соседнего поля quest
  | 'journalKeyRef' // ключ журнальной записи квеста из соседнего поля quest
  | 'dialogueNodeRef' // узел диалога NPC из соседнего поля entity
  | 'cutsceneRef' // катсцена кампании (итерация 8, блок E)
  | 'statusRef' // статус из реестра кампании (блок 5 ТЗ)
  | 'weatherRef' // погода из реестра кампании (блок 9 ТЗ)
  | 'codexRef' // запись кодекса (блок 10 ТЗ)
  | 'portraitPick' // портрет: из персонажа или своё изображение

export interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  options?: string[] // для select
  optional?: boolean
  placeholder?: string
}

export interface TypeSchema {
  label: string
  fields: FieldSpec[]
  /** заготовка при создании */
  blank: Record<string, unknown>
}

// ─────────────── условия ───────────────

export const CONDITION_SCHEMAS: Record<Condition['type'], TypeSchema> = {
  player_enters_location: {
    label: 'Игрок входит в локацию',
    fields: [{ key: 'location', label: 'Локация', kind: 'locationRef' }],
    blank: { location: '' },
  },
  player_enters_scene: {
    label: 'Игрок входит в сцену',
    fields: [{ key: 'scene', label: 'Сцена', kind: 'sceneRef' }],
    blank: { scene: '' },
  },
  flag_set: {
    label: 'Флаг установлен',
    fields: [{ key: 'flag', label: 'Флаг', kind: 'flagRef' }],
    blank: { flag: '' },
  },
  flag_not_set: {
    label: 'Флаг НЕ установлен',
    fields: [{ key: 'flag', label: 'Флаг', kind: 'flagRef' }],
    blank: { flag: '' },
  },
  variable_compare: {
    label: 'Сравнение переменной',
    fields: [
      { key: 'var', label: 'Переменная', kind: 'string' },
      { key: 'operator', label: 'Оператор', kind: 'select', options: ['==', '!=', '<', '>', '<=', '>='] },
      { key: 'value', label: 'Значение', kind: 'json', placeholder: '0 или "строка"' },
    ],
    blank: { var: '', operator: '==', value: 0 },
  },
  time_of_day: {
    label: 'Время суток',
    fields: [{ key: 'value', label: 'Период(ы)', kind: 'timeOfDay' }],
    blank: { value: ['day'] },
  },
  tick_elapsed: {
    label: 'Прошло тиков (глобально)',
    fields: [{ key: 'min_tick', label: 'Минимальный тик', kind: 'number' }],
    blank: { min_tick: 0 },
  },
  quest_at_stage: {
    label: 'Квест на стадии',
    fields: [
      { key: 'quest', label: 'Квест', kind: 'questRef' },
      { key: 'stage', label: 'Стадия', kind: 'questStageRef' },
    ],
    blank: { quest: '', stage: '' },
  },
  has_item: {
    label: 'Есть предмет',
    fields: [
      { key: 'item', label: 'Предмет', kind: 'itemRef' },
      { key: 'min_quantity', label: 'Мин. количество', kind: 'number', optional: true },
    ],
    blank: { item: '' },
  },
  skill_ge: {
    label: 'Навык ≥',
    fields: [
      { key: 'skill', label: 'Навык', kind: 'skillRef' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { skill: '', threshold: 50 },
  },
  stat_ge: {
    label: 'Характеристика ≥',
    fields: [
      { key: 'stat', label: 'Характеристика', kind: 'string', placeholder: 'POW' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { stat: 'POW', threshold: 10 },
  },
  hp_le: {
    label: 'HP ≤',
    fields: [{ key: 'threshold', label: 'Порог', kind: 'number' }],
    blank: { threshold: 3 },
  },
  hp_ge: {
    label: 'HP ≥',
    fields: [{ key: 'threshold', label: 'Порог', kind: 'number' }],
    blank: { threshold: 1 },
  },
  luck_ge: {
    label: 'Удача ≥',
    fields: [{ key: 'threshold', label: 'Очков удачи', kind: 'number' }],
    blank: { threshold: 1 },
  },
  fatigue_ge: {
    label: 'Усталость ≥',
    fields: [{ key: 'threshold', label: 'Очков усталости', kind: 'number' }],
    blank: { threshold: 1 },
  },
  fatigue_le: {
    label: 'Усталость ≤',
    fields: [{ key: 'threshold', label: 'Очков усталости', kind: 'number' }],
    blank: { threshold: 0 },
  },
  sanity_ge: {
    label: 'Рассудок ≥',
    fields: [{ key: 'threshold', label: 'Очков рассудка', kind: 'number' }],
    blank: { threshold: 50 },
  },
  sanity_le: {
    label: 'Рассудок ≤',
    fields: [{ key: 'threshold', label: 'Очков рассудка', kind: 'number' }],
    blank: { threshold: 25 },
  },
  reputation_ge: {
    label: 'Репутация ≥',
    fields: [{ key: 'threshold', label: 'Порог', kind: 'number' }],
    blank: { threshold: 50 },
  },
  wealth_ge: {
    label: 'Достаток ≥',
    fields: [{ key: 'level', label: 'Уровень (индекс шкалы)', kind: 'number' }],
    blank: { level: 1 },
  },
  passion_ge: {
    label: 'Страсть ≥',
    fields: [
      { key: 'id', label: 'id страсти', kind: 'string' },
      { key: 'value', label: 'Значение', kind: 'number' },
    ],
    blank: { id: '', value: 50 },
  },
  allegiance_ge: {
    label: 'Причастность ≥',
    fields: [
      { key: 'id', label: 'id силы', kind: 'string' },
      { key: 'points', label: 'Очки', kind: 'number' },
    ],
    blank: { id: '', points: 100 },
  },
  power_level_ge: {
    label: 'Уровень мощи кампании ≥',
    fields: [{ key: 'level', label: "normal/heroic/epic/superhuman", kind: 'string', placeholder: 'heroic' }],
    blank: { level: 'heroic' },
  },
  crime_committed: {
    label: 'Преступление совершено',
    fields: [
      { key: 'id', label: 'id преступления (пусто — любое)', kind: 'string', optional: true },
      { key: 'min_bounty', label: 'Мин. награда', kind: 'number', optional: true },
    ],
    blank: {},
  },
  bounty_total_ge: {
    label: 'Награда за голову ≥',
    fields: [{ key: 'threshold', label: 'Порог', kind: 'number' }],
    blank: { threshold: 100 },
  },
  level_ge: {
    label: 'Уровень героя ≥',
    fields: [{ key: 'level', label: 'Уровень', kind: 'number' }],
    blank: { level: 2 },
  },
  has_feat: {
    label: 'Черта взята',
    fields: [{ key: 'id', label: 'id черты', kind: 'string' }],
    blank: { id: '' },
  },
  meta_currency_ge: {
    label: 'Метавалюты ≥',
    fields: [
      { key: 'currency', label: 'id метавалюты', kind: 'string' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { currency: '', threshold: 10 },
  },
  meta_achievement: {
    label: 'Достижение открыто',
    fields: [{ key: 'id', label: 'id достижения', kind: 'string' }],
    blank: { id: '' },
  },
  need_le: {
    label: 'Потребность ≤',
    fields: [
      { key: 'need', label: 'Потребность', kind: 'needRef' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { need: '', threshold: 20 },
  },
  need_ge: {
    label: 'Потребность ≥',
    fields: [
      { key: 'need', label: 'Потребность', kind: 'needRef' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { need: '', threshold: 50 },
  },
  entity_alive: {
    label: 'Сущность жива',
    fields: [{ key: 'entity', label: 'Сущность', kind: 'npcRef' }],
    blank: { entity: '' },
  },
  entity_dead: {
    label: 'Сущность мертва',
    fields: [{ key: 'entity', label: 'Сущность', kind: 'npcRef' }],
    blank: { entity: '' },
  },
  disposition_ge: {
    label: 'Отношение ≥',
    fields: [
      { key: 'target', label: 'Фракция или NPC', kind: 'dispRef' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { target: '', threshold: 0 },
  },
  disposition_le: {
    label: 'Отношение ≤',
    fields: [
      { key: 'target', label: 'Фракция или NPC', kind: 'dispRef' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { target: '', threshold: 0 },
  },
  in_party: {
    label: 'В партии',
    fields: [{ key: 'entity', label: 'NPC', kind: 'npcRef' }],
    blank: { entity: '' },
  },
  random_chance: {
    label: 'Случайный шанс',
    fields: [{ key: 'probability', label: 'Вероятность (0–1)', kind: 'number' }],
    blank: { probability: 0.5 },
  },
  has_status: {
    label: 'У игрока есть статус',
    fields: [{ key: 'status', label: 'Статус', kind: 'statusRef' }],
    blank: { status: '' },
  },
  weather_is: {
    label: 'Погода сейчас',
    fields: [{ key: 'weather', label: 'Погода', kind: 'weatherRef' }],
    blank: { weather: '' },
  },
  and: {
    label: 'И (все)',
    fields: [{ key: 'conditions', label: 'Условия', kind: 'conditions' }],
    blank: { conditions: [] },
  },
  or: {
    label: 'ИЛИ (любое)',
    fields: [{ key: 'conditions', label: 'Условия', kind: 'conditions' }],
    blank: { conditions: [] },
  },
  not: {
    label: 'НЕ',
    fields: [{ key: 'condition', label: 'Условие (JSON)', kind: 'json' }],
    blank: { condition: { type: 'flag_set', flag: '' } },
  },
}

// ─────────────── эффекты ───────────────

export const EFFECT_SCHEMAS: Record<Effect['type'], TypeSchema> = {
  set_flag: {
    label: 'Установить флаг',
    fields: [{ key: 'flag', label: 'Флаг', kind: 'flagRef' }],
    blank: { flag: '' },
  },
  clear_flag: {
    label: 'Снять флаг',
    fields: [{ key: 'flag', label: 'Флаг', kind: 'flagRef' }],
    blank: { flag: '' },
  },
  apply_status: {
    label: 'Наложить статус',
    fields: [
      { key: 'status', label: 'Статус', kind: 'statusRef' },
      { key: 'duration', label: 'Длительность (пусто — из реестра)', kind: 'number', optional: true },
    ],
    blank: { target: 'player', status: '' },
  },
  remove_status: {
    label: 'Снять статус',
    fields: [{ key: 'status', label: 'Статус', kind: 'statusRef' }],
    blank: { target: 'player', status: '' },
  },
  set_weather: {
    label: 'Сменить погоду',
    fields: [{ key: 'weather', label: 'Погода (пусто — ясно)', kind: 'weatherRef' }],
    blank: { weather: '' },
  },
  unlock_codex: {
    label: 'Открыть запись кодекса',
    fields: [{ key: 'entry', label: 'Запись', kind: 'codexRef' }],
    blank: { entry: '' },
  },
  set_variable: {
    label: 'Установить переменную',
    fields: [
      { key: 'var', label: 'Переменная', kind: 'string' },
      { key: 'value', label: 'Значение', kind: 'json', placeholder: '0 или "строка"' },
    ],
    blank: { var: '', value: 0 },
  },
  change_variable: {
    label: 'Изменить переменную',
    fields: [
      { key: 'var', label: 'Переменная', kind: 'string' },
      { key: 'delta', label: 'Дельта', kind: 'number' },
    ],
    blank: { var: '', delta: 1 },
  },
  start_dialogue: {
    label: 'Начать диалог',
    fields: [
      { key: 'entity', label: 'NPC', kind: 'npcRef' },
      { key: 'dialogue_knot', label: 'С какого узла начать', kind: 'dialogueNodeRef', optional: true },
    ],
    blank: { entity: '' },
  },
  start_combat: {
    label: 'Начать бой',
    fields: [
      { key: 'enemies', label: 'Враги', kind: 'units' },
      { key: 'allies', label: 'Союзники (временные)', kind: 'units', optional: true },
      { key: 'arena', label: 'Арена', kind: 'arenaRef' },
      { key: 'intro', label: 'Вступление', kind: 'string', optional: true },
      { key: 'on_victory', label: 'При победе', kind: 'effects', optional: true },
    ],
    blank: { enemies: [], arena: '' },
  },
  teleport_player: {
    label: 'Телепорт игрока',
    fields: [
      { key: 'location', label: 'Локация', kind: 'locationRef' },
      { key: 'scene', label: 'Сцена', kind: 'sceneRef', optional: true },
    ],
    blank: { location: '' },
  },
  change_scene_state: {
    label: 'Сменить состояние сцены',
    fields: [
      { key: 'scene', label: 'Сцена', kind: 'sceneRef' },
      { key: 'state', label: 'Состояние', kind: 'string' },
    ],
    blank: { scene: '', state: '' },
  },
  add_item: {
    label: 'Дать предмет',
    fields: [
      { key: 'item', label: 'Предмет', kind: 'itemRef' },
      { key: 'quantity', label: 'Количество', kind: 'number', optional: true },
    ],
    blank: { item: '' },
  },
  remove_item: {
    label: 'Забрать предмет',
    fields: [
      { key: 'item', label: 'Предмет', kind: 'itemRef' },
      { key: 'quantity', label: 'Количество', kind: 'number', optional: true },
    ],
    blank: { item: '' },
  },
  change_need: {
    label: 'Изменить потребность',
    fields: [
      { key: 'need', label: 'Потребность', kind: 'needRef' },
      { key: 'delta', label: 'Дельта', kind: 'number' },
    ],
    blank: { need: '', delta: 10 },
  },
  change_hp: {
    label: 'Изменить HP',
    fields: [{ key: 'delta', label: 'Дельта', kind: 'number' }],
    blank: { delta: -1 },
  },
  change_skill: {
    label: 'Изменить навык',
    fields: [
      { key: 'skill', label: 'Навык', kind: 'skillRef' },
      { key: 'delta', label: 'Дельта', kind: 'number' },
    ],
    blank: { skill: '', delta: 5 },
  },
  skill_check_gate: {
    label: 'Проверка навыка (ветвление)',
    fields: [
      { key: 'skill', label: 'Навык', kind: 'skillRef' },
      { key: 'difficulty', label: 'Сложность', kind: 'number' },
      { key: 'success_effects', label: 'При успехе', kind: 'effects' },
      { key: 'fail_effects', label: 'При провале', kind: 'effects' },
    ],
    blank: { skill: 'spot', difficulty: 50, success_effects: [], fail_effects: [] },
  },
  change_disposition: {
    label: 'Изменить отношение',
    fields: [
      { key: 'target', label: 'Фракция или NPC', kind: 'dispRef' },
      { key: 'delta', label: 'Дельта', kind: 'number' },
    ],
    blank: { target: '', delta: 10 },
  },
  stat_check: {
    label: 'Проверка характеристики (ветвление)',
    fields: [
      { key: 'stat', label: 'Характеристика', kind: 'string', placeholder: 'POW' },
      { key: 'multiplier', label: 'Множитель (ум. 5)', kind: 'number', optional: true },
      { key: 'modifier', label: 'Модификатор к цели', kind: 'number', optional: true },
      { key: 'augment_passion', label: 'Аугмент: id страсти', kind: 'string', optional: true },
      { key: 'assist_entity', label: 'Подмога: id союзника', kind: 'npcRef', optional: true },
      { key: 'assist_skill', label: 'Навык подмоги', kind: 'skillRef', optional: true },
      { key: 'success_effects', label: 'При успехе', kind: 'effects' },
      { key: 'fail_effects', label: 'При провале', kind: 'effects' },
    ],
    blank: { stat: 'POW', success_effects: [], fail_effects: [] },
  },
  opposed_check: {
    label: 'Противоборство навыком (ветвление)',
    fields: [
      { key: 'skill', label: 'Навык героя', kind: 'skillRef' },
      { key: 'entity', label: 'Оппонент NPC', kind: 'npcRef', optional: true },
      { key: 'against_skill', label: 'Навык оппонента', kind: 'skillRef', optional: true },
      { key: 'against_value', label: 'Или порог навыка', kind: 'number', optional: true },
      { key: 'tie', label: 'При равенстве выигрывает', kind: 'select', options: ['player', 'opponent'], optional: true },
      { key: 'augment_passion', label: 'Аугмент: id страсти', kind: 'string', optional: true },
      { key: 'success_effects', label: 'При победе героя', kind: 'effects' },
      { key: 'fail_effects', label: 'При поражении', kind: 'effects' },
    ],
    blank: { skill: '', success_effects: [], fail_effects: [] },
  },
  change_luck: {
    label: 'Изменить удачу',
    fields: [{ key: 'delta', label: 'Очки удачи (±)', kind: 'number' }],
    blank: { delta: -1 },
  },
  change_fatigue: {
    label: 'Изменить усталость',
    fields: [{ key: 'delta', label: 'Очки усталости (±)', kind: 'number' }],
    blank: { delta: -1 },
  },
  change_sanity: {
    label: 'Изменить рассудок',
    fields: [{ key: 'delta', label: 'Очки рассудка (±)', kind: 'number' }],
    blank: { delta: -5 },
  },
  change_reputation: {
    label: 'Изменить репутацию',
    fields: [{ key: 'delta', label: 'Сдвиг (±)', kind: 'number' }],
    blank: { delta: 5 },
  },
  change_wealth: {
    label: 'Сдвиг достатка',
    fields: [{ key: 'levels', label: 'Ступеней (±)', kind: 'number' }],
    blank: { levels: 1 },
  },
  change_passion: {
    label: 'Изменить страсть',
    fields: [
      { key: 'id', label: 'id страсти', kind: 'string' },
      { key: 'delta', label: 'Сдвиг (±)', kind: 'number' },
    ],
    blank: { id: '', delta: 10 },
  },
  change_allegiance: {
    label: 'Изменить причастность',
    fields: [
      { key: 'id', label: 'id силы', kind: 'string' },
      { key: 'points', label: 'Очки (±)', kind: 'number' },
    ],
    blank: { id: '', points: 1 },
  },
  train_stat: {
    label: 'Тренировка характеристики',
    fields: [
      { key: 'stat', label: 'Характеристика', kind: 'string', placeholder: 'STR' },
      { key: 'delta', label: 'Сдвиг (±)', kind: 'number' },
    ],
    blank: { stat: 'STR', delta: 1 },
  },
  hazard_fall: {
    label: 'Падение (высота → урон)',
    fields: [
      { key: 'meters', label: 'Высота, метров', kind: 'number' },
      { key: 'skill', label: 'Навык смягчения (ум. dodge)', kind: 'skillRef', optional: true },
    ],
    blank: { meters: 10 },
  },
  commit_crime: {
    label: 'Совершить преступление',
    fields: [
      { key: 'id', label: 'id преступления', kind: 'string' },
      { key: 'bounty', label: 'Награда за голову (опц.)', kind: 'number', optional: true },
    ],
    blank: { id: '' },
  },
  set_price_event: {
    label: 'Включить ценовое событие',
    fields: [{ key: 'id', label: 'id события', kind: 'string' }],
    blank: { id: '' },
  },
  clear_price_event: {
    label: 'Снять ценовое событие',
    fields: [{ key: 'id', label: 'id события (пусто — все)', kind: 'string', optional: true }],
    blank: {},
  },
  grant_xp: {
    label: 'Опыт (очки уровней)',
    fields: [{ key: 'points', label: 'Очки опыта', kind: 'number' }],
    blank: { points: 50 },
  },
  grant_feat: {
    label: 'Выдать черту',
    fields: [{ key: 'id', label: 'id черты', kind: 'string' }],
    blank: { id: '' },
  },
  meta_currency: {
    label: 'Метавалюта (между забегами)',
    fields: [
      { key: 'id', label: 'id метавалюты', kind: 'string' },
      { key: 'amount', label: 'Сумма (±)', kind: 'number' },
    ],
    blank: { id: '', amount: 5 },
  },
  start_quest: {
    label: 'Начать квест',
    fields: [{ key: 'quest', label: 'Квест', kind: 'questRef' }],
    blank: { quest: '' },
  },
  advance_quest: {
    label: 'Продвинуть квест',
    fields: [
      { key: 'quest', label: 'Квест', kind: 'questRef' },
      { key: 'stage', label: 'Стадия', kind: 'questStageRef' },
    ],
    blank: { quest: '', stage: '' },
  },
  fail_quest: {
    label: 'Провалить квест',
    fields: [{ key: 'quest', label: 'Квест', kind: 'questRef' }],
    blank: { quest: '' },
  },
  journal_update: {
    label: 'Запись в журнал квеста',
    fields: [
      { key: 'quest', label: 'Квест', kind: 'questRef' },
      { key: 'text_key', label: 'Журнальная запись', kind: 'journalKeyRef' },
    ],
    blank: { quest: '', text_key: '' },
  },
  give_reward: {
    label: 'Награда',
    fields: [{ key: 'items', label: 'Предметы', kind: 'rewardItems', optional: true }],
    blank: { items: [] },
  },
  join_party: {
    label: 'Взять в партию',
    fields: [{ key: 'entity', label: 'NPC', kind: 'npcRef' }],
    blank: { entity: '' },
  },
  leave_party: {
    label: 'Убрать из партии',
    fields: [{ key: 'entity', label: 'NPC', kind: 'npcRef' }],
    blank: { entity: '' },
  },
  block_path: {
    label: 'Заблокировать путь',
    fields: [
      { key: 'from', label: 'Из локации', kind: 'locationRef' },
      { key: 'to', label: 'В локацию', kind: 'locationRef' },
    ],
    blank: { from: '', to: '' },
  },
  unblock_path: {
    label: 'Разблокировать путь',
    fields: [
      { key: 'from', label: 'Из локации', kind: 'locationRef' },
      { key: 'to', label: 'В локацию', kind: 'locationRef' },
    ],
    blank: { from: '', to: '' },
  },
  set_description: {
    label: 'Изменить описание',
    fields: [
      { key: 'entity', label: 'Сущность', kind: 'entityRef' },
      { key: 'text', label: 'Новое описание', kind: 'string' },
    ],
    blank: { entity: '', text: '' },
  },
  show_message: {
    label: 'Показать сообщение',
    fields: [
      { key: 'text', label: 'Текст', kind: 'string' },
      { key: 'portrait', label: 'Портрет', kind: 'portraitPick', optional: true },
    ],
    blank: { text: '' },
  },
  reveal_location: {
    label: 'Открыть локацию',
    fields: [{ key: 'location', label: 'Локация', kind: 'locationRef' }],
    blank: { location: '' },
  },
  advance_time: {
    label: 'Промотать время',
    fields: [{ key: 'ticks', label: 'Тиков', kind: 'number' }],
    blank: { ticks: 1 },
  },
  remove_entity: {
    label: 'Удалить сущность из мира',
    fields: [{ key: 'entity', label: 'Сущность', kind: 'entityRef' }],
    blank: { entity: '' },
  },
  spawn_entity: {
    label: 'Разместить сущность',
    fields: [
      { key: 'entity', label: 'Сущность', kind: 'entityRef' },
      { key: 'scene', label: 'Сцена', kind: 'sceneRef' },
      { key: 'slot', label: 'Слот', kind: 'string' },
    ],
    blank: { entity: '', scene: '', slot: '' },
  },
  game_over_victory: {
    label: 'Победный финал',
    fields: [],
    blank: {},
  },
  game_over_death: {
    label: 'Гибель (конец забега)',
    fields: [{ key: 'reason', label: 'Причина', kind: 'string', optional: true }],
    blank: {},
  },
  play_cutscene: {
    label: 'Показать катсцену',
    fields: [{ key: 'cutscene', label: 'Катсцена', kind: 'cutsceneRef' }],
    blank: { cutscene: '' },
  },
}

/** Источник русских названий по id (реализуется EditorStore). */
export interface LabelSource {
  labelFor(kind: string, id: string): string
  /** название стадии/журнальной записи квеста */
  questStageLabel?(questId: string, key: string): string
}

export const TIME_OF_DAY_LABELS: Record<string, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  night: 'Ночь',
}

const REF_KIND_MAP: Partial<Record<FieldKind, string>> = {
  entityRef: 'entity',
  npcRef: 'npc',
  itemRef: 'item',
  locationRef: 'location',
  sceneRef: 'scene',
  questRef: 'quest',
  arenaRef: 'arena',
  ruleRef: 'rule',
  needRef: 'need',
  skillRef: 'skill',
  dispRef: 'disposition',
  flagRef: 'flag',
  cutsceneRef: 'cutscene',
  statusRef: 'status',
  weatherRef: 'weather',
  codexRef: 'codex',
}

/** Человекочитаемое значение одного поля (русские названия вместо id). */
function fieldValueText(f: FieldSpec, v: unknown, labels?: LabelSource, obj?: Record<string, unknown>): string | null {
  if (v === undefined || v === null || v === '') return null
  if (f.kind === 'questStageRef' || f.kind === 'journalKeyRef') {
    const q = typeof obj?.quest === 'string' ? obj.quest : ''
    return labels?.questStageLabel?.(q, String(v)) ?? String(v)
  }
  const refKind = REF_KIND_MAP[f.kind]
  if (refKind && typeof v === 'string') return labels ? labels.labelFor(refKind, v) : v
  if (f.kind === 'timeOfDay') {
    const arr = Array.isArray(v) ? v : [v]
    if (arr.length === 0) return null
    return arr.map((t) => TIME_OF_DAY_LABELS[String(t)] ?? String(t)).join(', ')
  }
  if (f.kind === 'units') {
    const arr = Array.isArray(v) ? (v as Array<{ entity?: string; count?: number }>) : []
    if (arr.length === 0) return null
    return arr
      .map((u) => `${labels && u.entity ? labels.labelFor('npc', u.entity) : u.entity ?? '?'} ×${u.count ?? 1}`)
      .join(', ')
  }
  if (f.kind === 'rewardItems') {
    const arr = Array.isArray(v) ? (v as Array<{ item?: string; quantity?: number }>) : []
    if (arr.length === 0) return null
    return arr
      .map((u) => `${labels && u.item ? labels.labelFor('item', u.item) : u.item ?? '?'} ×${u.quantity ?? 1}`)
      .join(', ')
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function conditionSummary(c: Condition, labels?: LabelSource): string {
  const s = CONDITION_SCHEMAS[c.type]
  const vals = s
    ? s.fields
        .filter((f) => f.kind !== 'conditions' && f.kind !== 'effects')
        .map((f) => fieldValueText(f, (c as unknown as Record<string, unknown>)[f.key], labels, c as unknown as Record<string, unknown>))
        .filter((v): v is string => v !== null)
        .join(', ')
    : ''
  return `${s?.label ?? c.type}${vals ? `: ${vals}` : ''}`
}

export function effectSummary(e: Effect, labels?: LabelSource): string {
  const s = EFFECT_SCHEMAS[e.type]
  const vals = s
    ? s.fields
        .filter((f) => f.kind !== 'conditions' && f.kind !== 'effects' && f.kind !== 'json')
        .map((f) => fieldValueText(f, (e as unknown as Record<string, unknown>)[f.key], labels, e as unknown as Record<string, unknown>))
        .filter((v): v is string => v !== null)
        .join(', ')
    : ''
  return `${s?.label ?? e.type}${vals ? `: ${vals}` : ''}`
}
