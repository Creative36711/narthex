import type { EngineCtx } from './context'
import type { Condition, DiceRules, DurationActionDef, Effect, NpcDef } from '../shared/types'
import { evalCondition } from './conditions'
import { skillCheck, CHECK_RESULT_LABEL, type SkillCheckOutcome } from './brp'
import { world } from './world'

/** Типы эффектов, разрешённых в почасовом per_tick (белый список dz.20). */
const DURATION_TICK_EFFECTS = new Set([
    'change_need', 'change_hp', 'change_fatigue', 'change_sanity',
  ])

// ─────────────── удача (аудит §5.6 п.8) ───────────────

  /** максимум удачи: POW × meta.luck.multiplier (умолчание 5). Система opt-in: нет meta.luck — удачи нет. */
function luckMax(this: EngineCtx): number {
    const cfg = this.campaign.meta.luck
    if (!cfg) return 0
    const mult = cfg.multiplier ?? 5
    return Math.max(0, this.state.player.stats.POW * mult)
  }

/** текущие очки удачи (старые сейвы без поля считаются полными) */
function luck(this: EngineCtx): number {
    const max = this.luckMax()
    return Math.min(max, this.state.player.luck ?? max)
  }

/** потратить/вернуть очки удачи; ложь — не хватает */
function changeLuck(this: EngineCtx, delta: number): boolean {
    const cur = this.luck()
    const next = Math.max(0, Math.min(this.luckMax(), cur + delta))
    if (delta < 0 && cur + delta < 0) return false
    this.state.player.luck = next
    return true
  }

function applyTickEffects(this: EngineCtx, effects: Effect[] | undefined, skipped: { done: boolean }): void {
    if (!effects) return
    for (const fx of effects) {
      if (!DURATION_TICK_EFFECTS.has(fx.type)) {
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
function runTicksFlow(this: EngineCtx, opts: {
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
      applyTickEffects.call(this, opts.perTick, skipped)
      this.advanceTicks(1)
      if (this.state.game_over) return
      if (opts.breakWhen && opts.breakWhen.some((c) => evalCondition(c, this))) {
        interruptTicksFlow.call(this, opts.label, opts.interruptRule, i + 1)
        return
      }
      if ((opts.interruptChance ?? 0) > 0 && this.rng.chance(opts.interruptChance!)) {
        interruptTicksFlow.call(this, opts.label, opts.interruptRule, i + 1)
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

function interruptTicksFlow(this: EngineCtx, label: string, rule: string | undefined, afterTicks: number): void {
    this.pushLog(`${label} прервано на ${afterTicks}-м часу: что-то пошло не по плану.`)
    if (rule) this.fireRule(rule)
    this.autosave()
    this.notify()
  }

/** Границы/параметры текущего запроса — читает UI-окно выбора. */
function durationRequestInfo(this: EngineCtx): {
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

function cancelDurationRequest(this: EngineCtx): void {
    if (!this.durationRequest) return
    this.durationRequest = null
    this.notify()
  }

/** Игрок подтвердил длину в окне выбора. */
function confirmDurationRequest(this: EngineCtx, ticks: number): void {
    const req = this.durationRequest
    if (!req) return
    this.durationRequest = null
    if (req.kind === 'camp') { this.campRest(ticks); return }
    this.runDurationAction(req.action, ticks)
  }

/** Игрок нажал «Разбить лагерь»: всегда через окно выбора (при фиксированной длине — как окно подтверждения с прогнозом). */
function requestCampRest(this: EngineCtx): void {
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
function requestDurationAction(this: EngineCtx, id: string, ticks?: number | null): void {
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
function runDurationAction(this: EngineCtx, def: DurationActionDef, ticks: number): void {
    const min = Math.max(1, Math.floor(def.min_ticks ?? 1))
    const max = Math.max(min, Math.floor(def.max_ticks ?? min))
    const step = Math.max(1, Math.floor(def.step ?? 1))
    let chosen = Math.min(max, Math.max(min, Number.isFinite(ticks) ? Math.floor(ticks) : min))
    chosen = Math.min(max, min + step * Math.round((chosen - min) / step))
    if (def.available_when && !def.available_when.every((c) => evalCondition(c, this))) return
    this.pushLog(`${def.label}: начало — ${chosen} ч.`)
    runTicksFlow.call(this, {
      label: def.label,
      ticks: chosen,
      perTick: def.per_tick,
      interruptChance: Math.max(0, Math.min(1, def.interrupt_chance_per_tick ?? 0)),
      interruptRule: def.interrupt_rule,
      breakWhen: def.break_when,
      onFinish: def.on_finish,
    })
  }

function campRest(this: EngineCtx, ticks?: number): void {
    const cfg = this.campaign.meta.camping
    if (!cfg || !this.campAvailable().ok) return
    const min = Math.max(1, Math.floor(cfg.min_ticks ?? cfg.ticks ?? 8))
    const max = Math.max(min, Math.floor(cfg.max_ticks ?? cfg.ticks ?? 8))
    const chosen = Math.min(max, Math.max(min, Math.floor(ticks ?? cfg.ticks ?? 8)))
    this.pushLog('Вы разбиваете лагерь и устраиваетесь на ночлег…')
    runTicksFlow.call(this, {
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

/** игрок ответил на предложение удачи (UI) */
function resolveLuckOffer(this: EngineCtx, reroll: boolean): void {
    const offer = this.luckOffer
    this.luckOffer = null
    offer?.decide(reroll)
    this.notify()
  }

/**
   * Синхронно бросить проверку и применить успех/провал-эффекты.
   * Если включена удача и броска не вышло — игроку предлагают переброс,
   * но эффекты ждут ответа (ложь возвращает «эффекты уже применились»).
   */
function applyByCheck(this: EngineCtx, outcome: SkillCheckOutcome, describe: string, retry: () => SkillCheckOutcome, onOk: () => void, onFail: () => void): boolean {
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
      decide: (reroll: boolean) => {
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
function playerCheckOutcome(this: EngineCtx, target: number, modifier: number, describe: string): SkillCheckOutcome {
    const out = skillCheck(Math.max(1, target), this.rng, modifier, this.diceRules)
    this.pushLog(`${describe} — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`)
    return out
  }

/**
   * Аугмент страсти и подмога союзника (аудит B6, книжные аугменты):
   * порог значения — meta.augments.threshold (умолчание 50),
   * прибавка к броску — meta.augments.bonus (умолчание +20, книжно).
   */
function augmentBonus(this: EngineCtx, e: { augment_passion?: string; assist_entity?: string; assist_skill?: string }, fallbackSkill?: string): number {
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

/** Бросок проверки характеристики героя (POW×5 — удача, INT×5 — идея). */
function statCheck(this: EngineCtx, stat: string, multiplier = 5, modifier = 0): SkillCheckOutcome {
    return playerCheckOutcome.call(this,
      ((this.state.player.stats as unknown as Record<string, number>)[stat] ?? 0) * multiplier,
      modifier,
      `Проверка характеристики ${stat}×${multiplier}`,
    )
  }

/**
   * Противоборство навыком героя (аудит §5.6 п.6): бросок героя против
   * броска оппонента (NPC или числовой порог), ранги из diceRules-таблицы.
   */
function opposedCheck(this: EngineCtx, e: Extract<Effect, { type: 'opposed_check' }>): { success: boolean; player: SkillCheckOutcome; rival: SkillCheckOutcome } {
    const skill = e.skill
    const playerValue = Math.max(1, this.skillEffective(skill) + this.statusSkillMod(skill) + augmentBonus.call(this, e, skill))
    const player = playerCheckOutcome.call(this, playerValue, 0, `Противоборство «${this.skillLabel(skill)}» (герой)`)
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
    const rival = playerCheckOutcome.call(this, rivalValue, 0, `Противоборство (${rivalLabel})`)
    const RANK: Record<string, number> = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 }
    const cmp = (RANK[player.result] ?? 1) - (RANK[rival.result] ?? 1)
    const wins = cmp > 0 || (cmp === 0 && (e.tie ?? 'player') === 'player')
    if (cmp === 0) this.pushLog(`Равный исход — победа ${wins ? 'героя' : 'оппонента'} по умолчанию.`)
    this.pushLog(wins ? 'Герой побеждает в противоборстве.' : 'Герой проигрывает противоборство.')
    if (player.success) this.markSkill(skill)
    return { success: wins, player, rival }
  }

/** Правила бросков d100 этой кампании (итерация 8, А7). */
function diceRules(this: EngineCtx): DiceRules { return world.diceRules(this) }

export const checks = {
  luckMax,
  luck,
  changeLuck,
  applyTickEffects,
  runTicksFlow,
  interruptTicksFlow,
  durationRequestInfo,
  cancelDurationRequest,
  confirmDurationRequest,
  requestCampRest,
  requestDurationAction,
  runDurationAction,
  campRest,
  resolveLuckOffer,
  applyByCheck,
  playerCheckOutcome,
  augmentBonus,
  statCheck,
  opposedCheck,
  diceRules,
}
