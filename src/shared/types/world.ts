import type { Condition, Effect } from './rules'


import type { MusicRule } from './audio'


import type { ArtDoc } from './scene-art'


// ───────────────────────── world.json ─────────────────────────

export interface TravelConnection {
  to: string
  cost_ticks: number
  requirements?: Condition[]
  random_encounter_table?: string
  /** индивидуальный звук пути (например, шум поезда, плеск волн, стук копыт) */
  sound?: string
  sound_volume?: number
  /** индивидуальный звук отправления (свисток паровоза, скрип трапа) */
  depart_sound?: string
  depart_sound_volume?: number
  /** индивидуальный звук прибытия (скрип тормозов, звон станционного колокола) */
  arrive_sound?: string
  arrive_sound_volume?: number
}

/** фоновый зацикленный звуковой слой с условиями активации */
export interface AmbientRule {
  /** условия включения звукового слоя (если условий нет — звучит всегда) */
  conditions?: Condition[]
  /** зацикленные звуки (id из реестра meta.sounds или путь к файлу) */
  sounds?: string[]
  /** одиночный id звука для краткости */
  sound?: string
  /** громкость слоя 0..1 (по умолчанию 1) */
  volume?: number
}

/**
 * Длительное действие (dz.20): сон на N часов, медитация, дежурство, чтение —
 * любое занятие, которое стоит часы игрового времени без разбивки по тикам-шагам.
 *
 * Безопасность intentionally BRP-дарёная:
 * — применение per_tick идёт ПОЧАСОВО (внутри цикла advanceTicks(1)), поэтому
 *   прервавшийся сон дал столько пользы, сколько часов проспали;
 * — смерть/конец игры посреди действия обрывают цикл (on_zero_effect потребностей
 *   срабатывает честно, «убить во сне» — дело правил мастера);
 * — вероятность прерывания честная: interrupt_chance_per_tick — шанс за ОДИН тик;
 *   шанс «хотя бы раз за n тиков» = 1 − (1−p)ⁿ (для p=0.05 и n=8 это ≈ 34%);
 * — пер BD-ролловертель: roll в движении сна НЕ происходит (просто «сон +8 часов»);
 *   попущенное восстановление HP по кости meta.rest.hp идёт ПОСЛЕ
 *   завершения (BRP-характерное лечение — не тут, а в лагере campRest).
 */
export interface DurationActionDef {
  /** Уникальный id действия (на него ссылается эффект start_duration_action). */
  id: string
  /** Имя для окна выбора и журнала («Ночной сон», «Медитация»). */
  label: string
  /** Минимальная длительность в тиках (по умолчанию 1, минимум 1). */
  min_ticks?: number
  /** Максимальная длительность в тиках (по умолчанию = min_ticks — действие фиксированной длины). */
  max_ticks?: number
  /** Шаг выбора длины в окне выбора (по умолчанию 1: выбрать 3, 4, 5… часов). */
  step?: number
  /**
   * Почасовые эффекты действия: каждый тик ДО тикания потребностей.
   * Белый список (прочее движок пропускает, audit ругается):
   *   change_need — +дельта общего стола / −личная деградация;
   *   change_hp / change_fatigue / change_sanity — личные числа.
   * Целые дельты в списке схемы — только положительные/отрицательные целые.
   */
  per_tick?: Effect[]
  /** Шанс прерывания за один тик (0..1). Сравнивается после каждого прожитого часа. */
  interrupt_chance_per_tick?: number
  /** Правило, стреляющее при прерывании (набег, кошмар, стражник потревожил). После правила действие завершается — вернувшийся персонаж «не проснулся», а остановился. */
  interrupt_rule?: string
  /** Условия-станные «хватит»: после каждого тика проверяются; если хотя бы одно истинно — действие завершается как прерывание (с правилом interrupt_rule, если задан). Например: будить, когда need_energy >= 100. */
  break_when?: Condition[]
  /** Эффекты НОРМАЛЬНОГО завершения (доспал): срабатывают один раз, только если цикл дошёл до конца без прерывания/смерти. */
  on_finish?: Effect[]
  /** Если заданы, действие доступно только при истинности всех условий (день/ночь, переменная, нужна скамейка в локации и т.п.). */
  available_when?: Condition[]
}

export interface LocationDef {
  id: string
  label: string
  position: { x: number; y: number }
  travel_connections: TravelConnection[]
  scenes: string[]
  /**
   * Сцена, в которую попадает игрок, придя в локацию с карты (итерация 8, А5).
   * По умолчанию — первая сцена локации.
   */
  arrival_scene?: string
  arena?: string
  on_enter_rules?: string[]
  hidden?: boolean // скрыта, пока не открыта эффектом reveal_location
  ambient_audio?: string // легаси: один звук фона
  /** фоновые зацикленные звуки (птицы, гул): складываются слоями. Строки id или AmbientRule с условиями */
  ambient?: Array<string | AmbientRule>
  /** здесь можно разбить лагерь (аудит B7); конфиг ночлега — meta.camping */
  camp?: boolean
  /**
   * музыка локации: список записей «условия → треки» (побеждает первая
   * истинная). Старый формат — строка (id трека или ссылка) — мигрируется
   * в `[{ tracks: [s] }]` при загрузке.
   */
  music?: string | MusicRule[]
}

export interface RegionDef {
  id: string
  label: string
  map_image: string
  /** фон карты, нарисованный примитивами (вместо map_image) — итерация 8, блок D */
  map_art?: ArtDoc
  map_size?: { w: number; h: number }
  parent_region: string | null
  locations: LocationDef[]
  sub_regions?: RegionDef[]
}

export interface WorldDef {
  regions: RegionDef[]
}

// ───────────────────────── сцены ─────────────────────────

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night'
