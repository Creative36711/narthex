/**
 * Chronicle Forge — типы формата кампании (Campaign Package).
 * Соответствуют ТЗ, раздел 3.
 */

// ───────────────────────── campaign.json ─────────────────────────

export interface NeedDef {
  id: string
  label: string
  max: number
  decay_per_tick: number
  critical_threshold: number
  on_zero_effect?: string // id правила-эффекта либо встроенный: "death"
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

export interface SceneStateDef {
  id: string
  label: string
  image: string
  condition: SceneCondition | null
}

export type SlotType = 'person' | 'item' | 'container' | 'furniture' | 'animal'

export interface SlotDef {
  id: string
  type: SlotType[]
  shape: 'rect'
  x: number
  y: number
  w: number
  h: number
  default_entity?: string
  condition: SceneCondition | null
}

export interface NavigationZone {
  area: { x: number; y: number; w: number; h: number }
  go_to_scene?: string
  go_to_location?: string
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
  schedule?: ScheduleEntry[]
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

export const SAVE_VERSION = 2

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
  dialogues: Record<string, string> // путь -> исходник .ink
  basePath: string
}
