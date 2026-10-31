import type { TimeOfDay } from './world'


import type { SkillDifficulty } from './adventure'


import type { ArtDoc, CameraDoc } from './scene-art'


// ───────────────────────── условия и эффекты ─────────────────────────

export type Condition =
  | { type: 'player_enters_location'; location: string }
  | { type: 'player_enters_scene'; scene: string }
  | { type: 'flag_set'; flag: string }
  | { type: 'flag_not_set'; flag: string }
  | { type: 'variable_compare'; var: string; operator: '==' | '!=' | '<' | '>' | '<=' | '>='; value: number | string }
  | { type: 'time_of_day'; value: TimeOfDay | TimeOfDay[] }
  /** сравнение с АБСОЛЮТНЫМ игровым тиком: `state.tick >= min_tick`. ВАЖНО:
   *  это не «прошло с начала забега» — для отсчёта от старта используйте
   *  `elapsed_ge` или пишите порог с учётом meta.starting_tick. */
  | { type: 'tick_elapsed'; min_tick: number }
  /** с начала забега прошло ≥ N тиков: `state.tick − (meta.starting_tick ?? 0) >= min`.
   *  Единственное верное средство сроков вида «через 72 часа от старта» при
   *  ненулевом starting_tick. */
  | { type: 'elapsed_ge'; min: number }
  | { type: 'quest_at_stage'; quest: string; stage: string }
  | { type: 'has_item'; item: string; min_quantity?: number }
  /** предмет экипирован на герое в любом слоте */
  | { type: 'equipped'; item: string }
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
  /**
   * Счётчик хроники игрока (мета-прогресс `meta.metaprogress`): «а сколько
   * раз это уже было» — между забегами. Ключи: `runs`, `deaths`,
   * `victories`, `endings_seen` (сколько разных концовок видел игрок) и
   * любой счётчик `stats_run` (`kills`, `quests_completed`,
   * `ticks_survived`, `travels`, `dialogues`) — для них берётся сумма
   * прошлых забегов ПЛЮС текущий.
   */
  | { type: 'meta_counter'; key: string; ge: number }
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
  /** потребность напарника (NpcDef.companion_needs) не выше / не ниже порога;
   *  у существа вне отряда le — ложь, ge — истина; неотслеживаемая потребность
   *  считается полной (робот не голодает) */
  | { type: 'companion_need_le'; entity: string; need: string; threshold: number }
  | { type: 'companion_need_ge'; entity: string; need: string; threshold: number }
  | { type: 'random_chance'; probability: number }
  | { type: 'has_status'; status: string }
  | { type: 'weather_is'; weather: string }
  /** известно ли настоящее имя персонажа (механика «Незнакомец») */
  | { type: 'npc_known'; entity: string; known?: boolean }
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }

export type Effect =
  | { type: 'set_flag'; flag: string; value?: boolean | number | string }
  | { type: 'clear_flag'; flag: string }
  /** наложить статус (блок 5 ТЗ); цель в мире — игрок */
  | { type: 'apply_status'; target: 'player'; status: string; duration?: number }
  /** снять статус */
  | { type: 'remove_status'; target: 'player'; status: string }
  /** сменить погоду ('' — ясно; блок 9 ТЗ) */
  | { type: 'set_weather'; weather: string }
  /** разблокировать запись кодекса (повтор — no-op; блок 10 ТЗ) */
  | { type: 'unlock_codex'; entry: string }
  /**
   * Открыть рецепт крафта «по ходу игры» (RecipeDef.known = false): до этого
   * эффекта рецепта нет во вкладке «Крафт». Повтор — no-op.
   */
  | { type: 'unlock_recipe'; recipe: string }
  /**
   * Открыть окно изготовления (крафта) эффектом правила, предмета или
   * реплики — как `open_trade`, только про верстак. `recipe` подсвечивает
   * нужный рецепт (например ремонт клапана из окна сцены).
   */
  | { type: 'open_craft'; recipe?: string }
  /**
   * Сменить состояние облика сущности (ключ из `portrait` НПЦ или
   * `scene_sprite_states`): правило переводит персонажа в «злой/испуганный/
   * раненый». Пустая строка state возвращает обычный облик. Опечатку в
   * состоянии ловит «Проверить кампанию» — иначе она тихо ничего не делала бы.
   */
  | { type: 'set_entity_state'; entity: string; state: string }
  /** раскрыть настоящее имя персонажа игроку (механика «Незнакомец») */
  | { type: 'learn_name'; entity: string; silent?: boolean }
  | { type: 'set_variable'; var: string; value: number | string }
  | { type: 'change_variable'; var: string; delta: number }
  | { type: 'start_dialogue'; entity: string; dialogue_knot?: string }
  /** Начать длительное действие из реестра meta.duration_actions (dz.20):
   *  без `ticks` — игрок выбирает длину из окна выбора min..max,
   *  с `ticks` — действие запускается сразу на указанное число тиков. */
  | { type: 'start_duration_action'; action: string; ticks?: number }
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
  /** сдвинуть потребность напарника (id из его companion_needs) на дельту */
  | { type: 'change_companion_need'; entity: string; need: string; delta: number }
  /** передать предмет из сумки героя напарнику со «второй сумкой» (companion_carry) */
  | { type: 'transfer_to_companion'; entity: string; item: string; quantity?: number }
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
  | {
      /**
       * Групповая сцепленная проверка (аудит §5.6): бросает герой и до
       * `helpers` союзников из партии — одной цепью. Если успешных бросков
       * среди всех участников ≥ `need` (умолчание — большинство), срабатывает
       * ОДНА ветвь успеха, иначе — ветвь провала. Подходит для тихих
       * обходов (все крадутся), рывков (вспомнили вместе), следопытства.
       */
      type: 'group_stat_check'
      /** чем бросаем: навыком (умолчание) или характеристикой ×множитель */
      mode?: 'skill' | 'stat'
      /** навык (mode='skill') */
      skill?: string
      /** характеристика (mode='stat') */
      stat?: string
      /** множитель характеристики (умолчание 5) */
      multiplier?: number
      /** сложность броска навыка у всех участников */
      difficulty?: SkillDifficulty
      /** дополнительный модификатор к цели характеристики */
      modifier?: number
      /** сколько первых союзников из партии участвует (умолчание 2) */
      helpers?: number
      /** сколько успешных бросков нужно (умолчание — большинство участников) */
      need?: number
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
  | {
      /**
       * Начать преследование героя (аудит §5.6): пока активно, каждые
       * `every_ticks` тиков (умолчание 4) герой и до двух союзников партии
       * проверяют цепочкой навык `skill` (умолчание stealth). Цепочка
       * провалов подряд ≥ fails_to_catch (умолчание 1) — погоня настигла:
       * срабатывают `on_fail` (обычно start_combat), преследование гаснет.
       * Остановить заранее можно эффектом stop_pursuit (оторвались в сцене).
       */
      type: 'start_pursuit'
      /** кто гонится (для подписи в журнале) */
      label?: string
      skill?: string
      every_ticks?: number
      fails_to_catch?: number
      on_fail: Effect[]
    }
  /** преследование окончено до облавы (отряд оторвался/нашёл укрытие) */
  | { type: 'stop_pursuit' }
  /**
   * Вызвать другое правило по id (раунд «Кружилиха»). Нужен, чтобы предмет или
   * слот не тащил за собой пару «поставить флаг → правило на flag_set»:
   * правило прямо зовёт продолжение. Защита от петель: глубина вложенных
   * вызовов ≤ FIRE_RULE_MAX_DEPTH (2) и правило не вызывает себя напрямую и
   * транзитивно — цикл диагностирует «Проверить кампанию». Семантика `once`
   * вызываемого правила сохраняется: повторный вызов — no-op.
   */
  | { type: 'fire_rule'; rule: string }
  /** совершить зарегистрированное преступление (аудит B7) */
  | { type: 'commit_crime'; id: string; bounty?: number }
  /** включить ценовое событие (аудит B7) */
  | { type: 'set_price_event'; id: string }
  /** снять ценовое событие (все — id не задано) */
  | { type: 'clear_price_event'; id?: string }
  /**
   * Красота экрана: большая надпись поверх мира (не «окно» — баннер).
   * preset: 'глава' (титульный шрифт, затухает в конце), 'шёпот' (курсив,
   * бледно), 'заголовок' (жирный, с акцентной лентой), 'проклятье'
   * (красная дымчатая вена), 'записочный' (листавочка наклонно).
   * Растянутость: до 5 секунд по умолчанию, читаемость > жести.
   */
  | {
      type: 'banner'
      /** текст надписи; понимает токены {var}/«скобки» стандартной раскладки */
      text: string
      preset?: 'глава' | 'шёпот' | 'заголовок' | 'проклятье' | 'записочный'
      /** появление: всплеск | тянуть | сбоку | молниеносно */
      enter?: 'всплеск' | 'тянуть' | 'сбоку' | 'молниеносно'
      /** секунды на экране (умолчание — от длины текста, минимум 3) */
      seconds?: number
      /** где: верх | центр (умолчание центр) */
      position?: 'верх' | 'центр'
      /** цветовое наполнение (HEX; умолчание — цвет пресета) */
      accent?: string
    }
  /**
   * «Открытка»: полноэкранная иллюстрация поверх мира с подписью; гаснет
   * по таймеру или тапом. Оформление — собственное (рамка, шрифт подписи).
   */
  | {
      type: 'postcard'
      image?: string
      art?: ArtDoc
      /** подпись под/поверх иллюстрации */
      text?: string
      preset?: 'глава' | 'шёпот' | 'заголовок' | 'проклятье' | 'записочный'
      /** секунды показа (умолчание 6; 0 — только по тапу) */
      seconds?: number
      /** кинематографический пан-зум фона (как у состояния сцены) */
      camera?: CameraDoc
    }
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
  | { type: 'play_sound'; sound: string; volume?: number }
  | { type: 'stop_sound'; sound?: string }
  | { type: 'override_music'; tracks: string[]; fade?: number }
  | { type: 'clear_music_override'; fade?: number }

export interface RuleDef {
  id: string
  label: string
  once: boolean
  /** manual-правило не проверяется автоматически — только вызывается по id (on_zero_effect и т.п.) */
  manual?: boolean
  /** триггер проверки: always (по умолчанию), enter_scene (вход на сцену), leave_scene (попытка уйти со сцены), interact (взаимодействие), time_tick */
  trigger?: 'always' | 'enter_scene' | 'leave_scene' | 'interact' | 'time_tick'
  /** УСЛОВИЯ правила (все должны выполниться). Обязательный массив; пустой —
   *  правило срабатывает при каждой проверке (если не once/manual).
   *  Отсутствие поля ломает движок при старте забега. */
  conditions: Condition[]
  /** ИЛИ-группы условий: И внутри группы, ИЛИ между группами. Правило активно,
   *  когда верны все `conditions` И хотя бы одна группа. Пусто/нет — как раньше.
   *  Вложенность ещё глубже не допускается (довольно и `and`/`or` в самих условиях). */
  conditions_any?: Condition[][]
  /** ЭФФЕКТЫ правила по порядку. Обязательный массив (пустой — правило-пустышка).
   *  Отсутствие поля ломает движок при старте забега. */
  effects: Effect[]
  /** глава (id из meta.chapters) — группировка в редакторе */
  chapter?: string
}
