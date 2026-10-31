import type { SkillDifficulty } from './adventure'


// ───────────────────────── диалоги (.dlg.json, итерация 8) ─────────────────────────

/** настроение (состояние портрета): базовые + свои состояния из формы NPC */
export type DlgEmotion = string

export interface DlgLine {
  text: string
  emotion?: DlgEmotion
  /** авторская ремарка (курсивом, не влияет на портрет) */
  action?: boolean
  /**
   * Спикер — не собеседник диалога, а другой персонаж (id NPC кампании):
   * спутник встревает в допрос, голос из-за двери, мастер за спиной героя.
   * Портрет, имя и эмоция реплики берутся у указанного спикера.
   * Несовместимо с ремаркой (ремарка — проза повествования, спикера у неё нет).
   * Присутствие спикера на месте — ответственность мастера: отгейтуйте ветку
   * условиями (in_party, флаг), движитель физику присутствия не проверяет.
   */
  speaker?: string
  /**
   * озвучка реплики: файл пакета (assets/voice/…) или ссылка (итерация 8,
   * блок G). Если нет — при включённом синтезаторе реплику читает браузер.
   */
  voice?: string
  /** звуковой эффект реплики: id звука из meta.sounds или путь к файлу (# sfx: ...) */
  sfx?: string
  /**
   * секундный таймер показа реплики (# timer: 3 или # timeout: 3) — design-doc §9.
   * По истечении времени диалог автоматически переходит дальше.
   */
  timer?: number
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
  /** навык героя не ниже порога (not: ниже) — светские проверки в разговоре */
  | { type: 'skill_ge'; skill: string; threshold: number; not?: boolean }
  /** счётчик хроники не ниже значения (not: ниже) — «новый круг», достижения */
  | { type: 'meta_counter'; key: string; ge: number; not?: boolean }
  /** известно ли настоящее имя персонажа (механика «Незнакомец») */
  | { type: 'npc_known'; entity: string; known?: boolean; not?: boolean }

export type DlgEffect =
  | { type: 'set_flag'; flag: string; value?: boolean | number | string }
  | { type: 'clear_flag'; flag: string }
  | { type: 'add_item'; item: string; qty: number }
  | { type: 'remove_item'; item: string; qty: number }
  | { type: 'fire_rule'; rule: string }
  | { type: 'join_party'; npc: string }
  | { type: 'open_trade'; npc: string }
  /**
   * Открыть окно изготовления (крафта) прямо по ходу сцены или реплики —
   * без кнопки в интерфейсе. `recipe` (необязательно) подсвечивает нужный
   * рецепт: «применить гаечный ключ к клапану → открылось изготовление
   * клапана». Разговор/торговлю окно крафта закрывает.
   */
  | { type: 'open_craft'; recipe?: string }
  | { type: 'start_quest'; quest: string }
  | { type: 'advance_time'; ticks: number }
  | { type: 'change_need'; need: string; delta: number }
  | { type: 'change_hp'; delta: number }
  /** сдвинуть потребность напарника (id из его companion_needs) на дельту;
   *  в сыром ink — `~ change_companion_need("npc_ira", "need_hunger", 30)` */
  | { type: 'change_companion_need'; npc: string; need: string; delta: number }
  /** передать предмет из сумки героя напарнику с включённой «второй сумкой»
   *  (companion_carry) — в сыром ink `~ give_to("npc_ira", "item_filter", 1)`;
   *  нет сумки/предмета — эффект тихо не срабатывает */
  | { type: 'transfer_to_companion'; npc: string; item: string; qty: number }
  /** напарник покидает отряд (возвращается к своему расписанию);
   *  в сыром ink — `~ leave_party("npc_ira")` */
  | { type: 'leave_party'; npc: string }
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
  /**
   * Открыть рецепт крафта «по ходу игры» (RecipeDef.known = false).
   * Повтор — no-op; рецепт без `known: false` открыт с самого начала.
   */
  | { type: 'unlock_recipe'; recipe: string }
  /**
   * Сменить облик/эмоцию персонажа репликой: портрет и спрайт переключаются
   * на состояние `state` (ключ из портретов персонажа); `""` — обычный облик.
   * В сыром ink — `~ set_entity_state("npc_ira", "angry")`.
   */
  | { type: 'set_entity_state'; entity: string; state: string }
  /**
   * Предъявить предмет/улику из инвентаря:
   * `~ present_item("ok_knot", "fail_knot", "required_item_id")`.
   */
  | { type: 'present_item'; ok: string; fail: string; required?: string }
  /** раскрыть настоящее имя персонажа игроку (механика «Незнакомец») */
  | { type: 'learn_name'; entity: string; silent?: boolean }
  /** перейти в другую сцену прямо из диалога (смена ракурса, крупный план или переезд) */
  | { type: 'go_to_scene'; scene: string; close_dialogue?: boolean }
  /** начать бой прямо из диалога (диалог закрывается и открывается боевая арена) */
  | { type: 'start_combat'; arena: string }
  /** сменить декорацию / состояние текущей сцены прямо под диалогом */
  | { type: 'change_scene_state'; state: string; scene?: string }
  /** завершить игру поражением / гибелью */
  | { type: 'game_over_death'; message?: string }
  /** завершить игру победой / успешным финалом */
  | { type: 'game_over_victory'; message?: string }

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
  /**
   * Дедлайн на раздумье (фидбек 27, §9 дизайн-документа): сколько секунд
   * игрок может выбирать ответ в этом узле. Истекло — разговор уходит в
   * узел `node` (или заканчивается, если он не задан). Работает только у
   * узлов с вариантами ответа; в ink превращается в `set_dialogue_timer`.
   */
  timer?: {
    seconds: number
    /** id узла, куда уйти по истечении; пусто — разговор заканчивается */
    node?: string
  }
}

export interface DlgDoc {
  version: 2
  /** название диалога для мастера (в списках вместо имени файла) */
  label?: string
  nodes: DlgNode[] // nodes[0] — начало разговора (knot main)
  /**
   * Мастерский сценарий (фидбек 29): текст, который мастер пишет словами.
   * Канон для чтения человеком; nodes — структура, собранная из него (её
   * читают формы, ink-генератор и движок). Правка форм пересобирает script.
   */
  script?: string
}
