import type { Condition, Effect } from './rules'


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
    /** гексы-укрытия (мастер размечает кистью «Укрытие»); влияют на стрельбу, если в правилах боя включены укрытия */
    cover_hexes?: HexCoord[]
  }
  /** зоны появления сторон. player — спавн ВСЕГО отряда: точки выдаются по очереди
   *  (первая — герою, дальше — напарникам по порядку отряда); гексов должно быть
   *  не меньше, чем герой + максимум напарников кампании. Непроходимые точки зоны
   *  движок пропускает; переполненный боец встаёт в ближайший свободный к герою. */
  spawn_zones: {
    player: { hexes: HexCoord[] }
    enemy: { hexes: HexCoord[] }
  }
  ambient_audio?: string
  /** id трека реестра music_tracks (если нет — трек боя кампании по умолчанию) */
  music?: string
}

// ───────────────────────── рецепты крафта (блок 4 ТЗ «Гибкий движок») ─────────────────────────

/**
 * Рецепт изготовления: компоненты (+ инструменты) → предмет. Проверка
 * навыка — родная BRP-механика (успех ставит «галочку» опыта).
 */
export interface RecipeDef {
  id: string
  label: string
  description?: string
  /** расходуемые компоненты */
  inputs: Array<{ item: string; quantity: number }>
  /** инструменты: нужны в инвентаре, НЕ расходуются */
  tools?: string[]
  /**
   * Рецепт починки (аудит §5.6 п.10): результат — не новый предмет, а
   * восстановленная прочность сломанного/изношенного экземпляра `output.item`
   * до максимума. Игрок выбирает, какой экземпляр чинить.
   */
  repair?: boolean
  /** декларативные условия возможности крафта (локация, флаг, …) */
  requires?: Condition[]
  /** проверка навыка при изготовлении; успех = создал и ставит «галочку» опыта, провал = компоненты целы (время промаха — fail_time_ticks) */
  skill?: { id: string; difficulty: SkillDifficulty }
  /** время изготовления (промотка тиков после успеха) */
  time_ticks?: number
  /** время неудачной попытки (промотка тиков при провале проверки навыка; по умолчанию 0 — промах бесплатен).
   *  Экономика попыток: если успех стоит часы, а провал — ноль, игрок рационально давит «Изготовить» до победы;
   *  BRP-привычная цена промаха время/материалы, поэтому для верстачной работы с проверкой задавайте хотя бы малое значение. */
  fail_time_ticks?: number
  /** результат */
  output: { item: string; quantity: number }
  /** сообщение об успехе (нет — стандартное) */
  message?: string
  /**
   * `false` — рецепт скрыт от игрока до эффекта `unlock_recipe` (правило,
   * диалог, событие). Старые кампании и сейвы не трогаем: поля нет — рецепт
   * известен с самого начала.
   */
  known?: boolean
  /** индивидуальный звук изготовления (например, звон наковальни, шипение реактивов, шорох шитья) */
  sound?: string
  sound_volume?: number
  /** динамические условия знания/доступности рецепта (навыки, флаги, черты, квесты) */
  conditions?: Condition[]
  /**
   * Требуется стационарный верстак / мастерская (boolean или id рабочего места).
   * Без верстака в полевых условиях такой предмет изготовить нельзя.
   */
  workbench?: boolean | string
  /** категория рецепта для фильтрации мастера и игрока */
  category?: string
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
  /** глава (id из meta.chapters) — группировка в редакторе */
  chapter?: string
}

// ───────────────────────── случайные встречи (ТЗ 3.8) ─────────────────────────

/**
 * Сложность проверки навыка (аудит §5.6 п.7): число — старый порог
 * (50 нейтрально, больше — труднее), строка — книжный уровень:
 * 'easy' ×2, 'normal' ×1, 'difficult' ½, 'impossible' ¼.
 */
export type SkillDifficulty = number | 'easy' | 'normal' | 'difficult' | 'impossible'

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
      difficulty: SkillDifficulty
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

/** JSON-файл-обёртка для таблиц встреч в rules/ (отдельный формат Campaign Package). */
export interface EncounterFileDef {
  encounter_tables: EncounterTableDef[]
}

/** manifest.json — список модулей Campaign Package, по одному JSON/Ink-файлу на сущность. */
export interface CampaignManifest {
  scenes: string[]
  entities: string[]
  /** файлы ПРАВИЛ (RuleDef: id/label/once/conditions/effects). Файлы таблиц встреч
   *  (`encounter_tables`) сюда НЕ перечисляют — только в `encounters`. */
  rules: string[]
  arenas?: string[]
  quests?: string[]
  /** файлы-обёртки таблиц встреч `{ encounter_tables: [...] }`: сами лежат в
   *  каталоге rules/, но перечисляются ТОЛЬКО здесь (дыра: дубль в `rules`
   *  давал «правило» без id/conditions и ронял движок и редактор). */
  encounters?: string[]
  cutscenes?: string[]
  recipes?: string[]
  codex?: string[]
  dialogues: string[]
}

/** Одна запись общего public/campaigns/index.json. */
export interface CampaignIndexEntry {
  id: string
  title: string
  description?: string
  author?: string
}
