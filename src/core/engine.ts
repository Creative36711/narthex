import type {
  CampaignData,
  Effect,
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
} from '../shared/types'
import { PRNG } from './prng'
import { derivedHP, derivedMP } from './brp'
import { evalCondition, evalSceneCondition } from './conditions'
import { hourOfDay, inTimeRange } from './time'
import type { Story } from 'inkjs'
import { bindExternals, compileDialogue, drainStory, type DialogueUI } from './dialogue'

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
  dialogue: DialogueUI | null = null
  /** всплывающие сообщения (show_message) */
  messages: { text: string; portrait?: string }[] = []

  constructor(campaign: CampaignData, state?: GameState) {
    this.campaign = campaign
    if (state) {
      this.state = state
      this.rng = new PRNG(state.seed)
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
      hp,
      max_hp: hp,
      mp,
      max_mp: mp,
      needs,
      inventory: (playerDef.inventory ?? []).map((i) => ({ ...i })),
      currencies,
    }

    return {
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
      log: [],
      game_over: null,
      stats_run: { travels: 0, dialogues: 0, ticks_survived: 0 },
    }
  }

  /** Вызывается один раз после создания/загрузки. */
  start(): void {
    this.runLocationRules(this.state.location)
    this.autosave()
    this.notify()
  }

  // ─────────────── время и потребности ───────────────

  advanceTicks(ticks: number): void {
    const meta = this.campaign.meta
    for (let i = 0; i < ticks; i++) {
      if (this.state.game_over) return
      this.state.tick += 1
      this.state.stats_run.ticks_survived += 1
      for (const need of meta.needs) {
        const cur = this.state.player.needs[need.id] ?? 0
        const next = Math.max(0, cur - need.decay_per_tick)
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
  }

  useItem(id: string): void {
    const def = this.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item' || !def.on_use) return
    this.applyEffects(def.on_use.effects)
    if (def.on_use.consume !== false) this.removeItem(id, 1)
    if (def.on_use.message) this.messages.push({ text: def.on_use.message })
    this.checkRules()
    this.notify()
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

  /** Активное состояние сцены: первое, чьё условие истинно; иначе первое. */
  activeSceneState(scene: SceneDef): SceneStateDef {
    for (const st of scene.states) {
      if (evalSceneCondition(st.condition, this)) return st
    }
    return scene.states[0]
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

      // 2. NPC по расписанию
      if (!entity) {
        for (const def of Object.values(this.campaign.entities)) {
          if (def.type !== 'npc' || !def.schedule) continue
          if (this.state.dead_entities.includes(def.id)) continue
          if (this.state.removed_entities.includes(def.id)) continue
          const entry = def.schedule.find(
            (e) => e.scene === scene.id && e.slot === slot.id && inTimeRange(hour, e.time_range),
          )
          if (entry) {
            entity = def
            break
          }
        }
      }

      // 3. default_entity (сущности без расписания)
      if (!entity && slot.default_entity) {
        const def = this.campaign.entities[slot.default_entity]
        const isScheduledNpc = def?.type === 'npc' && !!def.schedule
        const gone =
          this.state.dead_entities.includes(slot.default_entity) ||
          this.state.removed_entities.includes(slot.default_entity)
        if (def && !isScheduledNpc && !gone) entity = def
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
    if (conn?.requirements && !conn.requirements.every((c) => evalCondition(c, this))) {
      this.messages.push({ text: 'Путь закрыт.' })
      this.notify()
      return
    }
    this.advanceTicks(cost)
    this.state.stats_run.travels += 1
    if (this.state.game_over) return this.notify()

    const target = this.findLocation(locationId)
    if (!target) return
    this.state.region = target.region.id
    this.state.location = locationId
    const firstScene = target.location.scenes[0]
    if (firstScene) this.state.scene = firstScene
    this.onEnterLocation(locationId)
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
      case 'teleport_player': {
        const target = this.findLocation(e.location)
        if (target) {
          s.region = target.region.id
          s.location = e.location
          s.scene = e.scene ?? target.location.scenes[0]
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
    if (item.on_interact) {
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

  // ─────────────── диалоги ───────────────

  startDialogue(entityId: string, knot?: string): void {
    const npc = this.campaign.entities[entityId] as NpcDef | undefined
    if (!npc || npc.type !== 'npc' || !npc.dialogue) return
    const source = this.campaign.dialogues[npc.dialogue]
    if (!source) return
    const story = compileDialogue(source, npc.dialogue)
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
    this.dialogue = { npc, lines: drained.lines, choices: drained.choices, finished: drained.finished }
    this.notify()
  }

  chooseDialogueOption(index: number): void {
    if (!this.activeStory || !this.activeNpc) return
    this.activeStory.ChooseChoiceIndex(index)
    const drained = drainStory(this.activeStory)
    this.dialogue = {
      npc: this.activeNpc,
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
    this.dialogue = null
    this.activeStory = null
    if (type === 'death') deleteSave(this.campaign.meta.id) // permadeath — ТЗ 4.12
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
    return raw ? (JSON.parse(raw) as GameState) : null
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
