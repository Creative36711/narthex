import type { Condition, Effect } from './rules'


import type { SceneCondition, SceneStateDef, SlotType } from './scene-art'


import type { MusicRule } from './audio'


import type { AmbientRule } from './world'


import type { NarrativeIntroEntry } from './entities'


/** погода (блок 9 ТЗ): визуальный слой + звуковые слои */
/** декларативный слой атмосферы («мастерская спецэффектов»): летящие частицы из
 * файла-спрайта с поведением. WeatherDef.overlay = id эффекта (встроенные
 * rain/snow/fog/ash продолжают работать). */
export interface ParticleEffectDef {
  id: string
  label: string
  /** PNG/WEBP с альфой (частица любой формы); пусто — точка-градиент */
  sprite?: string
  /** штук на экран (умолчание 60) */
  count?: number
  size_min?: number
  size_max?: number
  /** скорость по вертикали, px/с; положительная — вниз (умолчание 40…80) */
  vy_min?: number
  vy_max?: number
  /** скорость по горизонтали, px/с (умолчание -5…5) */
  vx_min?: number
  vx_max?: number
  /** вращение, град/с (умолчание 0) */
  spin?: number
  /** непрозрачность 0..1 (умолчание 0.8) */
  opacity?: number
  /** размытие, px (умолчание 0; для тумана) */
  blur?: number
  blend?: 'normal' | 'screen'
  loop?: boolean
  /** цвет центра процедурной частицы (rgba/hex, по умолчанию белое/золотое свечение) */
  color_inner?: string
  /** цвет внешнего ореола процедурной частицы */
  color_outer?: string
}

export interface EncumbranceRules {
  /** Включена ли система перегруза (по умолчанию true) */
  enabled?: boolean
  /**
   * Формула базовой грузоподъёмности:
   * 'str_siz' | 'str_siz_sum' — классика BRP (STR + SIZ в кг), по умолчанию
   * 'str_con' — сила + телосложение (STR + CON в кг)
   * 'str_only' | 'str_x2' — чистая сила (STR * 2 в кг)
   * 'siz_x2' — чистые габариты (SIZ * 2 в кг)
   * 'str_plus_half_siz' — STR + (SIZ / 2) в кг
   * 'fixed' — фиксированное значение из base_capacity
   */
  formula?: 'str_siz' | 'str_siz_sum' | 'str_con' | 'str_only' | 'str_x2' | 'siz_x2' | 'str_plus_half_siz' | 'fixed'
  /** Фиксированная базовая вместимость в кг (при formula === 'fixed', по умолчанию 25) */
  base_capacity?: number
  /** Глобальный множитель грузоподъёмности мира (по умолчанию 1.0) */
  capacity_multiplier?: number
  /** Влияет ли перегруз на время путешествий между локациями (по умолчанию true) */
  travel_penalty?: boolean
  /** Множитель времени при лёгком перегрузе (>1.0x, по умолчанию 1.5) */
  light_travel_multiplier?: number
  /** Множитель времени при тяжёлом перегрузе (>1.5x, по умолчанию 2.0) */
  heavy_travel_multiplier?: number
  /** Порог критического перегруза, блокирующего перемещение (по умолчанию 2.0x, 0 = не блокировать) */
  critical_threshold?: number
  /** Штраф к уклонению в бою при лёгком перегрузе (%, по умолчанию 10) */
  light_dodge_penalty?: number
  /** Штраф к перемещению в бою при лёгком перегрузе (MOV, по умолчанию 1) */
  light_mov_penalty?: number
  /** Штраф к ловкостным навыкам при лёгком перегрузе (%, по умолчанию 10) */
  light_agility_skills_penalty?: number
  /** Штраф к уклонению в бою при тяжёлом перегрузе (%, по умолчанию 25) */
  heavy_dodge_penalty?: number
  /** Штраф к перемещению в бою при тяжёлом перегрузе (MOV, по умолчанию 2) */
  heavy_mov_penalty?: number
  /** Штраф к ловкостным навыкам при тяжёлом перегрузе (%, по умолчанию 25) */
  heavy_agility_skills_penalty?: number
  /** Штраф к уклонению в бою при критическом перегрузе (%, по умолчанию 50) */
  critical_dodge_penalty?: number
  /** Штраф к перемещению в бою при критическом перегрузе (MOV, по умолчанию 3) */
  critical_mov_penalty?: number
  /** Штраф к ловкостным навыкам при критическом перегрузе (%, по умолчанию 50) */
  critical_agility_skills_penalty?: number
}

export interface WeatherDef {
  id: string
  label: string
  /**
   * визуальный слой поверх сцены (чистый CSS), задаётся кампанией.
   * Движок рисует класс `weather-<overlay>`; встроенные слои движка:
   * `rain`, `snow`, `fog`, `ash`. Нет/'none' — без слоя. Встроенных
   * «погод по умолчанию» не существует — реестр целиком создаёт кампания.
   */
  overlay?: string
  /** зацикленные звуки (id из реестра звуков) — слои к эмбиенту */
  ambient?: string[]
  /**
   * Влияние погоды на бой (аудит B7): сдвиг навыков (метель −стрельбе),
   * штраф движения, урезание дальности оружия (туман), статус всем
   * бойцам при начале боя в эту погоду. Действует на обе стороны.
   */
  combat?: {
    skill_mods?: Array<{ skill: string; delta: number }>
    /** аддитив к движению всех бойцов, итог ≥ 1 */
    mov_penalty?: number
    /** срезание дальности оружия (дальность ≥ 1) */
    range_penalty?: number
    /** статус, накладываемый всем в начале боя */
    status?: string
  }
}

/**
 * Финальный экран (концовка). Мастер задаёт столько концовок, сколько хочет;
 * при завершении забега движок выбирает ПЕРВУЮ, у которой совпадает исход
 * (`on`) и выполнены все `conditions`. Если ни одна не подошла — стандартный
 * экран исхода («Забег окончен» / «Победа»).
 */
export interface EndingDef {
  id: string
  /** название в редакторе */
  label: string
  /** заголовок финального экрана */
  title: string
  /** текст концовки */
  text?: string
  /** тон экрана: гибель / победа / нейтральный */
  tone?: 'death' | 'victory' | 'neutral'
  /** к какому исходу применима концовка (нет — к любому) */
  on?: 'death' | 'victory'
  /** фон финала (файл пакета или ссылка); нет — фон темы */
  image?: string
  /** условия, при которых эта концовка показывается (все сразу) */
  conditions?: Condition[]
}

/** запись кодекса/бестиария — разблокируемый лор (блок 10 ТЗ) */
export interface CodexEntryDef {
  id: string
  /** название записи */
  label: string
  /** id из meta.codex_categories (нет — встроенные «Хроники») */
  category?: string
  /** основной текст */
  text: string
  /**
   * Бестиарий (аудит §5.6): id существа-NPC, о котором запись.
   * Заполнено — у записи в кодексе появляется боевая сводка
   * (характеристики, броня, природное оружие, способности, мораль).
   */
  creature_entity?: string
  /** файл/ссылка (нет — без картинки) */
  image?: string
}

/** встроенные категории кодекса (блок 10 ТЗ) */
export const BUILTIN_CODEX_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'creatures', label: 'Существа' },
  { id: 'places', label: 'Места' },
  { id: 'chronicles', label: 'Хроники' },
]

/** применение предмета инвентаря к слоту сцены — «ключ к двери» (блок 8 ТЗ) */
export interface SlotUseWith {
  /** предмет из инвентаря игрока */
  item: string
  /** израсходовать предмет (по умолчанию нет) */
  consume?: boolean
  effects: Effect[]
  message?: string
}

export interface SlotDef {
  id: string
  /** название слота для мастера (в списках вместо id) */
  label?: string
  type: SlotType[]
  shape: 'rect'
  x: number
  y: number
  w: number
  h: number
  default_entity?: string
  condition: SceneCondition | null
  /** множитель размера спрайта сцены в этом слоте (1 = по высоте слота) */
  sprite_scale?: number
  /** состояние спрайта сцены для занятого НПС (ключ из scene_sprite_states,
   *  id состояния кампании); пусто — обычный спрайт */
  sprite_state?: string
  /** индивидуальный звук клика/взаимодействия со слотом */
  sound?: string
  sound_volume?: number
  /** предметы, которыми можно воздействовать на слот (блок 8 ТЗ) */
  use_with?: SlotUseWith[]
  /** хотспот окружения (нарисован прямо на фоне сцены; в покое невидим, проявляется при наведении или Tab) */
  environmental?: boolean
}

/**
 * Зона перехода на сцене (итерация 8, А6): только ВНУТРИ локации —
 * в другую сцену или «открыть карту» (это и есть выход из локации).
 * Старые `go_to_location` мигрируются при загрузке (shared/migrate.ts).
 */
export interface NavigationZone {
  area: { x: number; y: number; w: number; h: number }
  go_to_scene?: string
  open_map?: boolean
  label: string
  cost_ticks?: number
  /** скрывать подпись до наведения курсора (зона как невидимый хотспот) */
  hide_label?: boolean
  /** условия доступности перехода (все должны выполниться) */
  conditions?: Condition[]
  /** сообщение игроку, если переход заблокирован */
  blocked_message?: string
  /** перехват: вместо перехода запустить диалог (например, окликает страж при попытке выйти) */
  intercept_dialogue?: string
  /** перехват: id правила-перехватчика */
  intercept_rule?: string
}

export type SceneParticlesPreset = 'dust' | 'steam' | 'rain' | 'snow' | 'fog' | 'ash' | 'sparks' | 'embers' | 'none'

export interface SceneParticlesConfig {
  type: SceneParticlesPreset
  density?: 'low' | 'medium' | 'high'
  speed?: 'slow' | 'normal' | 'fast'
  wind?: 'left' | 'none' | 'right'
  color?: string
}

export type SceneParticles = SceneParticlesPreset | SceneParticlesConfig

export interface SceneDef {
  id: string
  label: string
  location: string
  /** размер, в координатах которого размечены слоты/зоны */
  canvas?: { w: number; h: number }
  states: SceneStateDef[]
  slots: SlotDef[]
  navigation: NavigationZone[]
  /** переопределение музыки сцены (тот же формат, что у локации) */
  music?: MusicRule[]
  /** фоновые зацикленные звуки сцены (слагаются с фоном локации). Строка id или AmbientRule с условиями */
  ambient?: Array<string | AmbientRule>
  /** тип освещения сцены: outdoor (по умолчанию, фазы суток), indoor (помещение), none (без фильтров) */
  lighting?: 'outdoor' | 'indoor' | 'none'
  /** атмосферные частицы сцены (пыль, пар, искры, дождь, снег, туман) — строка пресета или расширенный конфиг */
  particles?: SceneParticles
  /** вводное атмосферное повествование от автора (мысли/описание при входе) */
  narrative_intro?: NarrativeIntroEntry[]
  /** показывать вводное повествование только один раз за забег (по умолчанию true) */
  narrative_intro_once?: boolean
  /** переопределение текста кнопки «Далее» */
  narrative_intro_next_label?: string
  /** переопределение текста кнопки «Завершить / Осмотреться» */
  narrative_intro_done_label?: string
  /** глава (id из meta.chapters) — группировка в редакторе; двигатель значения не ждёт */
  chapter?: string
}
