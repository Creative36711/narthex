import type { InventoryEntry, StatBlock } from './entities'


import type { ActiveStatus } from './foundations'


// ───────────────────────── состояние игры (сейв) ─────────────────────────

export interface PlayerState {
  entity: string
  /** имя героя, выбранное при создании персонажа (блок 11 ТЗ) */
  name?: string
  /** возраст героя (если мастер включил выбор; аудит §5.6) */
  age?: number
  /** id подготовленных способностей магии (meta.magic.slots, аудит §5.6) */
  prepared_abilities?: string[]
  /**
   * Облик героя: выбор игрока из галереи (gallery = id портрета) и/или
   * по сегментам (layers = id сегмента → id варианта).
   */
  portrait_choice?: { gallery?: string; layers?: Record<string, string> }
  /** id выбранного уровня сложности (meta.difficulties мастера) */
  difficulty?: string
  /** короткая биография героя (если мастер включил; аудит §5.6) */
  bio?: string
  stats: StatBlock
  skills: Record<string, number>
  /** «галочки» роста навыков (experience checks, ТЗ 4.3) */
  skill_marks: Record<string, boolean>
  hp: number
  max_hp: number
  mp: number
  max_mp: number
  /** текущие очки удачи (аудит §5.6 п.8); отсутствует в старых сейвах — считается полным (POW×множитель) */
  luck?: number
  /** очки усталости (аудит B6, opt-in meta.vitals.fatigue); max = (STR+CON)×множитель */
  fatigue?: number
  /** рассудок (аудит B6, opt-in meta.vitals.sanity); старт = POW×множитель */
  sanity?: number
  /** репутация (аудит B6, opt-in meta.reputation): шкала мастера, старт 0 */
  reputation?: number
  /** уровень достатка (аудит B6, opt-in meta.wealth_levels): индекс в шкале */
  wealth_level?: number
  /** страсти (аудит B6): id → значение 0..100+; реестр в meta.passions_list */
  passions?: Record<string, number>
  /** причастность (аудит B6): id силы/богини → очки; реестр в meta.allegiances */
  allegiance?: Record<string, number>
  /** опыт и уровень (аудит B8, opt-in meta.progression); старт 0/1 */
  xp?: number
  level?: number
  /** взятые черты (аудит B8) */
  feats?: string[]
  needs: Record<string, number>
  inventory: InventoryEntry[]
  /** устаревшее поле сохранений; актуальный баланс валют хранится в inventory как предметы-монеты */
  currencies?: Record<string, number>
  /** экипировка игрока: слот → предмет из инвентаря (блок 7 ТЗ; слоты задаёт кампания) */
  equipment: Record<string, string>
  /** активные статусы игрока (блок 5 ТЗ); left — мировые тики */
  statuses?: ActiveStatus[]
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
  /**
   * Приказ напарнику на бой (аудит §5.6 п.11):
   * 'free' (умолчание, AI сам), 'follow' (держаться рядом, не нападая),
   * 'hold' (стоять и защищаться), 'retreat' (держаться подальше, не нападать).
   */
  order?: 'free' | 'follow' | 'hold' | 'retreat'
  /** живые потребности напарника (только id из NpcDef.companion_needs):
   *  need id → текущее значение 0..NeedDef.max; создаются при вступлении */
  needs?: Record<string, number>
  /** собственная сумка напарника (если у NpcDef включён companion_carry) */
  inventory?: InventoryEntry[]
  /** надетое снаряжение напарника: слот из meta.equipment_slots → id предмета
   *  из его сумки; в бою замещает equipment карточки NPC */
  equipment?: Record<string, string>
  /** цель приказа 'focus' на этот бой: id подразделения противника (в памяти боя) */
  focus?: string
}
