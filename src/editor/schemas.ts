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
  | 'recipeRef' // рецепт крафта (открытие по ходу игры)
  | 'npcStateRef' // состояние облика НПЦ: его портреты/спрайты + реестр эмоций
  | 'portraitPick' // портрет: из персонажа или своё изображение
  // ── реестры кампании: мастер выбирает по названию и не вводит id руками (фидбек 27) ──
  | 'passionRef' // страсть (meta.passions_list)
  | 'allegianceRef' // сила причастности (meta.allegiances)
  | 'crimeRef' // преступление (meta.crimes)
  | 'featRef' // черта прокачки (meta.progression.feats)
  | 'metaCurrencyRef' // метавалюта хроники (meta.metaprogress.currencies)
  | 'achievementRef' // достижение хроники (meta.metaprogress.achievements)
  | 'priceEventRef' // ценовое событие (meta.price_events)
  | 'eventTableRef' // таблица случайных событий (meta.generators.event_tables)
  | 'generatorRef' // генератор (NPC / сцен / приключений)
  | 'statRef' // характеристика героя (STR … EDU) с русским названием
  | 'sceneStateRef' // состояние выбранной сцены (из соседнего поля scene)
  | 'sceneSlotRef' // слот выбранной сцены (из соседнего поля scene)
  | 'color' // цвет: палитра вместо ввода HEX руками
  | 'imagePath' // картинка кампании: загрузка файла/ссылка вместо ввода пути руками
  | 'longtext' // длинный текст: многострочное поле

export interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  options?: string[] // для select
  /** русские подписи опций select (значение → название); без записи показывается само значение */
  optionLabels?: Record<string, string>
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

/**
 * Вид поля → реестр `store.options(kind)`: выпадающий список с названиями.
 * Вынесено из Fields.tsx, чтобы тест мог проверить покрытие без React.
 */
export const REF_KINDS = {
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
  cutsceneRef: 'cutscene',
  statusRef: 'status',
  weatherRef: 'weather',
  codexRef: 'codex',
  passionRef: 'passion',
  allegianceRef: 'allegiance',
  crimeRef: 'crime',
  featRef: 'feat',
  metaCurrencyRef: 'metaCurrency',
  achievementRef: 'achievement',
  priceEventRef: 'priceEvent',
  eventTableRef: 'eventTable',
  generatorRef: 'generator',
  statRef: 'stat',
} as const

/** виды, у которых в Field.tsx своя ветка (не через REF_KINDS) */
export const SPECIAL_KINDS: FieldKind[] = [
  'string', 'number', 'boolean', 'select', 'conditions', 'effects', 'json', 'timeOfDay', 'units', 'rewardItems',
  'flagRef', 'questStageRef', 'journalKeyRef', 'dialogueNodeRef', 'recipeRef', 'npcStateRef', 'portraitPick',
  'sceneStateRef', 'sceneSlotRef', 'color', 'imagePath', 'longtext',
]

/** русские названия уровней мощи кампании (как в «Механики» → мощь) */
export const POWER_LEVEL_LABELS: Record<string, string> = {
  normal: 'Обычный',
  heroic: 'Героический',
  epic: 'Эпический',
  superhuman: 'Сверхчеловеческий',
}

/** наряды баннера/открытки: значение (русское слово из движка) → пояснение */
export const BANNER_PRESET_LABELS: Record<string, string> = {
  глава: 'глава — титульный шрифт, затухает в конце',
  шёпот: 'шёпот — курсив, бледно',
  заголовок: 'заголовок — жирный, с акцентной лентой',
  проклятье: 'проклятье — красная дымчатая вена',
  записочный: 'записочный — листок, наклонно',
}

/** появление баннера */
export const BANNER_ENTER_LABELS: Record<string, string> = {
  всплеск: 'всплеск',
  тянуть: 'плавно тянуть',
  сбоку: 'выезжает сбоку',
  молниеносно: 'молниеносно',
}

/** русские названия счётчиков хроники для условия meta_counter */
export const META_COUNTER_LABELS: Record<string, string> = {
  endings_seen: 'Увидено разных концовок',
  runs: 'Начато забегов',
  deaths: 'Смертей героя',
  victories: 'Побед',
  kills: 'Убийств в бою',
  quests_completed: 'Завершённых квестов',
  ticks_survived: 'Прожитых минут',
  travels: 'Переходов между сценами',
  dialogues: 'Начатых разговоров',
}

/** ключи счётчиков хроники, которые читает условие meta_counter */
export const META_COUNTER_KEYS = [
  'endings_seen',
  'runs',
  'deaths',
  'victories',
  'kills',
  'quests_completed',
  'ticks_survived',
  'travels',
  'dialogues',
]

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
      { key: 'stat', label: 'Характеристика', kind: 'statRef' },
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
      { key: 'id', label: 'Страсть', kind: 'passionRef' },
      { key: 'value', label: 'Значение', kind: 'number' },
    ],
    blank: { id: '', value: 50 },
  },
  allegiance_ge: {
    label: 'Причастность ≥',
    fields: [
      { key: 'id', label: 'Сила причастности', kind: 'allegianceRef' },
      { key: 'points', label: 'Очки', kind: 'number' },
    ],
    blank: { id: '', points: 100 },
  },
  power_level_ge: {
    label: 'Уровень мощи кампании ≥',
    fields: [{ key: 'level', label: 'Уровень мощи', kind: 'select', options: ['normal', 'heroic', 'epic', 'superhuman'], optionLabels: POWER_LEVEL_LABELS }],
    blank: { level: 'heroic' },
  },
  crime_committed: {
    label: 'Преступление совершено',
    fields: [
      { key: 'id', label: 'Преступление (пусто — любое)', kind: 'crimeRef', optional: true },
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
    fields: [{ key: 'id', label: 'Черта', kind: 'featRef' }],
    blank: { id: '' },
  },
  meta_currency_ge: {
    label: 'Метавалюты ≥',
    fields: [
      { key: 'currency', label: 'Метавалюта', kind: 'metaCurrencyRef' },
      { key: 'threshold', label: 'Порог', kind: 'number' },
    ],
    blank: { currency: '', threshold: 10 },
  },
  meta_achievement: {
    label: 'Достижение открыто',
    fields: [{ key: 'id', label: 'Достижение', kind: 'achievementRef' }],
    blank: { id: '' },
  },
  meta_counter: {
    label: 'Счётчик хроники ≥',
    fields: [
      { key: 'key', label: 'Счётчик', kind: 'select', options: META_COUNTER_KEYS, optionLabels: META_COUNTER_LABELS },
      { key: 'ge', label: 'Не меньше', kind: 'number' },
    ],
    blank: { key: 'endings_seen', ge: 2 },
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
  banner: {
    label: 'Большая надпись на экране (баннер)',
    fields: [
      { key: 'text', label: 'Текст надписи', kind: 'string' },
      { key: 'preset', label: 'Наряд надписи', kind: 'select', options: ['глава', 'шёпот', 'заголовок', 'проклятье', 'записочный'], optionLabels: BANNER_PRESET_LABELS, optional: true },
      { key: 'enter', label: 'Появление', kind: 'select', options: ['всплеск', 'тянуть', 'сбоку', 'молниеносно'], optionLabels: BANNER_ENTER_LABELS, optional: true },
      { key: 'seconds', label: 'Секунд на экране (пусто — по длине текста)', kind: 'number', optional: true },
      { key: 'position', label: 'Положение на экране', kind: 'select', options: ['верх', 'центр'], optionLabels: { верх: 'Вверху экрана', центр: 'По центру' }, optional: true },
      { key: 'accent', label: 'Цвет надписи (пусто — цвет наряда)', kind: 'color', optional: true },
    ],
    blank: { text: '', preset: 'глава' },
  },
  postcard: {
    label: '«Открытка»: иллюстрация на весь экран с подписью',
    fields: [
      { key: 'image', label: 'Картинка открытки', kind: 'imagePath', optional: true },
      { key: 'text', label: 'Подпись', kind: 'string', optional: true },
      { key: 'preset', label: 'Наряд подписи', kind: 'select', options: ['глава', 'шёпот', 'заголовок', 'проклятье', 'записочный'], optionLabels: BANNER_PRESET_LABELS, optional: true },
      { key: 'seconds', label: 'Секунд показа (0 — только по тапу)', kind: 'number', optional: true },
    ],
    blank: { seconds: 6 },
  },
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
  unlock_recipe: {
    label: 'Открыть рецепт крафта',
    fields: [{ key: 'recipe', label: 'Рецепт', kind: 'recipeRef' }],
    blank: { recipe: '' },
  },
  set_entity_state: {
    label: 'Сменить состояние облика (эмоцию)',
    fields: [
      { key: 'entity', label: 'Персонаж', kind: 'npcRef' },
      { key: 'state', label: 'Состояние', kind: 'npcStateRef' },
    ],
    blank: { entity: '', state: '' },
  },
  fire_rule: {
    label: 'Вызвать правило',
    fields: [
      { key: 'rule', label: 'Правило', kind: 'ruleRef' },
    ],
    blank: { rule: '' },
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
      { key: 'state', label: 'Состояние сцены', kind: 'sceneStateRef' },
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
      { key: 'stat', label: 'Характеристика', kind: 'statRef' },
      { key: 'multiplier', label: 'Множитель (ум. 5)', kind: 'number', optional: true },
      { key: 'modifier', label: 'Модификатор к цели', kind: 'number', optional: true },
      { key: 'augment_passion', label: 'Аугмент: страсть', kind: 'passionRef', optional: true },
      { key: 'assist_entity', label: 'Подмога: союзник', kind: 'npcRef', optional: true },
      { key: 'assist_skill', label: 'Навык подмоги', kind: 'skillRef', optional: true },
      { key: 'success_effects', label: 'При успехе', kind: 'effects' },
      { key: 'fail_effects', label: 'При провале', kind: 'effects' },
    ],
    blank: { stat: 'POW', success_effects: [], fail_effects: [] },
  },
  start_pursuit: {
    label: 'Начать преследование героя',
    fields: [
      { key: 'label', label: 'Кто гонится (подпись в журнале)', kind: 'string', placeholder: 'Сторожа барона', optional: true },
      { key: 'skill', label: 'Навык маскировки (ум. stealth)', kind: 'skillRef', optional: true },
      { key: 'every_ticks', label: 'Проверка каждые N тиков (ум. 4)', kind: 'number', optional: true },
      { key: 'fails_to_catch', label: 'Провалов до облавы (ум. 1)', kind: 'number', optional: true },
      { key: 'on_fail', label: 'Когда настигли (обычно «Начать бой»)', kind: 'effects' },
    ],
    blank: { skill: 'stealth', every_ticks: 4, fails_to_catch: 1, on_fail: [] },
  },
  stop_pursuit: {
    label: 'Преследование окончено (оторвались)',
    fields: [],
    blank: {},
  },
  group_stat_check: {
    label: 'Групповая сцепленная проверка (герой + союзники)',
    fields: [
      { key: 'mode', label: 'Чем бросаем', kind: 'select', options: ['skill', 'stat'], optionLabels: { skill: 'Навыком', stat: 'Характеристикой' }, optional: true },
      { key: 'skill', label: 'Навык (mode=skill)', kind: 'skillRef', optional: true },
      { key: 'stat', label: 'Характеристика (если бросаем характеристикой)', kind: 'statRef', optional: true },
      { key: 'multiplier', label: 'Множитель хар-ки (ум. 5)', kind: 'number', optional: true },
      { key: 'difficulty', label: 'Сложность навыка', kind: 'number', optional: true },
      { key: 'modifier', label: 'Модификатор (stat)', kind: 'number', optional: true },
      { key: 'helpers', label: 'Союзников в цепочке (ум. 2)', kind: 'number', optional: true },
      { key: 'need', label: 'Нужно успехов (ум. большинство)', kind: 'number', optional: true },
      { key: 'success_effects', label: 'Цепочка выдержала', kind: 'effects' },
      { key: 'fail_effects', label: 'Цепочка порвалась', kind: 'effects' },
    ],
    blank: { mode: 'skill', skill: 'stealth', helpers: 2, success_effects: [], fail_effects: [] },
  },
  opposed_check: {
    label: 'Противоборство навыком (ветвление)',
    fields: [
      { key: 'skill', label: 'Навык героя', kind: 'skillRef' },
      { key: 'entity', label: 'Оппонент NPC', kind: 'npcRef', optional: true },
      { key: 'against_skill', label: 'Навык оппонента', kind: 'skillRef', optional: true },
      { key: 'against_value', label: 'Или порог навыка', kind: 'number', optional: true },
      { key: 'tie', label: 'При равенстве выигрывает', kind: 'select', options: ['player', 'opponent'], optionLabels: { player: 'Герой', opponent: 'Соперник' }, optional: true },
      { key: 'augment_passion', label: 'Аугмент: страсть', kind: 'passionRef', optional: true },
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
      { key: 'id', label: 'Страсть', kind: 'passionRef' },
      { key: 'delta', label: 'Сдвиг (±)', kind: 'number' },
    ],
    blank: { id: '', delta: 10 },
  },
  change_allegiance: {
    label: 'Изменить причастность',
    fields: [
      { key: 'id', label: 'Сила причастности', kind: 'allegianceRef' },
      { key: 'points', label: 'Очки (±)', kind: 'number' },
    ],
    blank: { id: '', points: 1 },
  },
  train_stat: {
    label: 'Тренировка характеристики',
    fields: [
      { key: 'stat', label: 'Характеристика', kind: 'statRef' },
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
      { key: 'id', label: 'Преступление', kind: 'crimeRef' },
      { key: 'bounty', label: 'Награда за голову (опц.)', kind: 'number', optional: true },
    ],
    blank: { id: '' },
  },
  set_price_event: {
    label: 'Включить ценовое событие',
    fields: [{ key: 'id', label: 'Ценовое событие', kind: 'priceEventRef' }],
    blank: { id: '' },
  },
  clear_price_event: {
    label: 'Снять ценовое событие',
    fields: [{ key: 'id', label: 'Ценовое событие (пусто — все)', kind: 'priceEventRef', optional: true }],
    blank: {},
  },
  grant_xp: {
    label: 'Опыт (очки уровней)',
    fields: [{ key: 'points', label: 'Очки опыта', kind: 'number' }],
    blank: { points: 50 },
  },
  grant_feat: {
    label: 'Выдать черту',
    fields: [{ key: 'id', label: 'Черта', kind: 'featRef' }],
    blank: { id: '' },
  },
  meta_currency: {
    label: 'Метавалюта (между забегами)',
    fields: [
      { key: 'id', label: 'Метавалюта', kind: 'metaCurrencyRef' },
      { key: 'amount', label: 'Сумма (±)', kind: 'number' },
    ],
    blank: { id: '', amount: 5 },
  },
  roll_event_table: {
    label: 'Событие из таблицы (сейчас)',
    fields: [
      { key: 'table', label: 'Таблица событий', kind: 'eventTableRef' },
      { key: 'ignore_filters', label: 'Игнорировать фильтры (время/локация)', kind: 'boolean', optional: true },
    ],
    blank: { table: '' },
  },
  generate_variables: {
    label: 'Генерация переменных (списки)',
    fields: [
      { key: 'generator', label: 'Генератор', kind: 'generatorRef' },
      { key: 'seed', label: 'seed (стабильность)', kind: 'string', optional: true },
      { key: 'pack', label: 'Пакет ключей', kind: 'json' },
    ],
    blank: { generator: '', pack: [] },
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
      { key: 'text', label: 'Новое описание', kind: 'longtext' },
    ],
    blank: { entity: '', text: '' },
  },
  show_message: {
    label: 'Показать сообщение',
    fields: [
      { key: 'text', label: 'Текст сообщения', kind: 'longtext' },
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
      { key: 'slot', label: 'Слот сцены', kind: 'sceneSlotRef' },
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
  /** название состояния или слота сцены (по id сцены) */
  sceneSubLabel?(sceneId: string, mode: 'state' | 'slot', id: string): string
}

export const TIME_OF_DAY_LABELS: Record<string, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  night: 'Ночь',
}

const REF_KIND_MAP: Partial<Record<FieldKind, string>> = {
  ...REF_KINDS,
  // виды со своей веткой в Field, но с реестром для сводок
  flagRef: 'flag',
  recipeRef: 'recipe',
  npcStateRef: 'emotion',
}

/** Человекочитаемое значение одного поля (русские названия вместо id). */
function fieldValueText(f: FieldSpec, v: unknown, labels?: LabelSource, obj?: Record<string, unknown>): string | null {
  if (v === undefined || v === null || v === '') return null
  if (f.kind === 'questStageRef' || f.kind === 'journalKeyRef') {
    const q = typeof obj?.quest === 'string' ? obj.quest : ''
    return labels?.questStageLabel?.(q, String(v)) ?? String(v)
  }
  if (f.kind === 'sceneStateRef' || f.kind === 'sceneSlotRef') {
    const sc = typeof obj?.scene === 'string' ? obj.scene : ''
    return labels?.sceneSubLabel?.(sc, f.kind === 'sceneStateRef' ? 'state' : 'slot', String(v)) ?? String(v)
  }
  const refKind = REF_KIND_MAP[f.kind]
  if (refKind && typeof v === 'string') return labels ? labels.labelFor(refKind, v) : v
  // выпадающий список с русскими подписями: в сводке тоже подпись, а не машинное значение
  if (f.kind === 'select') return f.optionLabels?.[String(v)] ?? String(v)
  if (f.kind === 'imagePath') return String(v).split('/').pop() || String(v)
  if (f.kind === 'longtext') { const t = String(v).replace(/\s+/g, ' ').trim(); return t.length > 70 ? `${t.slice(0, 70)}…` : t }
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
