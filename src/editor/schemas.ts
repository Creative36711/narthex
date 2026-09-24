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
  show_message: {
    label: 'Показать сообщение',
    fields: [
      { key: 'text', label: 'Текст', kind: 'string' },
      { key: 'portrait', label: 'Портрет (путь)', kind: 'string', optional: true },
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
