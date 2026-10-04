import type {
  DifficultyPreset,
  ArtDoc,
  CameraDoc,
  CampaignData,
  SaveEnvelope,
  CodexEntryDef,
  CutsceneDef,
  DiceRules,
  Effect,
  EncounterEntry,
  EntityDef,
  GameState,
  ItemDef,
  ItemInteractOption,
  LocationDef,
  AchievementDef,
  ActiveStatus,
  EventTableDef,
  GenWeightedItem,
  NpcGeneratorDef,
  FeatDef,
  MetaStoreState,
  MetaUnlockDef,
  NpcDef,
  PlayerState,
  RecipeDef,
  RegionDef,
  SceneDef,
  SceneStateDef,
  SlotDef,
  SlotUseWith,
  StatBlock,
  StatusDef,
  TravelConnection,
  NeedCondition,
  RuleDef,
  PresenceOverride,
  SkillDifficulty,
  WeaponData,

  ImageValue,
} from '../shared/types'
import { SAVE_VERSION, DEFAULT_DICE_RULES, featureOn, equipmentSlots, BUILTIN_CODEX_CATEGORIES } from '../shared/types'
import {
  inspectSave,
  loadState,
  removeSave,
  writeSave,
  MAX_SAVE_SLOTS,
} from './savemigrate'
import { PRNG } from './prng'
import { derivedHP, derivedMP, movement, skillCheck, CHECK_RESULT_LABEL, difficultyModifier, difficultyLabel, type SkillCheckOutcome } from './brp'
import { rollDice } from './dice'
import { evalCondition, evalSceneCondition } from './conditions'
import { hourOfDay, inTimeRange, timeOfDay } from './time'
import type { CharChoice } from './charcreate'
import type { Story } from 'inkjs'
import { bindExternals, createStory, drainStory, firstInkKnot, type DialogueUI } from './dialogue'
import { skillLabel } from '../shared/skills'
import { playUi, playInteraction } from '../shared/audio'
import type { SoundHook } from '../shared/types'
import { migrateNeedCondition } from '../shared/migrate'
import { CombatController } from './combat'

/**
 * Game State Machine — ядро рантайма (ТЗ 2, 4).
 * Мутирует GameState; UI подписывается через onChange.
 */

export interface SlotOccupant {
  slot: SlotDef
  entity: EntityDef | null
}

export class GameEngine {
  campaign: CampaignData
  state: GameState
  rng: PRNG
  /** Временный флаг отладки, не сохраняется в состоянии забега. */
  debugInvincible = false
  private listeners = new Set<() => void>()
  private activeStory: Story | null = null
  private activeNpc: NpcDef | null = null
  /** Ink-истории этого забега (состояние once-выборов живёт в пределах забега) */
  dialogue: DialogueUI | null = null
  combat: CombatController | null = null
  /** открытая торговля: id NPC-торговца */
  trade: NpcDef | null = null
  /** транзитные всплывающие подсказки (не в сейве): «Получено: …» и т.п. — UI отображает и сам гасит */
  toasts: { id: number; text: string; kind: 'get' | 'lose' | 'info' }[] = []
  private toastSeq = 0

  /** добавить короткое всплывающее уведомление (записывается и в журнал).
   *  Гаснет само — обращать внимание важно, а закрывать каждое рукой — перебор (баг-фитч №6). */
  pushToast(text: string, kind: 'get' | 'lose' | 'info' = 'info'): void {
    const toast = { id: ++this.toastSeq, text, kind }
    // новый массив — UI-эффект таймеров ловит изменение ссылки
    this.toasts = [...this.toasts, toast]
    this.pushLog(text)
    playUi(kind === 'lose' ? 'item_lose' : kind === 'get' ? 'item_get' : 'message')
    this.notify()
    // страховка: гасим и без UI-эффекта (вдруг экран без транзит-надписей)
    setTimeout(() => this.dismissToast(toast.id), 5200)
  }

  /** UI погасил подсказку по таймеру */
  dismissToast(id: number): void {
    if (this.toasts.some((t) => t.id === id)) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
      this.notify()
    }
  }

  /** всплывающие сообщения (show_message) */
  messages: { text: string; portrait?: string }[] = []
  /**
   * Очередь катсцен (итерация 8, блок E). Эффект play_cutscene ставит
   * катсцену в очередь; остальные эффекты применяются сразу, но их экраны
   * (диалог, бой, торговля, сообщения) UI показывает только после ролика —
   * для игрока поток эффектов «продолжается по окончании катсцены».
   */
  cutsceneQueue: Array<{ def: CutsceneDef; serial: number }> = []
  private cutsceneSerial = 0
  /** забег создан с нуля (а не загружен из сейва) — для правил «на старте» */
  private freshRun: boolean
  /** обёртка последнего сохранения: версии кампании/движка и даты (`SaveEnvelope`) */
  envelope: SaveEnvelope | null = null

  constructor(campaign: CampaignData, state?: GameState) {
    this.campaign = campaign
    this.freshRun = !state
    if (state) {
      this.state = state
      this.rng = new PRNG(state.seed)
      // Старые сейвы дублировали баланс в currencies; inventory — единственный источник.
      delete this.state.player.currencies
      // миграция сейвов ≤ v2: экипировка из шаблона персонажа
      if (!this.state.player.equipment) {
        const def = this.campaign.entities[this.state.player.entity] as NpcDef | undefined
        this.state.player.equipment = { ...(def?.equipment ?? {}) }
      }
    } else {
      this.rng = new PRNG()
      this.state = this.newState()
    }
  }

  // ─────────────── подписка UI ───────────────

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  notify(): void {
    for (const fn of this.listeners) fn()
  }

  pushLog(text: string): void {
    this.state.log.push(text)
    if (this.state.log.length > 200) this.state.log.shift()
  }

  // ─────────────── создание нового забега ───────────────

  private newState(): GameState {
    const meta = this.campaign.meta
    const playerDef = this.campaign.entities[meta.default_player] as NpcDef
    const stats = { ...playerDef.stats }
    const hp = stats.HP ?? derivedHP(stats)
    const mp = stats.MP ?? derivedMP(stats)
    const needs: Record<string, number> = {}
    for (const n of meta.needs) needs[n.id] = n.max

    const player: PlayerState = {
      entity: playerDef.id,
      stats,
      skills: { ...playerDef.skills },
      skill_marks: {},
      hp,
      max_hp: hp,
      mp,
      max_mp: mp,
      needs,
      inventory: (playerDef.inventory ?? []).map((i) => ({ ...i })),
      equipment: { ...(playerDef.equipment ?? {}) },
    }

    const dispositions: Record<string, number> = {}
    for (const f of meta.factions ?? []) dispositions[f.id] = f.base_disposition

    return {
      save_version: SAVE_VERSION,
      campaign_id: meta.id,
      seed: this.rng.seed,
      tick: meta.starting_tick ?? 8,
      region: meta.starting_region,
      location: meta.starting_location,
      scene: meta.starting_scene,
      flags: {},
      variables: {},
      fired_rules: [],
      revealed_locations: [],
      dead_entities: [],
      removed_entities: [],
      spawned: [],
      player,
      quests: {},
      dispositions,
      party: [],
      blocked_paths: [],
      log: [],
      game_over: null,
      stats_run: { travels: 0, dialogues: 0, ticks_survived: 0, kills: 0, quests_completed: 0 },
    }
  }

  /** Вызывается один раз после создания/загрузки. */
  start(): void {
    // новый забег: правила, чьи условия выполнены с самого начала
    // (вступительная катсцена и т.п. — once + tick_elapsed 0)
    if (this.freshRun) {
      this.freshRun = false
      this.metaRunStart()
      this.checkRules()
    }
    this.runLocationRules(this.state.location)
    this.autosave()
    this.notify()
  }

  /**
   * Применить выбор с экрана создания персонажа (блок 11 ТЗ) к шаблону
   * `default_player`: имя, характеристики (с пересчётом производных),
   * навыки, снаряжение профессии. Вызывается ДО `start()` на новом забеге.
   */
  applyCharCreation(choice: CharChoice): void {
    const creation = this.campaign.meta.char_creation
    if (!creation) return
    const s = this.state
    const profession = creation.professions?.find((p) => p.id === choice.profession)
    const name = choice.name.trim()
    if (name) s.player.name = name
    // возраст и биография (аудит §5.6): только если мастер включил поля
    if (creation.choose_age && choice.age !== undefined) s.player.age = choice.age
    // уровень сложности от игрока (мастерские пресеты meta.difficulties)
    if (choice.difficulty && this.campaign.meta.difficulties?.some((d) => d.id === choice.difficulty)) {
      s.player.difficulty = choice.difficulty
    }
    // облик героя: галерея и/или слои мастера (char_creation.portraits[-layers])
    const pc: Record<string, unknown> = {}
    if (choice.portrait && creation.portraits?.some((p) => p.id === choice.portrait)) pc.gallery = choice.portrait
    if (choice.portrait_layers && creation.portrait_layers?.length) {
      const layers: Record<string, string> = {}
      for (const layer of creation.portrait_layers) {
        const sel = choice.portrait_layers[layer.id]
        if (sel && layer.options.some((o) => o.id === sel)) layers[layer.id] = sel
      }
      if (Object.keys(layers).length) pc.layers = layers
    }
    if (Object.keys(pc).length) s.player.portrait_choice = pc as PlayerState['portrait_choice']
    else delete s.player.age
    if (creation.choose_bio && choice.bio?.trim()) s.player.bio = choice.bio.trim()
    else delete s.player.bio
    // характеристики: только семь базовых, производные пересчитываются
    const stats = { ...choice.stats } as unknown as StatBlock
    delete stats.HP
    delete stats.MP
    s.player.stats = stats
    s.player.max_hp = derivedHP(stats)
    s.player.hp = s.player.max_hp
    s.player.max_mp = derivedMP(stats)
    s.player.mp = s.player.max_mp
    // навыки: итоговые значения с экрана (база + покупки + бонусы профессии)
    s.player.skills = { ...choice.skills }
    // снаряжение профессии
    for (const it of profession?.items ?? []) this.addItem(it.item, it.quantity, { silent: true })
    s.char_choice = JSON.parse(JSON.stringify(choice))
    this.pushLog(`${name || 'Герой'}: забег начинается.`)
  }

  // ─────────────── катсцены (итерация 8, блок E) ───────────────

  /** текущая катсцена (первая в очереди) */
  get cutscene(): CutsceneDef | null {
    return this.cutsceneQueue[0]?.def ?? null
  }

  /** уникальный номер показа текущей катсцены (ключ для UI) */
  get cutsceneKey(): number {
    return this.cutsceneQueue[0]?.serial ?? 0
  }

  // ─────────────── баннеры и «открытки» (кинематографические эффекты правил) ───────────────

  /** активные баннеры этого забега (визуальный слой, в сохранения не входит) */
  banners: Array<{
    /** serial для ключей React */
    serial: number
    text: string
    preset?: string
    enter?: string
    seconds?: number
    position?: string
    accent?: string
  }> = []
  /** активная «открытка» (одна за раз, новая вытесняет) */
  postcard: {
    image?: string
    art?: ArtDoc
    text?: string
    preset?: string
    seconds?: number
    camera?: CameraDoc
  } | null = null
  private bannerSerial = 1

  private showBanner(e: { text: string; preset?: string; enter?: string; seconds?: number; position?: string; accent?: string }): void {
    const serial = this.bannerSerial++
    this.banners = [...this.banners, { serial, ...e }]
    const seconds = e.seconds ?? Math.min(8, Math.max(3, e.text.length * 0.06))
    // таймер через globalThis: в node-смоуке engine тоже живёт
    globalThis.setTimeout(() => {
      if (this.banners.some((b) => b.serial === serial)) {
        this.banners = this.banners.filter((b) => b.serial !== serial)
        this.notify()
      }
    }, seconds * 1000)
    this.notify()
  }

  /** закрыть «открытку» (тап или таймер) */
  hidePostcard(): void {
    if (!this.postcard) return
    this.postcard = null
    this.notify()
  }

  playCutscene(id: string): void {
    const def = this.campaign.cutscenes?.[id]
    if (!def || !def.slides?.length) return
    this.cutsceneQueue.push({ def, serial: ++this.cutsceneSerial })
    this.pushLog(`Катсцена: «${def.label}»`)
    this.notify()
  }

  /** катсцена досмотрена или пропущена */
  endCutscene(): void {
    if (!this.cutsceneQueue.length) return
    this.cutsceneQueue.shift()
    if (!this.cutsceneQueue.length) {
      this.checkRules()
      this.autosave()
    }
    this.notify()
  }

  // ─────────────── время и потребности ───────────────

  /**
   * Условие потребности (когда убывает / когда восстанавливается).
   * Итерация 8, А3: «в локации» и «есть/надет предмет» — СПИСКИ id,
   * условие истинно, если выполнено хотя бы одно значение («любой из»).
   */
  private needCondOk(raw: NeedCondition): boolean {
    const c = migrateNeedCondition(raw)
    switch (c.type) {
      case 'time_of_day':
        return c.values.includes(timeOfDay(this.state.tick, this.campaign.meta))
      case 'flag':
        return !!this.state.flags[c.flag] !== !!c.not
      case 'in_location':
        return (c.locations ?? []).includes(this.state.location) !== !!c.not
      case 'has_item':
        return (c.items ?? []).some((id) => this.hasItem(id)) !== !!c.not
      case 'equipped':
        return (c.items ?? []).some((id) => this.isEquipped(id)) !== !!c.not
    }
  }

  advanceTicks(ticks: number): void {
    const meta = this.campaign.meta
    const needsOn = featureOn(meta, 'needs')
    for (let i = 0; i < ticks; i++) {
      if (this.state.game_over) return
      this.state.tick += 1
      this.state.stats_run.ticks_survived += 1
      if (needsOn) {
        for (const need of meta.needs) {
          // старые сохранения могут не знать новую потребность — считаем её полной
          const cur = this.state.player.needs[need.id] ?? need.max
          let next = cur
          // убыль — только когда все условия выполнены (пусто = всегда)
          const decays = !need.decay_when?.length || need.decay_when.every((c) => this.needCondOk(c))
          if (decays) next = Math.max(0, next - need.decay_per_tick * (this.difficultyDef()?.need_decay ?? 1))
          // восстановление — когда выполнены условия restore_when
          if (
            need.restore_per_tick &&
            (!need.restore_when?.length || need.restore_when.every((c) => this.needCondOk(c)))
          ) {
            next = Math.min(need.max, next + need.restore_per_tick)
          }
          this.state.player.needs[need.id] = next
          if (next <= 0 && cur > 0) this.onNeedZero(need.id)
        }
      }
      // статусы игрока (блок 5 ТЗ): DoT, декремент, истечение
      this.tickStatuses()
      // преследование (start_pursuit): периодические цепочные проверки маскировки
      if (this.state.pursuit) {
        this.state.pursuit.left -= 1
        if (this.state.pursuit.left <= 0) this.tickPursuit()
      }
      // смена суток: самочувствие NPC (спал по расписанию / не спал)
      const tpd = meta.ticks_per_day ?? 24
      if (tpd > 0 && this.state.tick > 0 && this.state.tick % tpd === 0) this.tickNpcMood()
    }
    // достижения со счётчиками (прожитые тики и пр.) — после пачки тиков
    this.checkAchievements()
    // таблицы случайных событий ходят тем же шагом, что и тики мира (аудит B9)
    this.tickEventTables()
    // правила на tick_elapsed / need_* (поезд ушёл, таймеры драм) — иначе
    // «последний поезд в 22:00» срабатывал только после смены сцены/диалога
    this.checkRules()
  }

  /** один тик мировых статусов игрока; статус сам по себе не убивает (мин. 1 HP) */
  private tickStatuses(): void {
    const list = this.state.player.statuses
    if (!list?.length) return
    const expired: StatusDef[] = []
    const cured: string[] = []
    for (const s of list) {
      const def = this.statusDef(s.id)
      if (!def) continue
      // болезни/яды с течением (аудит B7): стадии — спасбросок CON; DoT и модификаторы масштабированы тяжестью
      const severity = Math.max(1, s.severity ?? 1)
      if (def.dot?.hp) this.state.player.hp = Math.max(1, this.state.player.hp - def.dot.hp * severity)
      if (def.dot?.mp) this.state.player.mp = Math.max(0, this.state.player.mp - def.dot.mp * severity)
      if (def.dot?.hp) this.pushLog(`${def.label}: −${def.dot.hp * severity} HP${severity > 1 ? ` (тяжесть ${severity})` : ''}.`)
      if (def.disease && (s.next_check ?? Infinity) <= this.state.tick) {
        const mult = def.disease.con_multiplier ?? 5
        const out = skillCheck(this.state.player.stats.CON * mult, this.rng, 0, this.diceRules)
        this.pushLog(`${def.label}: стадия течения — CON×${mult}, d100=${out.roll} против ${out.target} → ${CHECK_RESULT_LABEL[out.result]}`)
        s.next_check = this.state.tick + def.disease.interval_ticks
        if (out.success) {
          s.severity = Math.max(0, severity - 1)
          if (s.severity === 0) {
            cured.push(s.id)
            continue
          }
          this.pushLog(`${def.label}: тяжесть снижается до ${s.severity}.`)
        } else {
          const cap = def.disease.severity_max ?? 5
          s.severity = Math.min(cap, severity + 1)
          this.pushLog(`${def.label}: болезнь ухудшается — тяжесть ${s.severity}/${cap}.`)
        }
      }
      s.left -= 1
      if (s.left <= 0) expired.push(def)
    }
    if (cured.length) {
      this.state.player.statuses = (this.state.player.statuses ?? []).filter((s) => !cured.includes(s.id))
      for (const id of cured) {
        const def = this.statusDef(id)
        this.pushLog(`${def?.label ?? id}: выздоровление.`)
      }
    }
    if (expired.length) {
      this.state.player.statuses = list.filter((s) => s.left > 0)
      for (const def of expired) {
        this.pushLog(def.expire_message ?? `${def.label}: эффект закончился.`)
        if (def.on_expire?.length) this.applyEffects(def.on_expire)
      }
      this.notify()
    }
  }

  private onNeedZero(needId: string): void {
    const need = this.campaign.meta.needs.find((n) => n.id === needId)
    if (!need) return
    if (need.on_zero_effect === 'death' || !need.on_zero_effect) {
      this.gameOver('death', `Смерть от истощения: ${need.label.toLowerCase()} на нуле.`)
      return
    }
    const rule = this.campaign.rules[need.on_zero_effect]
    if (rule) this.applyEffects(rule.effects)
  }

  changeNeed(needId: string, delta: number): void {
    if (!featureOn(this.campaign.meta, 'needs')) return
    const need = this.campaign.meta.needs.find((n) => n.id === needId)
    if (!need) return
    const cur = this.state.player.needs[needId] ?? 0
    const next = Math.min(need.max, Math.max(0, cur + delta))
    this.state.player.needs[needId] = next
    if (next <= 0 && cur > 0) this.onNeedZero(needId)
  }

  changeHp(delta: number): void {
    if (this.debugInvincible && delta < 0) return
    const p = this.state.player
    p.hp = Math.min(p.max_hp, p.hp + delta)
    if (p.hp <= 0 && !this.tryBrpSurvival()) this.gameOver('death', 'Ваши раны оказались смертельными.')
  }

  /**
   * Мировой спасбросок от смерти (режим combat.death.mode='brp'): при HP ≤ 0
   * бросок CON×con_multiplier; успех — герой выживает на грани (1 HP).
   * Истина — смерть отменена.
   */
  private tryBrpSurvival(): boolean {
    const death = this.campaign.meta.combat?.death
    if (death?.mode !== 'brp') return false
    const mult = death.con_multiplier ?? 5
    const out = skillCheck(this.state.player.stats.CON * mult, this.rng, 0, this.diceRules)
    this.pushLog(`Грань смерти: CON×${mult} — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`)
    if (!out.success) return false
    this.state.player.hp = 1
    this.pushLog('Герой выживает на грани смерти (1 HP).')
    return true
  }

  /**
   * Естественное лечение при отдыхе (аудит §5.6 п.3): сон (ink-вызов `sleep`)
   * лечит HP костями из `meta.rest.hp` (умолчание '1d3') и, если не отключено
   * (`rest.mp_full: false`), полностью восстанавливает MP.
   */
  restHeal(): { hp: number; mpFull: boolean } {
    const rest = this.campaign.meta.rest
    const p = this.state.player
    let healed = 0
    if (p.hp > 0 && p.hp < p.max_hp) {
      healed = Math.min(p.max_hp - p.hp, rollDice(rest?.hp ?? '1d3', this.rng))
      if (healed > 0) {
        p.hp += healed
        this.pushLog(`Отдых восстанавливает ${healed} HP.`)
      }
    }
    const mpFull = rest?.mp_full ?? true
    if (mpFull && p.mp < p.max_mp) {
      p.mp = p.max_mp
      this.pushLog('Силы восстановлены (MP полностью).')
    }
    // удача восполняется на отдыхе (мастер может запретить luck.rest_luck=false)
    if (this.luckMax() > 0 && (this.campaign.meta.luck?.rest_luck ?? true) && this.luck() < this.luckMax()) {
      this.state.player.luck = this.luckMax()
      this.pushLog('Герой чувствует: удача вернулась.')
    }
    // усталость снимается отдыхом (мастер может запретить vitals.fatigue.rest_restore=false)
    if (this.fatigueMax() > 0) {
      const cfg = this.campaign.meta.vitals?.fatigue
      const restore = cfg === true ? true : (typeof cfg === 'object' ? cfg.rest_restore !== false : true)
      if (restore && this.fatigue() < this.fatigueMax()) {
        this.state.player.fatigue = this.fatigueMax()
        this.pushLog('Усталость прошла (отдых).')
      }
    }
    return { hp: healed, mpFull }
  }

  // ─────────────── статусы (блок 5 ТЗ «Гибкий движок») ───────────────

  /** определение статуса из реестра кампании */
  statusDef(id: string): StatusDef | undefined {
    return this.campaign.meta.statuses?.find((s) => s.id === id)
  }

  /** активен ли статус у игрока */
  hasStatus(id: string): boolean {
    return !!this.state.player.statuses?.some((s) => s.id === id)
  }

  /**
   * Наложить статус на игрока (в мире — только игрок, v1). Повторное
   * наложение обновляет длительность по максимуму.
   */
  applyStatus(_target: 'player', id: string, duration?: number): void {
    const def = this.statusDef(id)
    if (!def || def.scope === 'combat') return // чисто боевые — через бой (блок 6)
    const left = duration ?? def.duration
    if (left <= 0) return
    const list = (this.state.player.statuses ??= [])
    const existing = list.find((s) => s.id === id)
    if (existing) {
      existing.left = Math.max(existing.left, left)
      return
    }
    // болезни/яды с течением (аудит B7): стартовая тяжесть и первая стадия
    const entry: ActiveStatus = { id, left }
    if (def.disease) {
      entry.severity = 1
      entry.next_check = this.state.tick + def.disease.interval_ticks
    }
    list.push(entry)
    this.pushLog(def.apply_message ?? `${def.label}: эффект наложен.`)
    if (def.on_apply?.length) this.applyEffects(def.on_apply)
    this.notify()
  }

  /** снять статус (без срабатывания on_expire) */
  removeStatus(_target: 'player', id: string): void {
    const list = this.state.player.statuses
    if (!list?.some((s) => s.id === id)) return
    this.state.player.statuses = list.filter((s) => s.id !== id)
    const def = this.statusDef(id)
    if (def) this.pushLog(`${def.label}: эффект снят.`)
    this.notify()
  }

  /** суммарный модификатор навыка от активных статусов (болезни масштабированы тяжестью) */
  statusSkillMod(skill: string): number {
    let mod = 0
    for (const s of this.state.player.statuses ?? []) {
      const def = this.statusDef(s.id)
      const sev = def?.disease ? Math.max(1, s.severity ?? 1) : 1
      for (const m of def?.skill_mods ?? []) if (m.skill === skill) mod += m.delta * sev
    }
    return mod
  }

  // ─────────────── инвентарь ───────────────

  hasItem(id: string): boolean {
    return this.itemCount(id) > 0
  }

  itemCount(id: string): number {
    return this.state.player.inventory
      .filter((i) => i.item === id)
      .reduce((s, i) => s + i.quantity, 0)
  }

  addItem(id: string, quantity = 1, opts: { silent?: boolean } = {}): void {
    const inv = this.state.player.inventory
    // изнашиваемые предметы — отдельные экземпляры (аудит §5.6 п.10)
    if (this.itemMaxDurability(id) !== undefined) {
      for (let i = 0; i < quantity; i++) inv.push({ item: id, quantity: 1 })
    } else {
      const entry = inv.find((i) => i.item === id && i.durability === undefined)
      if (entry) entry.quantity += quantity
      else inv.push({ item: id, quantity })
    }
    if (!opts.silent) this.pushToast(`Получено: ${this.itemTitle(id)}${quantity > 1 ? ` ×${quantity}` : ''}.`, 'get')
  }

  removeItem(id: string, quantity = 1, opts: { silent?: boolean; verb?: string } = {}): void {
    const inv = this.state.player.inventory
    let left = quantity
    // сначала расходим наиболее изношенные экземпляры
    while (left > 0) {
      const entries = inv.filter((i) => i.item === id)
      if (!entries.length) break
      const max = this.itemMaxDurability(id)
      const pick = max === undefined
        ? entries[0]
        : entries.reduce((a, b) => ((a.durability ?? max) <= (b.durability ?? max) ? a : b))
      if (pick.quantity > left) {
        pick.quantity -= left
        left = 0
      } else {
        left -= pick.quantity
        inv.splice(inv.indexOf(pick), 1)
      }
    }
    // предмет закончился — снимаем со всех слотов
    if (!this.hasItem(id)) {
      const eq = this.state.player.equipment
      for (const slot of Object.keys(eq)) {
        if (eq[slot] === id) delete eq[slot]
      }
    }
    const lost = quantity - left
    if (!opts.silent && lost > 0) {
      const verb = opts.verb ?? (lost >= quantity ? 'Потеряно' : 'Частично потеряно')
      this.pushToast(`${verb}: ${this.itemTitle(id)}${lost > 1 ? ` ×${lost}` : ''}.`, 'lose')
    }
  }

  // ─────────────── износ снаряжения (аудит §5.6 п.10) ───────────────

  /** максимальная прочность предмета (оружие — weapon_data, броня — armor_data); нет — вечный */
  itemMaxDurability(itemId: string): number | undefined {
    const def = this.campaign.entities[itemId] as ItemDef | undefined
    if (!def || def.type !== 'item') return undefined
    return def.weapon_data?.durability ?? def.armor_data?.durability
  }

  /** осталось прочности у первого пригодного экземпляра (нет — null) */
  itemDurabilityOf(id: string): { left: number; max: number } | null {
    const max = this.itemMaxDurability(id)
    if (max === undefined) return null
    const entry = this.state.player.inventory.find((i) => i.item === id)
    if (!entry) return null
    return { left: entry.durability ?? max, max }
  }

  /** пригоден ли предмет к использованию (есть экземпляр с прочностью > 0) */
  isItemUsable(id: string): boolean {
    const max = this.itemMaxDurability(id)
    if (max === undefined) return this.hasItem(id)
    return this.state.player.inventory.some((i) => i.item === id && (i.durability ?? max) > 0)
  }

  /** экземпляры с износом от меньшей прочности (для UI) */
  durabilityEntries(id: string): Array<{ entry: { item: string; quantity: number; durability?: number }; left: number }> {
    const max = this.itemMaxDurability(id)
    if (max === undefined) return []
    return this.state.player.inventory
      .filter((i) => i.item === id)
      .map((entry) => ({ entry, left: entry.durability ?? max }))
      .sort((a, b) => a.left - b.left)
  }

  /**
   * Износ предмета игрока (урон в бою): −amount самому надетому экземпляру.
   * Сломанный экземпляр с прочностью 0 сохраняется (для починки рецептом).
   * Истина — предмет сломался этим износом.
   */
  damageItemDurability(itemId: string, amount = 1): boolean {
    const max = this.itemMaxDurability(itemId)
    if (max === undefined) return false
    const entry = this.state.player.inventory
      .filter((i) => i.item === itemId && (i.durability ?? max) > 0)
      .sort((a, b) => (a.durability ?? max) - (b.durability ?? max))[0]
    if (!entry) return false
    const before = entry.durability ?? max
    entry.durability = Math.max(0, before - amount)
    if (entry.durability === 0 && before > 0) {
      const def = this.campaign.entities[itemId]
      this.pushLog(`«${def?.label ?? itemId}» сломался!`)
      playUi('defeat')
      return true
    }
    return false
  }

  /**
   * Починка (мастер помечает рецепт `repair: true`): восстанавливает самый
   * изношенный экземпляр до максимума. Истина — нашелся изношенный.
   */
  repairItem(itemId: string): boolean {
    const max = this.itemMaxDurability(itemId)
    if (max === undefined) return false
    const entry = this.state.player.inventory
      .filter((i) => i.item === itemId)
      .sort((a, b) => (a.durability ?? max) - (b.durability ?? max))[0]
    if (!entry || (entry.durability ?? max) >= max) return false
    entry.durability = max
    const def = this.campaign.entities[itemId]
    this.pushLog(`«${def?.label ?? itemId}» отремонтирован.`)
    this.notify()
    this.autosave()
    return true
  }

  /** свободные «еда предмета» нет изношенных экземпляров — для рецепта починки */
  hasDamaged(itemId: string): boolean {
    const max = this.itemMaxDurability(itemId)
    if (max === undefined) return false
    return this.state.player.inventory.some((i) => i.item === itemId && (i.durability ?? max) < max)
  }

  // ─────────────── экипировка (блок 7 ТЗ: слоты задаёт кампания) ───────────────

  /** список слотов экипировки кампании (встроенные + свои) */
  equipmentSlots(): Array<{ id: string; label: string }> {
    return equipmentSlots(this.campaign.meta)
  }

  slotLabel(slotId: string): string {
    return this.equipmentSlots().find((s) => s.id === slotId)?.label ?? slotId
  }

  /** слот, в который экипируется предмет (нет — не экипируется) */
  itemSlot(id: string): string | undefined {
    const def = this.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item') return undefined
    if (def.equip_slot) return def.equip_slot
    if (def.weapon_data) return 'weapon' // мягкая миграция старых предметов
    if (def.armor_data) return 'armor'
    return undefined
  }

  /** предмет надет? */
  isEquipped(id: string): boolean {
    return Object.values(this.state.player.equipment).includes(id)
  }

  /** в каком слоте надет предмет (нет — '') */
  equippedSlotOf(id: string): string {
    const eq = this.state.player.equipment
    for (const slot of Object.keys(eq)) if (eq[slot] === id) return slot
    return ''
  }

  /** надеть предмет из инвентаря в его слот */
  equipItem(id: string): void {
    if (!this.hasItem(id)) return
    const def = this.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item') return
    const slot = this.itemSlot(id)
    if (!slot) return
    this.state.player.equipment[slot] = id
    this.pushLog(slot === 'weapon' ? `Взято в руки: ${def.label}.` : `Надето: ${def.label}.`)
    this.pushToast(slot === 'weapon' ? `Взято в руки: ${def.label}.` : `Надето: ${def.label}.`, 'info')
    this.autosave()
    this.notify()
  }

  /** снять предмет из слота */
  unequipItem(slot: string): void {
    const eq = this.state.player.equipment
    const id = eq[slot]
    if (!id) return
    const def = this.campaign.entities[id] as ItemDef | undefined
    delete eq[slot]
    this.pushLog(`Снято: ${def?.label ?? id}.`)
    this.pushToast(`Снято: ${def?.label ?? id}.`, 'info')
    this.autosave()
    this.notify()
  }

  /** текущее оружие игрока (для UI и боя): экипированное или кулаки; сломанное — кулаки */
  playerWeapon(): { itemId: string | null; weapon: WeaponData; label: string } {
    const id = this.state.player.equipment['weapon']
    // сломанное оружие (прочность 0) не годится — кулаки (аудит §5.6 п.10)
    if (id && this.isItemUsable(id)) {
      const def = this.campaign.entities[id] as ItemDef | undefined
      if (def?.weapon_data) return { itemId: id, weapon: def.weapon_data, label: def.label }
    }
    return {
      itemId: null,
      weapon: { skill: 'brawl', damage: '1d3', damage_bonus: true, range: 1, attacks_per_round: 1, parry_capable: false, label: 'Кулаки' },
      label: 'Кулаки',
    }
  }

  /** броня игрока: сумма очков ВСЕХ надетых предметов с бронёй (шлем+кираса) */
  playerArmor(): { itemId: string | null; points: number; label: string } {
    let points = 0
    let first: string | null = null
    const labels: string[] = []
    for (const slot of Object.keys(this.state.player.equipment)) {
      const id = this.state.player.equipment[slot]
      // сломанная броня (прочность 0) перестаёт поглощать урон (аудит §5.6 п.10)
      if (!id || !this.isItemUsable(id)) continue
      const def = this.campaign.entities[id] as ItemDef | undefined
      if (def?.armor_data) {
        points += def.armor_data.points
        labels.push(def.label)
        if (!first) first = id
      }
    }
    if (!points) return { itemId: null, points: 0, label: 'Без брони' }
    return { itemId: first, points, label: labels.join(' + ') }
  }

  useItem(id: string): void {
    const def = this.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item' || !def.on_use) return
    playInteraction('use', { entity: def })
    this.applyEffects(def.on_use.effects)
    if (def.on_use.consume !== false) this.removeItem(id, 1, { verb: 'Использовано' })
    if (def.on_use.message) this.messages.push({ text: this.fmt(def.on_use.message) })
    this.checkRules()
    this.notify()
  }

  // ─────────────── груз и перегруз (ТЗ 4.6) ───────────────

  currentLoad(): number {
    let sum = 0
    for (const e of this.state.player.inventory) {
      const def = this.campaign.entities[e.item] as ItemDef | undefined
      if (def?.type === 'item') sum += (def.weight ?? 0) * e.quantity
    }
    return sum
  }

  maxLoad(): number {
    const s = this.state.player.stats
    return s.STR + s.SIZ
  }

  isOverloaded(): boolean {
    return this.currentLoad() > this.maxLoad()
  }

  // ─────────────── репутация и фракции (ТЗ 4.8) ───────────────

  /**
   * target: id фракции или id NPC.
   * У NPC: base_disposition + личный сдвиг (dispositions[npc.id]) + фракция
   * (если задана) + самочувствие. Личный сдвиг нужен накигэ/драмам, где
   * отношение к человеку важнее «города» — раньше без faction delta глотался.
   */
  getDisposition(target: string): number {
    const npc = this.campaign.entities[target] as NpcDef | undefined
    if (npc && npc.type === 'npc') {
      const personal = this.state.dispositions[target] ?? 0
      const factionValue = npc.faction ? (this.state.dispositions[npc.faction] ?? 0) : 0
      // самочувствие NPC (выспался/устал) подкрашивает отношение: ±25
      const moodShift = Math.round((this.npcMood(target) - 50) / 2)
      return personal + factionValue + (npc.base_disposition ?? 0) + moodShift
    }
    return this.state.dispositions[target] ?? 0
  }

  /** самочувствие NPC (0..100, умолчание 50): усталость от пропуска ночёвки по расписанию */
  /**
   * Ключ состояния облика героя: первый активный статус с совпадающим
   * ключом в meta.emotions… но практичнее — известные ключи по порядку:
   * статус из списка активных, иначе 'wounded' (HP < 50%), 'tired' (любая
   * потребность ≤ 25), иначе 'neutral'. Ключи — из реестра состояний мастера.
   */
  heroPortraitStateKey(): string {
    const p = this.state.player
    if (p.statuses?.length) return p.statuses[0].id
    if (p.hp * 2 < p.max_hp) return 'wounded'
    for (const v of Object.values(this.state.player.needs ?? {})) if (v <= 25) return 'tired'
    return 'neutral'
  }

  /**
   * Стек изображений портрета героя (низ → верх) с учётом состояния:
   * галерея — один кадр; слои — кадры выбранных вариантов по порядку
   * сегментов мастера; вариант облика под ключ состояния меняет кадр,
   * если мастер задал такую запись. Пусто — портрета нет.
   */
  heroPortraitImages(): ImageValue[] {
    const meta = this.campaign.meta
    const choice = this.state.player.portrait_choice
    const key = this.heroPortraitStateKey()
    const withState = (img: ImageValue, states?: Record<string, ImageValue>): ImageValue => states?.[key] || img
    const out: ImageValue[] = []
    if (choice?.layers && meta.char_creation?.portrait_layers?.length) {
      for (const layer of meta.char_creation.portrait_layers) {
        const opt = layer.options.find((o) => o.id === choice.layers![layer.id]) ?? layer.options[0]
        if (opt) out.push(withState(opt.image, opt.states))
      }
    } else if (choice?.gallery) {
      const def = meta.char_creation?.portraits?.find((p) => p.id === choice.gallery)
      if (def) out.push(withState(def.image, def.states))
    }
    // Текущая экипировка меняет только портрет на листе героя, не боевую фигурку.
    const overlays = Object.entries(this.state.player.equipment ?? {}).flatMap(([slot, id], index) => {
      const item = this.campaign.entities[id] as ItemDef | undefined
      return item?.type === 'item' && item.hero_appearance?.overlay
        ? [{ slot, index, order: item.hero_appearance.order ?? index, image: item.hero_appearance.overlay }]
        : []
    }).sort((a, b) => a.order - b.order || a.index - b.index)
    out.push(...overlays.map((x) => x.image))
    return out
  }

  /** Статичная боевая фигурка выбирается только из постоянного облика при создании. */
  heroCombatFigure(): { figure?: ImageValue; mode?: 'topdown' | 'side' | 'static' } {
    const meta = this.campaign.meta.char_creation
    const choice = this.state.player.portrait_choice
    if (!meta || !choice) return {}
    if (choice.layers && meta.portrait_layers?.length) {
      for (const layer of meta.portrait_layers) {
        const option = layer.options.find((o) => o.id === choice.layers![layer.id])
        if (option?.combat_figure) return { figure: option.combat_figure, mode: option.combat_figure_mode }
      }
    }
    const portrait = meta.portraits?.find((p) => p.id === choice.gallery)
    return portrait?.combat_figure
      ? { figure: portrait.combat_figure, mode: portrait.combat_figure_mode }
      : {}
  }

  npcMood(entityId: string): number {
    return this.state.npc_mood?.[entityId] ?? 50
  }

  /** сдвинуть самочувствие NPC (правила/эффекты; K.D. clamp 0..100) */
  changeNpcMood(entityId: string, delta: number): void {
    const m = (this.state.npc_mood ??= {})
    m[entityId] = Math.max(0, Math.min(100, (m[entityId] ?? 50) + delta))
  }

  changeDisposition(target: string, delta: number): void {
    const npc = this.campaign.entities[target] as NpcDef | undefined
    // Личный сдвиг на id NPC (или id фракции, если target — фракция).
    // Раньше NPC без faction молча игнорировался — диалоги «+отношение»
    // ничего не меняли (критично для драм/накигэ).
    const key = target
    if (npc && npc.type !== 'npc' && npc.type !== undefined) {
      // предметы и пр. — не цель отношения
      return
    }
    const cur = this.state.dispositions[key] ?? 0
    this.state.dispositions[key] = Math.max(-100, Math.min(100, cur + delta))
    const label =
      (npc && npc.type === 'npc' ? npc.label : undefined) ??
      this.campaign.meta.factions?.find((f) => f.id === key)?.label ??
      key
    this.pushLog(`Отношение «${label}»: ${delta > 0 ? '+' : ''}${delta} (теперь ${this.getDisposition(key)}).`)
  }

  // ─────────────── квесты (ТЗ 3.7) ───────────────

  startQuest(questId: string): void {
    const quest = this.campaign.quests[questId]
    if (!quest || this.state.quests[questId]) return
    const first = quest.stages[0]
    this.state.quests[questId] = { stage: first.id, status: 'active', journal: [] }
    this.pushLog(`Новый квест: «${quest.label}»`)
    this.messages.push({ text: `Новый квест: «${quest.label}»` })
    playUi('quest_started')
    if (first.on_enter_effects) this.applyEffects(first.on_enter_effects)
  }

  advanceQuestTo(questId: string, stageId: string): void {
    const quest = this.campaign.quests[questId]
    const qs = this.state.quests[questId]
    if (!quest || !qs || qs.status !== 'active' || qs.stage === stageId) return
    const stage = quest.stages.find((s) => s.id === stageId)
    if (!stage) return
    qs.stage = stageId
    if (stage.final) {
      qs.status = stage.outcome === 'failure' ? 'failed' : 'completed'
      if (qs.status === 'completed') {
        this.state.stats_run.quests_completed += 1
        this.messages.push({ text: `Квест завершён: «${quest.label}»` })
        playUi('quest_completed')
      } else {
        this.messages.push({ text: `Квест провален: «${quest.label}»` })
      }
      this.pushLog(`Квест «${quest.label}»: ${qs.status === 'completed' ? 'завершён' : 'провален'}.`)
    }
    if (stage.on_enter_effects) this.applyEffects(stage.on_enter_effects)
  }

  journalUpdate(questId: string, textKey: string): void {
    const quest = this.campaign.quests[questId]
    const qs = this.state.quests[questId]
    if (!quest || !qs) return
    const text = quest.journal_entries[textKey]
    if (text && !qs.journal.includes(text)) {
      qs.journal.push(text)
      this.pushLog(`Журнал: ${text}`)
    }
  }

  /** Переходы стадий активных квестов (вызывается из checkRules). */
  private checkQuestTransitions(): void {
    for (const [questId, qs] of Object.entries(this.state.quests)) {
      if (qs.status !== 'active') continue
      const quest = this.campaign.quests[questId]
      const stage = quest?.stages.find((s) => s.id === qs.stage)
      if (!stage?.transitions) continue
      for (const t of stage.transitions) {
        if (t.conditions.every((c) => evalCondition(c, this))) {
          this.advanceQuestTo(questId, t.to)
          break
        }
      }
    }
  }

  // ─────────────── напарники (ТЗ 4.11) ───────────────

  joinParty(entityId: string): void {
    const max = this.campaign.meta.max_companions ?? 1
    if (this.state.party.length >= max) return
    if (this.state.party.some((c) => c.entity === entityId)) return
    const def = this.campaign.entities[entityId] as NpcDef | undefined
    if (!def || def.type !== 'npc') return
    const hp = def.stats.HP ?? derivedHP(def.stats)
    this.state.party.push({ entity: entityId, hp, max_hp: hp })
    this.pushLog(`${def.label} присоединяется к вам.`)
    this.messages.push({ text: `${def.label} присоединяется к отряду.` })
  }

  leaveParty(entityId: string): void {
    const i = this.state.party.findIndex((c) => c.entity === entityId)
    if (i >= 0) this.state.party.splice(i, 1)
  }

  isInParty(entityId: string): boolean {
    return this.state.party.some((c) => c.entity === entityId)
  }

  // ─────────────── удача (аудит §5.6 п.8) ───────────────

  /** максимум удачи: POW × meta.luck.multiplier (умолчание 5). Система opt-in: нет meta.luck — удачи нет. */
  luckMax(): number {
    const cfg = this.campaign.meta.luck
    if (!cfg) return 0
    const mult = cfg.multiplier ?? 5
    return Math.max(0, this.state.player.stats.POW * mult)
  }

  /** текущие очки удачи (старые сейвы без поля считаются полными) */
  luck(): number {
    const max = this.luckMax()
    return Math.min(max, this.state.player.luck ?? max)
  }

  /** потратить/вернуть очки удачи; ложь — не хватает */
  changeLuck(delta: number): boolean {
    const cur = this.luck()
    const next = Math.max(0, Math.min(this.luckMax(), cur + delta))
    if (delta < 0 && cur + delta < 0) return false
    this.state.player.luck = next
    return true
  }

  // ─────────────── производные опции B6: усталость, рассудок, репутация, достаток, страсти, причастность ───────────────

  /** максимум усталости: (STR+CON)×множитель; opt-in meta.vitals.fatigue */
  fatigueMax(): number {
    const cfg = this.campaign.meta.vitals?.fatigue
    if (!cfg) return 0
    const mult = cfg === true ? 1 : (cfg.multiplier ?? 1)
    return Math.max(0, Math.round((this.state.player.stats.STR + this.state.player.stats.CON) * mult))
  }

  /** текущая усталость (полная по умолчанию, как удача) */
  fatigue(): number {
    const max = this.fatigueMax()
    return Math.min(max, this.state.player.fatigue ?? max)
  }

  /** израсходовать/восстановить усталость; ложь — запаса не хватит */
  changeFatigue(delta: number): boolean {
    const max = this.fatigueMax()
    if (max === 0 && delta !== 0) return true // система выключена — no-op
    const cur = this.fatigue()
    if (delta < 0 && cur + delta < 0) {
      this.state.player.fatigue = 0
      this.pushLog('Вы на пределе: очки усталости на нуле!')
      this.checkRules() // правила мастера могут среагировать на fatigue_le
      this.notify()
      return false
    }
    this.state.player.fatigue = Math.max(0, Math.min(max, cur + delta))
    this.checkRules()
    this.notify()
    return true
  }

  /** максимум рассудка: POW×множитель; opt-in meta.vitals.sanity */
  sanityMax(): number {
    const cfg = this.campaign.meta.vitals?.sanity
    if (!cfg) return 0
    const mult = cfg === true ? 5 : (cfg.multiplier ?? 5)
    return Math.max(0, this.state.player.stats.POW * mult)
  }

  /** текущий рассудок */
  sanity(): number {
    const max = this.sanityMax()
    return Math.min(max, this.state.player.sanity ?? max)
  }

  /** потеря/исцеление рассудка; пороги/психозы — правилами на sanity_le */
  changeSanity(delta: number): void {
    const max = this.sanityMax()
    if (max === 0 && delta !== 0) return
    const next = Math.max(0, Math.min(max, this.sanity() + delta))
    const lost = next - this.sanity()
    this.state.player.sanity = next
    if (lost < 0) this.pushLog(`Рассудок трещит: ${lost}. (сейчас ${next}/${max})`)
    else if (lost > 0) this.pushLog(`Мысли проясняются: рассудок +${lost}. (сейчас ${next}/${max})`)
    this.checkRules()
    this.notify()
  }

  /** репутация (opt-in meta.reputation) */
  reputation(): number {
    return Math.max(0, this.state.player.reputation ?? 0)
  }

  /** репутация включена мастером */
  reputationEnabled(): boolean {
    return !!this.campaign.meta.reputation
  }

  reputationLabel(): string {
    const cfg = this.campaign.meta.reputation
    return (typeof cfg === 'object' && cfg?.label) || 'Репутация'
  }

  changeReputation(delta: number): void {
    const next = Math.max(0, this.reputation() + delta)
    this.state.player.reputation = next
    if (delta > 0) this.pushLog(`Слава о вас растёт: репутация ${next}.`)
    else if (delta < 0) this.pushLog(`О вас отзываются хуже: репутация ${next}.`)
    this.checkRules()
    this.notify()
  }

  /** шкала достатка (opt-in meta.wealth_levels) */
  wealthLevels(): string[] {
    return this.campaign.meta.wealth_levels ?? []
  }

  /** текущий уровень достатка (индекс в шкале) */
  wealthLevel(): number {
    const lv = this.wealthLevels()
    return Math.max(0, Math.min(lv.length - 1, this.state.player.wealth_level ?? 0))
  }

  wealthLevelLabel(): string {
    return this.wealthLevels()[this.wealthLevel()] ?? ''
  }

  /** сдвиг достатка на ±levels ступеней */
  changeWealth(levels: number): void {
    const lv = this.wealthLevels()
    if (!lv.length) return
    const next = Math.max(0, Math.min(lv.length - 1, this.wealthLevel() + levels))
    if (next === this.wealthLevel()) return
    this.state.player.wealth_level = next
    this.pushLog(`Ваш достаток меняется: теперь «${lv[next]}».`)
    this.checkRules()
    this.notify()
  }

  /** страсть: значение 0..100+ */
  passion(id: string): number {
    return this.state.player.passions?.[id] ?? 0
  }

  passionLabel(id: string): string {
    return this.campaign.meta.passions_list?.find((p) => p.id === id)?.label ?? id
  }

  /** создать/сдвинуть страсть (clamped ≥ 0); лог первого появления */
  changePassion(id: string, delta: number): void {
    const p = this.state.player
    p.passions ??= {}
    const next = Math.max(0, (p.passions[id] ?? 0) + delta)
    const fresh = p.passions[id] == null
    p.passions[id] = next
    if (fresh) this.pushLog(`В вас зажигается страсть: «${this.passionLabel(id)}» (${next}).`)
    else this.pushLog(`Страсть «${this.passionLabel(id)}»: ${delta > 0 ? '+' : ''}${delta} → ${next}.`)
    this.checkRules()
    this.notify()
  }

  /** очки причастности силе */
  allegiance(id: string): number {
    return this.state.player.allegiance?.[id] ?? 0
  }

  allegianceLabel(id: string): string {
    return this.campaign.meta.allegiances?.find((a) => a.id === id)?.label ?? id
  }

  /** +очки причастности (по книге без снижения, дельта 0..100+) */
  changeAllegiance(id: string, points: number): void {
    const p = this.state.player
    p.allegiance ??= {}
    const next = Math.max(0, (p.allegiance[id] ?? 0) + points)
    const fresh = p.allegiance[id] == null
    p.allegiance[id] = next
    if (fresh) this.pushLog(`Вы обретаете причастность к «${this.allegianceLabel(id)}» (${next}).`)
    else if (points > 0) this.pushLog(`Причастность «${this.allegianceLabel(id)}»: +${points} → ${next}.`)
    else this.pushLog(`Причастность «${this.allegianceLabel(id)}»: ${points} → ${next}.`)
    this.checkRules()
    this.notify()
  }

  /**
   * Базовый шанс навыка (без обучения). Формула 'DEX×2' ('×' или '*'),
   * несколько слагаемых через '+': 'DEX×2+INT'.
   * Возвращает 0, если у навыка нет base (необученный даёт 0% — как раньше).
   */
  skillBaseChance(skillId: string): number {
    const def = this.campaign.meta.skills?.find((s) => s.id === skillId)
    const base = def?.base
    if (base == null) return 0
    if (typeof base === 'number') return base
    const stats = this.state.player.stats as unknown as Record<string, number>
    let total = 0
    for (const part of base.split('+')) {
      const m = part.trim().match(/^([A-Z]+)(?:\s*[×x*]\s*(\d+))?$/)
      if (!m) continue
      const stat = stats[m[1]] ?? 0
      total += stat * (m[2] ? parseInt(m[2], 10) : 1)
    }
    return total
  }

  /**
   * Эффективное значение навыка для проверок вне боя: изученный навык,
   * иначе базовый шанс (если у навыка задан `base` в реестре кампании).
   */
  skillEffective(skillId: string): number {
    const learned = this.state.player.skills[skillId]
    return learned != null ? learned : this.skillBaseChance(skillId)
  }

  /**
   * Тренировка характеристики (аудит B6): прибавка с клампом по stat_limits
   * кампании; пересчитывает производные пулы (HP/MP/усталость/рассудок).
   */
  trainStat(stat: string, delta: number): void {
    const p = this.state.player
    const stats = p.stats as unknown as Record<string, number>
    if (!(stat in stats)) return
    const lim = this.campaign.meta.char_creation?.stat_limits
    const min = lim?.min ?? 1
    const max = lim?.max ?? 99
    const next = Math.max(min, Math.min(max, stats[stat] + delta))
    if (next === stats[stat]) return
    stats[stat] = next
    this.pushLog(`Тренировка дала плоды: ${this.statLabel(stat)} ${delta > 0 ? '+' : ''}${delta} → ${next}.`)
    // пересчёт HP (SIZ+CON)/MP (POW) теми же формулами, что на создании героя
    const newMaxHp = derivedHP(p.stats)
    if (newMaxHp !== p.max_hp) {
      const diff = newMaxHp - p.max_hp
      p.max_hp = newMaxHp
      p.hp = Math.max(1, Math.min(p.max_hp, p.hp + Math.max(0, diff)))
    }
    const newMaxMp = derivedMP(p.stats)
    if (newMaxMp !== p.max_mp) {
      const diff = newMaxMp - p.max_mp
      p.max_mp = newMaxMp
      p.mp = Math.max(0, Math.min(p.max_mp, p.mp + Math.max(0, diff)))
    }
    this.checkRules()
    this.notify()
  }

  /** локализованное имя характеристики */
  statLabel(stat: string): string {
    const labels: Record<string, string> = { STR: 'Сила', CON: 'Телосложение', SIZ: 'Размер', DEX: 'Ловкость', INT: 'Разум', POW: 'Мощь', CHA: 'Обаяние', EDU: 'Образование' }
    return labels[stat] ?? stat
  }

  // ─────────────── уровни и черты (аудит B8, opt-in meta.progression) ───────────────

  /** система уровней включена мастером */
  progressionEnabled(): boolean {
    return !!this.campaign.meta.progression
  }

  /** текущий уровень (старт 1) */
  level(): number {
    return Math.max(1, this.state.player.level ?? 1)
  }

  /** текущий запас опыта */
  xp(): number {
    return Math.max(0, this.state.player.xp ?? 0)
  }

  /** сколько опыта нужно, чтобы взять следующий уровень (кумулятивно) */
  xpForLevel(level: number): number {
    const base = this.campaign.meta.progression?.xp_per_level ?? 100
    // база×summing i=1..level: base при lvl1→2; растёт линейно
    return base * level
  }

  /** опыт до следующего уровня или до потолка */
  xpToNext(): number | null {
    if (!this.progressionEnabled()) return null
    const max = this.campaign.meta.progression?.max_level
    if (max != null && this.level() >= max) return null
    return this.xpForLevel(this.level()) - this.xp()
  }

  /** нераспределённых черт (по умолчанию по одной за уровень) */
  pendingFeats(): number {
    if (!this.progressionEnabled()) return 0
    const per = this.campaign.meta.progression?.feats_per_level ?? 1
    return Math.max(0, (this.level() - 1) * per - (this.state.player.feats ?? []).length)
  }

  /** начислить опыт; при достижении порога — уровень ↑ (одна итерация) */
  grantXp(points: number): void {
    if (!this.progressionEnabled() || points <= 0) return
    const p = this.state.player
    const cap = this.campaign.meta.progression?.max_level
    if (cap != null && this.level() >= cap) return // потолок: опыт не копится
    p.xp = this.xp() + points
    this.pushLog(`Опыт: +${points} (всего ${p.xp}, до след. уровня ${this.xpToNext() ?? 'потолок'}).`)
    // уровни поднимаем по одному за проход (линейный лад book-op)
    while (this.xp() >= this.xpForLevel(this.level())) {
      const max = this.campaign.meta.progression?.max_level
      if (max != null && this.level() >= max) break
      p.xp = this.xp() - this.xpForLevel(this.level())
      p.level = this.level() + 1
      const slots = this.campaign.meta.progression?.feats_per_level ?? 1
      this.pushLog(`Уровень ${p.level}!${slots > 0 ? ` Доступно ${slots} чёрт(а) к выбору в листе персонажа.` : ''}`)
      this.checkRules()
    }
    this.notify()
  }

  /** дефолтного набора черт */
  availableFeats(): FeatDef[] {
    if (!this.progressionEnabled()) return []
    const taken = new Set(this.state.player.feats ?? [])
    return (this.campaign.meta.progression?.feats ?? []).filter((f) => !taken.has(f.id))
  }

  /** доступна ли черта (условия requires) */
  featEligible(feat: FeatDef): boolean {
    if (!feat.requires?.length) return true
    return feat.requires.every((c) => evalCondition(c, this))
  }

  /** взять черту точкой прокачки (слоты расходуются) */
  takeFeat(id: string): boolean {
    if (!this.progressionEnabled() || this.pendingFeats() <= 0) return false
    const feat = this.availableFeats().find((f) => f.id === id)
    if (!feat || !this.featEligible(feat)) return false
    this.applyFeat(feat)
    this.pushLog(`Взята черта «${feat.label}».`)
    this.notify()
    return true
  }

  /** выдать черту напрямую (эффект grant_feat, без счёта слотов) */
  grantFeat(id: string): void {
    if (!this.progressionEnabled()) return
    const feat = this.campaign.meta.progression?.feats?.find((f) => f.id === id)
    if (!feat || (this.state.player.feats ?? []).includes(id)) return
    this.applyFeat(feat)
    this.pushLog(`Освоена черта «${feat.label}».`)
    this.checkRules()
    this.notify()
  }

  /** применение бонусов черты (уже взята) */
  private applyFeat(feat: FeatDef): void {
    const p = this.state.player
    p.feats ??= []
    p.feats.push(feat.id)
    const mods = feat.mods ?? {}
    for (const [skill, delta] of Object.entries(mods.skills ?? {})) {
      p.skills[skill] = Math.max(0, (p.skills[skill] ?? 0) + (delta as number))
    }
    for (const [stat, delta] of Object.entries(mods.stats ?? {})) {
      if (delta) this.trainStat(stat, delta as number)
    }
    if (mods.hp) {
      p.max_hp = Math.max(1, p.max_hp + mods.hp)
      p.hp = Math.min(p.max_hp, p.hp + mods.hp)
    }
    if (mods.mp) {
      p.max_mp = Math.max(0, p.max_mp + mods.mp)
      p.mp = Math.min(p.max_mp, p.mp + mods.mp)
    }
    // движение от черт — добавкой в список модификаторов movement()
    this.checkRules()
  }

  /** движение героя: базовое + перманентные бонусы черт */
  playerMovement(): number {
    let mov = movement(this.state.player.stats)
    for (const fid of this.state.player.feats ?? []) {
      const f = this.campaign.meta.progression?.feats?.find((x) => x.id === fid)
      mov += f?.mods?.mov ?? 0
    }
    return Math.max(1, mov)
  }

  // ─────────────── опасности, преступления, цены, лагерь (аудит B7) ───────────────

  /**
   * Падение (аудит B7): урон = floor(meters / porog) кубиков, смягчающая
   * проверка навыком (умолчание dodge) уполовинивает. Порог и кубик
   * настраиваются в meta.hazards (книжные: 3 м на 1d6).
   */
  applyFall(meters: number, skill?: string): void {
    const hz = this.campaign.meta.hazards
    const perDie = Math.max(1, hz?.fall_meters_per_die ?? 3)
    const dice = Math.floor(Math.max(0, meters) / perDie)
    const sane = dice <= 0 ? '0' : `${dice}d6`
    let dmg = 0
    let modLog = ''
    const p = this.state.player
    if (dice > 0) {
      const skillId = skill ?? 'dodge'
      const known = p.skills[skillId]
      if (known != null && known > 0) {
        const out = skillCheck(Math.max(1, known), this.rng, 0, this.diceRules)
        if (out.success) {
          modLog = ` (${this.skillLabel(skillId)} смягчает: половина)`
        }
        dmg = rollDice(sane, this.rng)
        if (out.success) dmg = Math.max(0, Math.ceil(dmg / 2))
        this.pushLog(`Падение с ${meters} м — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}${modLog}`)
      } else {
        dmg = rollDice(sane, this.rng)
        this.pushLog(`Падение с ${meters} м: ${dmg} урона (${sane}).`)
      }
    }
    if (dmg > 0) this.changeHp(-dmg)
    else this.pushLog('Падение обошлось без серьёзных травм.')
    this.notify()
  }

  /** реестр преступления из кампании */
  crimeLabel(id: string): string {
    return this.campaign.meta.crimes?.find((c) => c.id === id)?.label ?? id
  }

  /** зафиксировать преступление героя (аудит B7) */
  commitCrime(id: string, bounty = 0): void {
    const s = this.state
    s.crimes ??= {}
    if (s.crimes[id]) {
      s.crimes[id].bounty += Math.max(0, bounty)
    } else {
      s.crimes[id] = { bounty: Math.max(0, bounty), tick: s.tick }
    }
    this.pushLog(`Совершено преступление: «${this.crimeLabel(id)}»${bounty > 0 ? ` (награда за голову ${bounty})` : ''}.`)
    this.checkRules()
    this.notify()
  }

  /** преступление совершено? (любое — без id; minBounty — порог награды) */
  hasCrime(id?: string, minBounty = 0): boolean {
    const list = this.state.crimes ?? {}
    if (!id) return Object.values(list).some((c) => minBounty <= 0 ? true : c.bounty >= minBounty)
    const c = list[id]
    if (!c) return false
    return minBounty <= 0 ? true : c.bounty >= minBounty
  }

  /** суммарная награда за голову героя */
  bountyTotal(): number {
    return Object.values(this.state.crimes ?? {}).reduce((sum, c) => sum + c.bounty, 0)
  }

  /** активные ценовые события */
  priceEventsActive(): Array<{ id: string; label: string }> {
    const reg = this.campaign.meta.price_events ?? []
    return (this.state.price_events ?? []).map((id) => ({ id, label: reg.find((e) => e.id === id)?.label ?? id }))
  }

  /** включить/выключить ценовое событие (аудит B7) */
  setPriceEvent(id: string, on: boolean): void {
    const list = (this.state.price_events ??= [])
    if (on) {
      if (!this.campaign.meta.price_events?.some((e) => e.id === id)) return
      if (!list.includes(id)) {
        list.push(id)
        this.pushLog(`Ценник меняется: «${this.campaign.meta.price_events.find((e) => e.id === id)!.label}».`)
      }
    } else if (id) {
      const i = list.indexOf(id)
      if (i >= 0) list.splice(i, 1)
    } else if (list.length) {
      list.length = 0
      this.pushLog('Ценники снова прежние.')
    }
    this.checkRules()
    this.notify()
  }

  /** множитель цен по активным ценовым событиям для данного предмета */
  priceEventMultiplier(item: ItemDef): number {
    if (!this.state.price_events?.length) return 1
    let mult = 1
    for (const id of this.state.price_events) {
      const ev = this.campaign.meta.price_events?.find((e) => e.id === id)
      if (!ev) continue
      if (ev.items?.length && !ev.items.includes(item.id)) continue
      if (ev.categories?.length && !ev.categories.includes(item.category)) continue
      mult *= ev.multiplier
    }
    return mult
  }

  /** разрешён ли здесь лагерь (аудит B7): meta.camping + локация с camp: true */
  campAvailable(): { ok: boolean; reason: string } {
    const cfg = this.campaign.meta.camping
    if (!cfg) return { ok: false, reason: 'мастер не включил ночлег (meta.camping)' }
    if (this.combat || this.trade) return { ok: false, reason: 'сейчас не до отдыха' }
    const loc = this.findLocation(this.state.location)?.location
    if (!loc?.camp) return { ok: false, reason: 'здесь лагерь не разбить (location.camp)' }
    return { ok: true, reason: '' }
  }

  /**
   * Ночлег в лагере (аудит B7): advanceTicks(cfg.ticks), рост навыков,
   * естественное лечение, возможная засада — правило мастера
   * (meta.camping.ambush_rule, шанс ambush_chance).
   */
  campRest(): void {
    const cfg = this.campaign.meta.camping
    if (!cfg || !this.campAvailable().ok) return
    this.pushLog('Вы разбиваете лагерь и устраиваетесь на ночлег…')
    this.advanceTicks(cfg.ticks ?? 8)
    this.restAndGrow()
    this.restHeal()
    const chance = Math.max(0, Math.min(1, cfg.ambush_chance ?? 0))
    if (chance > 0 && this.rng.chance(chance)) {
      this.pushLog('Ночью — тревога! В лагерь кто-то прокрался!')
      if (cfg.ambush_rule) this.fireRule(cfg.ambush_rule)
    } else {
      this.pushLog('Ночь прошла спокойно.')
    }
    this.autosave()
    this.notify()
  }

  /**
   * Предложение переброска за удачу (аудит §5.6 п.8). Не сохраняется в сейв:
   * если игрок закрыл игру с открытым предложением — применится ветка провала.
   */
  luckOffer: { text: string; cost: number; decide: (reroll: boolean) => void } | null = null

  /** игрок ответил на предложение удачи (UI) */
  resolveLuckOffer(reroll: boolean): void {
    const offer = this.luckOffer
    this.luckOffer = null
    offer?.decide(reroll)
    this.notify()
  }

  /** Бросок проверки характеристики героя (POW×5 — удача, INT×5 — идея). */
  statCheck(stat: string, multiplier = 5, modifier = 0): SkillCheckOutcome {
    return this.playerCheckOutcome(
      ((this.state.player.stats as unknown as Record<string, number>)[stat] ?? 0) * multiplier,
      modifier,
      `Проверка характеристики ${stat}×${multiplier}`,
    )
  }

  /**
   * Синхронно бросить проверку и применить успех/провал-эффекты.
   * Если включена удача и броска не вышло — игроку предлагают переброс,
   * но эффекты ждут ответа (ложь возвращает «эффекты уже применились»).
   */
  private applyByCheck(outcome: SkillCheckOutcome, describe: string, retry: () => SkillCheckOutcome, onOk: () => void, onFail: () => void): boolean {
    if (outcome.success) {
      onOk()
      return false
    }
    const cfg = this.campaign.meta.luck
    const cost = Math.max(1, cfg?.reroll_cost ?? 1)
    if (!cfg || this.luckMax() <= 0 || this.luck() < cost) {
      onFail()
      return false
    }
    this.changeLuck(-cost)
    this.pushLog(`Провал можно исправить за удачу: −${cost} (осталось ${this.luck()}).`)
    this.luckOffer = {
      text: `${describe} — провал (d100=${outcome.roll} против ${outcome.target}).`,
      cost,
      decide: (reroll) => {
        if (reroll) {
          const second = retry()
          this.pushLog(`Переброс за удачу: d100=${second.roll} против ${second.target} → ${CHECK_RESULT_LABEL[second.result]}.`)
          if (second.success) onOk()
          else onFail()
        } else {
          this.pushLog('Удача прибережена — остаётся провал.')
          onFail()
        }
        this.checkRules()
        this.autosave()
      },
    }
    return true
  }

  /** единый путь мировых бросков героя: бросок + журнал (+ метки навыка в playerSkillCheck) */
  private playerCheckOutcome(target: number, modifier: number, describe: string): SkillCheckOutcome {
    const out = skillCheck(Math.max(1, target), this.rng, modifier, this.diceRules)
    this.pushLog(`${describe} — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`)
    return out
  }

  /**
   * Аугмент страсти и подмога союзника (аудит B6, книжные аугменты):
   * порог значения — meta.augments.threshold (умолчание 50),
   * прибавка к броску — meta.augments.bonus (умолчание +20, книжно).
   */
  private augmentBonus(e: { augment_passion?: string; assist_entity?: string; assist_skill?: string }, fallbackSkill?: string): number {
    let mod = 0
    const cfg = this.campaign.meta.augments
    const threshold = Math.max(1, cfg?.threshold ?? 50)
    const bonus = Math.max(0, cfg?.bonus ?? 20)
    if (e.augment_passion && this.passion(e.augment_passion) >= threshold) {
      mod += bonus
      this.pushLog(`Страсть «${this.passionLabel(e.augment_passion)}» подхватывает вас (+${bonus}%).`)
    }
    if (e.assist_entity) {
      const npc = this.campaign.entities[e.assist_entity] as NpcDef | undefined
      const sk = e.assist_skill ?? fallbackSkill
      if (sk && (npc?.skills?.[sk] ?? 0) >= threshold) {
        mod += bonus
        this.pushLog(`${npc?.label ?? e.assist_entity} помогает (+${bonus}%).`)
      }
    }
    return mod
  }

  /**
   * Противоборство навыком героя (аудит §5.6 п.6): бросок героя против
   * броска оппонента (NPC или числовой порог), ранги из diceRules-таблицы.
   */
  opposedCheck(e: Extract<Effect, { type: 'opposed_check' }>): { success: boolean; player: SkillCheckOutcome; rival: SkillCheckOutcome } {
    const skill = e.skill
    const playerValue = Math.max(1, this.skillEffective(skill) + this.statusSkillMod(skill) + this.augmentBonus(e, skill))
    const player = this.playerCheckOutcome(playerValue, 0, `Противоборство «${this.skillLabel(skill)}» (герой)`)
    let rivalValue: number
    let rivalLabel = ''
    if (e.entity) {
      const npc = this.campaign.entities[e.entity] as NpcDef | undefined
      const rSkill = e.against_skill ?? skill
      rivalValue = Math.max(1, npc?.skills?.[rSkill] ?? 25)
      rivalLabel = npc?.label ?? e.entity
      if (npc && e.against_skill) rivalLabel += ` (${this.skillLabel(rSkill)})`
    } else {
      rivalValue = Math.max(1, e.against_value ?? 50)
      rivalLabel = `порог ${rivalValue}`
    }
    const rival = this.playerCheckOutcome(rivalValue, 0, `Противоборство (${rivalLabel})`)
    const RANK: Record<string, number> = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 }
    const cmp = (RANK[player.result] ?? 1) - (RANK[rival.result] ?? 1)
    const wins = cmp > 0 || (cmp === 0 && (e.tie ?? 'player') === 'player')
    if (cmp === 0) this.pushLog(`Равный исход — победа ${wins ? 'героя' : 'оппонента'} по умолчанию.`)
    this.pushLog(wins ? 'Герой побеждает в противоборстве.' : 'Герой проигрывает противоборство.')
    if (player.success) this.markSkill(skill)
    return { success: wins, player, rival }
  }

  // ─────────────── скрытность и обнаружение (аудит §5.6 п.12) ───────────────

  /** включена ли скрытность мастером (meta.stealth); боевой режим — отдельно */
  stealthEnabled(): boolean {
    return !!this.campaign.meta.stealth
  }

  /** герой сейчас крадётся */
  isSneaking(): boolean {
    return this.state.stealth?.sneaking === true
  }

  /** героя заметили в текущей сцене */
  isDetected(): boolean {
    return this.state.stealth?.detected === true
  }

  /** Получает значение навыка игрока (с модификаторами статусов) */
  playerSkill(skill: string): number {
    return Math.max(0, (this.state.player.skills[skill] ?? 0) + this.statusSkillMod(skill))
  }

  /**
   * Переключить красться/идти открыто. Вход в красться — моментальная
   * проверка против всех наблюдателей в сцене; заметили — режим включён,
   * но скрытым вас не считают.
   */
  toggleSneak(): void {
    if (!this.stealthEnabled()) return
    const st = (this.state.stealth ??= { sneaking: false, detected: false })
    const wasSneaking = st.sneaking
    st.sneaking = !wasSneaking
    st.detected = false
    
    if (st.sneaking) {
      this.pushLog('👁️‍🗨️ Вы переходите на скрытное передвижение. Бросок скрытности при смене сцены...')
      this.detectCheck('вы появляетесь в поле зрения')
    } else {
      this.pushLog('👁️ Вы больше не скрываетесь.')
    }
    
    this.autosave()
    this.notify()
  }

  /**
   * Проверка обнаружения: бросок скрытности героя против лучшей
   * внимательности живых NPC в текущей сцене. Поражение — `detected`.
   * Истина — остался незамеченным.
   */
  detectCheck(context: string): boolean {
    if (!this.stealthEnabled() || !this.isSneaking() || this.isDetected()) return true
    const scene = this.currentScene()
    if (!scene) return true
    const st = this.campaign.meta.stealth!
    let bestNpc: { label: string; value: number } | null = null
    for (const occ of this.slotOccupants(scene)) {
      const def = occ.entity
      if (!def || def.type !== 'npc') continue
      const value = def.perception ?? Math.max(1, (def.skills[st.perception_skill ?? 'perception'] ?? 0) || def.stats.INT * 2)
      if (!bestNpc || value > bestNpc.value) bestNpc = { label: def.label, value }
    }
    if (!bestNpc) return true
    const skill = st.skill ?? 'stealth'
    const hero = Math.max(1, (this.state.player.skills[skill] ?? 0) + this.statusSkillMod(skill))
    const mine = skillCheck(hero, this.rng, 0, this.diceRules)
    const theirs = skillCheck(bestNpc.value, this.rng, 0, this.diceRules)
    const RANK: Record<string, number> = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 }
    const wins = (RANK[mine.result] ?? 1) >= (RANK[theirs.result] ?? 1)
    this.pushLog(
      `🎲 Скрытность (${context}): ваш ${mine.result} (d100=${mine.roll}/${hero}) против «${bestNpc.label}» ${theirs.result} (d100=${theirs.roll}/${bestNpc.value}) → ${wins ? '✅ вас не заметили' : '❌ ВАС ЗАМЕТИЛИ!'}`,
    )
    if (!wins) {
      this.state.stealth!.detected = true
    }
    return wins
  }

  /** Внезапность при начале боя из скрытности: враги застигнуты врасплох. */
  consumeSurpriseFromSneak(): boolean {
    const st = this.state.stealth
    if (st?.sneaking && !st.detected) return true
    return false
  }

  // ─────────────── рост навыков (ТЗ 4.3) ───────────────

  markSkill(skill: string): void {
    if (!featureOn(this.campaign.meta, 'skills')) return
    if (this.state.player.skills[skill] != null) this.state.player.skill_marks[skill] = true
  }

  /** Проверка навыка игрока с «галочкой» опыта при успехе. */
  playerSkillCheck(skill: string, difficulty: SkillDifficulty = 50): ReturnType<typeof skillCheck> {
    // навыки выключены профилем — проверка резолвится успехом без броска
    if (!featureOn(this.campaign.meta, 'skills')) {
      return { roll: 0, target: 100, result: 'success', success: true }
    }
    // необученный навык берёт базовый шанс (аудит B6, meta.skills[].base)
    const value = Math.max(0, this.skillEffective(skill) + this.statusSkillMod(skill))
    const out = skillCheck(value, this.rng, difficultyModifier(value, difficulty), this.diceRules)
    this.pushLog(
      `Проверка «${this.skillLabel(skill)}» (${difficultyLabel(difficulty)}) — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`,
    )
    if (out.success) this.markSkill(skill)
    return out
  }

  /** Отдых: броски роста отмеченных навыков (d100 > навык → +1d6). */
  /** русское название навыка (реестр кампании → встроенный словарь → id) */
  skillLabel(id: string): string {
    return skillLabel(id, this.campaign.meta.skills)
  }

  restAndGrow(): string[] {
    if (!featureOn(this.campaign.meta, 'skills')) return []
    const grown: string[] = []
    for (const skill of Object.keys(this.state.player.skill_marks)) {
      const cur = this.state.player.skills[skill] ?? 0
      const roll = this.rng.int(1, 100)
      if (roll > cur) {
        const gain = rollDice('1d6', this.rng)
        this.state.player.skills[skill] = cur + gain
        grown.push(`${this.skillLabel(skill)} +${gain} (${cur} → ${cur + gain})`)
        this.pushLog(`Навык «${this.skillLabel(skill)}» вырос на ${gain} (${cur} → ${cur + gain}).`)
      }
    }
    this.state.player.skill_marks = {}
    if (grown.length) {
      this.messages.push({ text: `Во сне приходит опыт. Рост навыков: ${grown.join(', ')}.` })
      playUi('skill_up')
    }
    return grown
  }

  // ─────────────── торговля (ТЗ 4.7) ───────────────

  openTrade(entityId: string): void {
    if (!featureOn(this.campaign.meta, 'trade')) return
    const npc = this.campaign.entities[entityId] as NpcDef | undefined
    if (!npc || npc.type !== 'npc' || !npc.trader) return
    this.dialogue = null
    this.trade = npc
    this.notify()
  }

  closeTrade(): void {
    this.trade = null
    this.autosave()
    this.notify()
  }

  /** Модификатор цены: репутация и навык торговли (ТЗ 4.7). */
  priceModifier(npc: NpcDef): number {
    const disp = this.getDisposition(npc.id)
    const bargain = this.state.player.skills['bargain'] ?? 0
    const mod = 1.25 - disp * 0.003 - bargain * 0.004
    return Math.min(1.6, Math.max(0.7, mod))
  }

  /** id основной валюты кампании (первая в реестре) */
  get mainCurrency(): string {
    return this.campaign.meta.currencies[0]?.id ?? 'silver'
  }

  /** id предмета-монеты, который является единственным источником баланса */
  currencyItemId(currencyId = this.mainCurrency): string {
    const currency = this.campaign.meta.currencies.find((c) => c.id === currencyId)
    return currency?.item_id || `item_${currencyId}`
  }

  /** Баланс валюты читается из инвентаря, а не из устаревшего поля сохранения. */
  currencyAmount(currencyId = this.mainCurrency): number {
    return this.itemCount(this.currencyItemId(currencyId))
  }

  buyPrice(npc: NpcDef, itemId: string, basePrice?: number): number {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    const base = basePrice ?? item?.value?.[this.mainCurrency] ?? 1
    const dynamic = item ? this.priceEventMultiplier(item) : 1
    const diff = this.difficultyDef()?.prices ?? 1
    return Math.max(1, Math.round(base * this.priceModifier(npc) * dynamic * diff))
  }

  sellPrice(npc: NpcDef, itemId: string): number {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    const base = item?.value?.[this.mainCurrency] ?? 0
    const rate = npc.trader?.buy_rate ?? 0.4
    const dynamic = item ? this.priceEventMultiplier(item) : 1
    return Math.max(0, Math.floor((base * rate * dynamic) / this.priceModifier(npc)))
  }

  buyItem(itemId: string, price: number): boolean {
    const currencyItem = this.currencyItemId()
    if (this.itemCount(currencyItem) < price) return false
    this.removeItem(currencyItem, price, { silent: true })
    this.addItem(itemId, 1, { silent: true })
    this.markSkill('bargain')
    playUi('coin')
    this.notify()
    return true
  }

  sellItem(itemId: string, price: number): boolean {
    if (this.itemCount(itemId) < 1) return false
    this.removeItem(itemId, 1, { silent: true })
    this.addItem(this.currencyItemId(), price, { silent: true })
    this.markSkill('bargain')
    playUi('coin')
    this.notify()
    return true
  }

  // ─────────────── крафт (блок 4 ТЗ «Гибкий движок») ───────────────

  /** название предмета по id (фолбэк — сам id) */
  private itemTitle(id: string): string {
    return (this.campaign.entities[id] as ItemDef | undefined)?.label ?? id
  }

  /** все рецепты кампании, по алфавиту (русский) */
  allRecipes(): RecipeDef[] {
    return Object.values(this.campaign.recipes).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }

  /** чего не хватает для рецепта: компоненты, инструменты, условия */
  recipeMissing(r: RecipeDef): string[] {
    const missing: string[] = []
    for (const need of r.inputs ?? []) {
      const have = this.itemCount(need.item)
      if (have < need.quantity) missing.push(`${this.itemTitle(need.item)} ×${need.quantity} (есть ${have})`)
    }
    for (const tool of r.tools ?? []) {
      if (!this.hasItem(tool)) missing.push(`инструмент: ${this.itemTitle(tool)}`)
    }
    let blocked = false
    for (const c of r.requires ?? []) {
      if (!evalCondition(c, this)) blocked = true
    }
    if (blocked) missing.push('не выполнены условия')
    return missing
  }

  /**
   * Изготовление по рецепту. Если у рецепта есть проверка навыка — бросок
   * идёт первым: провал сохраняет компоненты. Успех расходует компоненты,
   * выдаёт результат и проматывает время.
   */
  craft(recipeId: string): boolean {
    const r = this.campaign.recipes[recipeId]
    if (!r || this.recipeMissing(r).length > 0) return false
    // рецепт починки (аудит §5.6 п.10): нужен изношенный экземпляр результата
    if (r.repair && !this.hasDamaged(r.output.item)) {
      this.messages.push({ text: `Не изнашившийся «${this.itemTitle(r.output.item)}» — чинить нечего.` })
      return false
    }
    if (r.skill) {
      const out = this.playerSkillCheck(r.skill.id, r.skill.difficulty)
      if (!out.success) {
        this.messages.push({ text: `Не получилось изготовить «${r.label}». Материалы остались целы.` })
        this.autosave()
        this.notify()
        return false
      }
    }
    for (const need of r.inputs ?? []) this.removeItem(need.item, need.quantity, { silent: true })
    if (r.repair) {
      this.repairItem(r.output.item)
    } else {
      this.addItem(r.output.item, r.output.quantity ?? 1)
    }
    if (r.time_ticks) this.advanceTicks(r.time_ticks)
    const outLabel = this.itemTitle(r.output.item)
    this.pushLog(`Изготовлено: ${outLabel} (рецепт «${r.label}»).`)
    this.messages.push({ text: r.message ?? `Изготовлено: ${outLabel}.` })
    playUi('craft')
    this.autosave()
    this.notify()
    return true
  }

  // ─────────────── случайные встречи (ТЗ 4.9) ───────────────

  private rollEncounter(conn: TravelConnection): void {
    if (!conn.random_encounter_table) return
    const table = this.campaign.encounters[conn.random_encounter_table]
    if (!table) return
    for (let roll = 0; roll < (table.rolls ?? 1); roll++) {
      const total = table.entries.reduce((s, e) => s + e.weight, 0)
      let pick = this.rng.next() * total
      let entry: EncounterEntry | null = null
      for (const e of table.entries) {
        pick -= e.weight
        if (pick <= 0) {
          entry = e
          break
        }
      }
      if (!entry) continue
      this.resolveEncounter(entry)
      if (this.combat || this.state.game_over) return
    }
  }

  private resolveEncounter(entry: EncounterEntry): void {
    switch (entry.type) {
      case 'nothing':
        return
      case 'combat': {
        // бой выключен профилем — встреча в пути проходит мимо
        if (!featureOn(this.campaign.meta, 'combat')) return
        const enemies = entry.enemies.map((e) => ({
          entity: e.entity,
          count: this.rng.int(e.count_min, e.count_max),
        }))
        this.startCombat({
          type: 'start_combat',
          enemies,
          arena: entry.arena,
          intro: entry.intro ?? 'В дороге на вас нападают!',
        })
        return
      }
      case 'dialogue':
        this.startDialogue(entry.entity, entry.knot)
        return
      case 'skill_check': {
        const out = this.playerSkillCheck(entry.skill, entry.difficulty)
        if (entry.message) this.messages.push({ text: entry.message })
        this.applyEffects(out.success ? entry.success_effects : entry.fail_effects)
        return
      }
      case 'event':
        this.applyEffects(entry.effects)
        if (entry.message) this.messages.push({ text: entry.message })
        return
    }
  }

  // ─────────────── мир: регионы, локации, сцены ───────────────

  allRegions(): RegionDef[] {
    const out: RegionDef[] = []
    const walk = (rs: RegionDef[]) => {
      for (const r of rs) {
        out.push(r)
        if (r.sub_regions) walk(r.sub_regions)
      }
    }
    walk(this.campaign.world.regions)
    return out
  }

  findRegion(id: string): RegionDef | undefined {
    return this.allRegions().find((r) => r.id === id)
  }

  findLocation(id: string): { region: RegionDef; location: LocationDef } | undefined {
    for (const region of this.allRegions()) {
      const location = region.locations.find((l) => l.id === id)
      if (location) return { region, location }
    }
    return undefined
  }

  currentScene(): SceneDef {
    return this.campaign.scenes[this.state.scene]
  }

  /**
   * Сцена, в которую игрок попадает при входе в локацию (итерация 8, А5):
   * arrival_scene локации, если она есть среди её сцен, иначе первая.
   */
  arrivalSceneOf(location: LocationDef): string | undefined {
    const arrival = location.arrival_scene
    if (arrival && location.scenes.includes(arrival)) return arrival
    return location.scenes[0]
  }

  /** Правила бросков d100 этой кампании (итерация 8, А7). */
  get diceRules(): DiceRules {
    return this.campaign.meta.dice_rules ?? DEFAULT_DICE_RULES
  }

  /** Активное состояние сцены: первое, чьё условие истинно; иначе первое. */
  activeSceneState(scene: SceneDef): SceneStateDef {
    for (const st of scene.states) {
      if (evalSceneCondition(st.condition, this)) return st
    }
    return scene.states[0]
  }

  /** Активное «особое место» НПС: первый оверрайд, чей флаг-условие выполнено. */
  private activePresenceOverride(def: EntityDef): PresenceOverride | undefined {
    if (def.type !== 'npc' || !def.presence_overrides) return undefined
    return def.presence_overrides.find(
      (o) => (!o.flag || !!this.state.flags[o.flag]) && (!o.not_flag || !this.state.flags[o.not_flag]),
    )
  }

  /**
   * Есть ли у NPC реальное расписание (непустой массив). Пустой `schedule: []`
   * — частый артефакт редактора/ИИ: это «расписания нет», а не «занят всегда
   * где-то ещё». Иначе default_entity в слоте никогда не появляется.
   */
  private npcHasSchedule(def: EntityDef): boolean {
    return def.type === 'npc' && Array.isArray(def.schedule) && def.schedule.length > 0
  }

  private npcHasPresenceOverrides(def: EntityDef): boolean {
    return def.type === 'npc' && Array.isArray(def.presence_overrides) && def.presence_overrides.length > 0
  }

  /** Занятость слотов с учётом расписаний NPC (ТЗ 4.1: обновление расписания). */
  slotOccupants(scene: SceneDef): SlotOccupant[] {
    const hour = hourOfDay(this.state.tick, this.campaign.meta)
    const out: SlotOccupant[] = []
    for (const slot of scene.slots) {
      if (!evalSceneCondition(slot.condition, this)) continue
      let entity: EntityDef | null = null

      // 1. заспавненные эффектами
      const spawned = this.state.spawned.find((s) => s.scene === scene.id && s.slot === slot.id)
      if (spawned) entity = this.campaign.entities[spawned.entity] ?? null

      // 2. NPC по событиям (важнее расписания) и по расписанию
      if (!entity) {
        for (const def of Object.values(this.campaign.entities)) {
          if (def.type !== 'npc' || (!this.npcHasSchedule(def) && !this.npcHasPresenceOverrides(def))) continue
          if (this.state.dead_entities.includes(def.id)) continue
          if (this.state.removed_entities.includes(def.id)) continue
          if (this.isInParty(def.id)) continue // напарник ходит с игроком
          const ov = this.activePresenceOverride(def)
          if (ov) {
            // пока активен флаг события — персонаж только в этом месте
            if (ov.scene === scene.id && ov.slot === slot.id) {
              entity = def
              break
            }
            continue
          }
          const entry = def.schedule?.find(
            (e) => e.scene === scene.id && e.slot === slot.id && inTimeRange(hour, e.time_range),
          )
          if (entry) {
            entity = def
            break
          }
        }
      }

      // 3. default_entity (сущности без расписания и активных событий)
      if (!entity && slot.default_entity) {
        const def = this.campaign.entities[slot.default_entity]
        // NPC с непустым расписанием/оверрайдом «живёт» только там — default
        // слот его не дублирует. Пустой schedule[] busyElsewhere НЕ считает.
        const busyElsewhere =
          def?.type === 'npc' && (this.npcHasSchedule(def) || !!this.activePresenceOverride(def))
        const gone =
          this.state.dead_entities.includes(slot.default_entity) ||
          this.state.removed_entities.includes(slot.default_entity) ||
          this.isInParty(slot.default_entity)
        if (def && !busyElsewhere && !gone) entity = def
      }

      out.push({ slot, entity })
    }
    return out
  }

  /** Переход между сценами внутри локации (или в сцену другой локации). */
  goToScene(sceneId: string, costTicks = 0): void {
    const scene = this.campaign.scenes[sceneId]
    if (!scene) return
    if (costTicks > 0) this.advanceTicks(costTicks)
    if (this.state.game_over) return this.notify()
    playInteraction('travel') // «переход по зоне» (H3); тема — ui_sounds travel/scene_transition
    const prevLocation = this.state.location
    this.state.scene = sceneId
    this.state.location = scene.location
    // скрытность: новая сцена — новые глаза; замеченным остаётся только по факту проверки
    if (this.state.stealth) this.state.stealth.detected = false
    if (this.isSneaking()) this.detectCheck('смена сцены')
    if (scene.location !== prevLocation) {
      this.onEnterLocation(scene.location)
    } else {
      this.checkRules()
    }
    this.notify()
  }

  /** Путешествие между локациями по travel_connections (ТЗ 4.9). */
  travelTo(locationId: string): void {
    const from = this.findLocation(this.state.location)
    const conn = from?.location.travel_connections.find((c) => c.to === locationId)
    const cost = conn?.cost_ticks ?? 1
    if (this.state.blocked_paths.includes(`${this.state.location}->${locationId}`)) {
      this.messages.push({ text: 'Путь закрыт.' })
      this.notify()
      return
    }
    if (conn?.requirements && !conn.requirements.every((c) => evalCondition(c, this))) {
      this.messages.push({ text: 'Путь закрыт.' })
      this.notify()
      return
    }
    playUi('travel_depart')
    this.advanceTicks(cost)
    this.state.stats_run.travels += 1
    if (this.state.game_over) return this.notify()

    const target = this.findLocation(locationId)
    if (!target) return
    this.state.region = target.region.id
    this.state.location = locationId
    const firstScene = this.arrivalSceneOf(target.location)
    if (firstScene) this.state.scene = firstScene
    playUi('travel_arrive')
    this.onEnterLocation(locationId)
    // случайная встреча в пути (после прибытия)
    if (conn && !this.state.game_over && !this.combat) this.rollEncounter(conn)
    this.notify()
  }

  private onEnterLocation(locationId: string): void {
    this.state.location = locationId
    this.runLocationRules(locationId)
    this.checkRules()
    this.autosave()
  }

  /** Локации региона, доступные/видимые на карте. */
  visibleLocations(region: RegionDef): LocationDef[] {
    return region.locations.filter(
      (l) => !l.hidden || this.state.revealed_locations.includes(l.id),
    )
  }

  travelCost(toLocation: string): number | null {
    const from = this.findLocation(this.state.location)
    const conn = from?.location.travel_connections.find((c) => c.to === toLocation)
    return conn ? conn.cost_ticks : null
  }

  // ─────────────── правила ───────────────

  private runLocationRules(locationId: string): void {
    const loc = this.findLocation(locationId)?.location
    if (!loc?.on_enter_rules) return
    for (const ruleId of loc.on_enter_rules) {
      this.tryFireRule(ruleId)
    }
  }

  /** Проверка всех правил (после каждого значимого действия — ТЗ 4.1). */
  checkRules(): void {
    for (const rule of Object.values(this.campaign.rules)) {
      if (rule.manual) continue
      this.tryFireRule(rule.id)
    }
    this.checkQuestTransitions()
  }

  /** условия правила: все `conditions` И (если заданы) хотя бы одна ИЛИ-группа */
  private ruleConditionsOk(rule: RuleDef): boolean {
    if (!rule.conditions.every((c) => evalCondition(c, this))) return false
    const groups = rule.conditions_any
    if (!groups || groups.length === 0) return true
    return groups.some((g) => !g.length || g.every((c) => evalCondition(c, this)))
  }

  private tryFireRule(ruleId: string, depth = 0): void {
    const rule = this.campaign.rules[ruleId]
    if (!rule) return
    if (rule.once && this.state.fired_rules.includes(rule.id)) return
    if (!this.ruleConditionsOk(rule)) return
    this.state.fired_rules.push(rule.id)
    this.applyEffects(rule.effects, depth)
  }

  // ─────────────── эффекты ───────────────

  /** актуальное описание сущности (с учётом динамических изменений set_description) */
  descOf(entityId: string): string {
    const def = this.campaign.entities[entityId] as { description?: string } | undefined
    return this.state.desc_overrides?.[entityId] ?? def?.description ?? ''
  }

  /**
   * Раз в сутки: самочувствие NPC с расписанием. Чьё расписание покрывает
   * ночь (от начала ночи до утра) — тот отсыпается (+10); кто без ночёвки
   * по расписанию — устаёт (−10). Диапазоны времени поддерживают полночь.
   */
  private tickNpcMood(): void {
    const meta = this.campaign.meta
    const tpd = meta.ticks_per_day ?? 24
    const nightStart = meta.time_of_day?.night ?? 22
    const morning = meta.time_of_day?.morning ?? 6
    const spanNight = (((morning - nightStart) % tpd) + tpd) % tpd || tpd
    const nightPts = [0, 0.25, 0.5, 0.75].map((f) => (nightStart + Math.floor(spanNight * f)) % tpd)
    for (const [id, ent] of Object.entries(this.campaign.entities)) {
      if (!ent || ent.type !== 'npc') continue
      const sch = (ent as NpcDef).schedule
      if (!sch?.length) continue
      const slept = sch.some((e) => {
        let [a, b] = e.time_range
        a = ((a % tpd) + tpd) % tpd
        b = ((b % tpd) + tpd) % tpd
        const covers = (t: number) => (a <= b ? t >= a && t < b : t >= a || t < b)
        return nightPts.every(covers)
      })
      this.changeNpcMood(id, slept ? 10 : -10)
    }
  }

  /** периодическая проверка погони: герой + до двух союзников цепочкой; провал наращивает счётчик до облавы */
  private tickPursuit(): void {
    const p = this.state.pursuit
    if (!p) return
    const companions = this.state.party.slice(0, 2)
    let wins = 0
    const outP = this.playerSkillCheck(p.skill, 50)
    if (outP.success) wins++
    for (const c of companions) {
      const def = this.campaign.entities[c.entity]
      if (!def || def.type !== 'npc') continue
      const out = skillCheck(Math.max(1, def.skills?.[p.skill] ?? 0), this.rng, difficultyModifier(def.skills?.[p.skill] ?? 0, 50), this.diceRules)
      this.pushLog(`${def.label}: d100=${out.roll} против ${out.target} → ${CHECK_RESULT_LABEL[out.result]}`)
      if (out.success) wins++
    }
    p.left = p.every
    if (wins > 0) {
      if (p.fails > 0) this.pushLog(`След удалось запутать — ${p.label ?? 'погоня'} пока не настигает.`)
      p.fails = 0
      return
    }
    p.fails += 1
    if (p.fails < p.fails_needed) {
      this.pushLog(`${p.label ?? 'Погоня'} не отстаёт — ещё ${p.fails_needed - p.fails} сорванная проверка, и отряд настигнут!`)
      return
    }
    this.pushLog(`${p.label ?? 'Погоня'} настигла отряд!`)
    const effects = p.on_fail
    delete this.state.pursuit
    this.applyEffects(effects)
  }

  /** подготовка способности в слот магии (meta.magic.slots): true — получилось */
  togglePreparedAbility(id: string): boolean {
    const s = this.state
    const slots = this.campaign.meta.magic?.slots
    if (!slots) return false
    const cur = new Set(s.player.prepared_abilities ?? [])
    if (cur.has(id)) cur.delete(id)
    else {
      if (cur.size >= slots) return false
      cur.add(id)
    }
    const arr = [...cur]
    s.player.prepared_abilities = arr
    if (!arr.length) delete s.player.prepared_abilities
    return true
  }

  /** динамически изменить описание сущности (правила/диалоги, действие set_description) */
  setEntityDescription(entityId: string, text: string): void {
    const s = this.state
    s.desc_overrides = { ...(s.desc_overrides ?? {}), [entityId]: text }
  }

  applyEffects(effects: Effect[], depth = 0): void {
    for (const e of effects) this.applyEffect(e, depth)
  }

  /**
   * Глубина вложенных вызовов правил (эффект fire_rule). Больше двух — стоп:
   * иначе «правило вызывает правило вызывает правило» зациклит забег. Прямые и
   * транзитивные петли ловит «Проверить кампанию» (см. store.validateContent).
   */
  private static readonly FIRE_RULE_MAX_DEPTH = 2

  applyEffect(e: Effect, depth = 0): void {
    const s = this.state
    switch (e.type) {
      case 'fire_rule':
        if (depth >= GameEngine.FIRE_RULE_MAX_DEPTH) {
          this.pushLog('Правило не вызвано: превышена глубина цепочки вызовов.')
          break
        }
        this.tryFireRule(e.rule, depth + 1)
        break
      case 'unlock_recipe':
        this.unlockRecipe(e.recipe)
        break
      case 'set_entity_state': {
        const m = (s.entity_states ??= {})
        if (e.state) m[e.entity] = e.state
        else delete m[e.entity]
        this.notify()
        break
      }
      case 'set_flag': s.flags[e.flag] = true; break
      case 'set_description':
        this.setEntityDescription(e.entity, e.text)
        break
      case 'clear_flag': delete s.flags[e.flag]; break
      case 'apply_status': this.applyStatus(e.target, e.status, e.duration); break
      case 'remove_status': this.removeStatus(e.target, e.status); break
      case 'set_weather': {
        const next = e.weather || undefined
        if (s.weather !== next) {
          s.weather = next
          const w = this.campaign.meta.weathers?.find((x) => x.id === next)
          this.pushLog(next ? `Погода меняется: ${w?.label ?? next}.` : 'Небо проясняется.')
        }
        break
      }
      case 'unlock_codex': this.unlockCodex(e.entry); break
      case 'set_variable': s.variables[e.var] = e.value; break
      case 'change_variable':
        s.variables[e.var] = Number(s.variables[e.var] ?? 0) + e.delta
        break
      case 'start_dialogue':
        this.startDialogue(e.entity, e.dialogue_knot)
        break
      case 'start_combat':
        this.startCombat(e)
        break
      case 'teleport_player': {
        const target = this.findLocation(e.location)
        if (target) {
          s.region = target.region.id
          s.location = e.location
          s.scene = e.scene ?? this.arrivalSceneOf(target.location) ?? s.scene
        }
        break
      }
      case 'change_scene_state':
        // состояние сцены управляется флагами; хелпер ставит флаг вида scene_state:<scene>
        s.flags[`scene_state:${e.scene}:${e.state}`] = true
        break
      case 'add_item': this.addItem(e.item, e.quantity ?? 1); break
      case 'remove_item': this.removeItem(e.item, e.quantity ?? 1); break
      case 'change_need': this.changeNeed(e.need, e.delta); break
      case 'change_hp': this.changeHp(e.delta); break
      case 'change_skill': {
        if (!featureOn(this.campaign.meta, 'skills')) break
        const cur = s.player.skills[e.skill] ?? 0
        s.player.skills[e.skill] = Math.max(0, cur + e.delta)
        this.pushLog(`Навык «${e.skill}»: ${e.delta > 0 ? '+' : ''}${e.delta} (теперь ${s.player.skills[e.skill]}).`)
        break
      }
      case 'skill_check_gate': {
        const out = this.playerSkillCheck(e.skill, e.difficulty)
        const retry = () => this.playerSkillCheck(e.skill, e.difficulty)
        const deferred = this.applyByCheck(
          out,
          `Проверка «${this.skillLabel(e.skill)}»`,
          retry,
          () => this.applyEffects(e.success_effects),
          () => this.applyEffects(e.fail_effects),
        )
        // с luckOffer эффекты применит resolveLuckOffer
        void deferred
        if (out.success) this.markSkill(e.skill)
        break
      }
      case 'stat_check': {
        const mult = e.multiplier ?? 5
        const aug = this.augmentBonus(e)
        const modifier = (e.modifier ?? 0) + aug
        const out = this.statCheck(e.stat, mult, modifier)
        this.applyByCheck(
          out,
          `Проверка характеристики ${e.stat}×${mult}`,
          () => this.statCheck(e.stat, mult, modifier),
          () => this.applyEffects(e.success_effects),
          () => this.applyEffects(e.fail_effects),
        )
        break
      }
      case 'group_stat_check': {
        // групповая сцепленная проверка (аудит §5.6): герой + до N союзников партии
        const bySkill = (e.mode ?? (e.stat ? 'stat' : 'skill')) === 'skill'
        const helpersN = Math.max(0, e.helpers ?? 2)
        const companions = this.state.party.slice(0, helpersN)
        const total = 1 + companions.length
        const need = Math.max(1, e.need ?? Math.ceil(total / 2))
        let wins = 0
        const whatLabel = bySkill
          ? `Групповая проверка «${this.skillLabel(e.skill!)}»`
          : `Групповая проверка ${e.stat}×${e.multiplier ?? 5}`
        this.pushLog(`${whatLabel} — цепочка из ${total} чел., нужно успешных: ${need}.`)
        // герой
        if (bySkill) {
          const out = this.playerSkillCheck(e.skill!, e.difficulty ?? 50)
          if (out.success) wins++
        } else {
          const out = this.statCheck(e.stat!, e.multiplier ?? 5, e.modifier ?? 0)
          if (out.success) wins++
        }
        // союзники — их собственными значениями
        const mult = e.multiplier ?? 5
        for (const c of companions) {
          const def = this.campaign.entities[c.entity]
          if (!def || def.type !== 'npc') continue
          const value = bySkill
            ? (def.skills?.[e.skill!] ?? 0)
            : (((def.stats as unknown as Record<string, number>)[e.stat!] ?? 0) * mult)
          const out = skillCheck(
            Math.max(1, value),
            this.rng,
            bySkill ? difficultyModifier(value, e.difficulty ?? 50) : (e.modifier ?? 0),
            this.diceRules,
          )
          this.pushLog(`${def.label}: d100=${out.roll} против ${out.target} → ${CHECK_RESULT_LABEL[out.result]}`)
          if (out.success) wins++
        }
        if (wins >= need) {
          this.pushLog(`Цепочка выдержала: ${wins} из ${total} успешно.`)
          this.applyEffects(e.success_effects)
        } else {
          this.pushLog(`Цепочка порвалась: ${wins} из ${total} успешно (нужно ${need}).`)
          this.applyEffects(e.fail_effects)
        }
        break
      }
      case 'opposed_check': {
        const res = this.opposedCheck(e)
        const finalize = (r: { success: boolean }) => this.applyEffects(r.success ? e.success_effects : e.fail_effects)
        if (res.success) {
          finalize(res)
          break
        }
        const cfg = this.campaign.meta.luck
        const cost = Math.max(1, cfg?.reroll_cost ?? 1)
        if (!cfg || this.luckMax() <= 0 || this.luck() < cost) {
          finalize(res)
          break
        }
        this.changeLuck(-cost)
        this.pushLog(`Поражение можно оспорить за удачу: −${cost} (осталось ${this.luck()}).`)
        this.luckOffer = {
          text: `Противоборство «${this.skillLabel(e.skill)}» — поражение героя.`,
          cost,
          decide: (reroll) => {
            if (reroll) finalize(this.opposedCheck(e))
            else {
              this.pushLog('Удача прибережена — остаётся поражение.')
              finalize(res)
            }
            this.checkRules()
            this.autosave()
          },
        }
        break
      }
      case 'change_luck': this.changeLuck(e.delta); break
      case 'change_fatigue': this.changeFatigue(e.delta); break
      case 'change_sanity': this.changeSanity(e.delta); break
      case 'change_reputation': this.changeReputation(e.delta); break
      case 'change_wealth': this.changeWealth(e.levels); break
      case 'change_passion': this.changePassion(e.id, e.delta ?? (e.set != null ? e.set - (this.state.player.passions?.[e.id] ?? 0) : 0)); break
      case 'change_allegiance': this.changeAllegiance(e.id, e.points); break
      case 'train_stat': this.trainStat(e.stat, e.delta); break
      case 'hazard_fall': this.applyFall(e.meters, e.skill); break
      case 'commit_crime': this.commitCrime(e.id, e.bounty); break
      case 'set_price_event': this.setPriceEvent(e.id, true); break
      case 'clear_price_event': this.setPriceEvent(e.id ?? '', false); break
      case 'banner': this.showBanner(e); break
      case 'postcard':
        this.postcard = { image: e.image, art: e.art, text: e.text, preset: e.preset, seconds: e.seconds, camera: e.camera }
        if ((e.seconds ?? 6) > 0) {
          const at = Math.max(1, e.seconds ?? 6)
          globalThis.setTimeout(() => this.hidePostcard(), at * 1000)
        }
        this.notify()
        break
      case 'grant_xp': this.grantXp(e.points); break
      case 'grant_feat': this.grantFeat(e.id); break
      case 'meta_currency': this.grantMetaCurrency(e.id, e.amount); break
      case 'roll_event_table': this.rollEventTable(e.table, { forced: true, ignoreFilters: e.ignore_filters }); break
      case 'generate_variables': {
        for (const p of e.pack) {
          const val = this.genValue(e.generator, p.key, e.seed)
          s.variables[p.as ?? p.key] = val
        }
        this.pushLog('Мир что-то замышляет…')
        break
      }
      case 'change_disposition': this.changeDisposition(e.target, e.delta); break
      case 'start_quest': this.startQuest(e.quest); break
      case 'advance_quest': this.advanceQuestTo(e.quest, e.stage); break
      case 'fail_quest': {
        const qs = s.quests[e.quest]
        if (qs && qs.status === 'active') {
          qs.status = 'failed'
          this.messages.push({ text: `Квест провален: «${this.campaign.quests[e.quest]?.label ?? e.quest}»` })
        }
        break
      }
      case 'journal_update': this.journalUpdate(e.quest, e.text_key); break
      case 'give_reward':
        for (const it of e.items ?? []) this.addItem(it.item, it.quantity)
        break
      case 'join_party': this.joinParty(e.entity); break
      case 'leave_party': this.leaveParty(e.entity); break
      case 'block_path':
        if (!s.blocked_paths.includes(`${e.from}->${e.to}`)) s.blocked_paths.push(`${e.from}->${e.to}`)
        break
      case 'unblock_path': {
        const i = s.blocked_paths.indexOf(`${e.from}->${e.to}`)
        if (i >= 0) s.blocked_paths.splice(i, 1)
        break
      }
      case 'show_message': {
        const msgText = this.fmt(e.text)
        // Не добавляем дублирующиеся сообщения (защита от спама ИИ-кампаний)
        // и ограничиваем очередь сообщений, чтобы не забивать UI
        if (!this.messages.some(m => m.text === msgText) && this.messages.length < 5) {
          this.messages.push({ text: msgText, portrait: e.portrait })
        }
        break
      }
      case 'reveal_location':
        if (!s.revealed_locations.includes(e.location)) s.revealed_locations.push(e.location)
        break
      case 'advance_time': this.advanceTicks(e.ticks); break
      case 'start_pursuit': {
        // преследование героя: периодические цепочные проверки маскировки
        s.pursuit = {
          label: e.label,
          skill: e.skill ?? 'stealth',
          every: Math.max(1, e.every_ticks ?? 4),
          fails_needed: Math.max(1, e.fails_to_catch ?? 1),
          fails: 0,
          left: Math.max(1, e.every_ticks ?? 4),
          on_fail: e.on_fail,
        }
        this.pushLog(`За вами следом идут${e.label ? ` — ${e.label}` : ''}! Удерживайте маскировку, пока не оторвётесь.`)
        break
      }
      case 'stop_pursuit': {
        if (s.pursuit) {
          delete s.pursuit
          this.pushLog('Погоня осталась позади.')
        }
        break
      }
      case 'remove_entity':
        if (!s.removed_entities.includes(e.entity)) s.removed_entities.push(e.entity)
        break
      case 'spawn_entity':
        s.spawned.push({ entity: e.entity, scene: e.scene, slot: e.slot })
        break
      case 'game_over_victory':
        this.gameOver('victory', 'Кампания пройдена!')
        break
      case 'game_over_death':
        this.gameOver('death', e.reason ?? 'Вы погибли.')
        break
      case 'play_cutscene':
        this.playCutscene(e.cutscene)
        break
    }
    // эффект мог выполнить условия достижений (флаги, предметы, переменные)
    this.checkAchievements()
  }

  // ─────────────── взаимодействие со слотами ───────────────

  // ─────────────── предмет → слот сцены (блок 8 ТЗ «Гибкий движок») ───────────────

  /** предметы игрока, применимые к слоту (для модалки выбора) */
  slotUseOptions(slot: SlotDef): Array<{ itemId: string; label: string; use: SlotUseWith }> {
    return (slot.use_with ?? [])
      .filter((u) => u.item && this.hasItem(u.item))
      .map((u) => ({
        itemId: u.item,
        label: (this.campaign.entities[u.item] as ItemDef | undefined)?.label ?? u.item,
        use: u,
      }))
  }

  /** применить предмет к слоту сцены; ложь — предмет/слот не подходят */
  useItemOnSlot(slotId: string, itemId: string): boolean {
    const scene = this.currentScene()
    const slot = scene?.slots.find((s) => s.id === slotId)
    const use = slot?.use_with?.find((u) => u.item === itemId)
    if (!slot || !use || !this.hasItem(itemId)) return false
    const def = this.campaign.entities[itemId] as ItemDef | undefined
    if (use.consume) this.removeItem(itemId, 1, { verb: 'Использовано' })
    this.applyEffects(use.effects)
    if (use.message) this.messages.push({ text: use.message })
    this.pushLog(`${def?.label ?? itemId}: использовано на «${slot.label ?? slotId}».`)
    playInteraction('use', { entity: def })
    this.checkRules()
    this.autosave()
    this.notify()
    return true
  }

  /**
   * Открыть рецепт крафта «по ходу игры». Рецепты без `known: false` открыты
   * всегда; этот эффект лишь снимает «закрытость» и один раз радует игрока.
   */
  unlockRecipe(recipeId: string): void {
    const r = this.campaign.recipes[recipeId]
    if (!r) return
    const s = this.state
    if (!s.recipes_unlocked) s.recipes_unlocked = []
    if (s.recipes_unlocked.includes(recipeId)) return
    s.recipes_unlocked.push(recipeId)
    this.messages.push({ text: `Новый рецепт: ${r.label}.` })
    this.pushLog(`Открыт рецепт: ${r.label}.`)
    playInteraction('pickup', {})
    this.notify()
    this.autosave()
  }

  /** рецепт виден игроку? (неизвестные закрыты до unlock_recipe) */
  recipeKnown(id: string): boolean {
    const r = this.campaign.recipes[id]
    if (!r) return false
    if (r.known !== false) return true
    return !!this.state.recipes_unlocked?.includes(id)
  }

  /** список рецептов, доступных игроку (вкладка «Крафт») */
  knownRecipes(): RecipeDef[] {
    return Object.values(this.campaign.recipes)
      .filter((r) => this.recipeKnown(r.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }

  /** состояние облика сущности, заданное правилом (set_entity_state) */
  entityState(id: string): string | undefined {
    return this.state.entity_states?.[id] || undefined
  }

  /**
   * Разблокировать запись кодекса (блок 10 ТЗ): повтор — no-op.
   * При первой разблокировке — сообщение «Новая запись в кодексе: …».
   */
  unlockCodex(entryId: string): void {
    const entry = this.campaign.codex[entryId]
    if (!entry) return
    const s = this.state
    if (!s.codex_unlocked) s.codex_unlocked = []
    if (s.codex_unlocked.includes(entryId)) return
    s.codex_unlocked.push(entryId)
    this.messages.push({ text: `Новая запись в кодексе: ${entry.label}.` })
    this.pushLog(`Кодекс пополнен: ${entry.label}.`)
    playInteraction('pickup', {})
    this.notify()
    this.autosave()
  }

  /** разблокированные записи кодекса (блок 10 ТЗ) */
  unlockedCodexEntries(): CodexEntryDef[] {
    return (this.state.codex_unlocked ?? [])
      .map((id) => this.campaign.codex[id])
      .filter((e): e is CodexEntryDef => !!e)
  }

  /** категории кодекса: свои из меты, иначе встроенные три (блок 10 ТЗ) */
  codexCategories(): Array<{ id: string; label: string }> {
    return this.campaign.meta.codex_categories ?? BUILTIN_CODEX_CATEGORIES
  }

  /**
   * Можно ли взаимодействовать с предметом прямо сейчас (фидбек №8: условия
   * блокируют клик — предмет остаётся «декорацией» в слоте).
   */
  /**
   * Текст с упоминаниями героя (фидбек №11, «больше плейсхолдеров в диалогах»):
   * `{имя}`/`{герой}` — имя персонажа, `{здоровье}`/`{здоровье_макс}` — HP,
   * `{день}` — номер дня забега, `{время}` — время суток по-русски,
   * `{переменная:<имя>}` — обычная переменная читалки ({имя} считает её латиницей).
   */
  fmt(text: string): string {
    if (!text.includes('{')) return text
    const st = this.state
    const p = st.player
    const day = Math.floor((st.tick ?? 0) / Math.max(1, this.campaign.meta.ticks_per_day || 24)) + 1
    const out: Record<string, string> = {
      'имя': p.name ?? 'герой',
      'герой': p.name ?? 'герой',
      'имя_героя': p.name ?? 'герой',
      'здоровье': String(Math.max(0, p.hp)),
      'здоровье_макс': String(p.max_hp),
      'мана': String(Math.max(0, p.mp)),
      'мана_макс': String(p.max_mp),
      'удача': String(this.luck()),
      'уровень': String(p.level ?? 1),
      'опыт': String(p.xp ?? 0),
      'день': String(day),
    }
    return text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      if (raw in out) return out[raw]!
      const cut = raw.indexOf(':')
      if (cut > 0) {
        const kind = raw.slice(0, cut)
        const id = raw.slice(cut + 1).trim()
        switch (kind) {
          case 'счёт': case 'счет': return String(this.itemCount(id))
          case 'навык': return String(p.skills[id] ?? 0)
          case 'потребность': return String(p.needs[id] ?? 0)
          case 'стат': return String((p.stats as unknown as Record<string, number>)[id] ?? 0)
          case 'валюта': return String(p.currencies?.[id] ?? 0)
        }
      }
      return `{${raw}}`
    })
  }

  itemInteractable(item: ItemDef): boolean {
    return (item.interactable_when ?? []).every((c) => evalCondition(c, this))
  }

  /** доступные сейчас варианты действий с предметом (условия показа) */
  itemInteractOptions(item: ItemDef): ItemInteractOption[] {
    const itemOptions = item.interact_options ?? []
    return itemOptions.filter((o, index) => {
      // Фильтруем по условиям
      if (!o.conditions?.every((c) => evalCondition(c, this))) return false
      // Фильтруем одноразовые варианты
      if (o.once) {
        const key = `item:${item.id}:${index}`
        if (this.state.used_item_interacts?.includes(key)) return false
      }
      return true
    })
  }

  /** применить выбранный вариант взаимодействия с предметом */
  runItemInteract(item: ItemDef, option: ItemInteractOption): void {
    playInteraction((option.sound ?? 'use') as SoundHook, { entity: item })
    this.applyEffects(option.effects)
    if (option.message) {
      this.messages.push({ text: this.fmt(option.message), portrait: item.portrait?.[option.emotion ?? 'neutral'] ?? item.portrait?.['neutral'] })
    }
    if (option.consume) this.state.removed_entities.push(item.id)
    // Одноразовые варианты: добавляем в список использованных
    if (option.once) {
      const itemOptions = item.interact_options ?? []
      const optionIndex = itemOptions.findIndex(o => o === option)
      if (optionIndex >= 0) {
        const key = `item:${item.id}:${optionIndex}`
        if (!this.state.used_item_interacts) this.state.used_item_interacts = []
        if (!this.state.used_item_interacts.includes(key)) {
          this.state.used_item_interacts.push(key)
        }
      }
    }
    this.checkRules()
    this.notify()
  }

  interactWithSlot(occ: SlotOccupant): boolean {
    if (!occ.entity) return false
    if (occ.entity.type === 'npc') {
      this.startDialogue(occ.entity.id)
      return true
    }
    const item = occ.entity as ItemDef
    if (!this.itemInteractable(item)) return false
    const slotType = occ.slot.type[0]
    // предмет с вариантами действий — окно выбора; собирается стороной UI
    if (this.itemInteractOptions(item).length) return false
    if (item.on_interact) {
      // «открыть контейнер» vs «использовать»: по типу слота/категории
      const isOpen = occ.slot.type.includes('container') || item.category === 'container'
      playInteraction(isOpen ? 'open' : 'use', { entity: item, slotType })
      this.applyEffects(item.on_interact.effects)
      if (item.on_interact.message) this.messages.push({ text: this.fmt(item.on_interact.message) })
      if (item.on_interact.consume) {
        this.state.removed_entities.push(item.id)
      }
      this.checkRules()
      this.notify()
    } else {
      // Не показываем описание автоматически при клике на предмет без взаимодействия.
      // Описание видно в тултипе (data-tip в UI).
      // Если нужно показать описание как сообщение, мастер должен использовать on_interact.message
      this.notify()
    }
    return true
  }

  // ─────────────── бой (Фаза 1) ───────────────

  /** эффекты on_victory, требующие закрытия экрана боя (диалог, телепорт и т.п.) */
  private postCombatEffects: Effect[] = []

  /**
   * Вызывается боем в момент его разрешения — победы, бегства игрока или
   * «бессознательного» проигрыша (BRP-режим). Безопасные эффекты применяются
   * сразу, пока игрок видит экран исхода; смена экрана (диалог, телепорт,
   * новый бой, финал) — после закрытия боя.
   */
  onCombatResolve(effects: Effect[]): void {
    const defer = new Set(['start_dialogue', 'start_combat', 'teleport_player', 'game_over_victory', 'game_over_death', 'play_cutscene'])
    this.postCombatEffects = effects.filter((e) => defer.has(e.type))
    this.applyEffects(effects.filter((e) => !defer.has(e.type)))
    this.notify()
  }

  startCombat(def: Extract<Effect, { type: 'start_combat' }>): void {
    // бой выключен профилем кампании — конфликт резолвится немедленной победой
    if (!featureOn(this.campaign.meta, 'combat')) {
      this.pushLog('Конфликт разрешился без боя.')
      this.applyEffects(def.on_victory ?? [])
      this.checkRules()
      this.notify()
      return
    }
    // внезапность из скрытности (мастер может задать def.surprise явно)
    let effective = def
    if (!def.surprise && this.isSneaking() && !this.isDetected()) {
      effective = { ...def, surprise: 'player' }
      this.pushLog('Вы нападаете из скрытности — враги застигнуты врасплох!')
    }
    if (this.state.stealth) this.state.stealth.sneaking = false
    // бой прерывает диалог
    this.dialogue = null
    this.activeStory = null
    this.activeNpc = null
    this.combat = new CombatController(this, effective)
    playUi('combat_start')
    this.notify()
  }

  /** Вызывается UI после экрана исхода боя (победа / бегство / выживание). */
  endCombat(): void {
    const combat = this.combat
    if (!combat) return
    this.combat = null
    if (combat.result === 'victory' || combat.result === 'fled') {
      // основная часть эффектов уже применена в момент исхода (onCombatResolve)
      const deferred = this.postCombatEffects
      this.postCombatEffects = []
      this.applyEffects(deferred)
      this.advanceTicks(1) // бой занимает время (ТЗ 4.1)
      this.state.stats_run.kills += combat.combatants.filter((c) => c.side === 'enemy' && c.dead).length
      this.pushLog(
        combat.result === 'victory'
          ? `Бой «${combat.arena.label}» выигран за ${combat.round} раунд(ов).`
          : `Вы отступили из боя «${combat.arena.label}».`,
      )
      this.checkRules()
      this.autosave()
    } else if (combat.result === 'defeat' && !this.state.game_over) {
      // BRP-режим (combat.death.mode='brp'): герой падает без сознания, но
      // выживает — эффекты on_defeat мастера уже частично применены
      const deferred = this.postCombatEffects
      this.postCombatEffects = []
      this.applyEffects(deferred)
      this.advanceTicks(1)
      this.pushLog('Вы приходите в себя после поражения.')
      this.checkRules()
      this.autosave()
    }
    this.notify()
  }

  /** Публичный запуск manual-правила (для Ink external fire_rule). */
  fireRule(ruleId: string): void {
    this.tryFireRule(ruleId)
  }

  // ─────────────── диалоги ───────────────

  /**
   * Найти ink-исходник диалога по ссылке NPC. Канон пакета —
   * `dialogues/<id>.ink`; монолит до repair и ручные правки часто держат
   * голый id (`dlg_orion`). Без фолбэков диалог «молча не открывался».
   */
  resolveDialogueSource(ref: string): { key: string; source: string } | null {
    const map = this.campaign.dialogues
    if (!ref) return null
    if (map[ref]) return { key: ref, source: map[ref]! }
    const bare = ref.replace(/^dialogues\//, '').replace(/\.(dlg\.json|ink|json)$/i, '')
    const candidates = [
      `dialogues/${bare}.ink`,
      bare,
      `${bare}.ink`,
      `dialogues/${bare}`,
    ]
    for (const k of candidates) {
      if (map[k]) return { key: k, source: map[k]! }
    }
    // последний шанс: суффикс/окончание ключа
    for (const [k, src] of Object.entries(map)) {
      if (k === bare || k.endsWith(`/${bare}.ink`) || k.endsWith(`/${bare}`)) {
        return { key: k, source: src }
      }
    }
    return null
  }

  startDialogue(entityId: string, knot?: string): void {
    const npc = this.campaign.entities[entityId] as NpcDef | undefined
    if (!npc || npc.type !== 'npc' || !npc.dialogue) return
    const resolved = this.resolveDialogueSource(npc.dialogue)
    if (!resolved) return
    const { key: dialogueKey, source } = resolved
    playInteraction('talk', { entity: npc })
    // Каждый разговор — свежая Story (компиляция кэширована в dialogue.ts):
    // однократные `*`-ветки исчезают до конца разговора и возвращаются в новом,
    // а «навсегда» вещи хранятся только во флагах. (фидбек №3)
    let story: Story
    try {
      story = createStory(source, dialogueKey)
    } catch (err) {
      // битый ink не должен валить весь рантайм: сообщение мастеру/игроку и выход
      const msg = err instanceof Error ? err.message : String(err)
      this.pushLog(`Диалог «${dialogueKey}» не скомпилировался.`)
      this.messages.push({ text: `Диалог недоступен (${npc.label}).` })
      console.error(msg)
      this.notify()
      return
    }
    bindExternals(story, this)
    // Точка входа: явный knot → «main» (канон редактора) → первый knot файла.
    // ИИ/ручные dlg.json часто зовут стартовый узел n_start — без фолбэка
    // ChoosePathString молча проваливался и диалог «не открывался».
    const entryKnot = knot ?? 'main'
    try {
      story.ChoosePathString(entryKnot)
    } catch {
      const fallback = firstInkKnot(source)
      if (!fallback || fallback === entryKnot) return
      try {
        story.ChoosePathString(fallback)
      } catch {
        return
      }
    }
    this.activeStory = story
    this.activeNpc = npc
    this.state.stats_run.dialogues += 1
    const drained = drainStory(story)
    if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
      // external в первой же реплике: бой / торговля / финал — окна диалога нет
      this.dialogue = null
      this.activeStory = null
      this.activeNpc = null
    } else {
      this.dialogue = { npc, lines: drained.lines, choices: drained.choices, finished: drained.finished }
    }
    this.notify()
  }

  chooseDialogueOption(index: number): void {
    const story = this.activeStory
    const npc = this.activeNpc
    if (!story || !npc) return
    story.ChooseChoiceIndex(index)
    const drained = drainStory(story)
    // external мог закрыть забег/открыть бой/торговлю (game_over чистит
    // activeStory — но drainStory уже отработал). Не восстанавливаем окно.
    if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
      this.dialogue = null
      this.activeStory = null
      this.activeNpc = null
      this.notify()
      return
    }
    this.dialogue = {
      npc,
      lines: drained.lines,
      choices: drained.choices,
      finished: drained.finished,
    }
    this.checkRules()
    // правило на checkRules тоже могло вызвать game_over
    if (this.state.game_over) {
      this.dialogue = null
      this.activeStory = null
      this.activeNpc = null
    }
    this.notify()
  }

  endDialogue(): void {
    this.dialogue = null
    this.activeStory = null
    this.activeNpc = null
    this.checkRules()
    this.autosave()
    this.notify()
  }

  dismissMessage(): void {
    this.messages.shift()
    this.notify()
  }

  // ─────────────── рогалик-луп ───────────────

  gameOver(type: 'death' | 'victory', reason: string, force = false): void {
    if (this.debugInvincible && type === 'death' && !force) return
    if (this.state.game_over) return
    // концовки кампании: первая подходящая по исходу и условиям (мастер задаёт сам)
    const ending = (this.campaign.meta.endings ?? []).find(
      (en) =>
        (!en.on || en.on === type) &&
        (en.conditions ?? []).every((c) => evalCondition(c, this)),
    )
    this.state.game_over = { type, reason, ending: ending?.id }
    if (ending?.id) this.rememberEnding(ending.id)
    this.finalizeRunMeta(type === 'victory')
    // Финал всегда закрывает диалог (и при победе, и при гибели). Иначе
    // GameView держит DialogueOverlay поверх и не показывает EndScreen:
    // `game_over && !dialogue` — типичный путь fire_rule/tick_elapsed →
    // game_over_victory из ink оставлял story «висящей».
    this.dialogue = null
    this.activeStory = null
    this.activeNpc = null
    this.trade = null
    // забег завершён в любом исходе — сейв стирается, «Продолжить» исчезает (фидбек №10)
    deleteSave(this.campaign.meta.id)
    this.notify()
  }

  /** Полный рестарт: новый seed (ТЗ 4.10). */
  restart(): GameEngine {
    deleteSave(this.campaign.meta.id)
    const fresh = new GameEngine(this.campaign)
    // выбор создания персонажа переживает перезапуск забега (блок 11 ТЗ)
    if (this.state.char_choice) {
      fresh.applyCharCreation({ ...this.state.char_choice, calling: this.state.char_choice.calling ?? '' })
    }
    fresh.start()
    return fresh
  }

  /** New Game+ доступен? (мастер разрешил, забег завершён победой) */
  newGamePlusAvailable(): boolean {
    return !!this.campaign.meta.new_game_plus && this.state.game_over?.type === 'victory'
  }

  /**
   * New Game+: победивший герой возвращается в новый забег с наследием
   * (keep мастера), круг +1 — множители сложности растут на boost-шаги.
   * Пермадет-семантика сохранена: NG+ только за победу.
   */
  newGamePlus(): GameEngine | null {
    const cfg = this.campaign.meta.new_game_plus
    if (!this.newGamePlusAvailable() || !cfg) return null
    const prev = this.state
    deleteSave(this.campaign.meta.id)
    const fresh = new GameEngine(this.campaign)
    if (prev.char_choice) {
      fresh.applyCharCreation({ ...prev.char_choice, calling: prev.char_choice.calling ?? '' })
    }
    fresh.start()
    const keep = new Set(cfg.keep ?? ['skills', 'skill_marks', 'stats', 'inventory', 'feats', 'prepared'])
    const pp = prev.player
    const np = fresh.state.player
    if (keep.has('skills')) np.skills = JSON.parse(JSON.stringify(pp.skills)) as typeof np.skills
    if (keep.has('skill_marks')) np.skill_marks = { ...pp.skill_marks }
    if (keep.has('stats')) {
      np.stats = { ...pp.stats }
      // базовые производные взяты из шаблона — подтянем к статам наследия
      np.max_hp = pp.max_hp
      np.max_mp = pp.max_mp
    }
    if (keep.has('inventory')) {
      np.inventory = JSON.parse(JSON.stringify(pp.inventory)) as typeof np.inventory
      np.equipment = { ...pp.equipment }
    }
    if (keep.has('feats')) {
      np.xp = pp.xp
      np.level = pp.level
      np.feats = pp.feats?.slice()
    }
    if (keep.has('prepared')) np.prepared_abilities = pp.prepared_abilities?.slice()
    // облик и сложность идентичны прошлому забегу
    np.portrait_choice = pp.portrait_choice && JSON.parse(JSON.stringify(pp.portrait_choice))
    np.difficulty = pp.difficulty
    np.hp = np.max_hp
    np.mp = np.max_mp
    fresh.state.ng_cycle = (prev.ng_cycle ?? 0) + 1
    return fresh
  }

  // ─────────────── мета-прогресс между забегами (аудит B8b) ───────────────

  /** мета-прогресс включён мастером (блок meta.metaprogress) */
  metaProgressEnabled(): boolean {
    return !!this.campaign.meta.metaprogress
  }

  private static metaKey(campaignId: string): string {
    return `chronicle-forge:meta:${campaignId}`
  }

  private metaState: MetaStoreState | null = null

  private static blankMetaState(): MetaStoreState {
    return { runs: 0, deaths: 0, victories: 0, currencies: {}, achievements: {}, unlocks: [], counters: {} }
  }

  /** снимок мета-хранилища (ленивая загрузка из localStorage) */
  metaStore(): MetaStoreState {
    if (this.metaState) return this.metaState
    let loaded: MetaStoreState
    try {
      const raw = localStorage.getItem(GameEngine.metaKey(this.campaign.meta.id))
      loaded = raw ? { ...GameEngine.blankMetaState(), ...(JSON.parse(raw) as Partial<MetaStoreState>) } : GameEngine.blankMetaState()
    } catch {
      loaded = GameEngine.blankMetaState()
    }
    this.metaState = loaded
    return loaded
  }

  private saveMetaStore(): void {
    if (!this.metaProgressEnabled() || !this.metaState) return
    try {
      localStorage.setItem(GameEngine.metaKey(this.campaign.meta.id), JSON.stringify(this.metaState))
    } catch { /* хранилище переполнено/недоступно — мета-прогресс терпимо */ }
  }

  /** баланс метавалюты */
  metaCurrency(id: string): number {
    return this.metaStore().currencies[id] ?? 0
  }

  /** начислить метавалюту (эффект/награда достижения) */
  grantMetaCurrency(id: string, amount: number): void {
    if (!this.metaProgressEnabled() || amount === 0) return
    const def = this.campaign.meta.metaprogress?.currencies?.find((c) => c.id === id)
    if (!def) return
    const st = this.metaStore()
    st.currencies[id] = Math.max(0, (st.currencies[id] ?? 0) + amount)
    this.pushLog(`${def.label}: ${amount > 0 ? '+' : ''}${amount} (всего ${st.currencies[id]}).`)
    this.saveMetaStore()
    this.notify()
  }

  /** открыто ли достижение */
  metaAchievementDone(id: string): boolean {
    return !!this.metaStore().achievements[id]
  }

  /**
   * Счётчик хроники для условия meta_counter: «сколько раз это уже было»
   * между забегами. Служебные ключи (runs/deaths/victories/endings_seen)
   * читаются из хранилища как есть; любой другой ключ — накопленный счётчик
   * stats_run плюс вклад текущего забега (как у достижений).
   */
  metaCounter(key: string): number {
    const st = this.metaStore()
    switch (key) {
      case 'runs': return st.runs
      case 'deaths': return st.deaths
      case 'victories': return st.victories
      case 'endings_seen': return (st.endings ?? []).length
      default: return (st.counters[key] ?? 0) + (this.state.stats_run[key as keyof typeof this.state.stats_run] ?? 0)
    }
  }

  /** записать концовку в хронику (истина — впервые увидена) */
  private rememberEnding(endingId: string): void {
    const st = this.metaStore()
    st.endings ??= []
    if (st.endings.includes(endingId)) return
    st.endings.push(endingId)
  }

  /** достижения с состоянием (для экрана) */
  achievementStates(): { def: AchievementDef; done: boolean; progress?: number; target?: number }[] {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg) return []
    const st = this.metaStore()
    return (cfg.achievements ?? [])
      .filter((a) => !a.hidden || st.achievements[a.id])
      .map((a) => ({
        def: a,
        done: !!st.achievements[a.id],
        ...(a.counter ? { progress: this.achievementCounter(a), target: a.counter.target } : {}),
      }))
  }

  private achievementCounter(a: AchievementDef): number {
    if (!a.counter) return 0
    const st = this.metaStore()
    const total = st.counters[a.counter.stat] ?? 0
    return total + (this.state.stats_run[a.counter.stat] ?? 0)
  }

  /**
   * Проверка всех закрытых достижений (тики, эффекты, конец забега вызывают).
   * Защёлкивает открывшиеся: лог, награда, сохранение.
   */
  checkAchievements(): void {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg?.achievements?.length) return
    const st = this.metaStore()
    let dirty = false
    for (const a of cfg.achievements) {
      if (st.achievements[a.id]) continue
      const ok = a.counter
        ? this.achievementCounter(a) >= a.counter.target
        : (a.conditions ?? []).length > 0 && (a.conditions ?? []).every((c) => evalCondition(c, this))
      if (!ok) continue
      st.achievements[a.id] = new Date().toISOString()
      dirty = true
      this.unlockedThisRun.push(a.id)
      this.pushLog(`Достижение: «${a.label}»!`)
      if (a.reward?.currency && a.reward.amount) {
        st.currencies[a.reward.currency] = Math.max(0, (st.currencies[a.reward.currency] ?? 0) + a.reward.amount)
        const curLabel = cfg.currencies?.find((c) => c.id === a.reward!.currency)?.label ?? a.reward.currency
        this.pushLog(`${curLabel}: +${a.reward.amount}.`)
      }
      if (a.reward?.xp) this.grantXp(a.reward.xp)
    }
    if (dirty) this.saveMetaStore()
  }

  /** открытые в этом забеге достижения (для экрана исхода) */
  private unlockedThisRun: string[] = []
  achievementsUnlockedThisRun(): AchievementDef[] {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg) return []
    return this.unlockedThisRun
      .map((id) => cfg.achievements?.find((a) => a.id === id))
      .filter((x): x is AchievementDef => !!x)
  }

  /** вклад статистики текущего забега в суммарные счётчики + исход */
  private finalizeRunMeta(won: boolean): void {
    if (!this.metaProgressEnabled()) return
    const st = this.metaStore()
    if (won) st.victories += 1
    else st.deaths += 1
    for (const [k, v] of Object.entries(this.state.stats_run)) {
      st.counters[k] = (st.counters[k] ?? 0) + (v ?? 0)
    }
    this.checkAchievements() // награда «за весь забег» тоже получает шанс
    this.saveMetaStore()
  }

  /** старт нового забега: счётчик и гранты купленных усилений */
  private metaRunStart(): void {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg) return
    const st = this.metaStore()
    st.runs += 1
    this.saveMetaStore()
    if (st.runs > 1) this.pushLog(`Хроника продолжает писаться — забег №${st.runs}.`)
    for (const uid of st.unlocks) {
      const u = cfg.unlocks?.find((x) => x.id === uid)
      if (!u) continue
      this.pushLog(`Усиление из хроники: «${u.label}».`)
      this.applyEffects(u.grants)
    }
    this.checkAchievements()
  }

  /** куплено ли усиление */
  metaUnlockOwned(id: string): boolean {
    return this.metaStore().unlocks.includes(id)
  }

  /** можно ли купить усиление (валюты хватает, требования истинны) */
  metaUnlockAffordable(u: MetaUnlockDef): boolean {
    if (this.metaUnlockOwned(u.id)) return false
    if (u.requires?.length && !u.requires.every((c) => evalCondition(c, this))) return false
    return u.cost.every((c) => this.metaCurrency(c.currency) >= c.amount)
  }

  /** купить постоянное усиление (экран хроники/финала) */
  buyMetaUnlock(id: string): boolean {
    const u = this.campaign.meta.metaprogress?.unlocks?.find((x) => x.id === id)
    if (!u || !this.metaUnlockAffordable(u)) return false
    const st = this.metaStore()
    for (const c of u.cost) st.currencies[c.currency] = (st.currencies[c.currency] ?? 0) - c.amount
    st.unlocks.push(id)
    this.saveMetaStore()
    this.pushLog(`В хронику записано усиление «${u.label}» — будет действовать каждом новом забеге.`)
    this.notify()
    return true
  }

  // ─────────────── случайные события и генераторы (аудит B9) ───────────────

  /** есть ли генераторы/таблицы вообще */
  generatorsEnabled(): boolean {
    const g = this.campaign.meta.generators
    return !!(g && (g.event_tables?.length || g.npc?.length || g.scenes?.length || g.adventures?.length))
  }

  /** таблица событий по id */
  eventTableDef(id: string): EventTableDef | undefined {
    return this.campaign.meta.generators?.event_tables?.find((t) => t.id === id)
  }

  /** таблица событий активна сейчас (не выключена, время/локация подходят) */
  private eventTableActive(t: EventTableDef): boolean {
    if (t.disabled) return false
    if (t.time_of_day?.length && !t.time_of_day.includes(timeOfDay(this.state.tick, this.campaign.meta))) return false
    if (t.locations?.length && !t.locations.includes(this.state.location)) return false
    return true
  }

  /**
   * Один бросок таблицы: выбор случайного подходящего правила и его
   * исполнение. Возвращает id исполненного правила или null.
   * `forced` — вызыватель эффекта roll_event_table: без шанса-интервала,
   * `ignoreFilters` — даже без проверок времени/локации.
   */
  rollEventTable(tableId: string, opts: { forced?: boolean; ignoreFilters?: boolean } = {}): string | null {
    const t = this.eventTableDef(tableId)
    if (!t || t.disabled) return null
    if (!opts.ignoreFilters && !this.eventTableActive(t)) return null
    if (!opts.forced && (t.chance ?? 1) < 1 && !this.rng.chance(t.chance ?? 1)) return null
    const candidates: string[] = []
    for (const ruleId of t.rules) {
      const rule = this.campaign.rules[ruleId]
      if (!rule) continue
      if (rule.once && this.state.fired_rules.includes(rule.id)) continue
      if (!this.ruleConditionsOk(rule)) continue
      candidates.push(ruleId)
    }
    if (!candidates.length) return null
    const picked = candidates[this.rng.int(0, candidates.length - 1)]!
    this.pushLog(`Событие (${t.label})…`)
    this.fireRule(picked)
    return picked
  }

  /** тики: у каждой таблицы свой шаг (tick % interval === 0) */
  private tickEventTables(): void {
    const tables = this.campaign.meta.generators?.event_tables
    if (!tables?.length) return
    for (const t of tables) {
      if (t.interval_ticks <= 0) continue
      if (this.state.tick % t.interval_ticks !== 0) continue
      this.rollEventTable(t.id)
    }
  }

  /** взвешенный выбор из списка генератора (`genPick` используется и из ink) */
  genPickWeighted(items: GenWeightedItem[], rand: () => number): string | null {
    if (!items.length) return null
    let total = 0
    for (const it of items) total += Math.max(0, it.weight ?? 1)
    if (total <= 0) return items[0].value
    let roll = rand() * total
    for (const it of items) {
      roll -= Math.max(0, it.weight ?? 1)
      if (roll <= 0) return it.value
    }
    return items[items.length - 1].value
  }

  /** найти определение генератора (любого вида) по id или id списка */
  private genDef(generatorId: string): { lists: Record<string, GenWeightedItem[]> } | undefined {
    const g = this.campaign.meta.generators
    if (!g) return undefined
    return (
      g.npc?.find((x) => x.id === generatorId) ??
      g.scenes?.find((x) => x.id === generatorId) ??
      g.adventures?.find((x) => x.id === generatorId)
    )
  }

  /**
   * Значение из списка генератора. `key` — ключ списка; компоновка имени —
   * ключ `name` (через gen.name части). seed — стабильная строка: тот же
   * seed+key даёт то же значение. Без seed — игровой PRNG.
   */
  genValue(generatorId: string, key: string, seed?: string): string {
    const def = this.genDef(generatorId)
    if (!def) return ''
    const rand = seed ? this.seedRand(`${seed}:${generatorId}:${key}`) : () => this.rng.next()
    if (key === 'name') {
      const nameGen = this.campaign.meta.generators?.npc?.find((x) => x.id === generatorId)
      if (nameGen?.name?.length) return this.composeGenName(nameGen, rand)
    }
    // спец-ключ цели приключения: goals:N
    if (key.startsWith('goal:')) {
      const adv = this.campaign.meta.generators?.adventures?.find((x) => x.id === generatorId)
      const idx = parseInt(key.slice(5), 10)
      const template = adv?.goals[idx]
      if (template) return this.expandGenTemplate(template, def.lists, rand)
      return ''
    }
    const list = def.lists[key]
    return list ? (this.genPickWeighted(list, rand) ?? '') : ''
  }

  /** детерминированный PRNG из строки (стабильность по seed) */
  private seedRand(seed: string): () => number {
    let h = 2166136261 >>> 0
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 16777619) >>> 0
    }
    let x = h || 1
    return () => {
      x ^= x << 13; x >>>= 0
      x ^= x >> 17
      x ^= x << 5; x >>>= 0
      return x / 4294967296
    }
  }

  /** компоновка имени из частей (список/литерал) */
  private composeGenName(gen: NpcGeneratorDef, rand: () => number): string {
    if (!gen.name?.length) return ''
    return gen.name
      .map((p) => {
        if (p.literal != null) return p.literal
        const list = gen.lists[p.list ?? '']
        return list ? (this.genPickWeighted(list, rand) ?? '') : ''
      })
      .filter(Boolean)
      .join('')
      .trim()
  }

  /** подстановка {list:key} в шаблон (цели приключений и слоты сцен) */
  private expandGenTemplate(template: string, lists: Record<string, GenWeightedItem[]>, rand: () => number): string {
    // {list:ключ} — наследие ранних версий; {список:ключ} — русская форма,
    // которую учит подсказывать UI мастера. Обе подстановки равноправны.
    return template.replace(/\{(?:list|список):([^\s{}]+)\}/g, (_m, key: string) => {
      const list = lists[key]
      return list ? (this.genPickWeighted(list, rand) ?? '') : ''
    })
  }

  // ─────────────── сохранение ───────────────

  /**
   * Автосейв: состояние пишется в обёртке (`SaveEnvelope`) вместе с версией
   * кампании и версией движка — без этого нельзя ни перенести сейв, ни
   * объяснить игроку, почему он не подошёл после обновления.
   */
  /** выбранный игроком уровень сложности (мастерские пресеты meta.difficulties) с накруткой круга New Game+ */
  difficultyDef(): DifficultyPreset | null {
    const list = this.campaign.meta.difficulties
    if (!list?.length) return null
    const base = list.find((d) => d.id === this.state.player.difficulty) ?? list[0]
    const cycle = this.state.ng_cycle ?? 0
    const boost = this.campaign.meta.new_game_plus?.boost
    if (!cycle || !boost) return base
    // круг New Game+ ужесточает мир: шаги множителей поверх выбранного пресета
    const withStep = (v: number | undefined, step: number | undefined) =>
      v === undefined || !step ? v : Math.round(v * (1 + step * cycle) * 100) / 100
    return {
      ...base,
      enemy_damage: withStep(base.enemy_damage, boost.enemy_damage_step),
      need_decay: withStep(base.need_decay, boost.need_decay_step),
      prices: withStep(base.prices, boost.prices_step),
    }
  }

  autosave(): void {
    if (this.state.game_over) return
    // «путь железного человека»: на этом уровне сложности автосейвы выключены
    if (this.difficultyDef()?.no_autosave) return
    this.envelope = writeSave(this.campaign.meta.id, this.state, this.campaign.meta.version, this.envelope ?? undefined) ?? this.envelope
  }

  /**
   * Ручной сейв в слот игрока (аудит §5.6 п.9): перезаписывает слот.
   * Пермадет стирает автосейв, ручные слоты переживают забег — честный
   * «снимок на всякий случай», если мастер их не запретил (meta.save_slots).
   */
  manualSave(slot: number): boolean {
    if (this.state.game_over) return false
    const env = writeSave(this.campaign.meta.id, this.state, this.campaign.meta.version, undefined, slot)
    if (env) {
      this.pushLog(`Слот ${slot}: забег записан.`)
      this.notify()
    }
    return env !== null
  }

  /** сколько ручных слотов показывать игроку (мастер; умолчание 3) */
  saveSlotsCount(): number {
    return Math.max(0, Math.min(MAX_SAVE_SLOTS, this.campaign.meta.save_slots ?? 3))
  }
}

// ─────────────── save/load helpers ───────────────

export {
  saveKey,
  backupKey,
  preserveSave,
  openSave,
  inspectSave,
  peekSave,
  loadState,
  writeSave,
  exportSaveText,
  importSaveText,
  checkSaveVersion,
  SAVE_MIGRATIONS,
  OLDEST_SAVE_VERSION,
  slotKey,
  listSaveSlots,
  removeSave as removeSaveSlot,
  MAX_SAVE_SLOTS,
} from './savemigrate'
export type { SaveSlot, SaveSlotInfo } from './savemigrate'
export type { OpenedSave, SaveVerdict, SaveMigration } from './savemigrate'
export type { SaveReport, SaveNote, SaveEnvelope } from '../shared/types'

/**
 * Чтение сохранения без кампании: только перенос формата (`SAVE_MIGRATIONS`).
 * Полная проверка (версии кампании + починка ссылок) — `openSave`.
 */
export function loadSave(campaignId: string): GameState | null {
  return loadState(campaignId)
}

export function deleteSave(campaignId: string): void {
  removeSave(campaignId)
}

/**
 * Есть ли сохранение, с которым можно продолжить забег. Учитывает и перенос
 * формата, и вердикт по версиям кампании: неподдерживаемый сейв кнопкой
 * «Продолжить» не предлагается, но и не удаляется (`openSave` покажет причину).
 */
export function hasSave(campaignId: string, campaign?: CampaignData): boolean {
  if (!campaign) return loadState(campaignId) !== null
  const opened = inspectSave(campaignId, campaign)
  return !!opened && opened.verdict.kind === 'ok'
}
