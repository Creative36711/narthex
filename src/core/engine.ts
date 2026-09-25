import type {
  CampaignData,
  CutsceneDef,
  DiceRules,
  Effect,
  EncounterEntry,
  EntityDef,
  GameState,
  ItemDef,
  LocationDef,
  NpcDef,
  PlayerState,
  RegionDef,
  SceneDef,
  SceneStateDef,
  SlotDef,
  TravelConnection,
  NeedCondition,
  PresenceOverride,
  WeaponData,
} from '../shared/types'
import { SAVE_VERSION, DEFAULT_DICE_RULES } from '../shared/types'
import { PRNG } from './prng'
import { derivedHP, derivedMP, skillCheck, CHECK_RESULT_LABEL } from './brp'
import { rollDice } from './dice'
import { evalCondition, evalSceneCondition } from './conditions'
import { hourOfDay, inTimeRange, timeOfDay } from './time'
import type { Story } from 'inkjs'
import { bindExternals, createStory, drainStory, type DialogueUI } from './dialogue'
import { skillLabel } from '../shared/skills'
import { playUi, playInteraction } from '../shared/audio'
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
  private listeners = new Set<() => void>()
  private activeStory: Story | null = null
  private activeNpc: NpcDef | null = null
  /** Ink-истории этого забега (состояние once-выборов живёт в пределах забега) */
  dialogue: DialogueUI | null = null
  combat: CombatController | null = null
  /** открытая торговля: id NPC-торговца */
  trade: NpcDef | null = null
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

  constructor(campaign: CampaignData, state?: GameState) {
    this.campaign = campaign
    this.freshRun = !state
    if (state) {
      this.state = state
      this.rng = new PRNG(state.seed)
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
    const currencies: Record<string, number> = {}
    for (const c of meta.currencies) currencies[c.id] = 0

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
      currencies,
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
      this.checkRules()
    }
    this.runLocationRules(this.state.location)
    this.autosave()
    this.notify()
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
    for (let i = 0; i < ticks; i++) {
      if (this.state.game_over) return
      this.state.tick += 1
      this.state.stats_run.ticks_survived += 1
      for (const need of meta.needs) {
        // старые сохранения могут не знать новую потребность — считаем её полной
        const cur = this.state.player.needs[need.id] ?? need.max
        let next = cur
        // убыль — только когда все условия выполнены (пусто = всегда)
        const decays = !need.decay_when?.length || need.decay_when.every((c) => this.needCondOk(c))
        if (decays) next = Math.max(0, next - need.decay_per_tick)
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
    const need = this.campaign.meta.needs.find((n) => n.id === needId)
    if (!need) return
    const cur = this.state.player.needs[needId] ?? 0
    const next = Math.min(need.max, Math.max(0, cur + delta))
    this.state.player.needs[needId] = next
    if (next <= 0 && cur > 0) this.onNeedZero(needId)
  }

  changeHp(delta: number): void {
    const p = this.state.player
    p.hp = Math.min(p.max_hp, p.hp + delta)
    if (p.hp <= 0) this.gameOver('death', 'Ваши раны оказались смертельными.')
  }

  // ─────────────── инвентарь ───────────────

  hasItem(id: string): boolean {
    return this.itemCount(id) > 0
  }

  itemCount(id: string): number {
    return this.state.player.inventory.find((i) => i.item === id)?.quantity ?? 0
  }

  addItem(id: string, quantity = 1): void {
    const inv = this.state.player.inventory
    const entry = inv.find((i) => i.item === id)
    if (entry) entry.quantity += quantity
    else inv.push({ item: id, quantity })
  }

  removeItem(id: string, quantity = 1): void {
    const inv = this.state.player.inventory
    const entry = inv.find((i) => i.item === id)
    if (!entry) return
    entry.quantity -= quantity
    if (entry.quantity <= 0) inv.splice(inv.indexOf(entry), 1)
    // предмет закончился — снимаем с персонажа
    const eq = this.state.player.equipment
    if (!this.hasItem(id)) {
      if (eq.weapon === id) delete eq.weapon
      if (eq.armor === id) delete eq.armor
    }
  }

  // ─────────────── экипировка ───────────────

  /** предмет надет? */
  isEquipped(id: string): boolean {
    const eq = this.state.player.equipment
    return eq.weapon === id || eq.armor === id
  }

  /** надеть оружие/броню из инвентаря */
  equipItem(id: string): void {
    if (!this.hasItem(id)) return
    const def = this.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item') return
    if (def.weapon_data) {
      this.state.player.equipment.weapon = id
      this.pushLog(`Взято в руки: ${def.label}.`)
    } else if (def.armor_data) {
      this.state.player.equipment.armor = id
      this.pushLog(`Надето: ${def.label}.`)
    } else return
    this.autosave()
    this.notify()
  }

  /** снять оружие/броню */
  unequipItem(slot: 'weapon' | 'armor'): void {
    const eq = this.state.player.equipment
    const id = eq[slot]
    if (!id) return
    const def = this.campaign.entities[id] as ItemDef | undefined
    delete eq[slot]
    this.pushLog(`Снято: ${def?.label ?? id}.`)
    this.autosave()
    this.notify()
  }

  /** текущее оружие игрока (для UI и боя): экипированное или кулаки */
  playerWeapon(): { itemId: string | null; weapon: WeaponData; label: string } {
    const id = this.state.player.equipment.weapon
    if (id && this.hasItem(id)) {
      const def = this.campaign.entities[id] as ItemDef | undefined
      if (def?.weapon_data) return { itemId: id, weapon: def.weapon_data, label: def.label }
    }
    return {
      itemId: null,
      weapon: { skill: 'brawl', damage: '1d3', damage_bonus: true, range: 1, attacks_per_round: 1, parry_capable: false, label: 'Кулаки' },
      label: 'Кулаки',
    }
  }

  /** текущая броня игрока (очки поглощения) */
  playerArmor(): { itemId: string | null; points: number; label: string } {
    const id = this.state.player.equipment.armor
    if (id && this.hasItem(id)) {
      const def = this.campaign.entities[id] as ItemDef | undefined
      if (def?.armor_data) return { itemId: id, points: def.armor_data.points, label: def.label }
    }
    return { itemId: null, points: 0, label: 'Без брони' }
  }

  useItem(id: string): void {
    const def = this.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item' || !def.on_use) return
    playInteraction('use', { entity: def })
    this.applyEffects(def.on_use.effects)
    if (def.on_use.consume !== false) this.removeItem(id, 1)
    if (def.on_use.message) this.messages.push({ text: def.on_use.message })
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

  /** target: id фракции или id NPC (у NPC — фракция + личный сдвиг). */
  getDisposition(target: string): number {
    const npc = this.campaign.entities[target] as NpcDef | undefined
    if (npc && npc.type === 'npc') {
      const factionValue = npc.faction ? (this.state.dispositions[npc.faction] ?? 0) : 0
      return factionValue + (npc.base_disposition ?? 0)
    }
    return this.state.dispositions[target] ?? 0
  }

  changeDisposition(target: string, delta: number): void {
    const npc = this.campaign.entities[target] as NpcDef | undefined
    const faction = npc && npc.type === 'npc' ? npc.faction : target
    if (!faction) return
    const cur = this.state.dispositions[faction] ?? 0
    this.state.dispositions[faction] = Math.max(-100, Math.min(100, cur + delta))
    const label = this.campaign.meta.factions?.find((f) => f.id === faction)?.label ?? faction
    this.pushLog(`Отношение «${label}»: ${delta > 0 ? '+' : ''}${delta} (теперь ${this.state.dispositions[faction]}).`)
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

  // ─────────────── рост навыков (ТЗ 4.3) ───────────────

  markSkill(skill: string): void {
    if (this.state.player.skills[skill] != null) this.state.player.skill_marks[skill] = true
  }

  /** Проверка навыка игрока с «галочкой» опыта при успехе. */
  playerSkillCheck(skill: string, difficulty = 50): ReturnType<typeof skillCheck> {
    const value = this.state.player.skills[skill] ?? 0
    const out = skillCheck(value, this.rng, 50 - difficulty, this.diceRules)
    this.pushLog(`Проверка «${this.skillLabel(skill)}» — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`)
    if (out.success) this.markSkill(skill)
    return out
  }

  /** Отдых: броски роста отмеченных навыков (d100 > навык → +1d6). */
  /** русское название навыка (реестр кампании → встроенный словарь → id) */
  skillLabel(id: string): string {
    return skillLabel(id, this.campaign.meta.skills)
  }

  restAndGrow(): string[] {
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

  buyPrice(npc: NpcDef, itemId: string, basePrice?: number): number {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    const base = basePrice ?? item?.value?.[this.mainCurrency] ?? 1
    return Math.max(1, Math.round(base * this.priceModifier(npc)))
  }

  sellPrice(npc: NpcDef, itemId: string): number {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    const base = item?.value?.[this.mainCurrency] ?? 0
    const rate = npc.trader?.buy_rate ?? 0.4
    return Math.max(0, Math.floor((base * rate) / this.priceModifier(npc)))
  }

  buyItem(itemId: string, price: number): boolean {
    if (this.itemCount('item_silver') < price) return false
    this.removeItem('item_silver', price)
    this.addItem(itemId, 1)
    this.markSkill('bargain')
    playUi('coin')
    this.notify()
    return true
  }

  sellItem(itemId: string, price: number): boolean {
    if (this.itemCount(itemId) < 1) return false
    this.removeItem(itemId, 1)
    this.addItem('item_silver', price)
    this.markSkill('bargain')
    playUi('coin')
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
          if (def.type !== 'npc' || (!def.schedule && !def.presence_overrides)) continue
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
        const busyElsewhere =
          def?.type === 'npc' && (!!def.schedule || !!this.activePresenceOverride(def))
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

  private tryFireRule(ruleId: string): void {
    const rule = this.campaign.rules[ruleId]
    if (!rule) return
    if (rule.once && this.state.fired_rules.includes(rule.id)) return
    if (!rule.conditions.every((c) => evalCondition(c, this))) return
    this.state.fired_rules.push(rule.id)
    this.applyEffects(rule.effects)
  }

  // ─────────────── эффекты ───────────────

  applyEffects(effects: Effect[]): void {
    for (const e of effects) this.applyEffect(e)
  }

  applyEffect(e: Effect): void {
    const s = this.state
    switch (e.type) {
      case 'set_flag': s.flags[e.flag] = true; break
      case 'clear_flag': delete s.flags[e.flag]; break
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
        const cur = s.player.skills[e.skill] ?? 0
        s.player.skills[e.skill] = Math.max(0, cur + e.delta)
        this.pushLog(`Навык «${e.skill}»: ${e.delta > 0 ? '+' : ''}${e.delta} (теперь ${s.player.skills[e.skill]}).`)
        break
      }
      case 'skill_check_gate': {
        const out = this.playerSkillCheck(e.skill, e.difficulty)
        this.applyEffects(out.success ? e.success_effects : e.fail_effects)
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
      case 'show_message': this.messages.push({ text: e.text, portrait: e.portrait }); break
      case 'reveal_location':
        if (!s.revealed_locations.includes(e.location)) s.revealed_locations.push(e.location)
        break
      case 'advance_time': this.advanceTicks(e.ticks); break
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
  }

  // ─────────────── взаимодействие со слотами ───────────────

  interactWithSlot(occ: SlotOccupant): void {
    if (!occ.entity) return
    if (occ.entity.type === 'npc') {
      this.startDialogue(occ.entity.id)
      return
    }
    const item = occ.entity as ItemDef
    const slotType = occ.slot.type[0]
    if (item.on_interact) {
      // «открыть контейнер» vs «использовать»: по типу слота/категории
      const isOpen = occ.slot.type.includes('container') || item.category === 'container'
      playInteraction(isOpen ? 'open' : 'use', { entity: item, slotType })
      this.applyEffects(item.on_interact.effects)
      if (item.on_interact.message) this.messages.push({ text: item.on_interact.message })
      if (item.on_interact.consume) {
        this.state.removed_entities.push(item.id)
      }
      this.checkRules()
      this.notify()
    } else {
      this.messages.push({ text: item.description || item.label })
      this.notify()
    }
  }

  // ─────────────── бой (Фаза 1) ───────────────

  /** эффекты on_victory, требующие закрытия экрана боя (диалог, телепорт и т.п.) */
  private postCombatEffects: Effect[] = []

  /**
   * Вызывается боем в момент победы (фидбек: сообщения должны быть видны
   * ещё на экране победы, до «Продолжить»). Безопасные эффекты применяются
   * сразу; смена экрана (диалог, телепорт, новый бой, финал) — после закрытия.
   */
  onCombatVictory(effects: Effect[]): void {
    const defer = new Set(['start_dialogue', 'start_combat', 'teleport_player', 'game_over_victory', 'game_over_death', 'play_cutscene'])
    this.postCombatEffects = effects.filter((e) => defer.has(e.type))
    this.applyEffects(effects.filter((e) => !defer.has(e.type)))
    this.notify()
  }

  startCombat(def: Extract<Effect, { type: 'start_combat' }>): void {
    // бой прерывает диалог
    this.dialogue = null
    this.activeStory = null
    this.activeNpc = null
    this.combat = new CombatController(this, def)
    playUi('combat_start')
    this.notify()
  }

  /** Вызывается UI после экрана победы. */
  endCombat(): void {
    const combat = this.combat
    if (!combat) return
    this.combat = null
    if (combat.result === 'victory') {
      // основная часть on_victory уже применена в момент победы (onCombatVictory)
      const deferred = this.postCombatEffects
      this.postCombatEffects = []
      this.applyEffects(deferred)
      this.advanceTicks(1) // бой занимает время (ТЗ 4.1)
      this.pushLog(`Бой «${combat.arena.label}» выигран за ${combat.round} раунд(ов).`)
      this.state.stats_run.kills += combat.combatants.filter((c) => c.side === 'enemy' && c.dead).length
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

  startDialogue(entityId: string, knot?: string): void {
    const npc = this.campaign.entities[entityId] as NpcDef | undefined
    if (!npc || npc.type !== 'npc' || !npc.dialogue) return
    const source = this.campaign.dialogues[npc.dialogue]
    if (!source) return
    playInteraction('talk', { entity: npc })
    // Каждый разговор — свежая Story (компиляция кэширована в dialogue.ts):
    // однократные `*`-ветки исчезают до конца разговора и возвращаются в новом,
    // а «навсегда» вещи хранятся только во флагах. (фидбек №3)
    const story = createStory(source, npc.dialogue)
    bindExternals(story, this)
    try {
      story.ChoosePathString(knot ?? 'main')
    } catch {
      return
    }
    this.activeStory = story
    this.activeNpc = npc
    this.state.stats_run.dialogues += 1
    const drained = drainStory(story)
    if (this.combat) {
      // диалог сразу запустил бой — не показываем окно
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
    if (this.combat || this.trade) {
      // external запустил бой или торговлю — диалог закрыт, не восстанавливаем
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

  gameOver(type: 'death' | 'victory', reason: string): void {
    if (this.state.game_over) return
    this.state.game_over = { type, reason }
    if (type === 'death') {
      this.dialogue = null
      this.activeStory = null
    }
    // забег завершён в любом исходе — сейв стирается, «Продолжить» исчезает (фидбек №10)
    deleteSave(this.campaign.meta.id)
    this.notify()
  }

  /** Полный рестарт: новый seed (ТЗ 4.10). */
  restart(): GameEngine {
    deleteSave(this.campaign.meta.id)
    const fresh = new GameEngine(this.campaign)
    fresh.start()
    return fresh
  }

  // ─────────────── сохранение ───────────────

  autosave(): void {
    if (this.state.game_over) return
    try {
      localStorage.setItem(saveKey(this.campaign.meta.id), JSON.stringify(this.state))
    } catch {
      /* приватный режим и т.п. */
    }
  }
}

// ─────────────── save/load helpers ───────────────

function saveKey(campaignId: string): string {
  return `chronicle-forge:save:${campaignId}`
}

export function loadSave(campaignId: string): GameState | null {
  try {
    const raw = localStorage.getItem(saveKey(campaignId))
    if (!raw) return null
    const state = JSON.parse(raw) as GameState
    // несовместимые старые сейвы отбрасываем
    if ((state.save_version ?? 1) !== SAVE_VERSION) return null
    return state
  } catch {
    return null
  }
}

export function deleteSave(campaignId: string): void {
  try {
    localStorage.removeItem(saveKey(campaignId))
  } catch {
    /* ignore */
  }
}

export function hasSave(campaignId: string): boolean {
  return loadSave(campaignId) !== null
}
