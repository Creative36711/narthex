import type { ActiveStatus, ItemDef, NeedCondition, NpcDef, StatusDef } from '../shared/types'
import { featureOn } from './caps'
import { migrateNeedCondition } from '../shared/migrate'
import type { EngineCtx } from './context'
import { CHECK_RESULT_LABEL, skillCheck } from './brp'
import { rollDice } from './dice'
import { timeOfDay } from './time'
import { playInteraction } from '../shared/audio'

export const needs = {
  // ─────────────── время и потребности ───────────────
  
  /**
  * Условие потребности (когда убывает / когда восстанавливается).
  * Итерация 8, А3: «в локации» и «есть/надет предмет» — СПИСКИ id,
  * условие истинно, если выполнено хотя бы одно значение («любой из»).
  */
  needCondOk(ctx: EngineCtx, raw: NeedCondition): boolean {
    const c = migrateNeedCondition(raw)
    switch (c.type) {
      case 'time_of_day':
        return c.values.includes(timeOfDay(ctx.state.tick, ctx.campaign.meta))
      case 'flag':
        return !!ctx.state.flags[c.flag] !== !!c.not
      case 'in_location':
        return (c.locations ?? []).includes(ctx.state.location) !== !!c.not
      case 'has_item':
        return (c.items ?? []).some((id) => ctx.hasItem(id)) !== !!c.not
      case 'equipped':
        return (c.items ?? []).some((id) => ctx.isEquipped(id)) !== !!c.not
      case 'weather':
        return (ctx.state.weather ?? '') === c.weather !== !!c.not
    }
  },

  advanceTicks(ctx: EngineCtx, ticks: number, hooks: { tickPursuit(): void; tickNpcMood(): void; tickEventTables(): void }): void {
    const meta = ctx.campaign.meta
    const needsOn = featureOn(meta, 'needs')
    for (let i = 0; i < ticks; i++) {
      if (ctx.state.game_over) return
      ctx.state.tick += 1
      ctx.state.stats_run.ticks_survived += 1
      if (needsOn) {
        for (const need of meta.needs) {
          // старые сохранения могут не знать новую потребность — считаем её полной
          const cur = ctx.state.player.needs[need.id] ?? need.max
          let next = cur
          // убыль — только когда все условия выполнены (пусто = всегда)
          const decays = !need.decay_when?.length || need.decay_when.every((c) => needs.needCondOk(ctx, c))
          if (decays) next = Math.max(0, next - need.decay_per_tick * (ctx.difficultyDef()?.need_decay ?? 1))
          // восстановление — когда выполнены условия restore_when
          if (
            need.restore_per_tick &&
            (!need.restore_when?.length || need.restore_when.every((c) => needs.needCondOk(ctx, c)))
          ) {
            next = Math.min(need.max, next + need.restore_per_tick)
          }
          ctx.state.player.needs[need.id] = next
          if (next <= 0 && cur > 0) needs.onNeedZero(ctx, need.id)
        }
      }
      // потребности напарников (NpcDef.companion_needs): те же темпы и условия
      // убыли/восстановления, что у героя; без «на нуле»-исходов — это
      // истощение существа, а не конец игры (последствия описывает мастер
      // правилами через условия companion_need_le/ge)
      if (needsOn && ctx.state.party.length) {
        for (const comp of ctx.state.party) {
          if (!comp.needs) continue
          for (const need of meta.needs) {
            const cur = comp.needs[need.id]
            if (cur === undefined) continue
            let next = cur
            const decays = !need.decay_when?.length || need.decay_when.every((c) => needs.needCondOk(ctx, c))
            if (decays) next = Math.max(0, next - need.decay_per_tick * (ctx.difficultyDef()?.need_decay ?? 1))
            if (
              need.restore_per_tick &&
              (!need.restore_when?.length || need.restore_when.every((c) => needs.needCondOk(ctx, c)))
            ) {
              next = Math.min(need.max, next + need.restore_per_tick)
            }
            comp.needs[need.id] = next
            if (next <= 0 && cur > 0) {
              const cdef = ctx.campaign.entities[comp.entity] as NpcDef | undefined
              ctx.pushLog(`${cdef?.label ?? comp.entity} на пределе: ${need.label.toLowerCase()} на нуле.`)
            }
          }
        }
      }
      // статусы игрока (блок 5 ТЗ): DoT, декремент, истечение
      needs.tickStatuses(ctx)
      // преследование (start_pursuit): периодические цепочные проверки маскировки
      if (ctx.state.pursuit) {
        ctx.state.pursuit.left -= 1
        if (ctx.state.pursuit.left <= 0) hooks.tickPursuit()
      }
      // смена суток: самочувствие NPC (спал по расписанию / не спал)
      const tpd = meta.ticks_per_day ?? 24
      if (tpd > 0 && ctx.state.tick > 0 && ctx.state.tick % tpd === 0) hooks.tickNpcMood()
      // порча скоропортящихся предметов от времени
      needs.tickPerishableItems(ctx, 1)
    }
    // достижения со счётчиками (прожитые тики и пр.) — после пачки тиков
    ctx.checkAchievements()
    // таблицы случайных событий ходят тем же шагом, что и тики мира (аудит B9)
    hooks.tickEventTables()
    // правила на tick_elapsed / need_* (поезд ушёл, таймеры драм) — иначе
    // «последний поезд в 22:00» срабатывал только после смены сцены/диалога
    ctx.checkRules()
  },

  /** Обработка порчи скоропортящихся предметов со временем (decay_ticks / freshness) */
  tickPerishableItems(ctx: EngineCtx, ticks: number): void {
    const inv = ctx.state.player.inventory
    for (let i = inv.length - 1; i >= 0; i--) {
      const slot = inv[i]
      if (slot.freshness === undefined) continue
      slot.freshness = Math.max(0, slot.freshness - ticks)
      if (slot.freshness === 0) {
        const def = ctx.campaign.entities[slot.item] as ItemDef | undefined
        const title = def?.label ?? slot.item
        const msg = def?.spoil_msg || `«${title}» испортился от времени.`
        ctx.pushLog(msg)
        ctx.pushToast(msg, 'info')

        if (def?.spoil_action === 'rule' && def.spoil_rule) {
          ctx.fireRule(def.spoil_rule)
        }

        if (def?.spoil_into) {
          const replacement = def.spoil_into
          const repDef = ctx.campaign.entities[replacement] as ItemDef | undefined
          slot.item = replacement
          slot.freshness = repDef?.decay_ticks !== undefined ? repDef.decay_ticks : undefined
          if (repDef?.label) {
            ctx.pushLog(`Превратилось в: ${repDef.label}.`)
          }
        } else {
          // удаление из инвентаря
          inv.splice(i, 1)
          // если предмет был надет в слот экипировки — снимаем
          for (const eqSlot of Object.keys(ctx.state.player.equipment)) {
            if (ctx.state.player.equipment[eqSlot] === slot.item) {
              delete ctx.state.player.equipment[eqSlot]
            }
          }
        }
      }
    }
  },

  /** один тик мировых статусов игрока; статус сам по себе не убивает (мин. 1 HP) */
  tickStatuses(ctx: EngineCtx): void {
    const list = ctx.state.player.statuses
    if (!list?.length) return
    const expired: StatusDef[] = []
    const cured: string[] = []
    for (const s of list) {
      const def = needs.statusDef(ctx, s.id)
      if (!def) continue
      // болезни/яды с течением (аудит B7): стадии — спасбросок CON; DoT и модификаторы масштабированы тяжестью
      const severity = Math.max(1, s.severity ?? 1)
      if (def.dot?.hp) ctx.state.player.hp = Math.max(1, ctx.state.player.hp - def.dot.hp * severity)
      if (def.dot?.mp) ctx.state.player.mp = Math.max(0, ctx.state.player.mp - def.dot.mp * severity)
      if (def.dot?.hp) ctx.pushLog(`${def.label}: −${def.dot.hp * severity} HP${severity > 1 ? ` (тяжесть ${severity})` : ''}.`)
      if (def.disease && (s.next_check ?? Infinity) <= ctx.state.tick) {
        const mult = def.disease.con_multiplier ?? 5
        const out = skillCheck(ctx.state.player.stats.CON * mult, ctx.rng, 0, ctx.diceRules)
        ctx.pushLog(`${def.label}: стадия течения — CON×${mult}, d100=${out.roll} против ${out.target} → ${CHECK_RESULT_LABEL[out.result]}`)
        s.next_check = ctx.state.tick + def.disease.interval_ticks
        if (out.success) {
          s.severity = Math.max(0, severity - 1)
          if (s.severity === 0) {
            cured.push(s.id)
            continue
          }
          ctx.pushLog(`${def.label}: тяжесть снижается до ${s.severity}.`)
        } else {
          const cap = def.disease.severity_max ?? 5
          s.severity = Math.min(cap, severity + 1)
          ctx.pushLog(`${def.label}: болезнь ухудшается — тяжесть ${s.severity}/${cap}.`)
        }
      }
      s.left -= 1
      if (s.left <= 0) expired.push(def)
    }
    if (cured.length) {
      ctx.state.player.statuses = (ctx.state.player.statuses ?? []).filter((s) => !cured.includes(s.id))
      for (const id of cured) {
        const def = needs.statusDef(ctx, id)
        ctx.pushLog(`${def?.label ?? id}: выздоровление.`)
      }
    }
    if (expired.length) {
      ctx.state.player.statuses = list.filter((s) => s.left > 0)
      for (const def of expired) {
        ctx.pushLog(def.expire_message ?? `${def.label}: эффект закончился.`)
        if (def.on_expire?.length) ctx.applyEffects(def.on_expire)
      }
      ctx.notify()
    }
  },

  onNeedZero(ctx: EngineCtx, needId: string): void {
    const need = ctx.campaign.meta.needs.find((n) => n.id === needId)
    if (!need) return
    if (need.on_zero_effect === 'death' || !need.on_zero_effect) {
      ctx.gameOver('death', `Смерть от истощения: ${need.label.toLowerCase()} на нуле.`)
      return
    }
    const rule = ctx.campaign.rules[need.on_zero_effect]
    if (rule) ctx.applyEffects(rule.effects ?? [])
  },

  changeNeed(ctx: EngineCtx, needId: string, delta: number): void {
    if (!featureOn(ctx.campaign.meta, 'needs')) return
    const need = ctx.campaign.meta.needs.find((n) => n.id === needId)
    if (!need) return
    const cur = ctx.state.player.needs[needId] ?? 0
    const next = Math.min(need.max, Math.max(0, cur + delta))
    ctx.state.player.needs[needId] = next
    // общий стол: рост потребности героя делят напарники, отслеживающие ту же
    // потребность (еда/вода/сон на двоих); убыль — всегда личная
    if (delta > 0) {
      for (const comp of ctx.state.party) {
        if (comp.needs?.[needId] !== undefined) ctx.changeCompanionNeed(comp.entity, needId, delta)
      }
    }
    if (next <= 0 && cur > 0) needs.onNeedZero(ctx, needId)
  },

  changeHp(ctx: EngineCtx, delta: number): void {
    if (ctx.debugInvincible && delta < 0) return
    const p = ctx.state.player
    p.hp = Math.min(p.max_hp, p.hp + delta)
    if (p.hp <= 0 && !needs.tryBrpSurvival(ctx)) ctx.gameOver('death', 'Ваши раны оказались смертельными.')
  },

  /**
  * Мировой спасбросок от смерти (режим combat.death.mode='brp'): при HP ≤ 0
  * бросок CON×con_multiplier; успех — герой выживает на грани (1 HP).
  * Истина — смерть отменена.
  */
  tryBrpSurvival(ctx: EngineCtx): boolean {
    const death = ctx.campaign.meta.combat?.death
    if (death?.mode !== 'brp') return false
    const mult = death.con_multiplier ?? 5
    const out = skillCheck(ctx.state.player.stats.CON * mult, ctx.rng, 0, ctx.diceRules)
    ctx.pushLog(`Грань смерти: CON×${mult} — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`)
    if (!out.success) return false
    ctx.state.player.hp = 1
    ctx.pushLog('Герой выживает на грани смерти (1 HP).')
    return true
  },

  /**
  * Естественное лечение при отдыхе (аудит §5.6 п.3): сон (ink-вызов `sleep`)
  * лечит HP костями из `meta.rest.hp` (умолчание '1d3') и, если не отключено
  * (`rest.mp_full: false`), полностью восстанавливает MP.
  */
  restHeal(ctx: EngineCtx): { hp: number; mpFull: boolean } {
    const rest = ctx.campaign.meta.rest
    const p = ctx.state.player
    let healed = 0
    if (p.hp > 0 && p.hp < p.max_hp) {
      healed = Math.min(p.max_hp - p.hp, rollDice(rest?.hp ?? '1d3', ctx.rng))
      if (healed > 0) {
        p.hp += healed
        ctx.pushLog(`Отдых восстанавливает ${healed} HP.`)
      }
    }
    // напарники отдыхают вместе с отрядом: те же кости естественного лечения
    for (const comp of ctx.state.party) {
      if (comp.hp > 0 && comp.hp < comp.max_hp) {
        const cHealed = Math.min(comp.max_hp - comp.hp, rollDice(rest?.hp ?? '1d3', ctx.rng))
        if (cHealed > 0) {
          comp.hp += cHealed
          const cdef = ctx.campaign.entities[comp.entity] as NpcDef | undefined
          ctx.pushLog(`${cdef?.label ?? comp.entity} подлатался: +${cHealed} HP.`)
        }
      }
    }
    const mpFull = rest?.mp_full ?? true
    if (mpFull && p.mp < p.max_mp) {
      p.mp = p.max_mp
      ctx.pushLog('Силы восстановлены (MP полностью).')
    }
    // удача восполняется на отдыхе (мастер может запретить luck.rest_luck=false)
    if (ctx.luckMax() > 0 && (ctx.campaign.meta.luck?.rest_luck ?? true) && ctx.luck() < ctx.luckMax()) {
      ctx.state.player.luck = ctx.luckMax()
      ctx.pushLog('Герой чувствует: удача вернулась.')
    }
    // усталость снимается отдыхом (мастер может запретить vitals.fatigue.rest_restore=false)
    if (ctx.fatigueMax() > 0) {
      const cfg = ctx.campaign.meta.vitals?.fatigue
      const restore = cfg === true ? true : (typeof cfg === 'object' ? cfg.rest_restore !== false : true)
      if (restore && ctx.fatigue() < ctx.fatigueMax()) {
        ctx.state.player.fatigue = ctx.fatigueMax()
        ctx.pushLog('Усталость прошла (отдых).')
      }
    }
    return { hp: healed, mpFull }
  },

  // ─────────────── статусы (блок 5 ТЗ «Гибкий движок») ───────────────
  
  /** определение статуса из реестра кампании */
  statusDef(ctx: EngineCtx, id: string): StatusDef | undefined {
    return ctx.campaign.meta.statuses?.find((s) => s.id === id)
  },

  /** активен ли статус у игрока */
  hasStatus(ctx: EngineCtx, id: string): boolean {
    return !!ctx.state.player.statuses?.some((s) => s.id === id)
  },

  /**
  * Наложить статус на игрока (в мире — только игрок, v1). Повторное
  * наложение обновляет длительность по максимуму.
  */
  applyStatus(ctx: EngineCtx, _target: 'player', id: string, duration?: number): void {
    const def = needs.statusDef(ctx, id)
    if (!def || def.scope === 'combat') return // чисто боевые — через бой (блок 6)
    const left = duration ?? def.duration
    if (left <= 0) return
    const list = (ctx.state.player.statuses ??= [])
    const existing = list.find((s) => s.id === id)
    if (existing) {
      existing.left = Math.max(existing.left, left)
      return
    }
    // болезни/яды с течением (аудит B7): стартовая тяжесть и первая стадия
    const entry: ActiveStatus = { id, left }
    if (def.disease) {
      entry.severity = 1
      entry.next_check = ctx.state.tick + def.disease.interval_ticks
    }
    list.push(entry)
    ctx.pushLog(def.apply_message ?? `${def.label}: эффект наложен.`)
    if (def.apply_sound) playInteraction(def.apply_sound, { sound: def.apply_sound })
    if (def.on_apply?.length) ctx.applyEffects(def.on_apply)
    ctx.notify()
  },

  /** снять статус (без срабатывания on_expire) */
  removeStatus(ctx: EngineCtx, _target: 'player', id: string): void {
    const list = ctx.state.player.statuses
    if (!list?.some((s) => s.id === id)) return
    ctx.state.player.statuses = list.filter((s) => s.id !== id)
    const def = needs.statusDef(ctx, id)
    if (def) {
      ctx.pushLog(`${def.label}: эффект снят.`)
      if (def.remove_sound) playInteraction(def.remove_sound, { sound: def.remove_sound })
    }
    ctx.notify()
  },

  /** суммарный модификатор навыка от активных статусов (болезни масштабированы тяжестью) */
  statusSkillMod(ctx: EngineCtx, skill: string): number {
    let mod = 0
    for (const s of ctx.state.player.statuses ?? []) {
      const def = needs.statusDef(ctx, s.id)
      const sev = def?.disease ? Math.max(1, s.severity ?? 1) : 1
      for (const m of def?.skill_mods ?? []) if (m.skill === skill) mod += m.delta * sev
    }
    return mod
  },
}
