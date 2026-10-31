import type { CameraDoc, ImageValue } from './scene-art'


import type { Condition, Effect } from './rules'


import type { SoundHookMap } from './audio'


export type NarrativeIntroEntry =
  | string
  | {
      text: string
      voice?: string
      sfx?: string
      image?: string
      camera?: string | CameraDoc
      conditions?: Condition[]
      duration?: number
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
  /**
   * Срок годности / свежесть конкретного экземпляра в игровых тиках (часах):
   * Убывает каждый тик; при достижении 0 превращается в spoil_into или уничтожается.
   */
  freshness?: number
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
  /** имя/описание до знакомства (механика «Незнакомец», напр. «Незнакомка в платке»). Пока имя не раскрыто через learn_name / диалог, игрок видит эту подпись */
  unknown_label?: string
  /** описание сущности (при наведении); можно менять динамически (set_description) */
  description: string
  /** ПОРТРЕТ (диалог): состояние → изображение (блок 3 ТЗ «Гибкий движок») */
  portrait: Record<string, string> // emotion -> image
  /** СПРАЙТ В СЦЕНЕ: изображение с вырезанным фоном (прозрачный PNG, ОБЯЗАТЕЛЬНО);
   *  нет — в сцене используется портрет (состояние «Обычный»).
   *  Можно цикл кадров (ImageValue) — «живой» спрайт. */
  scene_sprite?: ImageValue
  /** состояния спрайта сцены — по образцу портретов: ключ — id состояния из
   *  реестра кампании (`meta.emotions`); «Куда девать» определяет слот сцены
   *  (SlotDef.sprite_state). Пустого ключа нет: «Обычный» — это scene_sprite. */
  scene_sprite_states?: Record<string, ImageValue>
  /** ФИГУРКА БОЯ: отображается на арене ВМЕСТО жетона (без круглой маски
   *  и рамки стороны); прозрачный фон ОБЯЗАТЕЛЕН; нет — круглый жетон из
   *  `token ?? portrait.neutral`. Можно цикл кадров (ImageValue). */
  combat_figure?: ImageValue
  /** состояния фигурки боя: 'dead' — погиб, 'down' — без сознания/выведен,
   *  id статуса — пока статус активен. Пустой ключ = обычная (combat_figure). */
  combat_figure_states?: Record<string, ImageValue>
  /** как разворачивать фигурку: 'topdown' — поворот картинки к цели (арту «вид сверху»),
   *  'side' — только зеркало влево/вправо, БЕЗ поворота (исключительно для фронтального/
   *  вертикального арта; на арте «сверху» фигурка вечно смотрит в камеру — частая ошибка),
   *  'static' — не разворачивать; по умолчанию 'topdown'. Режим выбирается стилем арта и
   *  в одной кампании, как правило, один на всех сущностей — при перегенерации арта
   *  синхронизируй figure_mode/facing_offset у всех. */
  figure_mode?: 'topdown' | 'side' | 'static'
  /** сдвиг разворота фигурки, градусы по часовой (только режим 'topdown'):
   *  прибавляется к вычисленному движком направлению при отрисовке. Нужен,
   *  если готовый арт смотрит не строго «вверх» (0°): 180 — фигурка нарисована
   *  вниз (на юг), 90 — вправо, -90 — влево. Влияет только на картинку:
   *  игровая логика (задняя дуга удара в спину и т.п.) считается по реальному
   *  направлению бойца. По умолчанию 0. */
  facing_offset?: number
  /** мягкая тень под спрайтом/фигуркой (по умолчанию включена) */
  shadow?: boolean
  /**
   * Эффект «живого дыхания» спрайта в сцене:
   * Для NPC по умолчанию включён (true). Для роботов, автоматонов, механизмов
   * и нежити можно отключить (false).
   */
  breathe?: boolean
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
  /** Расовый/индивидуальный бонус к грузоподъёмности (+кг, напр. +5 кг для выносливых рас) */
  carry_capacity_bonus?: number
  /** Расовый/индивидуальный множитель грузоподъёмности (напр. 2.5 для мутантов, гигантов, четвероногих) */
  carry_capacity_mult?: number
  /** НАПАРНИК: набор потребностей, которые тикают у существа в отряде (id из
   *  реестра `meta.needs`; пусто/нет — потребностей нет: робот, нежить).
   *  Убывают и восстанавливаются по тикам теми же правилами, что у героя; общий
   *  стол: когда потребность героя растёт (еда, сон — эффект change_need с
   *  положительной дельтой), напарник, отслеживающий ту же потребность, растёт
   *  на столько же. Ниже `critical_threshold` собственной потребности — штраф
   *  навыкам в бою и метка «истощён». Читать/менять из правил и ink:
   *  условия `companion_need_le`/`companion_need_ge`, эффект
   *  `change_companion_need`. */
  companion_needs?: string[]
  /** НАПАРНИК: «вторая сумка» — у существа есть собственный инвентарь, между
   *  героем и напарником можно передавать предметы; надетые напарником оружие
   *  и броня используются им в бою. Грузоподъёмность считается по тем же
   *  формулам энкадменса, что у героя */
  companion_carry?: boolean
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

/** Уровень сложности, который мастер предлагает игроку (meta.difficulties). */
export interface DifficultyPreset {
  id: string
  label: string
  /** что это значит — видно игроку при выборе */
  description?: string
  /** множитель урона врагов по герою в бою (умолчание 1; 0.5 — мягкий бой, 1.5 — лихо) */
  enemy_damage?: number
  /** множитель скорости убыли потребностей (умолчание 1) */
  need_decay?: number
  /** множитель цен при покупке/продаже (умолчание 1; у торговца дороже) */
  prices?: number
  /** на этом уровне автосохранения выключены (путь железного человека) */
  no_autosave?: boolean
}

/**
 * Шаблон вида существа (meta.species): боевой костяк NPC по нажатию
 * «Применить вид» в редакторе персонажа. Встроенных видов в движке нет —
 * виды задаёт мастер под свою кампанию (контент, не код).
 */
export interface SpeciesTemplate {
  id: string
  label: string
  /** подсказка мастеру: чем этот вид примечателен */
  description?: string
  stats?: Record<string, number>
  skills?: Record<string, number>
  /** броня в очках (нет — 0) */
  armor?: number
  natural_weapon?: {
    skill: string
    damage: string
    label?: string
    damage_bonus?: boolean
    range?: number
    attacks_per_round?: number
    parry_capable?: boolean
  }
  /** id способностей из реестра кампании */
  abilities?: string[]
  morale?: { below_hp_pct: number; flee_chance: number }
  /** Расовый/видовой бонус к переносимому весу (+кг) */
  carry_capacity_bonus?: number
  /** Расовый/видовой множитель переносимого веса (напр. 3.0 для вьючных животных или мутантов) */
  carry_capacity_mult?: number
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

/**
 * Вариант взаимодействия с предметом в сцене (фидбек: «собрать траву»,
 * «срезать», «поджечь»). Клик по предмету с таким списком открывает
 * окно выбора действия — как мини-диалог с портретом предмета.
 */
export interface ItemInteractOption {
  /** подпись кнопки действия */
  label: string
  /** состояние портрета предмета при выборе (ключ из portrait) */
  emotion?: string
  /** пояснение под кнопкой: условия, расход, проверка */
  hint?: string
  /** условия показа (все истинны — вариант виден) */
  conditions?: Condition[]
  /** реакция */
  effects: Effect[]
  /** после применения предмет исчезает со сцены */
  consume?: boolean
  /** одноразовый вариант: исчезает после выбора (в текущем забеге) */
  once?: boolean
  /** сообщение после применения (оформлено портретом предмета) */
  message?: string
  /** звуковой хук взаимодействия (умолчание 'use' или 'open' для контейнера) */
  sound?: string
  sound_volume?: number
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
  /** мягкая тень под спрайтом в сцене (по умолчанию включена) */
  shadow?: boolean
  /** ПОРТРЕТЫ (состояния) предмета для окна взаимодействия: emotion → изображение.
   *  «Обычный» — по умолчанию; без портретов окно показывает только текст. */
  portrait?: Record<string, string>
  /** СПРАЙТ В СЦЕНЕ: картинка предмета в его слоте (целиком, без обрезки).
   *  Нет — в слоте не рисуется ничего (ни портрет, ни иконка).
   *  Можно цикл кадров (ImageValue) — «живой» предмет. */
  scene_sprite?: ImageValue
  /**
   * Эффект «живого дыхания» спрайта в сцене:
   * По умолчанию отключён (false). Можно включить для живых или пульсирующих предметов (био-сердце, мимик).
   */
  breathe?: boolean
  /**
   * Взаимодействовать можно только когда условия истинны; пока ложны —
   * предмет «декорация»: виден в слоте, но не нажимается и не подсвечивается.
   */
  interactable_when?: Condition[]
  /** подсказка действия под курсором в сцене («Осмотреть замок», «Повернуть вентиль») */
  interact_hint?: string
  /** варианты действий по клику (выбор как в диалоге); приоритет над on_interact */
  interact_options?: ItemInteractOption[]
  weight: number
  value?: Record<string, number>
  stackable: boolean
  /** сюжетный/квестовый предмет: нельзя случайно выбросить, продать или передать
   *  напарнику через сумку (уход/гибель напарника не съест критическую вещь).
   *  Скриптовая передача эффектом transfer_to_companion остаётся решением мастера. */
  quest_item?: boolean
  /** Срок годности предмета в игровых тиках (например, 24 = 24 часа). Если не задан — предмет не портится */
  decay_ticks?: number
  /** В какой предмет превращается после порчи (например item_meat_spoiled или item_scrap) */
  spoil_into?: string
  /** Действие при порче: 'transform' (в spoil_into), 'destroy' (исчезает), 'rule' (запуск правила) */
  spoil_action?: 'transform' | 'destroy' | 'rule'
  /** Идентификатор правила, запускаемого при порче (если spoil_action === 'rule') */
  spoil_rule?: string
  /** Сообщение в журнал при порче предмета */
  spoil_msg?: string
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
  /** Бонус к переносимому весу при экипировке (+кг, напр. +10 кг для походного рюкзака) */
  carry_bonus?: number
  /** Множитель грузоподъёмности при экипировке (напр. 2.0 для силового экзоскелета) */
  carry_mult?: number
  /** прозрачный слой поверх портрета героя, когда этот предмет надет */
  hero_appearance?: { overlay: ImageValue; order?: number }
  /** взаимодействие в сцене (бочка с водой и т.п.) */
  on_interact?: UseEffectDef
  /** использование из инвентаря */
  on_use?: UseEffectDef
  /** звуки взаимодействий (хук → id звука реестра кампании) */
  sounds?: SoundHookMap
}

export type EntityDef = NpcDef | ItemDef
