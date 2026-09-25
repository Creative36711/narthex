/**
 * Chronicle Forge — типы формата кампании (Campaign Package).
 * Соответствуют ТЗ, раздел 3.
 */

// ───────────────────────── campaign.json ─────────────────────────

/**
 * Условие для потребности (фидбек №1/№3 седьмого раунда): когда она убывает
 * и когда восстанавливается. Пример «Тепло»: убывает ночью, если нет тёплой
 * одежды и герой не в таверне; в таверне — восстанавливается.
 *
 * Итерация 8, А3: множественные значения. «Герой в локации» и «есть/надет
 * предмет» принимают СПИСОК id и означают «любой из» (условия потребности
 * соединяются по «И», поэтому нескольких локаций одним условием раньше было
 * не выразить). Одиночные поля старого формата (`location`, `item`)
 * мигрируются при загрузке (см. shared/migrate.ts).
 */
export type NeedCondition =
  | { type: 'time_of_day'; values: TimeOfDay[] }
  | { type: 'flag'; flag: string; not?: boolean }
  | { type: 'in_location'; locations: string[]; not?: boolean; location?: string }
  | { type: 'has_item'; items: string[]; not?: boolean; item?: string }
  | { type: 'equipped'; items: string[]; not?: boolean; item?: string }

/**
 * Настройки бросков d100 (итерация 8, А7). Хранятся в campaign.json —
 * у каждой кампании могут быть свои пороги, движок ничего не хардкодит.
 */
export interface DiceRules {
  /** критический успех: бросок ≤ навык / critical_divisor */
  critical_divisor: number
  /** особый (хороший) успех: бросок ≤ навык / special_divisor */
  special_divisor: number
  /** критический провал начинается с этого броска (fumble_from…100) */
  fumble_from: number
  /**
   * Классический BRP: при навыке ниже этого порога крит-провал — весь
   * диапазон fumble_from…99 (а не только 100). По умолчанию выключено.
   */
  fumble_low_skill?: number
}

/** «Щедрые» пороги (по умолчанию): крит /5, особый /2, провал 96–100. */
export const DEFAULT_DICE_RULES: DiceRules = {
  critical_divisor: 5,
  special_divisor: 2,
  fumble_from: 96,
}

/** Классический BRP: крит /20, особый /5, провал — 00 или 96–100 при навыке < 30. */
export const CLASSIC_DICE_RULES: DiceRules = {
  critical_divisor: 20,
  special_divisor: 5,
  fumble_from: 96,
  fumble_low_skill: 30,
}

export interface NeedDef {
  id: string
  label: string
  max: number
  decay_per_tick: number
  critical_threshold: number
  on_zero_effect?: string // id правила-эффекта либо встроенный: "death"
  /** убывает, только когда ВСЕ условия выполнены (пусто — всегда) */
  decay_when?: NeedCondition[]
  /** восстановление за тик, когда выполнены условия restore_when */
  restore_per_tick?: number
  restore_when?: NeedCondition[]
}

export interface CurrencyDef {
  id: string
  label: string
  symbol: string
  exchange_rate?: Record<string, number>
}

export interface CharCreationDef {
  total_points: number
  stat_limits: { min: number; max: number }
  skill_cap: number
  mandatory_skills: string[]
  forbidden_skills: string[]
  allowed_professions: string[]
}

export interface TimeOfDayThresholds {
  /** час начала каждого периода (в тиках от начала суток) */
  morning: number
  day: number
  evening: number
  night: number
}

export interface FactionDef {
  id: string
  label: string
  base_disposition: number
  /** служебная фракция: отношение не меняется, игроку не показывается */
  hidden?: boolean
}

/** Категория предметов: задаёт, какие свойства доступны предмету (фидбек №8). */
export interface ItemCategoryDef {
  id: string
  label: string
  /** предметы категории можно использовать для восстановления здоровья */
  restores_hp?: boolean
  /** какие потребности восстанавливают предметы категории (id из реестра needs) */
  restores_needs?: string[]
  /** предметы категории — оружие (навык, урон и т.д.) */
  is_weapon?: boolean
  /** предметы категории — броня (очки поглощения урона) */
  is_armor?: boolean
}

export interface CampaignMeta {
  id: string
  title: string
  version: string
  engine_version: string
  author: string
  description: string
  tick_label: string
  ticks_per_day: number
  time_of_day?: TimeOfDayThresholds
  starting_region: string
  starting_location: string
  starting_scene: string
  starting_tick?: number
  needs: NeedDef[]
  /** правила бросков d100 (пороги крита/особого успеха/провала); см. DEFAULT_DICE_RULES */
  dice_rules?: DiceRules
  /** реестр навыков кампании (id + русское название); см. shared/skills.ts */
  skills?: Array<{ id: string; label: string }>
  /** реестр категорий предметов: категория определяет, что предмет умеет */
  item_categories?: ItemCategoryDef[]
  /** реестр типов слотов сцены (что можно ставить в слот); по умолчанию — встроенные */
  slot_types?: Array<{ id: string; label: string }>
  /** реестр флагов: русское название и назначение (редактор показывает названия, движку важен только id) */
  flags?: Array<{ id: string; label: string; description?: string }>
  currencies: CurrencyDef[]
  factions?: FactionDef[]
  /** максимальный груз в кг: STR + SIZ (по умолчанию) */
  max_load_formula?: 'str_plus_siz'
  max_companions?: number
  char_creation?: CharCreationDef
  /** id сущности-шаблона игрока (Фаза 0: предсозданный персонаж) */
  default_player: string
  roguelike?: {
    permadeath: boolean
    meta_progress: string[]
    randomize_on_restart: string[]
  }
}

// ───────────────────────── world.json ─────────────────────────

export interface TravelConnection {
  to: string
  cost_ticks: number
  requirements?: Condition[]
  random_encounter_table?: string
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
  ambient_audio?: string
  music?: string
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

/** Простое декларативное условие для состояний сцены / слотов */
export interface SceneCondition {
  time_of_day?: TimeOfDay | TimeOfDay[]
  flag?: string
  not_flag?: string
}

// ─────────────── декларативная графика (итерация 8, блок D) ───────────────

/**
 * Заливка примитива: сплошной цвет или линейный градиент.
 * `angle` — направление градиента в градусах (0 — слева направо).
 */
export type ArtFill = string | { color?: string; gradient?: { from: string; to: string; angle?: number } }

interface ArtShapeBase {
  /** прозрачность 0…1 */
  opacity?: number
  /** поворот вокруг своего центра, градусы */
  rotate?: number
}

export interface ArtRect extends ArtShapeBase {
  type: 'rect'
  x: number
  y: number
  w: number
  h: number
  fill?: ArtFill
  stroke?: string
  stroke_width?: number
  radius?: number
}

export interface ArtEllipse extends ArtShapeBase {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
  fill?: ArtFill
  stroke?: string
  stroke_width?: number
}

export interface ArtPolygon extends ArtShapeBase {
  type: 'polygon'
  /** точки в виде [x1, y1, x2, y2, …] в координатах холста */
  points: number[]
  fill?: ArtFill
  stroke?: string
  stroke_width?: number
}

export interface ArtLine extends ArtShapeBase {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  color?: string
  width?: number
}

export interface ArtText extends ArtShapeBase {
  type: 'text'
  x: number
  y: number
  text: string
  size?: number
  color?: string
  /** 'start' | 'middle' | 'end' — как в SVG */
  align?: 'start' | 'middle' | 'end'
  bold?: boolean
  italic?: boolean
  font?: string
}

export type ArtShape = ArtRect | ArtEllipse | ArtPolygon | ArtLine | ArtText

export interface ArtLayer {
  /** подпись слоя для мастера («небо», «гора», «стена») */
  label?: string
  shape: ArtShape
  opacity?: number
  rotate?: number
}

/**
 * Векторная «картинка из JSON»: слои примитивов в координатах холста
 * (по умолчанию 1280×720 — та же система, что у слотов сцены).
 * Формат рассчитан на генерацию ИИ: нарисовав сцену примитивами, генератор
 * сам знает координаты объектов и ставит слоты точно на них.
 */
export interface ArtDoc {
  canvas?: { w: number; h: number }
  background?: string
  layers: ArtLayer[]
}

export interface SceneStateDef {
  id: string
  label: string
  /** фон-изображение (файл пакета или ссылка) */
  image?: string
  /** фон, нарисованный примитивами (вместо image) */
  art?: ArtDoc
  condition: SceneCondition | null
}

/** тип слота — id из реестра кампании slot_types (мастер может добавлять свои) */
export type SlotType = string

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
}

export interface SceneDef {
  id: string
  label: string
  location: string
  /** размер, в координатах которого размечены слоты/зоны */
  canvas?: { w: number; h: number }
  states: SceneStateDef[]
  slots: SlotDef[]
  navigation: NavigationZone[]
}

// ───────────────────────── сущности ─────────────────────────

export interface StatBlock {
  STR: number
  CON: number
  SIZ: number
  DEX: number
  INT: number
  POW: number
  CHA: number
  HP?: number
  MP?: number
}

/** «при событии — в этом месте»: активная запись важнее расписания */
export interface PresenceOverride {
  /** активен, когда флаг установлен */
  flag?: string
  /** …и (опционально) когда этот флаг НЕ установлен */
  not_flag?: string
  location: string
  scene: string
  slot: string
}

export interface ScheduleEntry {
  /** [от, до) в тиках суток; поддерживает переход через полночь */
  time_range: [number, number]
  location: string
  scene: string
  slot: string
}

export interface InventoryEntry {
  item: string
  quantity: number
}

export interface TraderDef {
  /** товары: id предмета и цена в серебре (переопределяет value) */
  sells: Array<{ item: string; price?: number; stock?: number }>
  /** скупает ли торговец предметы игрока */
  buys: boolean
  /** множитель закупки (доля от стоимости) */
  buy_rate?: number
}

export interface NpcDef {
  id: string
  type: 'npc'
  label: string
  portrait: Record<string, string> // emotion -> image
  token?: string
  stats: StatBlock
  skills: Record<string, number>
  equipment?: Record<string, string>
  inventory?: InventoryEntry[]
  loot_table?: Array<{ item: string; chance: number; min?: number; max?: number }>
  dialogue?: string // путь к .ink
  /** тип в слотах сцены (id из реестра slot_types); по умолчанию «Персонаж» */
  slot_type?: string
  schedule?: ScheduleEntry[]
  /** особые места по событиям: пока активен флаг — персонаж здесь, расписание не действует */
  presence_overrides?: PresenceOverride[]
  faction?: string
  base_disposition?: number
  trader?: TraderDef | null
  combat_ai?: string
  /** броня в очках (если нет предмета-брони) */
  armor?: number
  /** природное оружие (когти, укус) — если нет equipment.weapon */
  natural_weapon?: WeaponData
}

export interface WeaponData {
  skill: string
  damage: string
  damage_bonus: boolean
  range: number
  attacks_per_round: number
  parry_capable: boolean
  label?: string
}

export interface UseEffectDef {
  effects: Effect[]
  consume?: boolean
  message?: string
}

export interface ItemDef {
  id: string
  type: 'item'
  category: string
  /** тип в слотах сцены (id из реестра slot_types); по умолчанию «Предмет»/«Контейнер» */
  slot_type?: string
  label: string
  description: string
  image?: string
  weight: number
  value?: Record<string, number>
  stackable: boolean
  weapon_data?: WeaponData
  /** броня: очки поглощения урона */
  armor_data?: { points: number }
  /** взаимодействие в сцене (бочка с водой и т.п.) */
  on_interact?: UseEffectDef
  /** использование из инвентаря */
  on_use?: UseEffectDef
}

export type EntityDef = NpcDef | ItemDef

// ───────────────────────── катсцены (итерация 8, блок E) ─────────────────────────

/** переход к слайду: резкая смена, затемнение, сдвиг, медленный наезд */
export type CutsceneTransition = 'cut' | 'fade' | 'slide' | 'panzoom'

/**
 * Слайд катсцены. Кадр — ОДНО из: `art` (ArtDoc, рисуется примитивами),
 * `image` (файл пакета или ссылка), `video` (mp4-ссылка или YouTube —
 * работает только онлайн). Без кадра — подпись на чёрном фоне.
 */
export interface CutsceneSlide {
  art?: ArtDoc
  image?: string
  video?: string
  /** подпись: печатается поверх кадра, снизу */
  text?: string
  /** озвучка слайда: файл пакета (assets/voice/…) или ссылка */
  voice?: string
  /** длительность в секундах; по умолчанию — по длине текста или озвучки */
  duration?: number
  transition: CutsceneTransition
}

/**
 * Слайд-катсцена: запускается эффектом `play_cutscene` из правила или
 * диалога, показывается оверлеем поверх всего. Целиком описывается JSON'ом
 * (слайды — ArtDoc), поэтому её можно сгенерировать без единого файла.
 */
export interface CutsceneDef {
  id: string
  label: string
  /** музыка на всю катсцену: файл пакета или ссылка */
  music?: string
  slides: CutsceneSlide[]
}

// ───────────────────────── диалоги (.dlg.json, итерация 8) ─────────────────────────

/** настроение (состояние портрета): базовые + свои состояния из формы NPC */
export type DlgEmotion = string

export interface DlgLine {
  text: string
  emotion?: DlgEmotion
  /** авторская ремарка (курсивом, не влияет на портрет) */
  action?: boolean
  /**
   * озвучка реплики: файл пакета (assets/voice/…) или ссылка (итерация 8,
   * блок G). Если нет — при включённом синтезаторе реплику читает браузер.
   */
  voice?: string
}

/** условие показа/ветвления (все условия списка должны выполниться) */
export type DlgCond =
  | { type: 'flag'; flag: string; not?: boolean }
  | { type: 'item_ge'; item: string; count: number; not?: boolean } // предметов ≥ n (not: < n)
  | { type: 'has_item'; item: string; not?: boolean }
  | { type: 'disp_ge'; target: string; value: number; not?: boolean } // отношение ≥ (not: <)
  | { type: 'quest'; quest: string; stage: string; not?: boolean } // квест на стадии ('' = не начат)
  | { type: 'in_party'; npc: string; not?: boolean }
  | { type: 'hp_ge'; value: number; not?: boolean } // здоровье ≥ (not: <)

export type DlgEffect =
  | { type: 'set_flag'; flag: string }
  | { type: 'add_item'; item: string; qty: number }
  | { type: 'remove_item'; item: string; qty: number }
  | { type: 'fire_rule'; rule: string }
  | { type: 'join_party'; npc: string }
  | { type: 'open_trade'; npc: string }
  | { type: 'start_quest'; quest: string }
  | { type: 'advance_time'; ticks: number }
  | { type: 'change_need'; need: string; delta: number }
  | { type: 'change_hp'; delta: number }
  | { type: 'sleep'; ticks: number }
  | { type: 'change_disposition'; target: string; delta: number }
  | { type: 'play_cutscene'; cutscene: string }

/** шаг: реплика или игровое действие (порядок важен) */
export type DlgStep =
  | { kind: 'line'; line: DlgLine }
  | { kind: 'effect'; effect: DlgEffect }

/**
 * Блок шагов с необязательным условием. Если условие есть — можно задать
 * ветку «иначе». goto ('' — продолжить, 'end', 'stay', id узла) уводит
 * разговор из середины блока.
 */
export interface DlgSection {
  conds?: DlgCond[]
  steps: DlgStep[]
  goto?: string
  else_steps?: DlgStep[]
  else_goto?: string
}

/** проверка навыка с ветками успеха и провала */
export interface DlgCheck {
  skill: string
  difficulty: number
  /** изменённая сложность при условиях (например «легче, если пришли с тыла») */
  mods?: Array<{ conds: DlgCond[]; value: number }>
  success: { sections: DlgSection[]; goto: string }
  fail: { sections: DlgSection[]; goto: string }
}

export interface DlgChoice {
  text: string
  /** показывать вариант только при условиях */
  conds?: DlgCond[]
  /** одноразовый в рамках одного разговора (в новом разговоре вернётся) */
  once?: boolean
  /** ответ НПС (блоки с условиями) */
  sections: DlgSection[]
  /** проверка навыка после ответа (ветки успех/провал) */
  check?: DlgCheck
  /** куда дальше: id узла, 'stay' (те же варианты) или 'end' (конец разговора) */
  goto: string
}

export interface DlgNode {
  id: string
  label: string
  sections: DlgSection[]
  choices: DlgChoice[]
  /** узел без вариантов: куда перейти после реплик ('end' по умолчанию) */
  goto?: string
}

export interface DlgDoc {
  version: 2
  /** название диалога для мастера (в списках вместо имени файла) */
  label?: string
  nodes: DlgNode[] // nodes[0] — начало разговора (knot main)
}

// ───────────────────────── арены (ТЗ 3.9) ─────────────────────────

export type HexCoord = [number, number] // [col, row]

export interface ArenaDef {
  id: string
  label: string
  image: string
  canvas?: { w: number; h: number }
  hex_grid: {
    cols: number
    rows: number
    hex_size: number
    offset: 'odd-r'
    /** пиксельный сдвиг центра гекса (0,0); по умолчанию сетка центрируется */
    origin?: { x: number; y: number }
    blocked_hexes: HexCoord[]
    difficult_terrain: HexCoord[]
  }
  spawn_zones: {
    player: { hexes: HexCoord[] }
    enemy: { hexes: HexCoord[] }
  }
  ambient_audio?: string
  music?: string
}

// ───────────────────────── квесты (ТЗ 3.7) ─────────────────────────

export interface QuestStageDef {
  id: string
  /** название стадии для мастера (в редакторе) */
  label?: string
  final?: boolean
  outcome?: 'success' | 'failure'
  on_enter_effects?: Effect[]
  transitions?: Array<{ to: string; conditions: Condition[] }>
}

export interface QuestDef {
  id: string
  label: string
  description: string
  journal_entries: Record<string, string>
  stages: QuestStageDef[]
}

// ───────────────────────── случайные встречи (ТЗ 3.8) ─────────────────────────

export type EncounterEntry =
  | { weight: number; type: 'nothing' }
  | {
      weight: number
      type: 'combat'
      enemies: Array<{ entity: string; count_min: number; count_max: number }>
      arena: string
      intro?: string
    }
  | { weight: number; type: 'dialogue'; entity: string; knot?: string }
  | {
      weight: number
      type: 'skill_check'
      skill: string
      difficulty: number
      message?: string
      success_effects: Effect[]
      fail_effects: Effect[]
    }
  | { weight: number; type: 'event'; effects: Effect[]; message?: string }

export interface EncounterTableDef {
  id: string
  rolls: number
  entries: EncounterEntry[]
}

// ───────────────────────── условия и эффекты ─────────────────────────

export type Condition =
  | { type: 'player_enters_location'; location: string }
  | { type: 'player_enters_scene'; scene: string }
  | { type: 'flag_set'; flag: string }
  | { type: 'flag_not_set'; flag: string }
  | { type: 'variable_compare'; var: string; operator: '==' | '!=' | '<' | '>' | '<=' | '>='; value: number | string }
  | { type: 'time_of_day'; value: TimeOfDay | TimeOfDay[] }
  | { type: 'tick_elapsed'; min_tick: number }
  | { type: 'quest_at_stage'; quest: string; stage: string }
  | { type: 'has_item'; item: string; min_quantity?: number }
  | { type: 'skill_ge'; skill: string; threshold: number }
  | { type: 'need_le'; need: string; threshold: number }
  | { type: 'need_ge'; need: string; threshold: number }
  | { type: 'entity_alive'; entity: string }
  | { type: 'entity_dead'; entity: string }
  | { type: 'disposition_ge'; target: string; threshold: number }
  | { type: 'disposition_le'; target: string; threshold: number }
  | { type: 'in_party'; entity: string }
  | { type: 'random_chance'; probability: number }
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }

export type Effect =
  | { type: 'set_flag'; flag: string }
  | { type: 'clear_flag'; flag: string }
  | { type: 'set_variable'; var: string; value: number | string }
  | { type: 'change_variable'; var: string; delta: number }
  | { type: 'start_dialogue'; entity: string; dialogue_knot?: string }
  | {
      type: 'start_combat'
      enemies: Array<{ entity: string; count: number }>
      /** временные союзники только на этот бой (не входят в партию) */
      allies?: Array<{ entity: string; count: number }>
      arena: string
      intro?: string
      on_victory?: Effect[]
    }
  | { type: 'teleport_player'; location: string; scene?: string }
  | { type: 'change_scene_state'; scene: string; state: string }
  | { type: 'add_item'; item: string; quantity?: number }
  | { type: 'remove_item'; item: string; quantity?: number }
  | { type: 'change_need'; need: string; delta: number }
  | { type: 'change_hp'; delta: number }
  | { type: 'change_skill'; skill: string; delta: number }
  | {
      type: 'skill_check_gate'
      skill: string
      difficulty: number
      success_effects: Effect[]
      fail_effects: Effect[]
    }
  | { type: 'change_disposition'; target: string; delta: number }
  | { type: 'start_quest'; quest: string }
  | { type: 'advance_quest'; quest: string; stage: string }
  | { type: 'fail_quest'; quest: string }
  | { type: 'journal_update'; quest: string; text_key: string }
  | { type: 'give_reward'; items?: Array<{ item: string; quantity: number }> }
  | { type: 'join_party'; entity: string }
  | { type: 'leave_party'; entity: string }
  | { type: 'block_path'; from: string; to: string }
  | { type: 'unblock_path'; from: string; to: string }
  | { type: 'show_message'; text: string; portrait?: string }
  | { type: 'reveal_location'; location: string }
  | { type: 'advance_time'; ticks: number }
  | { type: 'remove_entity'; entity: string }
  | { type: 'spawn_entity'; entity: string; scene: string; slot: string }
  | { type: 'game_over_victory' }
  | { type: 'game_over_death'; reason?: string }
  | { type: 'play_cutscene'; cutscene: string }

export interface RuleDef {
  id: string
  label: string
  once: boolean
  /** manual-правило не проверяется автоматически — только вызывается по id (on_zero_effect и т.п.) */
  manual?: boolean
  conditions: Condition[]
  effects: Effect[]
}

// ───────────────────────── состояние игры (сейв) ─────────────────────────

export interface PlayerState {
  entity: string
  stats: StatBlock
  skills: Record<string, number>
  /** «галочки» роста навыков (experience checks, ТЗ 4.3) */
  skill_marks: Record<string, boolean>
  hp: number
  max_hp: number
  mp: number
  max_mp: number
  needs: Record<string, number>
  inventory: InventoryEntry[]
  currencies: Record<string, number>
  /** экипировка игрока: id предметов из инвентаря */
  equipment: { weapon?: string; armor?: string }
}

export interface QuestState {
  stage: string
  status: 'active' | 'completed' | 'failed'
  journal: string[]
}

export interface CompanionState {
  entity: string
  hp: number
  max_hp: number
}

export const SAVE_VERSION = 3

export interface GameState {
  save_version?: number
  campaign_id: string
  seed: string
  tick: number
  region: string
  location: string
  scene: string
  flags: Record<string, boolean>
  variables: Record<string, number | string>
  fired_rules: string[]
  revealed_locations: string[]
  dead_entities: string[]
  removed_entities: string[]
  spawned: Array<{ entity: string; scene: string; slot: string }>
  /** сериализованное состояние Ink-историй (путь → state JSON) */
  ink_states?: Record<string, string>
  player: PlayerState
  quests: Record<string, QuestState>
  dispositions: Record<string, number>
  party: CompanionState[]
  blocked_paths: string[]
  log: string[]
  game_over: null | { type: 'death' | 'victory'; reason: string }
  stats_run: { travels: number; dialogues: number; ticks_survived: number; kills: number; quests_completed: number }
}

// ───────────────────────── загруженная кампания ─────────────────────────

export interface CampaignData {
  meta: CampaignMeta
  world: WorldDef
  scenes: Record<string, SceneDef>
  entities: Record<string, EntityDef>
  rules: Record<string, RuleDef>
  arenas: Record<string, ArenaDef>
  quests: Record<string, QuestDef>
  encounters: Record<string, EncounterTableDef>
  /** катсцены по id (итерация 8, блок E) */
  cutscenes: Record<string, CutsceneDef>
  dialogues: Record<string, string> // путь -> исходник .ink
  basePath: string
}

// ─────────────────── монолитный JSON кампании (итерация 8, блок F) ───────────────────

/**
 * Диалог в монолитном JSON: обычный формат конструктора (.dlg.json) ИЛИ
 * «сырой» ink-исходник (запасной вариант для продвинутых генераторов;
 * .ink из DlgDoc генерируется при импорте).
 */
export interface MonolithRawInk {
  label?: string
  ink: string
}

export type MonolithDialogue = DlgDoc | MonolithRawInk

/**
 * «Кампания одним JSON» — формат обмена и ИИ-генерации (блок F).
 * Ключи словарей — id объектов (как в самих определениях). При импорте
 * валидатор чинит ссылки (создаёт заглушки, отключает битое) и раскладывает
 * документ обратно в Campaign Package; .ink для диалогов генерируется из
 * DlgDoc. Полный описательный схемы — docs/campaign.schema.json,
 * гайд для генераторов — docs/ai-campaign-guide.md.
 */
export interface MonolithDoc {
  campaign: CampaignMeta
  world: WorldDef
  scenes: Record<string, SceneDef>
  entities: Record<string, EntityDef>
  rules: Record<string, RuleDef>
  quests: Record<string, QuestDef>
  arenas: Record<string, ArenaDef>
  cutscenes: Record<string, CutsceneDef>
  /** таблицы случайных встреч (в Campaign Package лежат в rules/encounters.json) */
  encounters?: Record<string, EncounterTableDef>
  /** диалоги по id (имя файла без расширения) */
  dialogues: Record<string, MonolithDialogue>
}
