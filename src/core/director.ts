import type { EngineCtx } from './context'
import type { ArtDoc, CameraDoc, CutsceneDef, Effect, SceneDef } from '../shared/types'
import { featureOn } from './caps'
import { stopVoiceAudio } from '../shared/voiceAudio'
import { playUi } from '../shared/audio'
import { CombatController } from './combat'

/** Нужно ли показывать вводное повествование сцены (narrative_intro) */
function shouldShowNarrativeIntro(this: EngineCtx, scene: SceneDef): boolean {
    if (!scene.narrative_intro || scene.narrative_intro.length === 0) return false
    const once = scene.narrative_intro_once ?? true
    if (!once) return true
    return !(this.state.seen_narrative_intros ?? []).includes(scene.id)
  }

/** Активно ли сейчас нарративное вводное повествование сцены */
function isSceneIntroActive(this: EngineCtx): boolean {
    const sc = this.campaign.scenes[this.state.scene]
    if (!sc) return false
    return this.shouldShowNarrativeIntro(sc) && !this.cutscene && !this.dialogue && !this.combat
  }

/** Пометить вводное повествование сцены как просмотренное */
function markNarrativeIntroSeen(this: EngineCtx, sceneId: string): void {
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

// ─────────────── катсцены (итерация 8, блок E) ───────────────

  /** текущая катсцена (первая в очереди) */
function cutscene(this: EngineCtx): CutsceneDef | null {
    return this.cutsceneQueue[0]?.def ?? null
  }

/** уникальный номер показа текущей катсцены (ключ для UI) */
function cutsceneKey(this: EngineCtx): number {
    return this.cutsceneQueue[0]?.serial ?? 0
  }

function showBanner(this: EngineCtx, e: { text: string; preset?: string; enter?: string; seconds?: number; position?: string; accent?: string }): void {
    const serial = this.bannerSerial++
    this.banners = [...this.banners, { serial, ...e }]
    const seconds = e.seconds ?? Math.min(8, Math.max(3, e.text.length * 0.06))
    if (this.cutsceneQueue.length > 0) {
      // Пока идет катсцена, таймер баннера ждет ее окончания
      this.bannerPendingTimers.push({ serial, seconds })
    } else {
      globalThis.setTimeout(() => {
        if (this.banners.some((b: { serial: number }) => b.serial === serial)) {
          this.banners = this.banners.filter((b: { serial: number }) => b.serial !== serial)
          this.notify()
        }
      }, seconds * 1000)
    }
    this.notify()
  }

function showPostcard(this: EngineCtx, e: { image?: string; art?: ArtDoc; text?: string; preset?: string; seconds?: number; camera?: CameraDoc }): void {
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
function hidePostcard(this: EngineCtx): void {
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

function flushPendingBannersIfClear(this: EngineCtx): void {
    if (!this.cutsceneQueue.length && !this.isSceneIntroActive() && !this.postcard && !this.messages.length) {
      if (this.bannerPendingTimers.length) {
        for (const item of this.bannerPendingTimers) {
          globalThis.setTimeout(() => {
            if (this.banners.some((b: { serial: number }) => b.serial === item.serial)) {
              this.banners = this.banners.filter((b: { serial: number }) => b.serial !== item.serial)
              this.notify()
            }
          }, item.seconds * 1000)
        }
        this.bannerPendingTimers = []
      }
    }
  }

function playCutscene(this: EngineCtx, id: string): void {
    const def = this.campaign.cutscenes?.[id]
    if (!def || !def.slides?.length) return
    if (this.cutsceneQueue.some((c: { def: CutsceneDef; serial: number }) => c.def.id === id)) return
    stopVoiceAudio()
    this.cutsceneQueue.push({ def, serial: ++this.cutsceneSerial })
    this.pushLog(`Катсцена: «${def.label}»`)
    this.notify()
  }

/** катсцена досмотрена или пропущена */
function endCutscene(this: EngineCtx): void {
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

/**
   * Вызывается боем в момент его разрешения — победы, бегства игрока или
   * «бессознательного» проигрыша (BRP-режим). Безопасные эффекты применяются
   * сразу, пока игрок видит экран исхода; смена экрана (диалог, телепорт,
   * новый бой, финал) — после закрытия боя.
   */
function onCombatResolve(this: EngineCtx, effects: Effect[]): void {
    const defer = new Set(['start_dialogue', 'start_combat', 'teleport_player', 'game_over_victory', 'game_over_death', 'play_cutscene'])
    this.postCombatEffects = effects.filter((e) => defer.has(e.type))
    this.applyEffects(effects.filter((e) => !defer.has(e.type)))
    this.notify()
  }

function startCombat(this: EngineCtx, def: Extract<Effect, { type: 'start_combat' }>): void {
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
function endCombat(this: EngineCtx): void {
    const combat = this.combat
    if (!combat) return
    this.combat = null
    // похороны отряда: погибшие в бою напарники покидают отряд навсегда
    for (const ally of combat.combatants.filter((c: { id: string; dead: boolean; entityId: string; side: string }) => c.id.startsWith('c_ally_') && c.dead)) {
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
      this.state.stats_run.kills += combat.combatants.filter((c: { id: string; dead: boolean; entityId: string; side: string }) => c.side === 'enemy' && c.dead).length
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

export const director = {
  shouldShowNarrativeIntro,
  isSceneIntroActive,
  markNarrativeIntroSeen,
  cutscene,
  cutsceneKey,
  showBanner,
  showPostcard,
  hidePostcard,
  flushPendingBannersIfClear,
  playCutscene,
  endCutscene,
  onCombatResolve,
  startCombat,
  endCombat,
}
