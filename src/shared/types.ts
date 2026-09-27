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

// ───────────────────────── статусы (блок 5 ТЗ «Гибкий движок») ─────────────────────────

/**
 * Длительное изменяющее состояние: яд, кровотечение, бафф. В мире живёт в
 * тиках, в бою — в раундах. Реестр статусов — в `campaign.json` (meta.statuses).
 */
export interface StatusDef {
  id: string
  label: string
  description?: string
  /** иконка-файл/ссылка; нет — текстовый чип */
  icon?: string
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
 * Снимок мета-хранилища кампании (localStorage `chronicle-forge:meta:<id>`):
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

export interface CurrencyDef {
  /** id валюты для цен и value предметов */
  id: string
  label: string
  symbol: string
  /** предмет-монета в инвентаре; старые кампании используют соглашение item_<id> */
  item_id?: string
  exchange_rate?: Record<string, number>
}

/** «происхождение» героя при создании персонажа (блок 11 ТЗ) */
export interface ProfessionDef {
  id: string
  label: string
  description?: string
  /** бонусы к навыкам (бесплатные, не тратят бюджет) */
  skill_bonus: Record<string, number>
  /** стартовое снаряжение */
  items?: Array<{ item: string; quantity: number }>
  /**
   * стартовое распределение характеристик, которое задаёт мастер:
   * абсолютные значения семи характеристик (в рамках stat_limits).
   * Нет — все характеристики начинают с минимума.
   */
  stats?: Record<string, number>
}

/**
 * «Призвание» — второй шаблон создания персонажа (фидбек 19): если
 * происхождение распределяет характеристики, то призвание — стартовые
 * НАВЫКИ. Мастер обязан распределить весь бюджет skill_points (значения —
 * абсолютные стартовые проценты, считая от нижнего порога), игрок после
 * выбора может убавлять/прибавлять в рамках бюджета.
 */
export interface CallingDef {
  id: string
  label: string
  description?: string
  /** стартовые значения навыков (абсолютные, ≥ нижнего порога) */
  skills: Record<string, number>
}

/**
 * Создание персонажа (блок 11 ТЗ). Всё задаёт мастер кампании —
 * встроенных значений и «происхождений по умолчанию» в движке нет.
 * Нет самого блока `char_creation` — забег стартует готовым шаблоном.
 */
export interface CharCreationDef {
  /** бюджет характеристик (очки сверх минимума) */
  total_points: number
  /** пороги каждой характеристики (задаёт мастер) */
  stat_limits: { min: number; max: number }
  /** бюджет навыков (нет — покупки навыков выключены) */
  skill_points?: number
  /** порог навыка сверху (нет — без верхнего порога) */
  skill_cap?: number
  /** порог навыка снизу (нет — 0) */
  skill_floor?: number
  /** обязательные навыки (стартуют с 25%) */
  mandatory_skills?: string[]
  /** нельзя покупать */
  forbidden_skills?: string[]
  /** «происхождения» — шаблоны героя (распределяют характеристики) */
  professions?: ProfessionDef[]
  /** «призвания» — шаблоны стартовых навыков (фидбек 19) */
  callings?: CallingDef[]
  /** ввод имени героя */
  choose_name?: boolean
  /**
   * Генерация характеристик КУБИКАМИ (аудит §5.6 п.5, базовый метод BRP).
   * Задано — на экране создания появляются броски вместо бюджета очков;
   * распределение `profession.stats` в этом режиме игнорируется.
   */
  roll?: {
    /** базовая формула для всех характеристик (умолчание '3d6', BRP) */
    notation?: string
    /** переопределения по характеристикам (BRP: INT/SIZ — '2d6+6') */
    per_stat?: Record<string, string>
    /**
     * сколько наборов бросать за раз, игрок выбирает один (умолчание 1;
     * BRP-практика «брось три набора — возьми один» без перебросов)
     */
    arrays?: number
    /**
     * перебросы: сколько характеристик можно перекинуть по одной штуке
     * после выбора набора (умолчание 0)
     */
    rerolls?: number
    /**
     * очков на перераспределение между характеристиками после выбора
     * набора (BRP разрешает сдвинуть до 3; умолчание 0)
     */
    redistribute?: number
  }
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
  /** краткая справка о фракции */
  description?: string
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
  /** звуки взаимодействий категории предметов (хук → id звука) */
  sounds?: SoundHookMap
}

/**
 * Профиль механик кампании (блок 1 ТЗ «Гибкий движок»). Каждое поле —
 * выключатель подсистемы; ОТСУТСТВУЮЩЕЕ поле (или весь `features`) означает,
 * что механика ВКЛЮЧЕНА — старые кампании работают без изменений.
 * Тумблеры скрывают подсистему и в движке, и в интерфейсе игрока.
 */
export interface CampaignFeatures {
  /** карта мира и путешествия между локациями */
  map?: boolean
  /** инвентарь, экипировка, предметы в бою (эффекты предметов продолжают работать) */
  inventory?: boolean
  /** потребности и их убывание/восстановление */
  needs?: boolean
  /** навыки: проверки резолвятся успехом без броска, рост отключён */
  skills?: boolean
  /** панель отношений (сами отношения продолжают меняться — могут гейтить диалоги) */
  relationships?: boolean
  /** торговля */
  trade?: boolean
  /** тактический бой: конфликты резолвятся немедленной победой */
  combat?: boolean
  /** отображение часов и времени суток (ход времени остаётся) */
  time?: boolean
}

/** механика включена, если поле отсутствует или истинно */
export function featureOn(meta: CampaignMeta, key: keyof CampaignFeatures): boolean {
  return meta.features?.[key] !== false
}

/**
 * Шрифт кампании (блок 2 ТЗ «Гибкий движок»): файл пакета (обычно
 * `assets/fonts/…`) или внешняя ссылка. Подключается `@font-face` на лету.
 */
export interface FontDef {
  id: string
  label: string
  src: string // .woff2/.woff/.ttf/.otf
  /** начертание для @font-face (например '400', '700'); по умолчанию '400' */
  weight?: string
  style?: 'normal' | 'italic'
}

/**
 * Игровой визуальный профиль (редизайн 2026): «стартовый художественный набор»,
 * а не тип механики. Профиль задаёт палитру, типографику, формы, стиль панелей
 * и именованный атмосферный эффект; поверх него автор допустимо
 * переопределяет акцент, шрифтовые роли, фоны и атмосферу (см. ThemeDoc).
 * Меняет только оформление — ни правил, ни dice_rules, ни данных.
 */
export type VisualProfileId =
  | 'forge'
  | 'epic-fantasy'
  | 'dark-fantasy'
  | 'myth-folklore'
  | 'gothic-horror'
  | 'cosmic-horror'
  | 'noir'
  | 'historical'
  | 'wilderness'
  | 'postapocalypse'
  | 'scifi'
  | 'cyberpunk'
  | 'modern'

/**
 * Тема оформления кампании (блок 2 ТЗ). Применяется ТОЛЬКО к Player Mode;
 * редактор остаётся в фирменном стиле. Палитра переопределяется ограниченно —
 * только акцентный цвет, чтобы мастер не сломал контрасты.
 */
export interface ThemeDoc {
  /**
   * визуальный профиль игры: «Фэнтези» / «Хоррор» / «Выживание».
   * Не задан — «Фэнтези» (наследие темы «Пепла Каэрдена»).
   * Старые кампании без этого поля открываются без изменений.
   */
  profile?: VisualProfileId
  /**
   * атмосферный эффект профиля (виньетка/зерно/чистый кадр).
   * Не задан или true — эффект профиля включён; false — чистый кадр.
   */
  atmosphere?: boolean
  /** роли шрифтов — id из `meta.fonts`; отсутствует роль — системный шрифт */
  fonts?: {
    /** основной текст: диалоги, панели, кнопки */
    body?: string
    /** заголовки: названия сцен и панелей, меню */
    display?: string
    /** «рукописный»: журнал, записки, кодекс */
    hand?: string
  }
  menu?: {
    /** фон главного меню (файл пакета или ссылка) */
    background?: string
    /** затемнение фона 0…0.9 для читаемости текста (по умолчанию 0.5) */
    dim?: number
    /** медленный зум фона («кен-бёрнс») */
    ken_burns?: boolean
    /** арт/лого кампании над заголовком */
    title_art?: string
  }
  /** фон экрана финала; нет — используется фон меню */
  end?: { background?: string }
  /** акцентный цвет интерфейса (заменяет золото темы) */
  accent?: string
}

export interface CampaignMeta {
  id: string
  title: string
  /** версия кампании (semver). Задаёт мастер; на ней завязана совместимость сохранений */
  version: string
  /**
   * УСТАРЕВШЕЕ имя минимальной версии движка. Новое поле — `min_engine`;
   * движок читает оба (`effectiveMinEngine`), старые пакеты продолжают работать.
   */
  engine_version: string
  /**
   * Версия формата Campaign Package, под которую собран пакет
   * (`PACKAGE_FORMAT` в `shared/versions.ts` на момент экспорта).
   * Нет поля — пакет собран до введения формата (считается v1).
   */
  package_format?: number
  /** минимальная версия движка, на которой кампания работает корректно */
  min_engine?: string
  /**
   * Сохранения от какой версии кампании ещё поддерживаются. Задаёт редактор
   * при публикации обновления (сравнение пакетов), мастер только подтверждает.
   * Нет поля — поддерживаются любые сохранения этой кампании (чинятся
   * автоматически, `core/savemigrate.ts`).
   */
  save_base_version?: string
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
  /** реестр статусов: яды, кровотечения, баффы (блок 5 ТЗ) */
  statuses?: StatusDef[]
  /** реестр боевых способностей (блок 6 ТЗ) */
  abilities?: AbilityDef[]
  /** реестр слотов экипировки (блок 7 ТЗ); встроенные Оружие/Броня есть всегда */
  equipment_slots?: Array<{ id: string; label: string }>
  /** календарь кампании: свои месяцы и дни недели (блок 9 ТЗ) */
  calendar?: {
    /** «Летопись Каэрдена», «г.э.»… */
    year_label?: string
    /** default 1 */
    start_year?: number
    /** default 30 */
    days_per_month?: number
    /** названия месяцев (циклы); нет — «Месяц 1» */
    months?: string[]
    /** названия дней недели (циклы); нет — без имён */
    day_names?: string[]
  }
  /** реестр погод (блок 9 ТЗ) */
  weathers?: WeatherDef[]
  /**
   * Лагерь и ночлег (аудит B7): действие «Разбить лагерь» в HUD, когда
   * герой в локации с `camp: true`. Отсутствие блока — кнопки нет ни где!
   * Master решает длительность (ticks, умолчание 8), риск вылазки опасности
   * (ambush_chance 0..1, умолчание 0 — безопасный лагерь) и сюжет засады
   * (ambush_rule — правило из реестра rules).
   */
  camping?: {
    ticks?: number
    ambush_chance?: number
    ambush_rule?: string
  }
  /**
   * Числа опасностей (аудит B7): падение — по {fall_meters_per_die} метрам
   * на один кубик урона {fall_damage} (книжное умолчание 3 м на 1d6);
   * навык смягчения — эффектом (умолчание dodge).
   */
  hazards?: {
    fall_meters_per_die?: number
    fall_damage?: string
  }
  /**
   * Реестр преступлений (аудит B7): преступление регистрируется эффектом
   * commit_crime; последствия (награда за голову, реакция стражи) — правилами
   * мастера по условиям crime_committed / bounty_total_ge
   */
  crimes?: Array<{ id: string; label: string }>
  /**
   * Ценники под событием (аудит B7): война, блокада, ярмарка.
   * Событие активируется эффектом set_price_event (выключить —
   * clear_price_event) и действует на весь каталог, соответствующий
   * его фильтрам (предметы и/или категории; без фильтров — на всё).
   */
  price_events?: Array<{
    id: string
    label: string
    /** множитель цены (1.5 = +50% к выкупу у игрока; продажа — обратно пропорционально) */
    multiplier: number
    /** только эти предметы; нет — все */
    items?: string[]
    /** только эти категории; нет — все */
    categories?: string[]
  }>
  /**
   * финальные экраны (концовки): мастер задаёт сколько угодно; при завершении
   * забега движок берёт ПЕРВУЮ концовку, чьи условия выполнены (и чей `on`
   * совпадает с исходом). Нет подходящей — стандартный экран исхода.
   */
  endings?: EndingDef[]
  /**
   * реестр визуальных слоёв погоды (id + название) — «без хардкода»: список
   * для селекта «Слой» целиком задаёт кампания. Движок умеет рисовать слои
   * `rain`, `snow`, `fog`, `ash`; свои id рисуются классом `weather-<id>`
   * (стили мастер может добавить в тему оформления).
   */
  overlay_layers?: Array<{ id: string; label: string }>
  /** категории кодекса (блок 10 ТЗ); нет — встроенные три */
  codex_categories?: Array<{ id: string; label: string }>
  /** правила бросков d100 (пороги крита/особого успеха/провала); см. DEFAULT_DICE_RULES */
  dice_rules?: DiceRules
  /** реестр навыков кампании (id + русское название); см. shared/skills.ts */
  skills?: Array<{
    id: string
    label: string
    /**
     * Категория навыка (аудит B6): id из meta.skill_categories;
     * панели навыков группируют по категориям.
     */
    category?: string
    /**
     * Базовый шанс навыка без обучения (аудит B6, книжные «базовые шансы»):
     * число (напр. 25) или формула характеристик «DEX×2», «INT×5».
     * Нет — необученный навык даёт 0% (как раньше).
     */
    base?: number | string
  }>
  /** реестр категорий навыков (аудит B6): бой/общение/знания/крафт… */
  skill_categories?: Array<{ id: string; label: string }>
  /**
   * Производные опции BRP (аудит B6), всё выключаемо мастером:
   * - fatigue — очки усталости, max = (STR+CON)×multiplier (умолчание ×1);
   *   на отдыхе восстанавливаются (rest_restore ≠ false); траты задаёт
   *   мастер эффектами change_fatigue (бег, бессонница, тяжёлый доспех);
   * - sanity — рассудок = POW×multiplier (умолчание ×5), траты эффектами
   *   change_sanity; пороги/психозы — правилами на условия sanity_le.
   * Без блока систем нет (как раньше).
   */
  vitals?: {
    fatigue?: boolean | { multiplier?: number; rest_restore?: boolean }
    sanity?: boolean | { multiplier?: number }
  }
  /** репутация (аудит B6): вкл. — чип в HUD и строка в панели героя */
  reputation?: boolean | { label?: string }
  /** шкала достатка (аудит B6): названия от низшего к высшему, напр. ['Нищий','Бедный','Свободный','Знатный'] */
  wealth_levels?: string[]
  /** реестр страстей (аудит B6): id + название; значения 0..100+ */
  passions_list?: Array<{ id: string; label: string }>
  /** реестр сил причастности (аудит B6): боги, духи, стихии; очки до 100+ */
  allegiances?: Array<{ id: string; label: string }>
  /**
   * Уровень мощи кампании (аудит B6, книжные normal/heroic/epic/superhuman):
   * метка для условий power_level_ge и документации; характеристики/навыки
   * мастер задаёт через char_creation (для heroic — формулы 2d6+6 в roll).
   */
  power_level?: 'normal' | 'heroic' | 'epic' | 'superhuman'
  /**
   * Аугменты страстей и подмога союзников (аудит B6): одинаковые числа для
   * всех проверок. threshold — минимальное значение страсти/навыка союзника
   * (умолчание 50), bonus — прибавка к броску (умолчание +20, книжно).
   */
  augments?: { threshold?: number; bonus?: number }
  /** реестр категорий предметов: категория определяет, что предмет умеет */
  item_categories?: ItemCategoryDef[]
  /** реестр типов слотов сцены (что можно ставить в слот); по умолчанию — встроенные */
  slot_types?: Array<{ id: string; label: string; sounds?: SoundHookMap }>
  /** реестр флагов: русское название и назначение (редактор показывает названия, движку важен только id) */
  flags?: Array<{ id: string; label: string; description?: string }>
  /** состояния портретов (встроенные + свои), фидбек 9.14 */
  emotions?: EmotionDef[]
  currencies: CurrencyDef[]
  factions?: FactionDef[]
  /** реестр музыкальных треков (итерация 8, блок H): файл/ссылка ИЛИ синтез MusicDoc */
  music_tracks?: MusicTrackDef[]
  /** реестр звуков: файл/ссылка ИЛИ синтез SoundDoc (массив — случайный вариант) */
  sounds?: SoundDef[]
  /** звуковая тема кампании: хук → id звука из реестра (пустой хук — тишина) */
  ui_sounds?: Record<string, string>
  /** трек(и) кампании по умолчанию, когда у локации/сцены своей музыки нет */
  default_music?: string[]
  /** трек(и) боя по умолчанию (если у арены нет своего arena.music) */
  combat_music?: string[]
  /** профиль механик: что включено в этой кампании (нет поля — всё включено) */
  features?: CampaignFeatures
  /** реестр шрифтов кампании (блок 2 ТЗ) */
  fonts?: FontDef[]
  /** тема оформления: шрифтовые роли, фон меню/финала, акцент (блок 2 ТЗ) */
  theme?: ThemeDoc
  /** максимальный груз в кг: STR + SIZ (по умолчанию) */
  max_load_formula?: 'str_plus_siz'
  max_companions?: number
  char_creation?: CharCreationDef
  /** боевые правила кампании: побег, мультиатаки, тяжёлые раны (аудит §5.6) */
  combat?: CombatRulesDef
  /**
   * Очки удачи героя (аудит §5.6 п.8, книжная Удача = POW×5): максимум =
   * POW × multiplier (умолчание 5; задайте 0, чтобы выключить удачу).
   * На провальный мировой/диалоговый бросок игрок может потратить
   * `reroll_cost` удачи (умолчание 1) и перебросить. Удача восстанавливается
   * на отдыхе (`rest_luck` ≠ false) — книжно удача не восполняется, но для
   * рогалика приятнее мягче; мастер решает сам.
   */
  luck?: { multiplier?: number; reroll_cost?: number; rest_luck?: boolean }
  /**
   * Уровни и черты — ОПЦИОНАЛЬНАЯ прогрессия поверх BRP (аудит B8).
   * Отсутствие блока — систем нет (классический рогалик: рост только навыков).
   * Опыт — эффектом grant_xp (или награды достижений), пороги:
   * xp_per_level (умолчание 100 за уровень, кумулятивно base×(1..n)).
   */
  progression?: {
    /** база порога уровня: уровень N стоит base×N очков опыта (умолчание 100) */
    xp_per_level?: number
    /** черт за уровень (умолчание 1; 0 — уровневая прокачка без черт) */
    feats_per_level?: number
    /** потолок уровня; нет — без потолка */
    max_level?: number
    /** реестр черт, доступных герою */
    feats?: FeatDef[]
  }
  /**
   * Мета-прогресс между забегами (аудит B8b): достижения, метавалюты и
   * постоянные усиления. Сохранение — отдельным ключом localStorage
   * `chronicle-forge:meta:<campaignId>`, живёт перекрёстно между сейвами.
   * Отсутствие блока — мета-прогресса нет (мастер может опустить весь пласт).
   */
  metaprogress?: MetaProgressDef
  /**
   * Таблицы случайных событий и генераторы контента (аудит B9).
   * Мастер решает: можно отключить всё (нет блока), отключить отдельные
   * таблицы (table.disabled) или собирать свои — генераторы работают
   * только на таблицах, которые описал мастер.
   */
  generators?: GeneratorsDef
  /**
   * Скрытность и обнаружение (аудит §5.6 п.12). Отсутствие блока — системы
   * нет (для стелс-кампаний мастер включает явно).
   * - `skill` — навык скрытности героя (умолчание 'stealth');
   * - `perception_skill` — навык обнаружения у NPC (умолчание 'perception';
   *   у NPC без него берётся INT×2);
   * - `combat_hide_penalty` — штраф атаки врагов по скрытому герою… нет:
   *   скрытый герой просто не выбирается целью.
   */
  stealth?: { skill?: string; perception_skill?: string }
  /**
   * Отдых и естественное лечение (аудит §5.6 п.3): сон через ink-вызов
   * `sleep` раньше только растил навыки. Теперь: `hp` — кости лечения за
   * сон (умолчание '1d3', мастер сам решает щедрость); `mp_full` — MP
   * восстанавливаются полностью (умолчание true).
   */
  rest?: { hp?: string; mp_full?: boolean }
  /** id сущности-шаблона игрока (Фаза 0: предсозданный персонаж) */
  default_player: string
  roguelike?: {
    permadeath: boolean
    meta_progress: string[]
    randomize_on_restart: string[]
  }
  /**
   * Сколько ручных слотов сохранения у игрока сверх автосейва
   * (аудит §5.6 п.9). Умолчание 3; 0 — только автосейв (классический
   * рогалик). Пермадет стирает автосейв; ручные слоты переживают забег —
   * это честный «снимок на всякий случай», мастер может запретить.
   */
  save_slots?: number
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
  ambient_audio?: string // легаси: один звук фона
  /** фоновые зацикленные звуки (птицы, гул): складываются слоями, фидбек 9.6 */
  ambient?: string[]
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

/** Простое декларативное условие для состояний сцены / слотов */
export interface SceneCondition {
  time_of_day?: TimeOfDay | TimeOfDay[]
  flag?: string
  not_flag?: string
  /** текущая погода (блок 9 ТЗ) */
  weather?: string
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

/** погода (блок 9 ТЗ): визуальный слой + звуковые слои */
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
  /** предметы, которыми можно воздействовать на слот (блок 8 ТЗ) */
  use_with?: SlotUseWith[]
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
  /** переопределение музыки сцены (тот же формат, что у локации) */
  music?: MusicRule[]
  /** фоновые зацикленные звуки сцены (слагаются с фоном локации) */
  ambient?: string[]
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
  /**
   * Прочность конкретного экземпляра (аудит §5.6 п.10): запись с этим полем —
   * отдельная копия многоразового предмета, стакается только с себе равными.
   */
  durability?: number
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
  /** описание сущности (при наведении); можно менять динамически (set_description) */
  description: string
  /** ПОРТРЕТ (диалог): состояние → изображение (блок 3 ТЗ «Гибкий движок») */
  portrait: Record<string, string> // emotion -> image
  /** СПРАЙТ В СЦЕНЕ: изображение с вырезанным фоном (прозрачный PNG);
   *  нет — в сцене используется портрет (состояние «Обычный») */
  scene_sprite?: string
  /** ФИГУРКА БОЯ: отображается на арене ВМЕСТО жетона (без круглой маски
   *  и рамки стороны); нет — круглый жетон из `token ?? portrait.neutral` */
  combat_figure?: string
  /** как разворачивать фигурку: вид сверху (поворот), вид сбоку (зеркало),
   *  не разворачивать; по умолчанию 'topdown' */
  figure_mode?: 'topdown' | 'side' | 'static'
  /** мягкая тень под спрайтом/фигуркой (по умолчанию включена) */
  shadow?: boolean
  /** изображение жетона в бою (когда фигурка не задана) */
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
  /**
   * Внимательность для скрытности (аудит §5.6 п.12): значение проверки
   * обнаружения. Нет — навык meta.stealth.perception_skill, а без него INT×2.
   */
  perception?: number
  /** природное оружие (когти, укус) — если нет equipment.weapon */
  natural_weapon?: WeaponData
  /** боевые способности (список id из реестра кампании; блок 6 ТЗ) */
  abilities?: string[]
  /** мораль: при каком % HP и с каким шансом враг может сбежать (блок 6 ТЗ) */
  morale?: { below_hp_pct: number; flee_chance: number }
  /** звуки взаимодействий (хук → id звука реестра кампании) */
  sounds?: SoundHookMap
}

export interface WeaponData {
  skill: string
  damage: string
  damage_bonus: boolean
  range: number
  attacks_per_round: number
  parry_capable: boolean
  label?: string
  /**
   * Износ (аудит §5.6 п.10): максимальная прочность. Нет — оружие вечно.
   * Срабатывание: за бой изнашивается 1 раз на критический провал.
   * Сломанное оружие заменяется кулаками, чинится рецептом (`repair: true`).
   */
  durability?: number
  /**
   * Боеприпасы (аудит B5): id предмета-расходника (стрелы, патроны). Каждая
   * атака игрока тратит 1 шт. из инвентаря; NPC — без ограничений.
   * Нет боеприпасов у игрока — оружие не стреляет.
   */
  ammo_item?: string
  /**
   * Особые удары (аудит B5): срабатывают при уверенном успехе и крите
   * (на выбор мастера на оружие):
   * - 'impale' — пронзание: дополнительный бросок урона без учёта брони;
   * - 'knockback' — отброс на 1 гекс от атакующего;
   * - 'disarm' — разоружение: цель теряет оружие (NPC — голыми руками);
   * - 'grapple' — захват: цель пропускает следующий ход;
   * - 'push_harmless' — толчок без урона (удар не наносит урона вообще).
   */
  traits?: Array<'impale' | 'knockback' | 'disarm' | 'grapple' | 'push_harmless'>
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
  armor_data?: {
    points: number
    /** износ брони: максимальная прочность (нет — вечная) */
    durability?: number
  }
  /**
   * Износ (аудит §5.6 п.10): мастер задаёт у оружия в weapon_data, у брони
   * в armor_data. Боевое изнашивание оружия, удар по броне. Сломанный
   * предмет сохраняет форму, но перестаёт работать (weapon_data/armor_data
   * дают 0), пока его не починят рецептом (`repair: true`).
   */
  /** слот экипировки (блок 7 ТЗ): предмет надевается в этот слот;
   *  нет — не экипируется. Старым предметам выставляется миграцией. */
  equip_slot?: string
  /** взаимодействие в сцене (бочка с водой и т.п.) */
  on_interact?: UseEffectDef
  /** использование из инвентаря */
  on_use?: UseEffectDef
  /** звуки взаимодействий (хук → id звука реестра кампании) */
  sounds?: SoundHookMap
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
  /** музыка на всю катсцену: id трека реестра, файл пакета или ссылка */
  music?: string
  slides: CutsceneSlide[]
}

// ─────────────────── аудио: музыка, звуки, синтез (итерация 8, блок H) ───────────────────

/**
 * Параметрический SFX в духе ZzFX/jsfxr: числа в порядке параметров zzfx
 * (громкость, случайность, частота, атака/сустейн/декей, форма волны…).
 * Рендерится Web Audio на лету (с кэшем буфера). Ретро-характер приемлем.
 */
export interface SoundDoc {
  zzfx: number[]
}

/** настроение генеративного трека */
export type MusicMood = 'тревожная' | 'спокойная' | 'боевая' | 'торжественная' | 'таинственная'

// ─────────────── состояния портрета (реестр эмоций, фидбек 9.14) ───────────────

/**
 * Состояние портрета НПС: ключ картинки `npc.portrait[id]` и тег `# emotion:`
 * в диалоге. Общий реестр кампании — чтобы состояние, заведённое у одного НПС,
 * предлагалось в диалогах всех остальных, и ИИ-генератору было на что сослаться.
 */
export interface EmotionDef {
  id: string
  label: string
}

/**
 * Дефолтное состояние портрета — существует всегда, в реестр не входит
 * и в списке состояний не показывается. Картинка, загруженная персонажу,
 * попадает именно сюда.
 */
export const DEFAULT_EMOTION: EmotionDef = { id: 'neutral', label: 'Обычный' }
/** лад генеративного трека */
export type MusicScale = 'минор' | 'мажор' | 'дорийский' | 'фригийский' | 'пентатоника'
/** слои аранжировки */
export type MusicLayer = 'пад-аккорды' | 'арпеджио' | 'бас' | 'перкуссия'

/**
 * Высокоуровневый генеративный формат музыки (НЕ ноты вручную).
 * Рантайм-генератор собирает бесшовный эмбиент-луп по гамме — «мимо»
 * сыграть не может; детерминизм от `seed`.
 */
export interface MusicDoc {
  mood: MusicMood
  /** ударов в минуту (по умолчанию зависит от настроения) */
  tempo?: number
  /** тональность: "C", "D#", "Fis"… (по умолчанию — от настроения) */
  key?: string
  scale: MusicScale
  layers: MusicLayer[]
  /** аккордовая последовательность ступенями гаммы: ["i","VI","III","VII"] */
  progression?: string[]
  /** зерно случайности (одинаковый seed — одна и та же музыка) */
  seed?: number
}

/** источник звука: файл/ссылка ИЛИ синтез из JSON; массив — случайный вариант */
export type SoundSource = string | SoundDoc

export interface SoundDef {
  id: string
  label: string
  src: SoundSource | SoundSource[]
  /** зацикленный фон (птицы, гул): играет слоем, пока не остановят (фидбек 9.6) */
  loop?: boolean
}

/** источник музыки: файл/ссылка ИЛИ генеративный MusicDoc */
export type MusicSource = string | MusicDoc

export interface MusicTrackDef {
  id: string
  label: string
  src: MusicSource
  /** громкость трека 0…1 (поверх настроек игрока) */
  volume?: number
  /** зацикливать (один трек) или играть как плейлист */
  loop?: boolean
}

/** условие музыкальной записи (паттерн состояния; все условия — по «И») */
export interface MusicCondition {
  time_of_day?: TimeOfDay | TimeOfDay[]
  flag?: string
  not_flag?: string
  /** текущая погода (блок 9 ТЗ) */
  weather?: string
}

/**
 * Запись «условия → музыка» (у локации/сцены): `tracks` — ВСЕГДА список
 * (один трек — луп, несколько — плейлист со сменой и кроссфейдом,
 * `shuffle` — в случайном порядке без повтора подряд); побеждает первая
 * истинная запись.
 */
export interface MusicRule {
  tracks: string[]
  shuffle?: boolean
  conditions?: MusicCondition[]
}

/** хуки звуков взаимодействий (звук сущности/категории/типа слота) */
export type SoundHook = 'pickup' | 'use' | 'open' | 'talk' | 'drop' | 'travel'

/** карта «хук → id звука реестра» */
export type SoundHookMap = Partial<Record<SoundHook, string>>

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
  | { type: 'has_status'; status: string; not?: boolean } // статус активен (блок 5 ТЗ)
  | { type: 'weather_is'; weather: string; not?: boolean } // текущая погода (блок 9 ТЗ; '' — ясно)

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
  | { type: 'set_description'; entity: string; text: string }
  /** статусы (блок 5 ТЗ): наложить (0/нет — из реестра) / снять */
  | { type: 'apply_status'; status: string; duration?: number }
  | { type: 'remove_status'; status: string }
  /** сменить погоду ('' — ясно; блок 9 ТЗ) */
  | { type: 'set_weather'; weather: string }
  /** разблокировать запись кодекса (повтор — no-op; блок 10 ТЗ) */
  | { type: 'unlock_codex'; entry: string }

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
  /** см. SkillDifficulty: число-порог (50 нейтрально) или уровень */
  difficulty: SkillDifficulty
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
  /** проверка навыка при изготовлении; успех = создал, провал = компоненты целы */
  skill?: { id: string; difficulty: SkillDifficulty }
  /** время изготовления (промотка тиков после успеха) */
  time_ticks?: number
  /** результат */
  output: { item: string; quantity: number }
  /** сообщение об успехе (нет — стандартное) */
  message?: string
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
  rules: string[]
  arenas?: string[]
  quests?: string[]
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
  /** характеристика героя не ниже порога (аудит §5.6 п.6) */
  | { type: 'stat_ge'; stat: string; threshold: number }
  /** HP не выше/не ниже порога (аудит: ранее HP можно было читать только из диалогов) */
  | { type: 'hp_le'; threshold: number }
  | { type: 'hp_ge'; threshold: number }
  /** очков удачи не меньше порога (аудит §5.6 п.8) */
  | { type: 'luck_ge'; threshold: number }
  /** усталость/рассудок/репутация/достаток (аудит B6, opt-in) */
  | { type: 'fatigue_ge'; threshold: number }
  | { type: 'fatigue_le'; threshold: number }
  | { type: 'sanity_ge'; threshold: number }
  | { type: 'sanity_le'; threshold: number }
  | { type: 'reputation_ge'; threshold: number }
  | { type: 'wealth_ge'; level: number }
  /** преступление совершено (любое — id не задан; либо суммарная награда ≥) */
  | { type: 'crime_committed'; id?: string; min_bounty?: number }
  /** суммарная награда за голову героя не меньше порога (аудит B7) */
  | { type: 'bounty_total_ge'; threshold: number }
  /** уровень героя не ниже (аудит B8, meta.progression) */
  | { type: 'level_ge'; level: number }
  /** метавалюты достаточно (аудит B8b) */
  | { type: 'meta_currency_ge'; currency: string; threshold: number }
  /** достижение открыто (аудит B8b) */
  | { type: 'meta_achievement'; id: string }
  /** черта взята (аудит B8) */
  | { type: 'has_feat'; id: string }
  /** страсть не ниже значения (аудит B6) */
  | { type: 'passion_ge'; id: string; value: number }
  /** очков причастности не меньше порога (аудит B6) */
  | { type: 'allegiance_ge'; id: string; points: number }
  /** уровень мощи кампании не ниже (аудит B6; ряд normal<heroic<epic<superhuman) */
  | { type: 'power_level_ge'; level: 'normal' | 'heroic' | 'epic' | 'superhuman' }
  | { type: 'need_le'; need: string; threshold: number }
  | { type: 'need_ge'; need: string; threshold: number }
  | { type: 'entity_alive'; entity: string }
  | { type: 'entity_dead'; entity: string }
  | { type: 'disposition_ge'; target: string; threshold: number }
  | { type: 'disposition_le'; target: string; threshold: number }
  | { type: 'in_party'; entity: string }
  | { type: 'random_chance'; probability: number }
  | { type: 'has_status'; status: string }
  | { type: 'weather_is'; weather: string }
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }

export type Effect =
  | { type: 'set_flag'; flag: string }
  | { type: 'clear_flag'; flag: string }
  /** наложить статус (блок 5 ТЗ); цель в мире — игрок */
  | { type: 'apply_status'; target: 'player'; status: string; duration?: number }
  /** снять статус */
  | { type: 'remove_status'; target: 'player'; status: string }
  /** сменить погоду ('' — ясно; блок 9 ТЗ) */
  | { type: 'set_weather'; weather: string }
  /** разблокировать запись кодекса (повтор — no-op; блок 10 ТЗ) */
  | { type: 'unlock_codex'; entry: string }
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
      /** запретить бегство игрока именно в этом бою (босс, засада) */
      no_flee?: boolean
      /** скрытность не работает в этом бою (открытое поле, тесная комната) */
      no_hide?: boolean
      /** бой начинается внезапно для героя: пропуск первого раунда */
      surprise?: 'player' | 'enemy'
      /** эффекты, если игрок сбежал из боя (аудит §5.6 п.2) */
      on_fled?: Effect[]
      /**
       * Эффекты проигрыша в режиме `combat.death.mode='brp'`, когда герой
       * выжил без сознания: плен, ограбление, спасение — что придумает
       * мастер. Не задано — проигрыш в бою остаётся смертью.
       */
      on_defeat?: Effect[]
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
      difficulty: SkillDifficulty
      success_effects: Effect[]
      fail_effects: Effect[]
    }
  | { type: 'change_disposition'; target: string; delta: number }
  | { type: 'start_quest'; quest: string }
  | { type: 'advance_quest'; quest: string; stage: string }
  | { type: 'fail_quest'; quest: string }
  | { type: 'journal_update'; quest: string; text_key: string }
  | { type: 'give_reward'; items?: Array<{ item: string; quantity: number }> }
  | {
      /** проверка ХАРАКТЕРИСТИКИ × множитель (аудит §5.6 п.6): POW×5 — удача, INT×5 — идея… */
      type: 'stat_check'
      stat: string
      /** множитель характеристики (умолчание 5 — книжный) */
      multiplier?: number
      /** дополнительный модификатор к цели (ситуация мастера) */
      modifier?: number
      /** аугмент страсти (аудит B6): id страсти из meta.passions_list; порог и бонус — meta.augments */
      augment_passion?: string
      /** подмога союзника (аудит B6): id NPC-сущности; её навык — assist_skill или сама проверка stat? */
      assist_entity?: string
      /** навык подмоги (умолчание — навык проверки / для stat_check — 'support') */
      assist_skill?: string
      success_effects: Effect[]
      fail_effects: Effect[]
    }
  | {
      /**
       * Противоборство навыком (аудит §5.6 п.6): герой против NPC или порога.
       * Ранги сравниваются (провал < успех < твёрдый < крит); при равенстве
       * побеждает `tie` (умолчание 'player').
       */
      type: 'opposed_check'
      skill: string
      /** цель — NPC (бросает тем же или указанным навыком) */
      entity?: string
      /** навык цели (умолчание — тот же навык) */
      against_skill?: string
      /** или числовой порог вместо броска NPC (значение навыка оппонента) */
      against_value?: number
      tie?: 'player' | 'opponent'
      /** аугмент страсти героя для этого спора (аудит B6) */
      augment_passion?: string
      success_effects: Effect[]
      fail_effects: Effect[]
    }
  | { type: 'change_luck'; delta: number }
  /** трата/восстановление усталости (аудит B6, meta.vitals.fatigue) */
  | { type: 'change_fatigue'; delta: number }
  /** трата рассудка или исцеление психики (аудит B6, meta.vitals.sanity) */
  | { type: 'change_sanity'; delta: number }
  /** репутация (аудит B6, meta.reputation) */
  | { type: 'change_reputation'; delta: number }
  /** сдвиг уровня достатка на ±n ступеней (аудит B6, meta.wealth_levels) */
  | { type: 'change_wealth'; levels: number }
  /** задать/сдвинуть страсть (аудит B6); set — точное значение */
  | { type: 'change_passion'; id: string; delta?: number; set?: number }
  /** очки причастности силе (аудит B6) */
  | { type: 'change_allegiance'; id: string; points: number }
  /**
   * Тренировка/рост ХАРАКТЕРИСТИКИ (аудит B6, книжный рост со временем):
   * прибавка delta к stat; движок пересчитывает HP/MP/усталость/рассудок.
   * Пределы — stat_limits кампании (культурные/видовые модификаторы уже
   * заложены мастером при создании: char_creation.roll.per_stat).
   */
  | { type: 'train_stat'; stat: string; delta: number }
  /**
   * Падение (аудит B7): `meters` — высота. Урон = floor(meters / настройку)
   * кубиков урона падения (meta.hazards, умолчание 3м на 1d6); смягчающая
   * проверка навыком (умолчание dodge) уполовинивает при успехе.
   */
  | { type: 'hazard_fall'; meters: number; skill?: string }
  /** совершить зарегистрированное преступление (аудит B7) */
  | { type: 'commit_crime'; id: string; bounty?: number }
  /** включить ценовое событие (аудит B7) */
  | { type: 'set_price_event'; id: string }
  /** снять ценовое событие (все — id не задано) */
  | { type: 'clear_price_event'; id?: string }
  /** очки опыта (аудит B8, meta.progression) */
  | { type: 'grant_xp'; points: number }
  /** начислить метавалюту (аудит B8b), открытие достижения meta_achievement не срабатывает — его проверяем отдельно */
  | { type: 'meta_currency'; id: string; amount: number }
  /**
   * Случайное событие из таблицы (аудит B9): форсирует бросок таблицы
   * прямо сейчас (фильтры времени/локации соблюдаются; шанс и интервал
   * таблицы при форсе игнорируются; выбор правила — по условиям правил).
   * ignore_filters: true — даже фильтры времени/локации снять.
   */
  | { type: 'roll_event_table'; table: string; ignore_filters?: boolean }
  /**
   * Пакетная генерация значений из списков генератора в переменные
   * (аудит B9): key — ключ списка, as — имя переменной (по умолчанию равно ключу).
   * seed — строка: один и тот же seed даёт тот же пакет (стабильность личности NPC и т.п.).
   */
  | { type: 'generate_variables'; generator: string; seed?: string; pack: { key: string; as?: string }[] }
  /** выдать черту вне прокачки (аудит B8; дубликаты игнорируются) */
  | { type: 'grant_feat'; id: string }
  | { type: 'join_party'; entity: string }
  | { type: 'leave_party'; entity: string }
  | { type: 'block_path'; from: string; to: string }
  | { type: 'unblock_path'; from: string; to: string }
  | { type: 'show_message'; text: string; portrait?: string }
  | { type: 'reveal_location'; location: string }
  | { type: 'advance_time'; ticks: number }
  | { type: 'remove_entity'; entity: string }
  | { type: 'spawn_entity'; entity: string; scene: string; slot: string }
  | { type: 'set_description'; entity: string; text: string } // динамическое описание сущности
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

// ───────────────────────── состояние игры (сейв) ─────────────────────────

export interface PlayerState {
  entity: string
  /** имя героя, выбранное при создании персонажа (блок 11 ТЗ) */
  name?: string
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
  /** цель приказа 'focus' на этот бой: id подразделения противника (в памяти боя) */
  focus?: string
}

/**
 * Версия формата `GameState` (внутренности сохранения). Растёт, когда меняется
 * форма состояния забега; переносом занимается цепочка миграций
 * `core/savemigrate.ts` (только вверх, старые шаги не удаляются).
 */
export const SAVE_VERSION = 4

/** Версия обёртки сохранения (`SaveEnvelope`) — метаданные вокруг `GameState`. */
export const SAVE_ENVELOPE_VERSION = 1

/**
 * Сохранение на диске = обёртка + состояние. Обёртка отвечает на вопросы
 * «от какой кампании и движка этот сейв» без разбора состояния — без неё
 * нельзя ни показать причину несовместимости, ни починить сейв после
 * обновления кампании.
 */
export interface SaveEnvelope {
  envelope_version: number
  /** формат `state` (см. SAVE_VERSION) */
  save_version: number
  campaign_id: string
  /** версия кампании, на которой сделано сохранение */
  campaign_version?: string
  /** версия движка, записавшего сохранение */
  engine_version?: string
  /** ISO-дата создания и последней записи */
  created_at?: string
  updated_at?: string
  /** сколько тиков прожито и где герой — для списков сохранений без разбора state */
  tick?: number
  location?: string
  state: GameState
}

/** Одна строка отчёта о переносе/починке сохранения (показывается игроку). */
export interface SaveNote {
  /** migrated — перенос формата; repaired — починка ссылок; warning — на заметку */
  kind: 'migrated' | 'repaired' | 'warning'
  text: string
}

/** Итог чтения сохранения: что сделали с сейвом и что об этом сказать игроку. */
export interface SaveReport {
  from_version: number
  to_version: number
  /** версия кампании в сейве (если известна) */
  campaign_version?: string
  notes: SaveNote[]
  /** сейв пришлось чинить (ссылки на удалённый контент кампании) */
  repaired: boolean
}

// ─────────── контракт совместимости кампании (compat.json) ───────────

/**
 * Одно ломающее изменение между версиями кампании. `kind` — из словаря
 * `CHANGE_KINDS` (`shared/compat.ts`); `impact` — человекочитаемое последствие
 * для сохранений.
 */
export interface CompatBreak {
  kind: string
  id: string
  label?: string
  impact?: string
}

/** Сводка изменений между двумя версиями кампании (по классам S/A/B/C/D). */
export interface CompatChanges {
  added: number
  removed: number
  changed: number
  /** детали по видам объектов, чтобы отчёт был читаемым */
  details?: Array<{ kind: string; op: 'added' | 'removed' | 'changed'; id: string; label?: string }>
}

/**
 * `compat.json` — контракт совместимости пакета. Пишет редактор при
 * публикации обновления; игрок читает его, чтобы узнать, поддержится ли его
 * сохранение. Поля формата: `format: 'chronicle-compat/1'`.
 */
export interface CampaignCompat {
  format: 'chronicle-compat/1'
  /** версия кампании, к которой относится контракт */
  version: string
  /** сохранения от какой версии ещё поддерживаются */
  save_base_version: string
  min_engine?: string
  package_format?: number
  updated_at?: string
  /** свёртка всех id пакета: по ней следующий релиз находит изменения */
  inventory_digest: string
  breaks: CompatBreak[]
  changes?: CompatChanges
  /** текст от автора («переписана глава 3») */
  notes?: string
}

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
  /** выбор создания персонажа (блок 11 ТЗ): имя, характеристики, навыки, происхождение и призвание */
  char_choice?: {
    name: string
    stats: Record<string, number>
    profession: string
    calling?: string
    skills: Record<string, number>
  }
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
  arenas: Record<string, ArenaDef>
  quests: Record<string, QuestDef>
  encounters: Record<string, EncounterTableDef>
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
