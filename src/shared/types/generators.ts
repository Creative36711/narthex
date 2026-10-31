import type { TimeOfDay } from './world'


// ───── случайные события и генераторы (аудит B9, всё — настройка мастера) ─────

/** Настройка одной таблицы событий (мастер решает тайминг и шансы). */
export interface EventTableDef {
  id: string
  label: string
  description?: string
  /** таблица отключена */
  disabled?: boolean
  /** полный порядок: каждые interval_ticks тиков мира — один бросок на событие */
  interval_ticks: number
  /** шанс, что на этом интервале вообще произойдёт событие (0..1; умолчание 1) */
  chance?: number
  /** время суток, когда таблица активна (нет — всегда) */
  time_of_day?: TimeOfDay[]
  /** локации, где таблица активна (нет — везде) */
  locations?: string[]
  /**
   * Ручные правила-кандидаты. В броске участвуют те, чьи ПРЕДПОСЫЛКИ
   * (rule.conditions) истинны прямо сейчас; выпавшее правило исполняется
   * (как при fire_rule). Повторы — как у правил: once-правило сработает
   * единожды, обычное может выпасть снова.
   */
  rules: string[]
}

/** Вольный элемент списка генератора с весом. */
export interface GenWeightedItem {
  value: string
  weight?: number
}

/** Компоновка имени: последовательность списков {list}/частей {literal}. */
export interface NamePatternPart { list?: string; literal?: string }

/**
 * Генератор NPC: мастер собирает имя/облик/характер из своих таблиц.
 * Результат применяется к целевому NPC (effect generate_npc) или к новой
 * сущности (spawn_template): создаётся копия шаблона с новым id.
 */
export interface NpcGeneratorDef {
  id: string
  label: string
  description?: string
  /** списки значений (id → взвешенный список строк) */
  lists: Record<string, GenWeightedItem[]>
  /**
   * Компоновка: {field → список-ключ}. Поля:
   * `name` (компоновка через parts: {list} или {literal}),
   * строковые поля — любые из NameableEntity-подобных: description, disposition_label и пр.
   */
  name?: NamePatternPart[]
  /** поле → ключ списка (description, stats.X, skills.Y, item.weapon …) */
  fields?: Record<string, string>
  /** seed-стабильность: повторный вызов с тем же seed даст того же персонажа */
}

/** Генератор сцен описаний: заполняет слоты сцены текстами по словарям. */
export interface SceneGeneratorDef {
  id: string
  label: string
  description?: string
  lists: Record<string, GenWeightedItem[]>
  /** id слота сцены → ключ списка: значение вставляется как описание слота (set_description-стиль) */
  slots: Record<string, string>
}

/** Генератор приключений: цепочка целей (квесто-строк) из таблиц. */
export interface AdventureGeneratorDef {
  id: string
  label: string
  description?: string
  lists: Record<string, GenWeightedItem[]>
  /** цель квеста: шаблон строки с подстановками {list:key} */
  goals: string[]
}

/** Общий блок генераторов в meta кампании (отсутствие — подсистемы нет). */
export interface GeneratorsDef {
  /** таблицы случайных событий (каждая со своим таймингом/шансом/фильтрами) */
  event_tables?: EventTableDef[]
  /** генераторы NPC */
  npc?: NpcGeneratorDef[]
  /** генераторы сцен */
  scenes?: SceneGeneratorDef[]
  /** генераторы приключений */
  adventures?: AdventureGeneratorDef[]
}
