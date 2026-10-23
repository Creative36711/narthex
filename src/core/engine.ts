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
  GameState,
  ItemDef,
  ItemInteractOption,
  LocationDef,
  AchievementDef,
  EventTableDef,
  GenWeightedItem,
  FeatDef,
  MetaStoreState,
  MetaUnlockDef,
  NavigationZone,
  NpcDef,
  PlayerState,
  RecipeDef,
  RegionDef,
  SceneDef,
  SceneStateDef,
  SlotDef,
  SlotUseWith,
  StatusDef,
  TravelConnection,
  SkillDifficulty,
  WeaponData,
  NeedDef,
  ImageValue,
} from '../shared/types'
import { SAVE_VERSION, startTick } from '../shared/types'
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
import { director } from './director'
import { character } from './character'
import { checks } from './checks'
import { economy } from './economy'
import { dialogueRuntime } from './dialogue-runtime'
import { encounters } from './encounters'
import { meta } from './meta'
import { roguelike } from './roguelike'
import { sceneSlots } from './scene-slots'
import { needs } from './needs'
import { quests } from './quests'
import { party } from './party'
import { social } from './social'
import { inventory } from './inventory'
import { equipment } from './equipment'
export type { SlotOccupant } from './world'
import { derivedHP, derivedMP, skillCheck, type SkillCheckOutcome } from './brp'
import type { CharChoice } from './charcreate'
import type { Story } from 'inkjs'
import type { DialogueUI, DialogueHistoryEntry } from './dialogue'
import { playUi, playInteraction, stopSound } from '../shared/audio'
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
  debugInvincible = false
  private listeners = new Set<() => void>()
  private activeStory: Story | null = null
  private activeNpc: NpcDef | null = null
  dialogue: DialogueUI | null = null
  dialogueHistory: DialogueHistoryEntry[] = []
  dialogueTimer: { seconds: number; knot?: string } | null = null
  private pendingDialogueTimer: { seconds: number; knot?: string } | null = null
  private pendingDialoguePresenting: { ok: string; fail: string; required?: string } | null = null
  combat: CombatController | null = null
  lastDialogueError: string | null = null
  trade: NpcDef | null = null
  craftRequest: { recipe?: string } | null = null
  craftSourceEntity: ItemDef | null = null
  toasts: { id: number; text: string; kind: 'get' | 'lose' | 'info' }[] = []
  private toastSeq = 0
  inspectedEntityId: string | null = null
  inspectEntity(id: string | null): void {
    this.inspectedEntityId = id
    this.notify()
  }
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
  pushToast(text: string, kind: 'get' | 'lose' | 'info' = 'info'): void {
    const toast = { id: ++this.toastSeq, text, kind }
    this.toasts = [...this.toasts, toast]
    this.pushLog(text)
    playUi(kind === 'lose' ? 'item_lose' : kind === 'get' ? 'item_get' : 'message')
    this.notify()
    setTimeout(() => this.dismissToast(toast.id), 5200)
  }
  dismissToast(id: number): void {
    if (this.toasts.some((t) => t.id === id)) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
      this.notify()
    }
  }
  messages: { text: string; portrait?: string }[] = []
  cutsceneQueue: Array<{ def: CutsceneDef; serial: number }> = []
  private cutsceneSerial = 0
  freshRun: boolean
  envelope: SaveEnvelope | null = null

  constructor(campaign: CampaignData, state?: GameState) {
    this.campaign = campaign
    this.freshRun = !state
    if (state) {
      this.state = state
      this.rng = new PRNG(state.seed)
      delete this.state.player.currencies
      if (!this.state.player.equipment) {
        const def = this.campaign.entities[this.state.player.entity] as NpcDef | undefined
        this.state.player.equipment = { ...(def?.equipment ?? {}) }
      }
    } else {
      this.rng = new PRNG()
      this.state = this.newState()
    }
  }
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
  log(text: string): void {
    this.pushLog(text)
  }

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
  shouldShowNarrativeIntro(scene: SceneDef): boolean { return director.shouldShowNarrativeIntro.call(this, scene) }
  isSceneIntroActive(): boolean { return director.isSceneIntroActive.call(this) }
  markNarrativeIntroSeen(sceneId: string): void { return director.markNarrativeIntroSeen.call(this, sceneId) }
  setFlag(f: string, value: unknown = true): void {
    if (value === false || value === 0 || value === 'false') {
      delete this.state.flags[f]
    } else {
      this.state.flags[f] = (value as any) ?? true
    }
    if (!this.combat && !this.trade) this.checkRules()
    this.notify()
  }
  clearFlag(f: string): void {
    delete this.state.flags[f]
    if (!this.combat && !this.trade) this.checkRules()
    this.notify()
  }
  inParty(entityId: string): boolean {
    return this.isInParty(entityId)
  }

  start(): void {
    if (this.freshRun) {
      this.freshRun = false
      this.metaRunStart()
      this.checkRules()
      this.fireTrigger('time_tick')
      this.fireTrigger('enter_scene', { sceneId: this.state.scene })
    }
    this.runLocationRules(this.state.location)
    this.autosave()
    this.notify()
  }
  applyCharCreation(choice: CharChoice): void { return character.applyCharCreation.call(this, choice) }
  get cutscene(): CutsceneDef | null { return director.cutscene.call(this) }
  get cutsceneKey(): number { return director.cutsceneKey.call(this) }
  banners: Array<{
    serial: number
    text: string
    preset?: string
    enter?: string
    seconds?: number
    position?: string
    accent?: string
  }> = []
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
  showBanner(e: { text: string; preset?: string; enter?: string; seconds?: number; position?: string; accent?: string }): void { void this.bannerSerial; void this.bannerPendingTimers; void this.postcardTimer; void this.postcardPendingSeconds; void this.cutsceneSerial; return director.showBanner.call(this, e) }
  showPostcard(e: { image?: string; art?: ArtDoc; text?: string; preset?: string; seconds?: number; camera?: CameraDoc }): void { return director.showPostcard.call(this, e) }
  hidePostcard(): void { return director.hidePostcard.call(this) }
  private flushPendingBannersIfClear(): void { return director.flushPendingBannersIfClear.call(this) }
  playCutscene(id: string): void { return director.playCutscene.call(this, id) }
  endCutscene(): void { return director.endCutscene.call(this) }
  advanceTicks(ticks: number): void { needs.advanceTicks(this, ticks, { tickPursuit: () => this.tickPursuit(), tickNpcMood: () => this.tickNpcMood(), tickEventTables: () => this.tickEventTables() }) }
  changeNeed(needId: string, delta: number): void { needs.changeNeed(this, needId, delta) }
  changeHp(delta: number): void { needs.changeHp(this, delta) }
  restHeal(): { hp: number; mpFull: boolean } { return needs.restHeal(this) }
  statusDef(id: string): StatusDef | undefined { return needs.statusDef(this, id) }
  hasStatus(id: string): boolean { return needs.hasStatus(this, id) }
  applyStatus(_target: 'player', id: string, duration?: number): void { needs.applyStatus(this, _target, id, duration) }
  removeStatus(_target: 'player', id: string): void { needs.removeStatus(this, _target, id) }
  statusSkillMod(skill: string): number { return needs.statusSkillMod(this, skill) }
  hasItem(id: string): boolean { return inventory.hasItem(this, id) }
  itemCount(id: string): number { return inventory.itemCount(this, id) }
  private itemTitle(id: string): string { return economy.itemTitle.call(this, id) }
  addItem(id: string, quantity = 1, opts: { silent?: boolean; freshness?: number } = {}): void { void this.itemTitle; inventory.addItem(this, id, quantity, opts) }
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
  getDisposition(target: string): number { return social.getDisposition(this, target) }
  heroPortraitStateKey(): string { return sceneSlots.heroPortraitStateKey.call(this) }
  heroPortraitImages(): ImageValue[] { return sceneSlots.heroPortraitImages.call(this) }
  heroCombatFigure(): {
    figure?: ImageValue
    mode?: 'topdown' | 'side' | 'static'
    offset?: number
  } { return sceneSlots.heroCombatFigure.call(this) }
  npcMood(entityId: string): number { return social.npcMood(this, entityId) }
  changeNpcMood(entityId: string, delta: number): void { social.changeNpcMood(this, entityId, delta) }
  changeDisposition(target: string, delta: number): void { social.changeDisposition(this, target, delta) }
  startQuest(questId: string): void { quests.startQuest(this, questId) }
  advanceQuestTo(questId: string, stageId: string): void { quests.advanceQuestTo(this, questId, stageId) }
  journalUpdate(questId: string, textKey: string): void { quests.journalUpdate(this, questId, textKey) }
  joinParty(entityId: string): void { party.joinParty(this, entityId) }
  companionNeed(entity: string, needId: string): number | null { return party.companionNeed(this, entity, needId) }
  changeCompanionNeed(entity: string, needId: string, delta: number): void { party.changeCompanionNeed(this, entity, needId, delta) }
  companionNeedDefs(entity: string): NeedDef[] { return party.companionNeedDefs(this, entity) }
  companionLoad(entity: string): number { return party.companionLoad(this, entity) }
  companionCapacity(entity: string): number { return party.companionCapacity(this, entity) }
  giveItemToCompanion(entity: string, itemId: string, quantity = 1, opts: { forceQuest?: boolean } = {}): boolean { return party.giveItemToCompanion(this, entity, itemId, quantity, opts) }
  takeItemFromCompanion(entity: string, itemId: string, quantity = 1): boolean { return party.takeItemFromCompanion(this, entity, itemId, quantity) }
  equipCompanionItem(entity: string, slotId: string, itemId: string | null): void { party.equipCompanionItem(this, entity, slotId, itemId) }
  useItemOnCompanion(entity: string, itemId: string): boolean { return party.useItemOnCompanion(this, entity, itemId) }
  leaveParty(entityId: string): void { party.leaveParty(this, entityId) }
  isInParty(entityId: string): boolean { return party.isInParty(this, entityId) }
  luckMax(): number { return checks.luckMax.call(this) }
  luck(): number { return checks.luck.call(this) }
  changeLuck(delta: number): boolean { return checks.changeLuck.call(this, delta) }
  fatigueMax(): number { return character.fatigueMax.call(this) }
  fatigue(): number { return character.fatigue.call(this) }
  changeFatigue(delta: number): boolean { return character.changeFatigue.call(this, delta) }
  sanityMax(): number { return character.sanityMax.call(this) }
  sanity(): number { return character.sanity.call(this) }
  changeSanity(delta: number): void { return character.changeSanity.call(this, delta) }
  reputation(): number { return social.reputation(this) }
  uiLabel(key: string, fallback: string): string { return social.uiLabel(this, key, fallback) }
  reputationEnabled(): boolean { return social.reputationEnabled(this) }
  reputationLabel(): string { return social.reputationLabel(this) }
  changeReputation(delta: number): void { social.changeReputation(this, delta) }
  wealthLevels(): string[] { return social.wealthLevels(this) }
  wealthLevel(): number { return social.wealthLevel(this) }
  wealthLevelLabel(): string { return social.wealthLevelLabel(this) }
  changeWealth(levels: number): void { social.changeWealth(this, levels) }
  passion(id: string): number { return social.passion(this, id) }
  passionLabel(id: string): string { return social.passionLabel(this, id) }
  changePassion(id: string, delta: number): void { social.changePassion(this, id, delta) }
  allegiance(id: string): number { return social.allegiance(this, id) }
  allegianceLabel(id: string): string { return social.allegianceLabel(this, id) }
  changeAllegiance(id: string, points: number): void { social.changeAllegiance(this, id, points) }
  skillBaseChance(skillId: string): number { return character.skillBaseChance.call(this, skillId) }
  skillEffective(skillId: string): number { return character.skillEffective.call(this, skillId) }
  trainStat(stat: string, delta: number): void { return character.trainStat.call(this, stat, delta) }
  statLabel(stat: string): string { return character.statLabel.call(this, stat) }
  progressionEnabled(): boolean { return character.progressionEnabled.call(this) }
  level(): number { return character.level.call(this) }
  xp(): number { return character.xp.call(this) }
  xpForLevel(level: number): number { return character.xpForLevel.call(this, level) }
  xpToNext(): number | null { return character.xpToNext.call(this) }
  pendingFeats(): number { return character.pendingFeats.call(this) }
  grantXp(points: number): void { return character.grantXp.call(this, points) }
  availableFeats(): FeatDef[] { return character.availableFeats.call(this) }
  featEligible(feat: FeatDef): boolean { return character.featEligible.call(this, feat) }
  takeFeat(id: string): boolean { return character.takeFeat.call(this, id) }
  grantFeat(id: string): void { return character.grantFeat.call(this, id) }
  playerMovement(): number { return character.playerMovement.call(this) }
  applyFall(meters: number, skill?: string): void { social.applyFall(this, meters, skill) }
  crimeLabel(id: string): string { return social.crimeLabel(this, id) }
  commitCrime(id: string, bounty = 0): void { social.commitCrime(this, id, bounty) }
  hasCrime(id?: string, minBounty = 0): boolean { return social.hasCrime(this, id, minBounty) }
  bountyTotal(): number { return social.bountyTotal(this) }
  priceEventsActive(): Array<{ id: string; label: string }> { return social.priceEventsActive(this) }
  setPriceEvent(id: string, on: boolean): void { social.setPriceEvent(this, id, on) }
  priceEventMultiplier(item: ItemDef): number { return social.priceEventMultiplier(this, item) }
  campAvailable(): { ok: boolean; reason: string } { return social.campAvailable(this) }
  durationRequest: { kind: 'camp' } | { kind: 'action'; action: DurationActionDef } | null = null
  durationRequestInfo(): {
    label: string
    min: number
    max: number
    step: number
    perTick?: Effect[]
    interruptChance: number
    startTick: number
  } | null { return checks.durationRequestInfo.call(this) }
  cancelDurationRequest(): void { return checks.cancelDurationRequest.call(this) }
  confirmDurationRequest(ticks: number): void { return checks.confirmDurationRequest.call(this, ticks) }
  requestCampRest(): void { return checks.requestCampRest.call(this) }
  requestDurationAction(id: string, ticks?: number | null): void { return checks.requestDurationAction.call(this, id, ticks) }
  runDurationAction(def: DurationActionDef, ticks: number): void { return checks.runDurationAction.call(this, def, ticks) }
  campRest(ticks?: number): void { return checks.campRest.call(this, ticks) }
  luckOffer: { text: string; cost: number; decide: (reroll: boolean) => void } | null = null
  resolveLuckOffer(reroll: boolean): void { return checks.resolveLuckOffer.call(this, reroll) }
  statCheck(stat: string, multiplier = 5, modifier = 0): SkillCheckOutcome { return checks.statCheck.call(this, stat, multiplier, modifier) }
  applyByCheck(outcome: SkillCheckOutcome, describe: string, retry: () => SkillCheckOutcome, onOk: () => void, onFail: () => void): boolean { return checks.applyByCheck.call(this, outcome, describe, retry, onOk, onFail) }
  opposedCheck(e: Extract<Effect, { type: 'opposed_check' }>): { success: boolean; player: SkillCheckOutcome; rival: SkillCheckOutcome } { return checks.opposedCheck.call(this, e) }
  stealthEnabled(): boolean { return encounters.stealthEnabled.call(this) }
  isSneaking(): boolean { return encounters.isSneaking.call(this) }
  isDetected(): boolean { return encounters.isDetected.call(this) }
  playerSkill(skill: string): number { return encounters.playerSkill.call(this, skill) }
  toggleSneak(): void { return encounters.toggleSneak.call(this) }
  detectCheck(context: string): boolean { return encounters.detectCheck.call(this, context) }
  consumeSurpriseFromSneak(): boolean { return encounters.consumeSurpriseFromSneak.call(this) }
  markSkill(skill: string): void { return character.markSkill.call(this, skill) }
  playerSkillCheck(skill: string, difficulty: SkillDifficulty = 50): ReturnType<typeof skillCheck> { return character.playerSkillCheck.call(this, skill, difficulty) }
  skillLabel(id: string): string { return character.skillLabel.call(this, id) }
  restAndGrow(): string[] { return character.restAndGrow.call(this) }
  openTrade(entityId: string): void { return economy.openTrade.call(this, entityId) }
  closeTrade(): void { return economy.closeTrade.call(this) }
  openCraft(recipeId?: string, sourceEntity?: ItemDef): void { return economy.openCraft.call(this, recipeId, sourceEntity) }
  closeCraft(): void { return economy.closeCraft.call(this) }
  setDialogueTimer(seconds: number, knot?: string): void { return dialogueRuntime.setDialogueTimer.call(this, seconds, knot) }
  dialogueTimeout(): void { return dialogueRuntime.dialogueTimeout.call(this) }
  promptPresentItem(okKnot: string, failKnot: string, required?: string): void { return dialogueRuntime.promptPresentItem.call(this, okKnot, failKnot, required) }
  submitPresentedItem(itemId: string | null): void { return dialogueRuntime.submitPresentedItem.call(this, itemId) }
  priceModifier(npc: NpcDef): number { return economy.priceModifier.call(this, npc) }
  get mainCurrency(): string { return economy.mainCurrency.call(this) }
  currencyItemId(currencyId = this.mainCurrency): string { return economy.currencyItemId.call(this, currencyId) }
  currencyAmount(currencyId = this.mainCurrency): number { return economy.currencyAmount.call(this, currencyId) }
  buyPrice(npc: NpcDef, itemId: string, basePrice?: number): number { return economy.buyPrice.call(this, npc, itemId, basePrice) }
  sellPrice(npc: NpcDef, itemId: string): number { return economy.sellPrice.call(this, npc, itemId) }
  traderSells(npc: NpcDef): Array<{ item: string; price?: number; stock?: number }> { return economy.traderSells.call(this, npc) }
  traderItemStock(npcId: string, itemId: string): number | undefined { return economy.traderItemStock.call(this, npcId, itemId) }
  buyItem(itemId: string, price: number): boolean { return economy.buyItem.call(this, itemId, price) }
  sellItem(itemId: string, price: number): boolean { return economy.sellItem.call(this, itemId, price) }
  allRecipes(): RecipeDef[] { return economy.allRecipes.call(this) }
  isWorkbenchAvailable(workbenchReq?: boolean | string): boolean { return economy.isWorkbenchAvailable.call(this, workbenchReq) }
  workbenchLabel(req?: boolean | string): string { return economy.workbenchLabel.call(this, req) }
  recipeMissing(r: RecipeDef): string[] { return economy.recipeMissing.call(this, r) }
  craft(recipeId: string): boolean { return economy.craft.call(this, recipeId) }
  private rollEncounter(conn: TravelConnection): void { return encounters.rollEncounter.call(this, conn) }
  allRegions(): RegionDef[] { return world.allRegions(this) }
  findRegion(id: string): RegionDef | undefined { return world.findRegion(this, id) }
  findLocation(id: string): { region: RegionDef; location: LocationDef } | undefined { return world.findLocation(this, id) }
  currentScene(): SceneDef { return world.currentScene(this) }
  arrivalSceneOf(location: LocationDef): string | undefined { return world.arrivalSceneOf(this, location) }
  get diceRules(): DiceRules { return checks.diceRules.call(this) }
  // Selection in world.activeSceneState: st.condition && evalSceneCondition(st.condition, this).
  activeSceneState(scene: SceneDef): SceneStateDef { return world.activeSceneState(this, scene) }
  changeSceneState(sceneIdOrState: string, maybeState?: string): void { world.changeSceneState(this, sceneIdOrState, maybeState) }
  goToSceneFromDialogue(sceneId: string, closeDialogue = true): void { world.goToSceneFromDialogue(this, sceneId, closeDialogue) }
  startCombatFromDialogue(arenaId: string): void { world.startCombatFromDialogue(this, arenaId) }
  slotOccupants(scene: SceneDef): SlotOccupant[] { return world.slotOccupants(this, scene) }
  goToScene(sceneId: string, costTicks = 0): void { world.goToScene(this, sceneId, costTicks) }
  navigate(nav: NavigationZone): boolean { return world.navigate(this, nav) }
  travelTo(locationId: string): void { world.travelTo(this, locationId, (conn) => this.rollEncounter(conn)) }
  visibleLocations(region: RegionDef): LocationDef[] { return world.visibleLocations(this, region) }
  travelCost(toLocation: string): number | null { return world.travelCost(this, toLocation) }
  travelBaseCost(toLocation: string): number | null { return world.travelBaseCost(this, toLocation) }
  private runLocationRules(locationId: string): void { return effectSystem.runLocationRules.call(this, locationId) }
  checkRules(): void { return effectSystem.checkRules.call(this) }
  fireTrigger(trigger: 'enter_scene' | 'leave_scene' | 'interact' | 'time_tick', _context?: { sceneId?: string; entityId?: string }): boolean { return effectSystem.fireTrigger.call(this, trigger, _context) }
  tryFireRule(ruleId: string, depth = 0): boolean { return effectSystem.tryFireRule.call(this, ruleId, depth) }
  isNpcNameKnown(entityId: string): boolean { return sceneSlots.isNpcNameKnown.call(this, entityId) }
  npcLabel(entity: string | NpcDef): string { return sceneSlots.npcLabel.call(this, entity) }
  learnNpcName(npcId: string, silent = false): void { return sceneSlots.learnNpcName.call(this, npcId, silent) }
  descOf(entityId: string): string { return sceneSlots.descOf.call(this, entityId) }
  private tickNpcMood(): void { social.tickNpcMood(this) }
  private tickPursuit(): void { return encounters.tickPursuit.call(this) }
  togglePreparedAbility(id: string): boolean { return character.togglePreparedAbility.call(this, id) }
  setEntityDescription(entityId: string, text: string): void { return sceneSlots.setEntityDescription.call(this, entityId, text) }
  applyEffects(effects: Effect[], depth = 0): void { return effectSystem.applyEffects.call(this, effects, depth) }
  applyEffect(e: Effect, depth = 0): void { return effectSystem.applyEffect.call(this, e, depth) }
  slotUseOptions(slot: SlotDef): Array<{ itemId: string; label: string; use: SlotUseWith }> { return sceneSlots.slotUseOptions.call(this, slot) }
  useItemOnSlot(slotId: string, itemId: string): boolean { return sceneSlots.useItemOnSlot.call(this, slotId, itemId) }
  unlockRecipe(recipeId: string): void { return economy.unlockRecipe.call(this, recipeId) }
  recipeKnown(id: string): boolean { return economy.recipeKnown.call(this, id) }
  knownRecipes(): RecipeDef[] { return economy.knownRecipes.call(this) }
  entityState(id: string): string | undefined { return sceneSlots.entityState.call(this, id) }
  unlockCodex(entryId: string): void { return sceneSlots.unlockCodex.call(this, entryId) }
  unlockedCodexEntries(): CodexEntryDef[] { return sceneSlots.unlockedCodexEntries.call(this) }
  codexCategories(): Array<{ id: string; label: string }> { return sceneSlots.codexCategories.call(this) }
  fmt(text: string): string { return sceneSlots.fmt.call(this, text) }
  itemInteractable(item: ItemDef): boolean { return sceneSlots.itemInteractable.call(this, item) }
  itemInteractOptions(item: ItemDef): ItemInteractOption[] { return sceneSlots.itemInteractOptions.call(this, item) }
  runItemInteract(item: ItemDef, option: ItemInteractOption): void { return sceneSlots.runItemInteract.call(this, item, option) }
  interactWithSlot(occ: SlotOccupant): boolean { return sceneSlots.interactWithSlot.call(this, occ) }
  private postCombatEffects: Effect[] = []
  onCombatResolve(effects: Effect[]): void { void this.postCombatEffects; return director.onCombatResolve.call(this, effects) }
  startCombat(def: Extract<Effect, { type: 'start_combat' }>): void { return director.startCombat.call(this, def) }
  endCombat(): void { return director.endCombat.call(this) }
  fireRule(ruleId: string): void { return effectSystem.fireRule.call(this, ruleId) }
  resolveDialogueSource(ref: string): { key: string; source: string } | null { return dialogueRuntime.resolveDialogueSource.call(this, ref) }
  startDialogue(entityId: string, knot?: string): void { void this.activeStory; void this.activeNpc; void this.pendingDialogueTimer; void this.pendingDialoguePresenting; return dialogueRuntime.startDialogue.call(this, entityId, knot) }
  chooseDialogueOption(index: number): void { return dialogueRuntime.chooseDialogueOption.call(this, index) }
  endDialogue(): void { return dialogueRuntime.endDialogue.call(this) }
  dismissMessage(): void {
    this.messages.shift()
    this.flushPendingBannersIfClear()
    this.notify()
  }
  gameOver(type: 'death' | 'victory', reason: string, force = false): void { return roguelike.gameOver.call(this, type, reason, force) }
  restart(): GameEngine { return roguelike.restart.call(this, GameEngine) as GameEngine }
  newGamePlusAvailable(): boolean { return roguelike.newGamePlusAvailable.call(this) }
  newGamePlus(): GameEngine | null { return roguelike.newGamePlus.call(this, GameEngine) as GameEngine | null }
  metaProgressEnabled(): boolean { return meta.metaProgressEnabled.call(this) }
  private metaState: MetaStoreState | null = null
  metaStore(): MetaStoreState { void this.metaState; return meta.metaStore.call(this) }
  metaCurrency(id: string): number { return meta.metaCurrency.call(this, id) }
  grantMetaCurrency(id: string, amount: number): void { return meta.grantMetaCurrency.call(this, id, amount) }
  metaAchievementDone(id: string): boolean { return meta.metaAchievementDone.call(this, id) }
  metaCounter(key: string): number { return meta.metaCounter.call(this, key) }
  achievementStates(): { def: AchievementDef; done: boolean; progress?: number; target?: number }[] { return meta.achievementStates.call(this) }
  checkAchievements(): void { return meta.checkAchievements.call(this) }
  private unlockedThisRun: string[] = []
  achievementsUnlockedThisRun(): AchievementDef[] { void this.unlockedThisRun; return meta.achievementsUnlockedThisRun.call(this) }
  private metaRunStart(): void { return meta.metaRunStart.call(this) }
  metaUnlockOwned(id: string): boolean { return meta.metaUnlockOwned.call(this, id) }
  metaUnlockAffordable(u: MetaUnlockDef): boolean { return meta.metaUnlockAffordable.call(this, u) }
  buyMetaUnlock(id: string): boolean { return meta.buyMetaUnlock.call(this, id) }
  generatorsEnabled(): boolean { return encounters.generatorsEnabled.call(this) }
  eventTableDef(id: string): EventTableDef | undefined { return encounters.eventTableDef.call(this, id) }
  rollEventTable(tableId: string, opts: { forced?: boolean; ignoreFilters?: boolean } = {}): string | null { return encounters.rollEventTable.call(this, tableId, opts) }
  private tickEventTables(): void { return encounters.tickEventTables.call(this) }
  genPickWeighted(items: GenWeightedItem[], rand: () => number): string | null { return encounters.genPickWeighted.call(this, items, rand) }
  genValue(generatorId: string, key: string, seed?: string): string { return encounters.genValue.call(this, generatorId, key, seed) }

  difficultyDef(): DifficultyPreset | null {
    const list = this.campaign.meta.difficulties
    if (!list?.length) return null
    const base = list.find((d) => d.id === this.state.player.difficulty) ?? list[0]
    const cycle = this.state.ng_cycle ?? 0
    const boost = this.campaign.meta.new_game_plus?.boost
    if (!cycle || !boost) return base
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
    if (this.difficultyDef()?.no_autosave) return
    this.envelope = writeSave(this.campaign.meta.id, this.state, this.campaign.meta.version, this.envelope ?? undefined) ?? this.envelope
  }
  manualSave(slot: number): boolean {
    if (this.state.game_over) return false
    const env = writeSave(this.campaign.meta.id, this.state, this.campaign.meta.version, undefined, slot)
    if (env) {
      this.pushLog(`Слот ${slot}: забег записан.`)
      this.notify()
    }
    return env !== null
  }
  saveSlotsCount(): number {
    return Math.max(0, Math.min(MAX_SAVE_SLOTS, this.campaign.meta.save_slots ?? 3))
  }
}

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
export function loadSave(campaignId: string): GameState | null {
  return loadState(campaignId)
}
export function deleteSave(campaignId: string): void {
  removeSave(campaignId)
}
export function hasSave(campaignId: string, campaign?: CampaignData): boolean {
  if (!campaign) return loadState(campaignId) !== null
  const opened = inspectSave(campaignId, campaign)
  return !!opened && opened.verdict.kind === 'ok'
}
