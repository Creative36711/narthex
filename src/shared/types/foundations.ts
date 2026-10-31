import type { TimeOfDay } from './world'


import type { Condition, Effect } from './rules'


/**
 * Narthex — типы формата кампании (Campaign Package).
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
  /** текущая погода: «Тепло убывает, пока метель» (design-doc §9, пункт 2) */
  | { type: 'weather'; weather: string; not?: boolean }

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
  /** Описание потребности для игрока (показывается в тултипе) */
  description?: string
  /** Короткая подпись для компактного отображения в HUD */
  short_label?: string
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

// ───────────────────────── статусы (блок 5 ТЗ «Гибкий движок») ─────────────────────────

/**
 * Длительное изменяющее состояние: яд, кровотечение, бафф. В мире живёт в
 * тиках, в бою — в раундах. Реестр статусов — в `campaign.json` (meta.statuses).
 */
export interface StatusDef {
  id: string
  label: string
  /** Короткая подпись для компактного отображения в HUD */
  short_label?: string
  description?: string
  /** иконка-файл/ссылка; нет — текстовый чип */
  icon?: string
  /** индивидуальный звук при наложении статуса */
  apply_sound?: string
  /** индивидуальный звук при спаде/снятии статуса */
  remove_sound?: string
  /** мир — тики, бой — раунды; 'both' — и там и там */
  scope: 'world' | 'combat' | 'both'
  /** длительность по умолчанию (мировые тики / боевые раунды) */
  duration: number
  /** урон за тик (мир) / за раунд (бой) */
  dot?: { hp?: number; mp?: number }
  /** модификаторы навыков на время статуса */
  skill_mods?: Array<{ skill: string; delta: number }>
  /** аддитив к движению (итог не ниже 1) */
  mov_mod?: number
  on_apply?: Effect[]
  on_expire?: Effect[]
  apply_message?: string
  expire_message?: string
  /**
   * Болезни и яды с течением (аудит B7): каждые interval_ticks мировых
   * тиков — спасбросок CON × con_multiplier. Успех — тяжесть −1 (0 —
   * выздоровление), провал — +1 (нарастает до severity_max). Урон от
   * течения времени и модификаторы навыков умножаются на текущую тяжесть.
   */
  disease?: {
    /** период спасбросков CON, мировых тиков */
    interval_ticks: number
    /** множитель CON (умолчание 5) */
    con_multiplier?: number
    /** предел тяжести (умолчание 5) */
    severity_max?: number
  }
}

/**
 * Черта прокачки (аудит B8, meta.progression.feats): постоянный бонус героя.
 * Месяет навыки, характеристики, HP/MP, движение; условия доступности —
 * обычные условия кампании (requires).
 */
export interface FeatDef {
  id: string
  label: string
  description?: string
  /** условия-предпосылки: все истинны — черту можно взять */
  requires?: Condition[]
  /** постоянные прибавки при взятии */
  mods?: {
    skills?: Record<string, number>
    stats?: Partial<Record<'STR' | 'CON' | 'SIZ' | 'DEX' | 'INT' | 'POW' | 'CHA' | 'EDU', number>>
    hp?: number
    mp?: number
    mov?: number
  }
}

// ───── мета-прогресс между забегами (аудит B8b) ─────

/** Метавалюта: копится между забегами, тратится на постоянные усиления. */
export interface MetaCurrencyDef {
  id: string
  label: string
  icon?: string
  description?: string
}

/**
 * Достижение кампании: условие истинно при проверке (тик, эффекты, конец
 * забега) → открывается навсегда. Либо счётчик stats-суммы к цели.
 * Награда — в метавалюте или в опыте текущего забега.
 */
export interface AchievementDef {
  id: string
  label: string
  description?: string
  icon?: string
  /** не показывать в списке до открытия */
  hidden?: boolean
  /** условия — все истинны для открытия (иначе счётчик) */
  conditions?: Condition[]
  /** накопительная метрика: поле stats_run суммируется по всем забегам */
  counter?: { stat: 'travels' | 'dialogues' | 'ticks_survived' | 'kills' | 'quests_completed'; target: number }
  /** награда при открытии */
  reward?: { currency?: string; amount?: number; xp?: number }
}

/** Постоянное усиление, купленное за метавалюту; действует каждом новом забеге. */
export interface MetaUnlockDef {
  id: string
  label: string
  description?: string
  icon?: string
  /** цена в метавалютах */
  cost: { currency: string; amount: number }[]
  /** эффекты, исполняемые один раз при старте каждого нового забега */
  grants: Effect[]
  /** условия видимости/доступности в магазине (все истинны) */
  requires?: Condition[]
}

/**
 * Снимок мета-хранилища кампании (localStorage `narthex:meta:<id>`):
 * счётчики забегов, метавалюты, открытые достижения, купленные усиления,
 * суммарная статистика всех забегов.
 */
export interface MetaStoreState {
  runs: number
  deaths: number
  victories: number
  currencies: Record<string, number>
  /** id достижения → дата открытия (ISO) */
  achievements: Record<string, string>
  unlocks: string[]
  counters: Record<string, number>
  /** id концовок, которые игрок уже видел (meta_counter: endings_seen) */
  endings?: string[]
}

/** Конфиг мета-прогресса кампании (включён самим наличием блока). */
export interface MetaProgressDef {
  /** метавалюты */
  currencies?: MetaCurrencyDef[]
  /** реестр достижений */
  achievements?: AchievementDef[]
  /** магазин постоянных усилений */
  unlocks?: MetaUnlockDef[]
}

/** Активный статус: сколько осталось (тиков в мире, раундов в бою). */
export interface ActiveStatus {
  id: string
  left: number
  /** текущая тяжесть болезни/яда (аудит B7); по умолчанию 1 */
  severity?: number
  /** мировой тик следующей стадии (спасброска CON) */
  next_check?: number
}

// ───────────────────────── боевые способности (блок 6 ТЗ «Гибкий движок») ─────────────────────────

/**
 * Способность бойца: тратит MP, имеет кулдаун, бьёт/лечит/вешает статус.
 * Реестр — в `campaign.json` (meta.abilities); НПС получают `abilities: [id…]`.
 */
export interface AbilityDef {
  id: string
  label: string
  description?: string
  mp_cost: number
  /** кулдаун в раундах (по умолчанию 0) */
  cooldown_rounds?: number
  /** дальность в гексах (1 = вплотную) */
  range: number
  /** навык попадания; нет — гарантированное применение */
  skill?: string
  kind: 'damage' | 'status' | 'heal'
  /** для kind 'damage', напр. '1d6+2' (бонус силы НЕ добавляется) */
  damage?: string
  /** для kind 'status' */
  status?: string
  status_duration?: number
  /** для kind 'heal', напр. '1d6' */
  heal?: string
  /**
   * Требует подготовки в слот (аудит §5.6, магия): работает, когда у кампании
   * задано meta.magic.slots — герой использует способность, только если она
   * подготовлена заранее (в листе персонажа, вне боя). Без слотов кампании —
   * поле ни на что не влияет.
   */
  prepare?: boolean
  /**
   * Откат силы при критическом провале броска навыка применения (магический
   * backlash, аудит §5.6): бросок по весам, запись действует на ЗАКЛИНАТЕЛЯ.
   * hp_delta/mp_delta — знаковые (минус — урон/потеря), status — из реестра.
   * Нет таблицы — критический провал остаётся просто промахом.
   */
  backlash_table?: Array<{
    weight: number
    /** строка в журнал (нет — стандартная «Нарушение силы») */
    text?: string
    hp_delta?: number
    mp_delta?: number
    status?: string
    status_duration?: number
  }>
}

// ───────────────────────── боевые правила кампании (аудит §5.6) ─────────────────────────

/**
 * Боевые правила кампании: всё отдаётся мастеру, отсутствие поля —
 * поведение кампаний до появления блока (обратная совместимость).
 */
export interface CombatRulesDef {
  /**
   * Бегство игрока из боя. Умолчание `true` (кнопка «Бежать» в бою);
   * `false` — бегство запрещено во всей кампании. Объект: `{ skill }` —
   * навык проверки отступления (умолчание `dodge`; нет такого навыка у
   * героя — бросок DEX×5). Точечный запрет боя — `no_flee` в start_combat.
   */
  flee?: boolean | { skill?: string }
  /**
   * Штраф каждой СЛЕДУЮЩЕЙ атаки бойца в том же раунде (оружие с
   * `attacks_per_round > 1`): второй удар идёт на penalty×1, третий — ×2…
   * Умолчание −20 (разделение навыка по духу BRP); 0 — все атаки ровные.
   */
  multi_attack_penalty?: number
  /**
   * Прицельная атака: действие «Прицелиться» тратит одну атаку из края и
   * даёт +bonus к следующей (умолчание вкл., бонус +20). false — выкл.
   */
  aim?: boolean | { bonus?: number }
  /**
   * Атаки возможности (аудит B5): уход из гекса, угрожаемого врагом,
   * вызывает у него бесплатный удар. Умолчание вкл. (книжно); false — выкл.
   */
  opportunity_attacks?: boolean
  /**
   * Таблица критических провалов мастера: бросок по весам при fumble.
   * Нет — fumble лишь промах (и износ оружия, если задана прочность).
   */
  fumble_table?: Array<{
    weight: number
    /** что случается с бойцом */
    kind: 'drop_weapon' | 'stuck' | 'self_hit' | 'skip_next'
    /** строка для журнала (нет — стандартная) */
    text?: string
  }>
  /**
   * Таблица критических успехов мастера (близнец fumble_table): бросок
   * по весам при критическом ударе.
   * - max_damage — книжный крит: максимум костей, броня не спасает (как обычно);
   * - double_damage — урон бросается обычно и удваивается (броня учитывается);
   * - disarm — книжный крит + цель разоружена;
   * - status — книжный крит + на цель статус из реестра.
   * Нет — крит всегда книжный (max_damage).
   */
  crit_table?: Array<{
    weight: number
    kind: 'max_damage' | 'double_damage' | 'disarm' | 'status'
    /** id статуса реестра (kind='status') */
    status?: string
    /** длительность статуса в ходах (нет — как записано в реестре) */
    duration?: number
    /** строка для журнала (нет — стандартная) */
    text?: string
  }>
  /**
   * Удар в спину / фланговый удар (аудит §5.6): атака из задней дуги цели
   * (за направлением её взгляда; дуга по умолчанию 120° — задний гекс и два
   * задне-фланговых) лишает цель защиты, а при damage_bonus добавляет
   * кости урона («1d4»). false/нет — механика выключена.
   */
  flank?: boolean | { arc?: number; damage_bonus?: string }
  /**
   * Укрытия на арене: дальнобойная атака (дальность оружия > 1) по бойцу,
   * стоящему на гексе укрытия (cover_hexes в разметке арены), получает
   * штраф к навыку (умолчание −20). На движение укрытия не влияют.
   * false/нет — механика выключена.
   */
  cover?: boolean | { penalty?: number }
  /**
   * Хит-локации (книжная опция, аудит §5.6 — РЕШЕНИЕ МАСТЕРА).
   * При удачном ударе бросается d100 и выбирается локацию попадания:
   * у неё свой множитель урона, своя броня (нет — общая) и статусы
   * при ранении/крите. Умолчание — ВЫКЛЮЧЕНО (единое тело).
   */
  hit_locations?: {
    /** процентная таблица; диапазоны [from..to] должны покрыть 1..100 */
    table: Array<{
      from: number
      to: number
      /** название локации («голова», «тело», «правая рука»…) */
      label: string
      /** множитель урона локации (умолчание ×1) */
      damage_mult?: number
      /** броня локации в очках (нет — общая броня защитника) */
      armor?: number
      /** статус цели при пробившем ударе */
      status_on_hit?: string
      /** статус цели при критическом ударе */
      status_on_crit?: string
      /** строка журнала (нет — «Попадание: <label>») */
      text?: string
    }>
  }
  /**
   * Правила гибели героя.
   * `instant` (умолчание) — 0 HP = смерть (рогалик-классика).
   * `brp` — книжный вариант: единичный удар ≥ половины максимума HP —
   * тяжёлая рана (спасбросок CON×con_multiplier, провал — потеря сознания
   * до конца боя); при падении HP до нуля — последний спасбросок CON:
   * успех — герой выживает без сознания (1 HP), бой проигран, а последствия
   * проигрыша задаёт мастер (`on_defeat` у эффекта start_combat; не задано —
   * раны смертельны, смерть как обычно). Провал спасброска — смерть.
   * Действует и на мировой урон вне боя (change_hp).
   */
  death?: { mode?: 'instant' | 'brp'; con_multiplier?: number }
}
