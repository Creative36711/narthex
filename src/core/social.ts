import type { ItemDef, NpcDef } from '../shared/types'
import type { EngineCtx } from './context'
import { CHECK_RESULT_LABEL, skillCheck } from './brp'
import { rollDice } from './dice'

export const social = {
  // ─────────────── репутация и фракции (ТЗ 4.8) ───────────────
  
  /**
  * target: id фракции или id NPC.
  * У NPC: base_disposition + личный сдвиг (dispositions[npc.id]) + фракция
  * (если задана) + самочувствие. Личный сдвиг нужен накигэ/драмам, где
  * отношение к человеку важнее «города» — раньше без faction delta глотался.
  */
  getDisposition(ctx: EngineCtx, target: string): number {
    const npc = ctx.campaign.entities[target] as NpcDef | undefined
    if (npc && npc.type === 'npc') {
      const personal = ctx.state.dispositions[target] ?? 0
      const factionValue = npc.faction ? (ctx.state.dispositions[npc.faction] ?? 0) : 0
      // самочувствие NPC (выспался/устал) подкрашивает отношение: ±25
      const moodShift = Math.round((ctx.npcMood(target) - 50) / 2)
      return personal + factionValue + (npc.base_disposition ?? 0) + moodShift
    }
    return ctx.state.dispositions[target] ?? 0
  },

  npcMood(ctx: EngineCtx, entityId: string): number {
    return ctx.state.npc_mood?.[entityId] ?? 50
  },

  /** сдвинуть самочувствие NPC (правила/эффекты; K.D. clamp 0..100) */
  changeNpcMood(ctx: EngineCtx, entityId: string, delta: number): void {
    const m = (ctx.state.npc_mood ??= {})
    m[entityId] = Math.max(0, Math.min(100, (m[entityId] ?? 50) + delta))
  },

  changeDisposition(ctx: EngineCtx, target: string, delta: number): void {
    const npc = ctx.campaign.entities[target] as NpcDef | undefined
    // Личный сдвиг на id NPC (или id фракции, если target — фракция).
    // Раньше NPC без faction молча игнорировался — диалоги «+отношение»
    // ничего не меняли (критично для драм/накигэ).
    const key = target
    if (npc && npc.type !== 'npc' && npc.type !== undefined) {
      // предметы и пр. — не цель отношения
      return
    }
    const cur = ctx.state.dispositions[key] ?? 0
    ctx.state.dispositions[key] = Math.max(-100, Math.min(100, cur + delta))
    const label =
      (npc && npc.type === 'npc' ? npc.label : undefined) ??
      ctx.campaign.meta.factions?.find((f) => f.id === key)?.label ??
      key
    ctx.pushLog(`Отношение «${label}»: ${delta > 0 ? '+' : ''}${delta} (теперь ${ctx.getDisposition(key)}).`)
  },

  /** репутация (opt-in meta.reputation) */
  reputation(ctx: EngineCtx): number {
    return Math.max(0, ctx.state.player.reputation ?? 0)
  },

  /** репутация включена мастером */
  /** Настраиваемая системная надпись интерфейса (design-doc §9, meta.ui_labels) */
  uiLabel(ctx: EngineCtx, key: string, fallback: string): string {
    return ctx.campaign.meta.ui_labels?.[key]?.trim() || fallback
  },

  reputationEnabled(ctx: EngineCtx): boolean {
    return !!ctx.campaign.meta.reputation
  },

  reputationLabel(ctx: EngineCtx): string {
    const cfg = ctx.campaign.meta.reputation
    return (typeof cfg === 'object' && cfg?.label) || 'Репутация'
  },

  changeReputation(ctx: EngineCtx, delta: number): void {
    const next = Math.max(0, ctx.reputation() + delta)
    ctx.state.player.reputation = next
    if (delta > 0) ctx.pushLog(`Слава о вас растёт: репутация ${next}.`)
    else if (delta < 0) ctx.pushLog(`О вас отзываются хуже: репутация ${next}.`)
    ctx.checkRules()
    ctx.notify()
  },

  /** шкала достатка (opt-in meta.wealth_levels) */
  wealthLevels(ctx: EngineCtx): string[] {
    return ctx.campaign.meta.wealth_levels ?? []
  },

  /** текущий уровень достатка (индекс в шкале) */
  wealthLevel(ctx: EngineCtx): number {
    const lv = ctx.wealthLevels()
    return Math.max(0, Math.min(lv.length - 1, ctx.state.player.wealth_level ?? 0))
  },

  wealthLevelLabel(ctx: EngineCtx): string {
    return ctx.wealthLevels()[ctx.wealthLevel()] ?? ''
  },

  /** сдвиг достатка на ±levels ступеней */
  changeWealth(ctx: EngineCtx, levels: number): void {
    const lv = ctx.wealthLevels()
    if (!lv.length) return
    const next = Math.max(0, Math.min(lv.length - 1, ctx.wealthLevel() + levels))
    if (next === ctx.wealthLevel()) return
    ctx.state.player.wealth_level = next
    ctx.pushLog(`Ваш достаток меняется: теперь «${lv[next]}».`)
    ctx.checkRules()
    ctx.notify()
  },

  /** страсть: значение 0..100+ */
  passion(ctx: EngineCtx, id: string): number {
    return ctx.state.player.passions?.[id] ?? 0
  },

  passionLabel(ctx: EngineCtx, id: string): string {
    return ctx.campaign.meta.passions_list?.find((p) => p.id === id)?.label ?? id
  },

  /** создать/сдвинуть страсть (clamped ≥ 0); лог первого появления */
  changePassion(ctx: EngineCtx, id: string, delta: number): void {
    const p = ctx.state.player
    p.passions ??= {}
    const next = Math.max(0, (p.passions[id] ?? 0) + delta)
    const fresh = p.passions[id] == null
    p.passions[id] = next
    if (fresh) ctx.pushLog(`В вас зажигается страсть: «${ctx.passionLabel(id)}» (${next}).`)
    else ctx.pushLog(`Страсть «${ctx.passionLabel(id)}»: ${delta > 0 ? '+' : ''}${delta} → ${next}.`)
    ctx.checkRules()
    ctx.notify()
  },

  /** очки причастности силе */
  allegiance(ctx: EngineCtx, id: string): number {
    return ctx.state.player.allegiance?.[id] ?? 0
  },

  allegianceLabel(ctx: EngineCtx, id: string): string {
    return ctx.campaign.meta.allegiances?.find((a) => a.id === id)?.label ?? id
  },

  /** +очки причастности (по книге без снижения, дельта 0..100+) */
  changeAllegiance(ctx: EngineCtx, id: string, points: number): void {
    const p = ctx.state.player
    p.allegiance ??= {}
    const next = Math.max(0, (p.allegiance[id] ?? 0) + points)
    const fresh = p.allegiance[id] == null
    p.allegiance[id] = next
    if (fresh) ctx.pushLog(`Вы обретаете причастность к «${ctx.allegianceLabel(id)}» (${next}).`)
    else if (points > 0) ctx.pushLog(`Причастность «${ctx.allegianceLabel(id)}»: +${points} → ${next}.`)
    else ctx.pushLog(`Причастность «${ctx.allegianceLabel(id)}»: ${points} → ${next}.`)
    ctx.checkRules()
    ctx.notify()
  },

  // ─────────────── опасности, преступления, цены, лагерь (аудит B7) ───────────────
  
  /**
  * Падение (аудит B7): урон = floor(meters / porog) кубиков, смягчающая
  * проверка навыком (умолчание dodge) уполовинивает. Порог и кубик
  * настраиваются в meta.hazards (книжные: 3 м на 1d6).
  */
  applyFall(ctx: EngineCtx, meters: number, skill?: string): void {
    const hz = ctx.campaign.meta.hazards
    const perDie = Math.max(1, hz?.fall_meters_per_die ?? 3)
    const dice = Math.floor(Math.max(0, meters) / perDie)
    const sane = dice <= 0 ? '0' : `${dice}d6`
    let dmg = 0
    let modLog = ''
    const p = ctx.state.player
    if (dice > 0) {
      const skillId = skill ?? 'dodge'
      const known = p.skills[skillId]
      if (known != null && known > 0) {
        const out = skillCheck(Math.max(1, known), ctx.rng, 0, ctx.diceRules)
        if (out.success) {
          modLog = ` (${ctx.skillLabel(skillId)} смягчает: половина)`
        }
        dmg = rollDice(sane, ctx.rng)
        if (out.success) dmg = Math.max(0, Math.ceil(dmg / 2))
        ctx.pushLog(`Падение с ${meters} м — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}${modLog}`)
      } else {
        dmg = rollDice(sane, ctx.rng)
        ctx.pushLog(`Падение с ${meters} м: ${dmg} урона (${sane}).`)
      }
    }
    if (dmg > 0) ctx.changeHp(-dmg)
    else ctx.pushLog('Падение обошлось без серьёзных травм.')
    ctx.notify()
  },

  /** реестр преступления из кампании */
  crimeLabel(ctx: EngineCtx, id: string): string {
    return ctx.campaign.meta.crimes?.find((c) => c.id === id)?.label ?? id
  },

  /** зафиксировать преступление героя (аудит B7) */
  commitCrime(ctx: EngineCtx, id: string, bounty = 0): void {
    const s = ctx.state
    s.crimes ??= {}
    if (s.crimes[id]) {
      s.crimes[id].bounty += Math.max(0, bounty)
    } else {
      s.crimes[id] = { bounty: Math.max(0, bounty), tick: s.tick }
    }
    ctx.pushLog(`Совершено преступление: «${ctx.crimeLabel(id)}»${bounty > 0 ? ` (награда за голову ${bounty})` : ''}.`)
    ctx.checkRules()
    ctx.notify()
  },

  /** преступление совершено? (любое — без id; minBounty — порог награды) */
  hasCrime(ctx: EngineCtx, id?: string, minBounty = 0): boolean {
    const list = ctx.state.crimes ?? {}
    if (!id) return Object.values(list).some((c) => minBounty <= 0 ? true : c.bounty >= minBounty)
    const c = list[id]
    if (!c) return false
    return minBounty <= 0 ? true : c.bounty >= minBounty
  },

  /** суммарная награда за голову героя */
  bountyTotal(ctx: EngineCtx): number {
    return Object.values(ctx.state.crimes ?? {}).reduce((sum, c) => sum + c.bounty, 0)
  },

  /** активные ценовые события */
  priceEventsActive(ctx: EngineCtx): Array<{ id: string; label: string }> {
    const reg = ctx.campaign.meta.price_events ?? []
    return (ctx.state.price_events ?? []).map((id) => ({ id, label: reg.find((e) => e.id === id)?.label ?? id }))
  },

  /** включить/выключить ценовое событие (аудит B7) */
  setPriceEvent(ctx: EngineCtx, id: string, on: boolean): void {
    const list = (ctx.state.price_events ??= [])
    if (on) {
      if (!ctx.campaign.meta.price_events?.some((e) => e.id === id)) return
      if (!list.includes(id)) {
        list.push(id)
        ctx.pushLog(`Ценник меняется: «${ctx.campaign.meta.price_events.find((e) => e.id === id)!.label}».`)
      }
    } else if (id) {
      const i = list.indexOf(id)
      if (i >= 0) list.splice(i, 1)
    } else if (list.length) {
      list.length = 0
      ctx.pushLog('Ценники снова прежние.')
    }
    ctx.checkRules()
    ctx.notify()
  },

  /** множитель цен по активным ценовым событиям для данного предмета */
  priceEventMultiplier(ctx: EngineCtx, item: ItemDef): number {
    if (!ctx.state.price_events?.length) return 1
    let mult = 1
    for (const id of ctx.state.price_events) {
      const ev = ctx.campaign.meta.price_events?.find((e) => e.id === id)
      if (!ev) continue
      if (ev.items?.length && !ev.items.includes(item.id)) continue
      if (ev.categories?.length && !ev.categories.includes(item.category)) continue
      mult *= ev.multiplier
    }
    return mult
  },

  /** разрешён ли здесь лагерь (аудит B7): meta.camping + локация с camp: true */
  campAvailable(ctx: EngineCtx): { ok: boolean; reason: string } {
    const cfg = ctx.campaign.meta.camping
    if (!cfg) return { ok: false, reason: 'мастер не включил ночлег (meta.camping)' }
    if (ctx.combat || ctx.trade || ctx.craftRequest) return { ok: false, reason: 'сейчас не до отдыха' }
    const loc = ctx.findLocation(ctx.state.location)?.location
    if (!loc?.camp) return { ok: false, reason: 'здесь лагерь не разбить (location.camp)' }
    return { ok: true, reason: '' }
  },

  /**
  * Раз в сутки: самочувствие NPC с расписанием. Чьё расписание покрывает
  * ночь (от начала ночи до утра) — тот отсыпается (+10); кто без ночёвки
  * по расписанию — устаёт (−10). Диапазоны времени поддерживают полночь.
  */
  tickNpcMood(ctx: EngineCtx): void {
    const meta = ctx.campaign.meta
    const tpd = meta.ticks_per_day ?? 24
    const nightStart = meta.time_of_day?.night ?? 22
    const morning = meta.time_of_day?.morning ?? 6
    const spanNight = (((morning - nightStart) % tpd) + tpd) % tpd || tpd
    const nightPts = [0, 0.25, 0.5, 0.75].map((f) => (nightStart + Math.floor(spanNight * f)) % tpd)
    for (const [id, ent] of Object.entries(ctx.campaign.entities)) {
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
      ctx.changeNpcMood(id, slept ? 10 : -10)
    }
  },
}
