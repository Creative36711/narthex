import type {
  DifficultyPreset,
  ArtDoc,
  CameraDoc,
  CampaignData,
  SaveEnvelope,
  CodexEntryDef,
  CutsceneDef,
  DiceRules,
  DurationActionDef,
  Effect,
  EncounterEntry,
  GameState,
  ItemDef,
  ItemInteractOption,
  LocationDef,
  AchievementDef,
  EventTableDef,
  GenWeightedItem,
  NpcGeneratorDef,
  FeatDef,
  MetaStoreState,
  MetaUnlockDef,
  NavigationZone,
  Condition,
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
  RuleDef,
  SkillDifficulty,
  WeaponData,
  NeedDef,

  ImageValue,
} from '../shared/types'
import { SAVE_VERSION, featureOn, startTick } from '../shared/types'
import {
  inspectSave,
  loadState,
  removeSave,
  writeSave,
  MAX_SAVE_SLOTS,
} from './savemigrate'
import { PRNG } from './prng'
import type { EngineCtx } from './context'
import { world, type SlotOccupant } from './world'
import { effects as effectSystem } from './effects'
import { sceneSlots } from './scene-slots'
import { needs } from './needs'
import { quests } from './quests'
import { party } from './party'
import { social } from './social'
import { inventory } from './inventory'
import { equipment } from './equipment'
export type { SlotOccupant } from './world'
import { derivedHP, derivedMP, movement, skillCheck, CHECK_RESULT_LABEL, difficultyModifier, difficultyLabel, type SkillCheckOutcome } from './brp'
import { rollDice } from './dice'
import { evalCondition } from './conditions'
import { timeOfDay } from './time'
import type { CharChoice } from './charcreate'
import type { Story } from 'inkjs'
import { bindExternals, createStory, drainStory, firstInkKnot, type DialogueUI, type DialogueHistoryEntry } from './dialogue'
import { skillLabel } from '../shared/skills'
import { playUi, playInteraction, stopSound } from '../shared/audio'
import { stopVoiceAudio } from '../shared/voiceAudio'

import { CombatController } from './combat'

/**
 * Game State Machine — ядро рантайма (ТЗ 2, 4).
 * Мутирует GameState; UI подписывается через onChange.
 */


export class GameEngine implements EngineCtx {
  [operation: string]: any

  readonly audio = { playUi, playInteraction, stopSound }
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
  /** накопленная история реплик и выборов текущего разговора (backlog) */
  dialogueHistory: DialogueHistoryEntry[] = []
  /**
   * Таймер на выбор в диалоге (фидбек 27, §9): ink-вызов
   * `~ set_dialogue_timer(15, "node_x")` задаёт дедлайн на текущем наборе
   * реплик. Пока он жив, плеер показывает полоску обратного отсчёта, а по
   * истечении вызывает `dialogueTimeout()`. Истёк без цели — разговор
   * заканчивается сам: игрок промолчал.
   */
  dialogueTimer: { seconds: number; knot?: string } | null = null
  /** таймер, объявленный ink-ом в текущем проходе до показа выбора */
  private pendingDialogueTimer: { seconds: number; knot?: string } | null = null
  /** ожидающий запрос предъявления предмета, объявленный ink-ом в текущем проходе */
  private pendingDialoguePresenting: { ok: string; fail: string; required?: string } | null = null
  combat: CombatController | null = null
  /** последняя ошибка запуска диалога (компиляция / отсутствующий узел) — для отладки и плейтеста */
  lastDialogueError: string | null = null
  /** открытая торговля: id NPC-торговца */
  trade: NpcDef | null = null
  /**
   * Запрос на открытие окна изготовления (эффект/реплика `open_craft`).
   * Плеер показывает панель крафта, пока поле не сброшено closeCraft().
   * `recipe` — рецепт, который надо подсветить (ремонт клапана и т.п.).
   */
  craftRequest: { recipe?: string } | null = null
  /** Конкретная сущность (верстак, плита, наковальня), у которой открыто окно крафта */
  craftSourceEntity: ItemDef | null = null
  /** транзитные всплывающие подсказки (не в сейве): «Получено: …» и т.п. — UI отображает и сам гасит */
  toasts: { id: number; text: string; kind: 'get' | 'lose' | 'info' }[] = []
  private toastSeq = 0

  /** Последняя осмотренная сущность (для панели отладки и режима инспектора) */
  inspectedEntityId: string | null = null

  inspectEntity(id: string | null): void {
    this.inspectedEntityId = id
    this.notify()
  }

  /** Сюжетное переопределение музыки (поверх текущей сцены/локации) */
  musicOverride: { tracks: string[]; fade?: number } | null = null

  setMusicOverride(tracks: string[], fade?: number): void {
    this.musicOverride = { tracks, fade }
    this.notify()
  }

  clearMusicOverride(): void {
    if (!this.musicOverride) return
    this.musicOverride = null
    this.notify()
  }

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
  freshRun: boolean
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

  /** EngineCtx logging boundary; retained as an alias for the existing log behavior. */
  log(text: string): void {
    this.pushLog(text)
  }

  /** подпись спикера реплики в истории диалога: явный # speaker — его имя, иначе собеседник */
  private dlgSpeakerLabel(line: { speaker?: string }, npc: NpcDef): string {
    if (!line.speaker) return npc.label
    const ent = this.campaign.entities[line.speaker] as NpcDef | undefined
    return ent?.label ?? npc.label
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
      tick: startTick(meta),
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
      seen_narrative_intros: [],
      known_npcs: [],
      log: [],
      game_over: null,
      stats_run: { travels: 0, dialogues: 0, ticks_survived: 0, kills: 0, quests_completed: 0 },
    }
  }

  /** Нужно ли показывать вводное повествование сцены (narrative_intro) */
  shouldShowNarrativeIntro(scene: SceneDef): boolean {
    if (!scene.narrative_intro || scene.narrative_intro.length === 0) return false
    const once = scene.narrative_intro_once ?? true
    if (!once) return true
    return !(this.state.seen_narrative_intros ?? []).includes(scene.id)
  }

  /** Активно ли сейчас нарративное вводное повествование сцены */
  isSceneIntroActive(): boolean {
    const sc = this.campaign.scenes[this.state.scene]
    if (!sc) return false
    return this.shouldShowNarrativeIntro(sc) && !this.cutscene && !this.dialogue && !this.combat
  }

  /** Пометить вводное повествование сцены как просмотренное */
  markNarrativeIntroSeen(sceneId: string): void {
    if (!this.state.seen_narrative_intros) this.state.seen_narrative_intros = []
    if (!this.state.seen_narrative_intros.includes(sceneId)) {
      this.state.seen_narrative_intros.push(sceneId)
      this.autosave()
    }
    // После завершения нарративного интро сцены активируем отложенную открытку или баннеры
    if (this.postcard && this.postcardPendingSeconds > 0 && !this.cutsceneQueue.length) {
      const at = this.postcardPendingSeconds
      this.postcardPendingSeconds = 0
      this.postcardTimer = globalThis.setTimeout(() => this.hidePostcard(), at * 1000)
    } else {
      this.flushPendingBannersIfClear()
    }
    this.notify()
  }

  /** Установить флаг (с поддержкой сброса при false) */
  setFlag(f: string, value: unknown = true): void {
    if (value === false || value === 0 || value === 'false') {
      delete this.state.flags[f]
    } else {
      this.state.flags[f] = (value as any) ?? true
    }
    if (!this.combat && !this.trade) this.checkRules()
    this.notify()
  }

  /** Сбросить флаг */
  clearFlag(f: string): void {
    delete this.state.flags[f]
    if (!this.combat && !this.trade) this.checkRules()
    this.notify()
  }

  /** Проверка присутствия спутника в отряде */
  inParty(entityId: string): boolean {
    return this.isInParty(entityId)
  }

  /** Вызывается один раз после создания/загрузки. */
  start(): void {
    // новый забег: правила, чьи условия выполнены с самого начала
    // (вступительная катсцена и т.п. — once + tick_elapsed 0)
    if (this.freshRun) {
      this.freshRun = false
      this.metaRunStart()
      this.checkRules()
      // Начальный тик времени и вход на стартовую сцену: запускают стартовые
      // правила с событийными триггерами (time_tick / enter_scene)
      this.fireTrigger('time_tick')
      this.fireTrigger('enter_scene', { sceneId: this.state.scene })
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
  private postcardTimer: ReturnType<typeof setTimeout> | null = null
  private postcardPendingSeconds = 0
  private bannerSerial = 1
  private bannerPendingTimers: Array<{ serial: number; seconds: number }> = []

  showBanner(e: { text: string; preset?: string; enter?: string; seconds?: number; position?: string; accent?: string }): void {
    const serial = this.bannerSerial++
    this.banners = [...this.banners, { serial, ...e }]
    const seconds = e.seconds ?? Math.min(8, Math.max(3, e.text.length * 0.06))
    if (this.cutsceneQueue.length > 0) {
      // Пока идет катсцена, таймер баннера ждет ее окончания
      this.bannerPendingTimers.push({ serial, seconds })
    } else {
      globalThis.setTimeout(() => {
        if (this.banners.some((b) => b.serial === serial)) {
          this.banners = this.banners.filter((b) => b.serial !== serial)
          this.notify()
        }
      }, seconds * 1000)
    }
    this.notify()
  }

  showPostcard(e: { image?: string; art?: ArtDoc; text?: string; preset?: string; seconds?: number; camera?: CameraDoc }): void {
    if (this.postcardTimer) {
      clearTimeout(this.postcardTimer)
      this.postcardTimer = null
    }
    this.postcard = { image: e.image, art: e.art, text: e.text, preset: e.preset, seconds: e.seconds, camera: e.camera }
    const at = Math.max(1, e.seconds ?? 6)
    if (this.cutsceneQueue.length > 0 || this.isSceneIntroActive()) {
      // Идет катсцена или нарративное интро сцены: открытка ждет завершения
      this.postcardPendingSeconds = at
    } else if ((e.seconds ?? 6) > 0) {
      this.postcardPendingSeconds = 0
      this.postcardTimer = globalThis.setTimeout(() => this.hidePostcard(), at * 1000)
    }
    this.notify()
  }

  /** закрыть «открытку» (тап или таймер) */
  hidePostcard(): void {
    if (this.postcardTimer) {
      clearTimeout(this.postcardTimer)
      this.postcardTimer = null
    }
    this.postcardPendingSeconds = 0
    if (!this.postcard) return
    this.postcard = null
    this.flushPendingBannersIfClear()
    this.notify()
  }

  private flushPendingBannersIfClear(): void {
    if (!this.cutsceneQueue.length && !this.isSceneIntroActive() && !this.postcard && !this.messages.length) {
      if (this.bannerPendingTimers.length) {
        for (const item of this.bannerPendingTimers) {
          globalThis.setTimeout(() => {
            if (this.banners.some((b) => b.serial === item.serial)) {
              this.banners = this.banners.filter((b) => b.serial !== item.serial)
              this.notify()
            }
          }, item.seconds * 1000)
        }
        this.bannerPendingTimers = []
      }
    }
  }

  playCutscene(id: string): void {
    const def = this.campaign.cutscenes?.[id]
    if (!def || !def.slides?.length) return
    if (this.cutsceneQueue.some((c) => c.def.id === id)) return
    stopVoiceAudio()
    this.cutsceneQueue.push({ def, serial: ++this.cutsceneSerial })
    this.pushLog(`Катсцена: «${def.label}»`)
    this.notify()
  }

  /** катсцена досмотрена или пропущена */
  endCutscene(): void {
    if (!this.cutsceneQueue.length) return
    stopVoiceAudio()
    this.cutsceneQueue.shift()
    if (!this.cutsceneQueue.length) {
      // Если интро сцены не активно и открытка ждала — запускаем открытку
      if (!this.isSceneIntroActive()) {
        if (this.postcard && this.postcardPendingSeconds > 0) {
          const at = this.postcardPendingSeconds
          this.postcardPendingSeconds = 0
          this.postcardTimer = globalThis.setTimeout(() => this.hidePostcard(), at * 1000)
        }
        this.flushPendingBannersIfClear()
      }
      this.checkRules()
      this.autosave()
    }
    this.notify()
  }

  // ─────────────── время, потребности и статусы ───────────────
  advanceTicks(ticks: number): void { needs.advanceTicks(this, ticks, { tickPursuit: () => this.tickPursuit(), tickNpcMood: () => this.tickNpcMood(), tickEventTables: () => this.tickEventTables() }) }
  changeNeed(needId: string, delta: number): void { needs.changeNeed(this, needId, delta) }
  changeHp(delta: number): void { needs.changeHp(this, delta) }
  restHeal(): { hp: number; mpFull: boolean } { return needs.restHeal(this) }
  statusDef(id: string): StatusDef | undefined { return needs.statusDef(this, id) }
  hasStatus(id: string): boolean { return needs.hasStatus(this, id) }
  applyStatus(_target: 'player', id: string, duration?: number): void { needs.applyStatus(this, _target, id, duration) }
  removeStatus(_target: 'player', id: string): void { needs.removeStatus(this, _target, id) }
  statusSkillMod(skill: string): number { return needs.statusSkillMod(this, skill) }

  // ─────────────── инвентарь, экипировка и груз ───────────────
  hasItem(id: string): boolean { return inventory.hasItem(this, id) }
  itemCount(id: string): number { return inventory.itemCount(this, id) }
  addItem(id: string, quantity = 1, opts: { silent?: boolean; freshness?: number } = {}): void { inventory.addItem(this, id, quantity, opts) }
  removeItem(id: string, quantity = 1, opts: { silent?: boolean; verb?: string } = {}): void { inventory.removeItem(this, id, quantity, opts) }
  itemMaxDurability(itemId: string): number | undefined { return inventory.itemMaxDurability(this, itemId) }
  itemDurabilityOf(id: string): { left: number; max: number } | null { return inventory.itemDurabilityOf(this, id) }
  isItemUsable(id: string): boolean { return inventory.isItemUsable(this, id) }
  durabilityEntries(id: string): Array<{ entry: { item: string; quantity: number; durability?: number }; left: number }> { return inventory.durabilityEntries(this, id) }
  damageItemDurability(itemId: string, amount = 1): boolean { return inventory.damageItemDurability(this, itemId, amount) }
  repairItem(itemId: string): boolean { return inventory.repairItem(this, itemId) }
  hasDamaged(itemId: string): boolean { return inventory.hasDamaged(this, itemId) }
  equipmentSlots(): Array<{ id: string; label: string }> { return equipment.equipmentSlots(this) }
  slotLabel(slotId: string): string { return equipment.slotLabel(this, slotId) }
  itemSlot(id: string): string | undefined { return equipment.itemSlot(this, id) }
  isEquipped(id: string): boolean { return equipment.isEquipped(this, id) }
  equippedSlotOf(id: string): string { return equipment.equippedSlotOf(this, id) }
  equipItem(id: string): void { equipment.equipItem(this, id) }
  unequipItem(slot: string): void { equipment.unequipItem(this, slot) }
  playerWeapon(): { itemId: string | null; weapon: WeaponData; label: string } { return equipment.playerWeapon(this) }
  playerArmor(): { itemId: string | null; points: number; label: string } { return equipment.playerArmor(this) }
  useItem(id: string): void { equipment.useItem(this, id) }
  currentLoad(): number { return equipment.currentLoad(this) }
  maxLoadDetails(): ReturnType<typeof equipment.maxLoadDetails> { return equipment.maxLoadDetails(this) }
  maxLoad(): number { return equipment.maxLoad(this) }
  encumbranceStatus(): 'normal' | 'light' | 'heavy' | 'critical' { return equipment.encumbranceStatus(this) }
  encumbranceDebuffs(): ReturnType<typeof equipment.encumbranceDebuffs> { return equipment.encumbranceDebuffs(this) }
  isOverloaded(): boolean { return equipment.isOverloaded(this) }
  isTravelBlockedByOverload(): boolean { return equipment.isTravelBlockedByOverload(this) }
  // ─────────────── репутация и фракции (ТЗ 4.8) ───────────────

  /**
   * target: id фракции или id NPC.
   * У NPC: base_disposition + личный сдвиг (dispositions[npc.id]) + фракция
   * (если задана) + самочувствие. Личный сдвиг нужен накигэ/драмам, где
   * отношение к человеку важнее «города» — раньше без faction delta глотался.
   */
  getDisposition(target: string): number { return social.getDisposition(this, target) }

  /** самочувствие NPC (0..100, умолчание 50): усталость от пропуска ночёвки по расписанию */
  /**
   * Ключ состояния облика героя: первый активный статус с совпадающим
   * ключом в meta.emotions… но практичнее — известные ключи по порядку:
   * статус из списка активных, иначе 'wounded' (HP < 50%), 'tired' (любая
   * потребность ≤ 25), иначе 'neutral'. Ключи — из реестра состояний мастера.
   */
  heroPortraitStateKey(): string { return sceneSlots.heroPortraitStateKey.call(this) }

  /**
   * Стек изображений портрета героя (низ → верх) с учётом состояния:
   * галерея — один кадр; слои — кадры выбранных вариантов по порядку
   * сегментов мастера; вариант облика под ключ состояния меняет кадр,
   * если мастер задал такую запись. Пусто — портрета нет.
   */
  heroPortraitImages(): ImageValue[] { return sceneSlots.heroPortraitImages.call(this) }

  /** Статичная боевая фигурка выбирается только из постоянного облика при создании. */
  heroCombatFigure(): {
    figure?: ImageValue
    mode?: 'topdown' | 'side' | 'static'
    offset?: number
  } { return sceneSlots.heroCombatFigure.call(this) }

  npcMood(entityId: string): number { return social.npcMood(this, entityId) }

  /** сдвинуть самочувствие NPC (правила/эффекты; K.D. clamp 0..100) */
  changeNpcMood(entityId: string, delta: number): void { social.changeNpcMood(this, entityId, delta) }

  changeDisposition(target: string, delta: number): void { social.changeDisposition(this, target, delta) }

  // ─────────────── квесты (ТЗ 3.7) ───────────────

  startQuest(questId: string): void { quests.startQuest(this, questId) }

  advanceQuestTo(questId: string, stageId: string): void { quests.advanceQuestTo(this, questId, stageId) }

  journalUpdate(questId: string, textKey: string): void { quests.journalUpdate(this, questId, textKey) }


  // ─────────────── напарники (ТЗ 4.11) ───────────────

  joinParty(entityId: string): void { party.joinParty(this, entityId) }

  /** Текущее значение потребности напарника; null — не в отряде или у существа
   *  потребность не отслеживается… но по контракту «робот не голодает»
   *  неотслеживаемая потребность возвращается максимальной, а не null. */
  companionNeed(entity: string, needId: string): number | null { return party.companionNeed(this, entity, needId) }

  /** Сдвиг потребности напарника; переход через ноль — заметка в лог (без game over). */
  changeCompanionNeed(entity: string, needId: string, delta: number): void { party.changeCompanionNeed(this, entity, needId, delta) }

  /** Набор отслеживаемых напарником потребностей (для UI): определения из meta.needs. */
  companionNeedDefs(entity: string): NeedDef[] { return party.companionNeedDefs(this, entity) }

  // ── «вторая сумка» напарника (NpcDef.companion_carry) ──

  /** Груз в сумке напарника, кг. */
  companionLoad(entity: string): number { return party.companionLoad(this, entity) }

  /** Грузоподъёмность напарника: та же формула энкадменса, что у героя,
   *  но по характеристикам существа (его carry_capacity_bonus/mult учтены). */
  companionCapacity(entity: string): number { return party.companionCapacity(this, entity) }

  /** Передать предмет из сумки героя напарнику (нужны оба: в отряде, companion_carry).
   *  Сюжетные предметы (quest_item) — как выбросить и продать — отдать нельзя:
   *  уход или гибель напарника не должна стирать критические вещи навсегда.
   *  `opts.forceQuest` — только для сюжетных эффектов (transfer_to_companion):
   *  мастер сам решает отдать квестовый предмет скриптом. */
  giveItemToCompanion(entity: string, itemId: string, quantity = 1, opts: { forceQuest?: boolean } = {}): boolean { return party.giveItemToCompanion(this, entity, itemId, quantity, opts) }

  /** Забрать предмет из сумки напарника себе. */
  takeItemFromCompanion(entity: string, itemId: string, quantity = 1): boolean { return party.takeItemFromCompanion(this, entity, itemId, quantity) }

  /** Надеть/снять предмет из сумки напарника на слот экипировки (null — снять). */
  equipCompanionItem(entity: string, slotId: string, itemId: string | null): void { party.equipCompanionItem(this, entity, slotId, itemId) }

  /** Применить предмет из сумки героя к напарнику: перенаправляет on_use-эффекты
   *  «здоровье» (change_hp) и «потребности» (change_need) на напарника, остальные
   *  эффекты игнорируются; расход предмета — как у героя (on_use.consume). */
  useItemOnCompanion(entity: string, itemId: string): boolean { return party.useItemOnCompanion(this, entity, itemId) }

  /** Напарник покидает отряд (отпустить, скрипт, гибель в бою).
   *  Его сумка возвращается герою — иначе переданные вещи стирались бы навсегда
   *  (до этого так и было: мягкая блокировка при гибели носильщика). */
  leaveParty(entityId: string): void { party.leaveParty(this, entityId) }

  isInParty(entityId: string): boolean { return party.isInParty(this, entityId) }

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
  reputation(): number { return social.reputation(this) }

  /** репутация включена мастером */
  /** Настраиваемая системная надпись интерфейса (design-doc §9, meta.ui_labels) */
  uiLabel(key: string, fallback: string): string { return social.uiLabel(this, key, fallback) }

  reputationEnabled(): boolean { return social.reputationEnabled(this) }

  reputationLabel(): string { return social.reputationLabel(this) }

  changeReputation(delta: number): void { social.changeReputation(this, delta) }

  /** шкала достатка (opt-in meta.wealth_levels) */
  wealthLevels(): string[] { return social.wealthLevels(this) }

  /** текущий уровень достатка (индекс в шкале) */
  wealthLevel(): number { return social.wealthLevel(this) }

  wealthLevelLabel(): string { return social.wealthLevelLabel(this) }

  /** сдвиг достатка на ±levels ступеней */
  changeWealth(levels: number): void { social.changeWealth(this, levels) }

  /** страсть: значение 0..100+ */
  passion(id: string): number { return social.passion(this, id) }

  passionLabel(id: string): string { return social.passionLabel(this, id) }

  /** создать/сдвинуть страсть (clamped ≥ 0); лог первого появления */
  changePassion(id: string, delta: number): void { social.changePassion(this, id, delta) }

  /** очки причастности силе */
  allegiance(id: string): number { return social.allegiance(this, id) }

  allegianceLabel(id: string): string { return social.allegianceLabel(this, id) }

  /** +очки причастности (по книге без снижения, дельта 0..100+) */
  changeAllegiance(id: string, points: number): void { social.changeAllegiance(this, id, points) }

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

  /** каноническое имя характеристики (всегда на латинице: STR, CON, SIZ, DEX, INT, POW, CHA, EDU) */
  statLabel(stat: string): string {
    return stat.toUpperCase()
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
  applyFall(meters: number, skill?: string): void { social.applyFall(this, meters, skill) }

  /** реестр преступления из кампании */
  crimeLabel(id: string): string { return social.crimeLabel(this, id) }

  /** зафиксировать преступление героя (аудит B7) */
  commitCrime(id: string, bounty = 0): void { social.commitCrime(this, id, bounty) }

  /** преступление совершено? (любое — без id; minBounty — порог награды) */
  hasCrime(id?: string, minBounty = 0): boolean { return social.hasCrime(this, id, minBounty) }

  /** суммарная награда за голову героя */
  bountyTotal(): number { return social.bountyTotal(this) }

  /** активные ценовые события */
  priceEventsActive(): Array<{ id: string; label: string }> { return social.priceEventsActive(this) }

  /** включить/выключить ценовое событие (аудит B7) */
  setPriceEvent(id: string, on: boolean): void { social.setPriceEvent(this, id, on) }

  /** множитель цен по активным ценовым событиям для данного предмета */
  priceEventMultiplier(item: ItemDef): number { return social.priceEventMultiplier(this, item) }

  /** разрешён ли здесь лагерь (аудит B7): meta.camping + локация с camp: true */
  campAvailable(): { ok: boolean; reason: string } { return social.campAvailable(this) }

  /**
   * Ночлег в лагере (аудит B7): advanceTicks(cfg.ticks), рост навыков,
   * естественное лечение, возможная засада — правило мастера
   * (meta.camping.ambush_rule, шанс ambush_chance). Восстановление
   * потребностей — опционально, meta.camping.restore (аудит кампании 2026):
   * применяется ПОСЛЕ хода времени через changeNeed (общий стол для плюса).
   */
  // ─────────────── длительные действия (dz.20) ───────────────

  /**
   * Запрос окна выбора длительности (сон и т.п.). Не сохраняется в сейв:
   * если игрок закрыл игру с открытым окном — действие просто не началось.
   */
  durationRequest: { kind: 'camp' } | { kind: 'action'; action: DurationActionDef } | null = null

  /** Типы эффектов, разрешённых в почасовом per_tick (белый список dz.20). */
  private static readonly DURATION_TICK_EFFECTS = new Set([
    'change_need', 'change_hp', 'change_fatigue', 'change_sanity',
  ])

  private applyTickEffects(effects: Effect[] | undefined, skipped: { done: boolean }): void {
    if (!effects) return
    for (const fx of effects) {
      if (!GameEngine.DURATION_TICK_EFFECTS.has(fx.type)) {
        if (!skipped.done) {
          this.pushLog(`Двигатель: эффект '${fx.type}' не входит в белый список длительного действия и пропущен.`)
          skipped.done = true
        }
        continue
      }
      this.applyEffect(fx)
    }
  }

  /**
   * Общий цикл «провести N тиков»: почасовое применение per_tick ДО
   * тикания потребностей, честные почасовые прерывания, стан-условия
   * break_when, эффекты on_finish — только при полном завершении.
   * Смерть/конец игры посреди цикла обрывают действие (on_zero_effect
   * потребностей и смертельный урон честны: «умереть во сне» возможно).
   */
  private runTicksFlow(opts: {
    label: string
    ticks: number
    perTick?: Effect[]
    interruptChance?: number
    interruptRule?: string
    breakWhen?: Condition[]
    onFinish?: Effect[]
    after?: () => void
  }): void {
    const skipped = { done: false }
    for (let i = 0; i < opts.ticks; i++) {
      if (this.state.game_over) return
      this.applyTickEffects(opts.perTick, skipped)
      this.advanceTicks(1)
      if (this.state.game_over) return
      if (opts.breakWhen && opts.breakWhen.some((c) => evalCondition(c, this))) {
        this.interruptTicksFlow(opts.label, opts.interruptRule, i + 1)
        return
      }
      if ((opts.interruptChance ?? 0) > 0 && this.rng.chance(opts.interruptChance!)) {
        this.interruptTicksFlow(opts.label, opts.interruptRule, i + 1)
        return
      }
    }
    opts.after?.()
    if (opts.onFinish) {
      for (const fx of opts.onFinish) this.applyEffect(fx)
    }
    this.pushLog(`${opts.label} завершено: прошло ${opts.ticks} ч.`)
    this.autosave()
    this.notify()
  }

  private interruptTicksFlow(label: string, rule: string | undefined, afterTicks: number): void {
    this.pushLog(`${label} прервано на ${afterTicks}-м часу: что-то пошло не по плану.`)
    if (rule) this.fireRule(rule)
    this.autosave()
    this.notify()
  }

  /** Границы/параметры текущего запроса — читает UI-окно выбора. */
  durationRequestInfo(): {
    label: string
    min: number
    max: number
    step: number
    perTick?: Effect[]
    interruptChance: number
    startTick: number
  } | null {
    const req = this.durationRequest
    if (!req) return null
    if (req.kind === 'camp') {
      const cfg = this.campaign.meta.camping
      if (!cfg) return null
      const min = Math.max(1, Math.floor(cfg.min_ticks ?? cfg.ticks ?? 8))
      return {
        label: 'Ночлег',
        min,
        max: Math.max(min, Math.floor(cfg.max_ticks ?? cfg.ticks ?? 8)),
        step: 1,
        perTick: cfg.per_tick,
        interruptChance: 0,
        startTick: this.state.tick,
      }
    }
    const def = req.action
    const min = Math.max(1, Math.floor(def.min_ticks ?? 1))
    return {
      label: def.label,
      min,
      max: Math.max(min, Math.floor(def.max_ticks ?? min)),
      step: Math.max(1, Math.floor(def.step ?? 1)),
      perTick: def.per_tick,
      interruptChance: Math.max(0, Math.min(1, def.interrupt_chance_per_tick ?? 0)),
      startTick: this.state.tick,
    }
  }

  cancelDurationRequest(): void {
    if (!this.durationRequest) return
    this.durationRequest = null
    this.notify()
  }

  /** Игрок подтвердил длину в окне выбора. */
  confirmDurationRequest(ticks: number): void {
    const req = this.durationRequest
    if (!req) return
    this.durationRequest = null
    if (req.kind === 'camp') { this.campRest(ticks); return }
    this.runDurationAction(req.action, ticks)
  }

  /** Игрок нажал «Разбить лагерь»: всегда через окно выбора (при фиксированной длине — как окно подтверждения с прогнозом). */
  requestCampRest(): void {
    const cfg = this.campaign.meta.camping
    if (!cfg || !this.campAvailable().ok) return
    this.durationRequest = { kind: 'camp' }
    this.notify()
  }

  /**
   * Запуск длительного действия из реестра (эффект start_duration_action).
   * ticks задан — запуск немедленно; не задан — окно выбора (или мгновенный
   * запуск при фиксированной длине min == max). Недоступное (available_when
   * ложно) действие молча отказывает: контент должен был скрыть вариант.
   */
  requestDurationAction(id: string, ticks?: number | null): void {
    const def = (this.campaign.meta.duration_actions ?? []).find((d) => d.id === id)
    if (!def) {
      this.pushLog(`Двигатель: длительное действие '${id}' не найдено в реестре кампании.`)
      this.notify()
      return
    }
    if (def.available_when && !def.available_when.every((c) => evalCondition(c, this))) return
    const min = Math.max(1, Math.floor(def.min_ticks ?? 1))
    const max = Math.max(min, Math.floor(def.max_ticks ?? min))
    if (ticks != null && ticks > 0) { this.runDurationAction(def, ticks); return }
    if (max === min) { this.runDurationAction(def, min); return }
    this.durationRequest = { kind: 'action', action: def }
    this.notify()
  }

  /** Выполнить длительное действие (с клампом длины в min..max и выравниванием по step). */
  runDurationAction(def: DurationActionDef, ticks: number): void {
    const min = Math.max(1, Math.floor(def.min_ticks ?? 1))
    const max = Math.max(min, Math.floor(def.max_ticks ?? min))
    const step = Math.max(1, Math.floor(def.step ?? 1))
    let chosen = Math.min(max, Math.max(min, Number.isFinite(ticks) ? Math.floor(ticks) : min))
    chosen = Math.min(max, min + step * Math.round((chosen - min) / step))
    if (def.available_when && !def.available_when.every((c) => evalCondition(c, this))) return
    this.pushLog(`${def.label}: начало — ${chosen} ч.`)
    this.runTicksFlow({
      label: def.label,
      ticks: chosen,
      perTick: def.per_tick,
      interruptChance: Math.max(0, Math.min(1, def.interrupt_chance_per_tick ?? 0)),
      interruptRule: def.interrupt_rule,
      breakWhen: def.break_when,
      onFinish: def.on_finish,
    })
  }

  campRest(ticks?: number): void {
    const cfg = this.campaign.meta.camping
    if (!cfg || !this.campAvailable().ok) return
    const min = Math.max(1, Math.floor(cfg.min_ticks ?? cfg.ticks ?? 8))
    const max = Math.max(min, Math.floor(cfg.max_ticks ?? cfg.ticks ?? 8))
    const chosen = Math.min(max, Math.max(min, Math.floor(ticks ?? cfg.ticks ?? 8)))
    this.pushLog('Вы разбиваете лагерь и устраиваетесь на ночлег…')
    this.runTicksFlow({
      label: 'Ночлег',
      ticks: chosen,
      perTick: cfg.per_tick,
      after: () => {
        this.restAndGrow()
        this.restHeal()
        if (cfg.restore) {
          for (const [needId, v] of Object.entries(cfg.restore)) {
            if (v !== 0) this.changeNeed(needId, v)
          }
        }
        const chance = Math.max(0, Math.min(1, cfg.ambush_chance ?? 0))
        if (chance > 0 && this.rng.chance(chance)) {
          this.pushLog('Ночью — тревога! В лагерь кто-то прокрался!')
          if (cfg.ambush_rule) this.fireRule(cfg.ambush_rule)
        } else {
          this.pushLog('Ночь прошла спокойно.')
        }
      },
    })
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
  applyByCheck(outcome: SkillCheckOutcome, describe: string, retry: () => SkillCheckOutcome, onOk: () => void, onFail: () => void): boolean {
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
      this.pushLog('Вы переходите на скрытное передвижение. Бросок скрытности при смене сцены...')
      this.detectCheck('вы появляетесь в поле зрения')
    } else {
      this.pushLog('Вы больше не скрываетесь.')
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
      `Скрытность (${context}): ваш ${mine.result} (d100=${mine.roll}/${hero}) против «${bestNpc.label}» ${theirs.result} (d100=${theirs.roll}/${bestNpc.value}) → ${wins ? 'вас не заметили' : 'ВАС ЗАМЕТИЛИ!'}`,
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
    this.dialogueTimer = null
    this.trade = npc
    this.notify()
  }

  closeTrade(): void {
    this.trade = null
    this.autosave()
    this.notify()
  }

  /**
   * Открыть окно изготовления по ходу игры (эффект `open_craft`, реплика
   * `~ open_craft("recipe_id")`). Неизвестный или незаданный рецепт — просто
   * открывается список: рецепт может открыться позже эффектом unlock_recipe.
   * Разговор и торговля при этом закрываются, как у `open_trade`.
   */
  openCraft(recipeId?: string, sourceEntity?: ItemDef): void {
    if (!featureOn(this.campaign.meta, 'inventory')) return
    const known = recipeId && this.knownRecipes().some((r) => r.id === recipeId)
    this.dialogue = null
    this.dialogueTimer = null
    this.activeStory = null
    this.activeNpc = null
    this.trade = null
    if (sourceEntity) this.craftSourceEntity = sourceEntity
    this.craftRequest = { recipe: known ? recipeId : undefined }
    this.notify()
  }

  closeCraft(): void {
    this.craftRequest = null
    this.craftSourceEntity = null
    this.autosave()
    this.notify()
  }

  // ─────────────── таймер выбора в диалоге ───────────────

  /**
   * Ink-вызов `~ set_dialogue_timer(секунды, "узел")`: сколько секунд игрок
   * может думать над ответами и куда уйти, если он промолчал. Пустой узел —
   * по истечении разговор заканчивается. `0` снимает таймер.
   * Действует, только если на узле есть варианты ответа.
   */
  setDialogueTimer(seconds: number, knot?: string): void {
    const s = Math.floor(Number(seconds) || 0)
    this.pendingDialogueTimer = s > 0 ? { seconds: s, knot: knot ? String(knot) : undefined } : null
  }

  /**
   * Зафиксировать таймер, объявленный ink-ом в этом проходе: он живёт, пока
   * игроку показаны варианты ответа. Без вариантов таймер снимается, а
   * забытый ink-ом таймер не «переезжает» на следующую реплику.
   */
  private commitDialogueTimer(_choices?: number): void {
    const next = this.pendingDialogueTimer
    this.pendingDialogueTimer = null
    this.dialogueTimer = next ? next : null
  }

  /** Истёк таймер: уходим в назначенный узел или заканчиваем разговор. */
  dialogueTimeout(): void {
    const t = this.dialogueTimer
    const story = this.activeStory
    this.dialogueTimer = null
    if (!t || !story || !this.dialogue) return
    if (!t.knot) {
      this.pushLog('Разговор оборвался: вы слишком долго молчали.')
      this.endDialogue()
      return
    }
    try {
      story.ChoosePathString(t.knot)
    } catch {
      this.pushLog(`Узел «${t.knot}» для таймера не найден — разговор заканчивается.`)
      this.endDialogue()
      return
    }
    this.pushLog('Вы слишком долго молчали — собеседник перевёл разговор на своё.')
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : this.dlgSpeakerLabel(l, this.dialogue.npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    if (this.combat || this.trade || this.craftRequest || this.state.game_over || !this.activeStory) {
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
      this.notify()
      return
    }
    this.dialogue = {
      npc: this.dialogue.npc,
      lines: drained.lines,
      choices: drained.choices,
      finished: drained.finished,
      history: [...this.dialogueHistory],
    }
    this.commitDialogueTimer(drained.choices.length)
    this.commitDialoguePresenting()
    this.dialogue.timer = this.dialogueTimer ?? undefined
    this.notify()
  }

  // ─────────────── предъявление предмета в диалоге ───────────────

  /**
   * Ink-вызов `~ present_item("ok_knot", "fail_knot", "required_item")`:
   * предлагает игроку выбрать предмет из инвентаря для предъявления собеседнику.
   */
  promptPresentItem(okKnot: string, failKnot: string, required?: string): void {
    this.pendingDialoguePresenting = { ok: okKnot, fail: failKnot, required: required || undefined }
  }

  private commitDialoguePresenting(): void {
    const next = this.pendingDialoguePresenting
    this.pendingDialoguePresenting = null
    if (this.dialogue) {
      this.dialogue.presenting = next ? next : undefined
    }
  }

  /**
   * Игрок выбрал предмет для предъявления (или отменил выбор: itemId === null).
   */
  submitPresentedItem(itemId: string | null): void {
    const pres = this.dialogue?.presenting
    const story = this.activeStory
    if (!pres || !story || !this.dialogue) return
    this.dialogue.presenting = undefined
    if (itemId) {
      playUi('dialogue_present')
      const itDef = this.campaign.entities[itemId] as ItemDef | undefined
      this.dialogueHistory.push({
        speaker: this.state.player.name || 'Вы',
        text: `[Предъявлено: ${itDef?.label || itemId}]`,
        isChoice: true,
      })
    } else {
      playUi('click')
      this.dialogueHistory.push({
        speaker: this.state.player.name || 'Вы',
        text: '[Ничего не предъявлено]',
        isChoice: true,
      })
    }
    const success = itemId ? (!pres.required || pres.required === itemId) : false
    const targetKnot = success ? pres.ok : pres.fail
    try {
      story.ChoosePathString(targetKnot)
    } catch {
      this.pushLog(`Узел «${targetKnot}» для результата предъявления не найден.`)
      this.endDialogue()
      return
    }
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : this.dlgSpeakerLabel(l, this.dialogue.npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    if (this.combat || this.trade || this.craftRequest || this.state.game_over || !this.activeStory) {
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
      this.notify()
      return
    }
    this.dialogue = {
      npc: this.dialogue.npc,
      lines: drained.lines,
      choices: drained.choices,
      finished: drained.finished,
      history: [...this.dialogueHistory],
    }
    this.commitDialogueTimer(drained.choices.length)
    this.commitDialoguePresenting()
    this.dialogue.timer = this.dialogueTimer ?? undefined
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
    if (item?.quest_item) return 0
    const base = item?.value?.[this.mainCurrency] ?? 0
    const rate = npc.trader?.buy_rate ?? 0.4
    const dynamic = item ? this.priceEventMultiplier(item) : 1
    return Math.max(0, Math.floor((base * rate * dynamic) / this.priceModifier(npc)))
  }

  /** полный список продаваемых торговцем товаров, включая выкупленные у игрока */
  traderSells(npc: NpcDef): Array<{ item: string; price?: number; stock?: number }> {
    if (!npc.trader) return []
    const base = [...npc.trader.sells]
    const bought = this.state.trader_bought_items?.[npc.id] ?? []
    for (const b of bought) {
      if (!base.some((s) => s.item === b.item)) {
        base.push(b)
      }
    }
    return base
  }

  /** текущий остаток товара на складе торговца (undefined — бесконечный запас) */
  traderItemStock(npcId: string, itemId: string): number | undefined {
    const npc = this.campaign.entities[npcId] as NpcDef | undefined
    if (!npc?.trader) return undefined
    const traderSaved = this.state.trader_stocks?.[npcId]
    if (traderSaved && itemId in traderSaved) {
      return traderSaved[itemId]
    }
    const sellDef = npc.trader.sells.find((s) => s.item === itemId)
    if (sellDef && sellDef.stock !== undefined) return sellDef.stock
    const boughtDef = (this.state.trader_bought_items?.[npcId] ?? []).find((s) => s.item === itemId)
    if (boughtDef && boughtDef.stock !== undefined) return boughtDef.stock
    return undefined
  }

  buyItem(itemId: string, price: number): boolean {
    const currencyItem = this.currencyItemId()
    if (this.itemCount(currencyItem) < price) return false

    if (this.trade) {
      const stock = this.traderItemStock(this.trade.id, itemId)
      if (stock !== undefined && stock <= 0) return false
    }

    this.removeItem(currencyItem, price, { silent: true })
    this.addItem(itemId, 1, { silent: true })

    if (this.trade) {
      const stock = this.traderItemStock(this.trade.id, itemId)
      if (stock !== undefined) {
        if (!this.state.trader_stocks) this.state.trader_stocks = {}
        if (!this.state.trader_stocks[this.trade.id]) this.state.trader_stocks[this.trade.id] = {}
        this.state.trader_stocks[this.trade.id][itemId] = Math.max(0, stock - 1)
      }
    }

    this.markSkill('bargain')
    playUi('coin')
    this.notify()
    return true
  }

  sellItem(itemId: string, price: number): boolean {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    if (item?.quest_item) return false
    if (this.itemCount(itemId) < 1) return false
    this.removeItem(itemId, 1, { silent: true })
    this.addItem(this.currencyItemId(), price, { silent: true })

    // Добавляем проданный предмет торговцу для обратного выкупа
    if (this.trade) {
      const traderId = this.trade.id
      const npc = this.campaign.entities[traderId] as NpcDef | undefined
      if (npc?.trader) {
        const inBase = npc.trader.sells.some((s) => s.item === itemId)
        if (inBase) {
          const curStock = this.traderItemStock(traderId, itemId)
          if (curStock !== undefined) {
            if (!this.state.trader_stocks) this.state.trader_stocks = {}
            if (!this.state.trader_stocks[traderId]) this.state.trader_stocks[traderId] = {}
            this.state.trader_stocks[traderId][itemId] = curStock + 1
          }
        } else {
          if (!this.state.trader_bought_items) this.state.trader_bought_items = {}
          if (!this.state.trader_bought_items[traderId]) this.state.trader_bought_items[traderId] = []
          const existing = this.state.trader_bought_items[traderId].find((s) => s.item === itemId)
          const curStock = this.traderItemStock(traderId, itemId) ?? 0
          const nextStock = curStock + 1
          if (!existing) {
            this.state.trader_bought_items[traderId].push({ item: itemId, stock: nextStock })
          } else {
            existing.stock = nextStock
          }
          if (!this.state.trader_stocks) this.state.trader_stocks = {}
          if (!this.state.trader_stocks[traderId]) this.state.trader_stocks[traderId] = {}
          this.state.trader_stocks[traderId][itemId] = nextStock
        }
      }
    }

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

  /** доступен ли конкретный верстак / рабочее место в текущем контексте */
  isWorkbenchAvailable(workbenchReq?: boolean | string): boolean {
    if (!workbenchReq) return true

    // Если запрошен конкретный id предмета или категория
    if (typeof workbenchReq === 'string') {
      // 1. Проверяем источник текущего открытого окна крафта
      if (this.craftSourceEntity) {
        if (this.craftSourceEntity.id === workbenchReq || this.craftSourceEntity.category === workbenchReq) {
          return true
        }
      }
      // 2. Текущая сцена: есть ли в сцене предмет с таким id или категорией
      const sc = this.campaign.scenes[this.state.scene]
      if (sc) {
        const occupants = this.slotOccupants(sc)
        for (const occ of occupants) {
          if (!occ.entity) continue
          const it = occ.entity as ItemDef
          if (it.id === workbenchReq || it.category === workbenchReq) return true
          if (occ.slot.type.includes(workbenchReq)) return true
        }
      }
      // 3. Текущая локация
      const loc = this.findLocation(this.state.location)?.location
      if (loc && (loc as unknown as Record<string, unknown>)[workbenchReq]) return true

      return false
    }

    // Если workbenchReq === true — подходит любое рабочее место
    // 1. Окно крафта открыто по запросу у верстака
    if (this.craftRequest || this.craftSourceEntity) return true

    // 2. Текущая сцена
    const sc = this.campaign.scenes[this.state.scene]
    if (sc) {
      if ((sc as unknown as { workbench?: boolean }).workbench) return true
      const occupants = this.slotOccupants(sc)
      for (const occ of occupants) {
        if (!occ.entity) continue
        const it = occ.entity as ItemDef
        if (it.id === 'item_bench' || it.category === 'workbench') return true
        if (occ.slot.type.includes('workbench')) return true
        if (it.interact_options?.some((o) => o.effects?.some((ef) => ef.type === 'open_craft'))) return true
      }
    }

    // 3. Текущая локация
    const loc = this.findLocation(this.state.location)?.location
    if (loc && (loc as unknown as { workbench?: boolean }).workbench) return true

    return false
  }

  /** Название рабочего места для подсказки в интерфейсе */
  workbenchLabel(req?: boolean | string): string {
    if (!req) return ''
    if (req === true) return 'Верстак или мастерская'
    if (typeof req === 'string') {
      const ent = this.campaign.entities[req]
      if (ent) return ent.label
      const cat = this.campaign.meta.item_categories?.find((c) => c.id === req)
      if (cat) return cat.label
      return req
    }
    return ''
  }

  /** чего не хватает для рецепта: компоненты, инструменты, условия, верстак */
  recipeMissing(r: RecipeDef): string[] {
    const missing: string[] = []
    if (r.workbench && !this.isWorkbenchAvailable(r.workbench)) {
      missing.push(`требуется: ${this.workbenchLabel(r.workbench)}`)
    }
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
        // время промаха (экономика попыток): мастерская работа заполняет часы и при неудаче
        const spent = Math.max(0, Math.floor(r.fail_time_ticks ?? 0))
        if (spent > 0 && !this.state.game_over) this.advanceTicks(spent)
        this.messages.push({ text: `Не получилось изготовить «${r.label}». Материалы остались целы.${spent > 0 ? ` Потрачено ${spent} тик(ов) времени.` : ''}` })
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
    if (r.sound) playInteraction(r.sound, { sound: r.sound }, r.sound_volume ?? 1)
    else playUi('craft')
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

  allRegions(): RegionDef[] { return world.allRegions(this) }

  findRegion(id: string): RegionDef | undefined { return world.findRegion(this, id) }

  findLocation(id: string): { region: RegionDef; location: LocationDef } | undefined { return world.findLocation(this, id) }

  currentScene(): SceneDef { return world.currentScene(this) }

  /**
   * Сцена, в которую игрок попадает при входе в локацию (итерация 8, А5):
   * arrival_scene локации, если она есть среди её сцен, иначе первая.
   */
  arrivalSceneOf(location: LocationDef): string | undefined { return world.arrivalSceneOf(this, location) }

  /** Правила бросков d100 этой кампании (итерация 8, А7). */
  get diceRules(): DiceRules { return world.diceRules(this) }

  /** Активное состояние сцены: первое, чьё условие истинно; иначе первое. */
  // world.activeSceneState checks conditioned states first (`st.condition && evalSceneCondition(st.condition, this)`), then falls back to the base state.
  activeSceneState(scene: SceneDef): SceneStateDef { return world.activeSceneState(this, scene) }

  changeSceneState(sceneIdOrState: string, maybeState?: string): void { world.changeSceneState(this, sceneIdOrState, maybeState) }

  goToSceneFromDialogue(sceneId: string, closeDialogue = true): void { world.goToSceneFromDialogue(this, sceneId, closeDialogue) }

  startCombatFromDialogue(arenaId: string): void { world.startCombatFromDialogue(this, arenaId) }

  /** Занятость слотов с учётом расписаний NPC (ТЗ 4.1: обновление расписания). */
  slotOccupants(scene: SceneDef): SlotOccupant[] { return world.slotOccupants(this, scene) }

  /** Переход между сценами внутри локации (или в сцену другой локации). */
  goToScene(sceneId: string, costTicks = 0): void { world.goToScene(this, sceneId, costTicks) }

  /**
   * Проверка и выполнение перехода по зоне навигации (с поддержкой условий блокировки,
   * сообщений, окликов персонажей и правил-перехватчиков).
   */
  navigate(nav: NavigationZone): boolean { return world.navigate(this, nav) }

  /** Путешествие между локациями по travel_connections (ТЗ 4.9). */
  travelTo(locationId: string): void { world.travelTo(this, locationId, (conn) => this.rollEncounter(conn)) }

  /** Локации региона, доступные/видимые на карте. */
  visibleLocations(region: RegionDef): LocationDef[] { return world.visibleLocations(this, region) }

  /**
   * Время пути до локации в тиках с учётом штрафов перегруза
   */
  travelCost(toLocation: string): number | null { return world.travelCost(this, toLocation) }

  /**
   * Базовая стоимость пути без учёта штрафа перегруза (для отображения в UI)
   */
  travelBaseCost(toLocation: string): number | null { return world.travelBaseCost(this, toLocation) }

  // ─────────────── правила ───────────────

  private runLocationRules(locationId: string): void { return effectSystem.runLocationRules.call(this, locationId) }

  /** Проверка всех правил (после каждого значимого действия — ТЗ 4.1). */
  checkRules(): void { return effectSystem.checkRules.call(this) }

  /** вызов правил, привязанных к конкретному событийному триггеру */
  fireTrigger(trigger: 'enter_scene' | 'leave_scene' | 'interact' | 'time_tick', _context?: { sceneId?: string; entityId?: string }): boolean { return effectSystem.fireTrigger.call(this, trigger, _context) }

  /** условия правила: все `conditions` И (если заданы) хотя бы одна ИЛИ-группа */
  private ruleConditionsOk(rule: RuleDef): boolean { return effectSystem.ruleConditionsOk.call(this, rule) }

  tryFireRule(ruleId: string, depth = 0): boolean { return effectSystem.tryFireRule.call(this, ruleId, depth) }

  // ─────────────── механика «Незнакомец» (Unknown / Anonymous NPC) ───────────────

  /** раскрыто ли настоящее имя персонажа игроку */
  isNpcNameKnown(entityId: string): boolean { return sceneSlots.isNpcNameKnown.call(this, entityId) }

  /** актуальное имя персонажа с учётом статуса знакомства */
  npcLabel(entity: string | NpcDef): string { return sceneSlots.npcLabel.call(this, entity) }

  /** раскрыть настоящее имя персонажа игроку */
  learnNpcName(npcId: string, silent = false): void { return sceneSlots.learnNpcName.call(this, npcId, silent) }

  // ─────────────── эффекты ───────────────

  /** актуальное описание сущности (с учётом динамических изменений set_description) */
  descOf(entityId: string): string { return sceneSlots.descOf.call(this, entityId) }

  /**
   * Раз в сутки: самочувствие NPC с расписанием. Чьё расписание покрывает
   * ночь (от начала ночи до утра) — тот отсыпается (+10); кто без ночёвки
   * по расписанию — устаёт (−10). Диапазоны времени поддерживают полночь.
   */
  private tickNpcMood(): void { social.tickNpcMood(this) }

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
  setEntityDescription(entityId: string, text: string): void { return sceneSlots.setEntityDescription.call(this, entityId, text) }

  applyEffects(effects: Effect[], depth = 0): void { return effectSystem.applyEffects.call(this, effects, depth) }

  applyEffect(e: Effect, depth = 0): void { return effectSystem.applyEffect.call(this, e, depth) }

  // ─────────────── взаимодействие со слотами ───────────────

  // ─────────────── предмет → слот сцены (блок 8 ТЗ «Гибкий движок») ───────────────

  /** предметы игрока, применимые к слоту (для модалки выбора) */
  slotUseOptions(slot: SlotDef): Array<{ itemId: string; label: string; use: SlotUseWith }> { return sceneSlots.slotUseOptions.call(this, slot) }

  /** применить предмет к слоту сцены; ложь — предмет/слот не подходят */
  useItemOnSlot(slotId: string, itemId: string): boolean { return sceneSlots.useItemOnSlot.call(this, slotId, itemId) }

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

  /** рецепт виден игроку? (неизвестные закрыты до unlock_recipe или выполнения условий) */
  recipeKnown(id: string): boolean {
    const r = this.campaign.recipes[id]
    if (!r) return false
    // Проверка явного флага скрытости (unlock_recipe)
    if (r.known === false && !this.state.recipes_unlocked?.includes(id)) return false
    // Проверка динамических условий доступности рецепта (изучение, навыки, черты, квесты)
    if (r.conditions && r.conditions.length > 0) {
      if (!r.conditions.every((c) => evalCondition(c, this))) return false
    }
    return true
  }

  /** список рецептов, доступных игроку (вкладка «Крафт») */
  knownRecipes(): RecipeDef[] {
    return Object.values(this.campaign.recipes)
      .filter((r) => this.recipeKnown(r.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }

  /** состояние облика сущности, заданное правилом (set_entity_state) */
  entityState(id: string): string | undefined { return sceneSlots.entityState.call(this, id) }

  /**
   * Разблокировать запись кодекса (блок 10 ТЗ): повтор — no-op.
   * При первой разблокировке — сообщение «Новая запись в кодексе: …».
   */
  unlockCodex(entryId: string): void { return sceneSlots.unlockCodex.call(this, entryId) }

  /** разблокированные записи кодекса (блок 10 ТЗ) */
  unlockedCodexEntries(): CodexEntryDef[] { return sceneSlots.unlockedCodexEntries.call(this) }

  /** категории кодекса: свои из меты, иначе встроенные три (блок 10 ТЗ) */
  codexCategories(): Array<{ id: string; label: string }> { return sceneSlots.codexCategories.call(this) }

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
  fmt(text: string): string { return sceneSlots.fmt.call(this, text) }

  itemInteractable(item: ItemDef): boolean { return sceneSlots.itemInteractable.call(this, item) }

  /** доступные сейчас варианты действий с предметом (условия показа) */
  itemInteractOptions(item: ItemDef): ItemInteractOption[] { return sceneSlots.itemInteractOptions.call(this, item) }

  /** применить выбранный вариант взаимодействия с предметом */
  runItemInteract(item: ItemDef, option: ItemInteractOption): void { return sceneSlots.runItemInteract.call(this, item, option) }

  interactWithSlot(occ: SlotOccupant): boolean { return sceneSlots.interactWithSlot.call(this, occ) }

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
    // похороны отряда: погибшие в бою напарники покидают отряд навсегда
    for (const ally of combat.combatants.filter((c) => c.id.startsWith('c_ally_') && c.dead)) {
      const comp = this.state.party.find((p) => p.entity === ally.entityId)
      if (comp) {
        comp.hp = 0
        this.leaveParty(ally.entityId)
        this.messages.push({ text: `${ally.label} погиб(ла). Тело осталось на «${combat.arena.label}».`, portrait: ally.portrait })
      }
    }
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
  fireRule(ruleId: string): void { return effectSystem.fireRule.call(this, ruleId) }

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
    stopVoiceAudio()
    let npc = this.campaign.entities[entityId] as NpcDef | undefined
    if (!npc || npc.type !== 'npc') {
      npc = Object.values(this.campaign.entities).find((e): e is NpcDef => e.type === 'npc' && (e.dialogue === entityId || e.dialogue === `${entityId}.ink`))
    }
    if (!npc || npc.type !== 'npc' || !npc.dialogue) return
    const resolved = this.resolveDialogueSource(npc.dialogue)
    if (!resolved) return
    const { key: dialogueKey, source } = resolved
    playInteraction('talk', { entity: npc })
    // Каждый разговор — свежая Story (компиляция кэширована в dialogue.ts):
    // однократные `*`-ветки исчезают до конца разговора и возвращаются в новом,
    // а «навсегда» вещи хранятся только во флагах. (фидбек №3)
    let story: Story
    this.lastDialogueError = null
    try {
      story = createStory(source, dialogueKey)
    } catch (err) {
      // битый ink не должен валить весь рантайм: сообщение мастеру/игроку и выход
      const msg = err instanceof Error ? err.message : String(err)
      this.lastDialogueError = msg
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
      if (fallback && fallback !== entryKnot) {
        try {
          story.ChoosePathString(fallback)
        } catch {
          this.lastDialogueError = `Стартовый узел «${fallback}» не найден в диалоге «${dialogueKey}».`
          return
        }
      } else if (!story.canContinue) {
        this.lastDialogueError = `Узел «${entryKnot}» не найден в диалоге «${dialogueKey}».`
        return
      }
    }
    this.activeStory = story
    this.activeNpc = npc
    this.state.stats_run.dialogues += 1
    this.dialogueHistory = []
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : this.dlgSpeakerLabel(l, npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
      // external в первой же реплике: бой / торговля / финал — окна диалога нет
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
    } else {
      this.dialogue = {
        npc,
        lines: drained.lines,
        choices: drained.choices,
        finished: drained.finished,
        history: [...this.dialogueHistory],
      }
      this.commitDialogueTimer(drained.choices.length)
      this.commitDialoguePresenting()
      this.dialogue.timer = this.dialogueTimer ?? undefined
    }
    this.notify()
  }

  chooseDialogueOption(index: number): void {
    const story = this.activeStory
    const npc = this.activeNpc
    if (!story || !npc) return
    const chosenChoice = story.currentChoices[index]?.text
    if (chosenChoice) {
      this.dialogueHistory.push({
        speaker: this.state.player.name || 'Вы',
        text: chosenChoice,
        isChoice: true,
      })
    }
    story.ChooseChoiceIndex(index)
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : this.dlgSpeakerLabel(l, npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    // external мог закрыть забег/открыть бой/торговлю (game_over чистит
    // activeStory — но drainStory уже отработал). Не восстанавливаем окно.
    if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
      this.dialogue = null
      this.dialogueHistory = []
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
      history: [...this.dialogueHistory],
    }
    this.commitDialogueTimer(drained.choices.length)
    this.commitDialoguePresenting()
    this.dialogue.timer = this.dialogueTimer ?? undefined
    this.checkRules()
    // правило на checkRules тоже могло вызвать game_over
    if (this.state.game_over) {
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
    }
    this.notify()
  }

  endDialogue(): void {
    stopVoiceAudio()
    this.dialogueTimer = null
    this.pendingDialoguePresenting = null
    this.dialogue = null
    this.dialogueHistory = []
    this.activeStory = null
    this.activeNpc = null
    this.checkRules()
    this.autosave()
    this.notify()
  }

  dismissMessage(): void {
    this.messages.shift()
    this.flushPendingBannersIfClear()
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
    this.dialogueTimer = null
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
    return `narthex:meta:${campaignId}`
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
