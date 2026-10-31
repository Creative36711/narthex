import type { CompanionState, PlayerState, QuestState } from './state'


import type { Effect, RuleDef } from './rules'


import type { CampaignMeta } from './campaign'


import type { WorldDef } from './world'


import type { CodexEntryDef, SceneDef } from './world-rules'


import type { EntityDef } from './entities'


import type { ArenaDef, EncounterTableDef, QuestDef, RecipeDef } from './adventure'


import type { CutsceneDef } from './audio'


import type { DlgDoc } from './dialogue'


/**
 * Встроенные слоты экипировки (блок 7 ТЗ): присутствуют всегда, даже если
 * мастер добавил свои (фэнтези-амулеты, киберпанк-импланты…).
 */
/**
 * Слоты экипировки задаёт ТОЛЬКО кампания (блок 7 + правка «без хардкода»):
 * встроенных слотов нет — мастер сам решает, куда персонаж что надевает.
 * Броня всех надетых слотов по-прежнему суммируется в бою (механика BRP).
 */
export function equipmentSlots(meta: { equipment_slots?: Array<{ id: string; label: string }> }): Array<{ id: string; label: string }> {
  return (meta.equipment_slots ?? []).map((s) => ({ ...s }))
}

export interface GameState {
  save_version?: number
  campaign_id: string
  seed: string
  tick: number
  region: string
  location: string
  scene: string
  /** текущая погода (блок 9 ТЗ): id из реестра; нет — ясно */
  weather?: string
  /**
   * Скрытность (аудит §5.6 п.12): `sneaking` — герой крадётся;
   * `detected` — замечен (NPC в этой сцене видят вас; сбрасывается при
   * смене сцены). Поля нет в старых сейвах — считается «не крадётся».
   */
  stealth?: { sneaking: boolean; detected: boolean }
  /** разблокированные записи кодекса (блок 10 ТЗ) */
  codex_unlocked?: string[]
  /** рецепты, открытые эффектом unlock_recipe (RecipeDef.known = false) */
  recipes_unlocked?: string[]
  /** одноразовые варианты взаимодействия с предметами, использованные в этом забеге: "item:<id>:<option_index>" */
  used_item_interacts?: string[]
  /** состояние облика НПЦ, заданное правилом (set_entity_state): id → ключ */
  entity_states?: Record<string, string>
  /** выбор создания персонажа (блок 11 ТЗ): имя, характеристики, навыки, происхождение и призвание */
  char_choice?: {
    name: string
    stats: Record<string, number>
    profession: string
    calling?: string
    skills: Record<string, number>
  }
  /** id персонажей, чьи имена раскрыты игроку (механика «Незнакомец») */
  known_npcs?: string[]
  /** id сцен, для которых вводное повествование (narrative_intro) уже было просмотрено */
  seen_narrative_intros?: string[]
  flags: Record<string, boolean>
  variables: Record<string, number | string>
  /** динамические описания сущностей (действие set_description) */
  desc_overrides?: Record<string, string>
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
  /** совершённые преступления героя: id → награда и тик (аудит B7) */
  crimes?: Record<string, { bounty: number; tick: number }>
  /** активные ценовые события (аудит B7) */
  price_events?: string[]
  party: CompanionState[]
  /** остатки товаров на складах торговцев: traderId -> itemId -> текущий остаток */
  trader_stocks?: Record<string, Record<string, number>>
  /** выкупленные торговцем предметы у игрока: traderId -> массив выкупленных товаров для обратной продажи */
  trader_bought_items?: Record<string, Array<{ item: string; price?: number; stock?: number }>>
  /**
   * Самочувствие NPC (потребность в отдыхе, аудит §5.6): 0..100, умолчание 50.
   * Каждую новую сутки: персонаж, у которого расписание покрывает ночь,
   * отсыпается (+10), иначе устаёт (−10). Отклонение от 50 влияет на
   * отношение к герою (±25) — видно в диалогах и ценах торговли.
   */
  npc_mood?: Record<string, number>
  /**
   * Активное преследование (эффект start_pursuit, аудит §5.6):
   * тикает при ходе времени, провалом цепочки маскировки настигает.
   */
  /** круг New Game+ (0 — первый забег; растёт при каждом повторном старте) */
  ng_cycle?: number
  pursuit?: {
    label?: string
    skill: string
    every: number
    fails_needed: number
    fails: number
    left: number
    on_fail: Effect[]
  }
  blocked_paths: string[]
  log: string[]
  game_over: null | { type: 'death' | 'victory'; reason: string; ending?: string }
  stats_run: { travels: number; dialogues: number; ticks_survived: number; kills: number; quests_completed: number }
}

// ───────────────────────── загруженная кампания ─────────────────────────

export interface CampaignData {
  meta: CampaignMeta
  world: WorldDef
  scenes: Record<string, SceneDef>
  entities: Record<string, EntityDef>
  rules: Record<string, RuleDef>
  /** Порядок правил манифеста; отсутствует у программно созданных кампаний. */
  ruleOrder?: string[]
  arenas: Record<string, ArenaDef>
  quests: Record<string, QuestDef>
  encounters: Record<string, EncounterTableDef>
  /** Порядок таблиц встреч манифеста. */
  encounterOrder?: string[]
  /** катсцены по id (итерация 8, блок E) */
  cutscenes: Record<string, CutsceneDef>
  /** рецепты крафта по id (блок 4 ТЗ) */
  recipes: Record<string, RecipeDef>
  /** записи кодекса/бестиария по id (блок 10 ТЗ) */
  codex: Record<string, CodexEntryDef>
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
  /** рецепты крафта по id (блок 4 ТЗ; файлы в recipes/) */
  recipes?: Record<string, RecipeDef>
  /** записи кодекса/бестиария по id (блок 10 ТЗ; файлы в codex/) */
  codex?: Record<string, CodexEntryDef>
  /** диалоги по id (имя файла без расширения) */
  dialogues: Record<string, MonolithDialogue>
}

/** Канонический перечень ключей для документации и промпта генерации. */
export const MONOLITH_REQUIRED_KEYS = [
  'campaign', 'world', 'scenes', 'entities', 'rules', 'quests', 'arenas', 'cutscenes', 'dialogues',
] as const satisfies readonly (keyof MonolithDoc)[]
export const MONOLITH_OPTIONAL_KEYS = ['encounters', 'recipes', 'codex'] as const satisfies readonly (keyof MonolithDoc)[]

/** Получить настраиваемую системную надпись интерфейса с фоллбэком по умолчанию */
export function getUiLabel(meta: CampaignMeta | undefined, key: string, fallback: string): string {
  const val = meta?.ui_labels?.[key]?.trim()
  return val || fallback
}
