import type { ImageValue } from './scene-art'


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
/**
 * Портрет героя из галереи мастера (char_creation.portraits): игрок выбирает
 * карточку при создании персонажа. states — варианты облика по состоянию
 * (ключи из общего реестра meta.emotions: «ранен», «устал»…).
 */
export interface HeroPortraitOption {
  id: string
  label: string
  image: ImageValue
  states?: Record<string, ImageValue>
  /** необязательная постоянная фигурка боя, выбираемая только при создании героя */
  combat_figure?: ImageValue
  combat_figure_mode?: 'topdown' | 'side' | 'static'
  /** сдвиг разворота этой фигурки, градусы (см. NpcDef.facing_offset) */
  combat_facing_offset?: number
}

/**
 * Слой составного портрета (char_creation.portrait_layers): «лицо»,
 * «волосы», «одежда» — игрок собирает облик из вариантов слоёв мастера,
 * итог — стек изображений по порядку слоёв.
 */
export interface HeroPortraitLayerDef {
  id: string
  /** подпись сегмента для игрока («Лицо», «Цвет кожи», «Татуировка») */
  label: string
  /** необязательная категория для группировки настроек на экране создания */
  category?: 'identity' | 'skin' | 'build' | 'face' | 'hair' | 'clothing' | 'markings' | 'other'
  options: Array<{
    id: string
    label: string
    image: ImageValue
    states?: Record<string, ImageValue>
    /** постоянная фигурка боя, если этот выбор характеризует стартовый облик */
    combat_figure?: ImageValue
    combat_figure_mode?: 'topdown' | 'side' | 'static'
    /** сдвиг разворота этой фигурки, градусы (см. NpcDef.facing_offset) */
    combat_facing_offset?: number
  }>
}

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
  /** поле «Возраст» при создании героя (аудит §5.6) */
  choose_age?: boolean
  /** поле «Биография» — короткая предыстория своими словами */
  choose_bio?: boolean
  /**
   * Галерея портретов героя (пункт «портрет героя»): игрок выбирает одну
   * карточку. Пусто — экран портрета не появляется.
   */
  portraits?: HeroPortraitOption[]
  /**
   * Составной портрет по сегментам («лицо», «волосы», «одежда»): игрок
   * собирает облик из вариантов мастера. Можно сочетать с галереей —
   * собранный портрет перекрывает выбранную карточку, если сделан выбор
   * хотя бы в одном сегменте.
   */
  portrait_layers?: HeroPortraitLayerDef[]
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
