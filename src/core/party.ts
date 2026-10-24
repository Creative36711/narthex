import type { CompanionState, ItemDef, NeedDef, NpcDef } from '../shared/types'
import { featureOn } from './caps'
import type { EngineCtx } from './context'
import { derivedHP } from './brp'
import { playInteraction } from '../shared/audio'

export const party = {
  // ─────────────── напарники (ТЗ 4.11) ───────────────
  joinParty(ctx: EngineCtx, entityId: string): void {
    const max = ctx.campaign.meta.max_companions ?? 1
    if (ctx.state.party.length >= max) return
    if (ctx.state.party.some((c) => c.entity === entityId)) return
    const def = ctx.campaign.entities[entityId] as NpcDef | undefined
    if (!def || def.type !== 'npc') return
    const hp = def.stats.HP ?? derivedHP(def.stats)
    const comp: CompanionState = { entity: entityId, hp, max_hp: hp }
    // потребности напарника (NpcDef.companion_needs) стартуют полными
    if (def.companion_needs?.length && featureOn(ctx.campaign.meta, 'needs')) {
      comp.needs = {}
      for (const id of def.companion_needs) {
        const need = ctx.campaign.meta.needs.find((n) => n.id === id)
        if (need) comp.needs[id] = need.max
      }
      if (!Object.keys(comp.needs).length) delete comp.needs
    }
    if (def.companion_carry) comp.inventory = []
    ctx.state.party.push(comp)
    ctx.pushLog(`${def.label} присоединяется к вам.`)
    ctx.messages.push({ text: `${def.label} присоединяется к отряду.` })
  },

  /** Текущее значение потребности напарника; null — не в отряде или у существа
  *  потребность не отслеживается… но по контракту «робот не голодает»
  *  неотслеживаемая потребность возвращается максимальной, а не null. */
  companionNeed(ctx: EngineCtx, entity: string, needId: string): number | null {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    if (!comp) return null
    const need = ctx.campaign.meta.needs.find((n) => n.id === needId)
    if (!need) return null
    return comp.needs?.[needId] ?? need.max
  },

  /** Сдвиг потребности напарника; переход через ноль — заметка в лог (без game over). */
  changeCompanionNeed(ctx: EngineCtx, entity: string, needId: string, delta: number): void {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    const need = ctx.campaign.meta.needs.find((n) => n.id === needId)
    if (!comp || !need || comp.needs?.[needId] === undefined) return
    const cur = comp.needs[needId]
    const next = Math.min(need.max, Math.max(0, cur + delta))
    comp.needs[needId] = next
    if (next <= 0 && cur > 0) {
      const def = ctx.campaign.entities[entity] as NpcDef | undefined
      ctx.pushLog(`${def?.label ?? entity} на пределе: ${need.label.toLowerCase()} на нуле.`)
    }
  },

  /** Набор отслеживаемых напарником потребностей (для UI): определения из meta.needs. */
  companionNeedDefs(ctx: EngineCtx, entity: string): NeedDef[] {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    if (!comp?.needs) return []
    return ctx.campaign.meta.needs.filter((n) => comp.needs![n.id] !== undefined)
  },

  // ── «вторая сумка» напарника (NpcDef.companion_carry) ──
  
  /** Груз в сумке напарника, кг. */
  companionLoad(ctx: EngineCtx, entity: string): number {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    let sum = 0
    for (const e of comp?.inventory ?? []) {
      const def = ctx.campaign.entities[e.item] as ItemDef | undefined
      if (def?.type === 'item') sum += (def.weight ?? 0) * e.quantity
    }
    return Math.round(sum * 10) / 10
  },

  /** Грузоподъёмность напарника: та же формула энкадменса, что у героя,
  *  но по характеристикам существа (его carry_capacity_bonus/mult учтены). */
  companionCapacity(ctx: EngineCtx, entity: string): number {
    const def = ctx.campaign.entities[entity] as NpcDef | undefined
    if (!def?.stats) return 0
    const encRules = ctx.campaign.meta.encumbrance
    const formula = encRules?.formula ?? 'str_siz'
    let base = (def.stats.STR ?? 10) + (def.stats.SIZ ?? 10)
    if (formula === 'str_con') base = (def.stats.STR ?? 10) + (def.stats.CON ?? 10)
    else if (formula === 'str_only') base = (def.stats.STR ?? 10) * 2
    else if (formula === 'fixed') base = Math.max(1, encRules?.capacity_multiplier ?? 20)
    const worldMult = encRules?.capacity_multiplier && formula !== 'fixed' ? encRules.capacity_multiplier : 1.0
    const total = base * worldMult * (def.carry_capacity_mult ?? 1.0) + (def.carry_capacity_bonus ?? 0)
    return Math.max(1, Math.round(total * 10) / 10)
  },

  /** Передать предмет из сумки героя напарнику (нужны оба: в отряде, companion_carry).
  *  Сюжетные предметы (quest_item) — как выбросить и продать — отдать нельзя:
  *  уход или гибель напарника не должна стирать критические вещи навсегда.
  *  `opts.forceQuest` — только для сюжетных эффектов (transfer_to_companion):
  *  мастер сам решает отдать квестовый предмет скриптом. */
  giveItemToCompanion(ctx: EngineCtx, entity: string, itemId: string, quantity = 1, opts: { forceQuest?: boolean } = {}): boolean {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    const def = ctx.campaign.entities[entity] as NpcDef | undefined
    if (!comp || !def?.companion_carry || quantity <= 0) return false
    const itemDef = ctx.campaign.entities[itemId]
    if ((itemDef as ItemDef | undefined)?.quest_item && !opts.forceQuest) {
      ctx.pushToast(`${itemDef?.label ?? itemId} — сюжетная вещь: её нельзя передать напарнику.`, 'info')
      return false
    }
    const have = ctx.state.player.inventory.find((i) => i.item === itemId)?.quantity ?? 0
    if (have < quantity) return false
    if (!comp.inventory) comp.inventory = []
    ctx.removeItem(itemId, quantity, { silent: true })
    const slot = comp.inventory.find((i) => i.item === itemId)
    if (slot) slot.quantity += quantity
    else comp.inventory.push({ item: itemId, quantity })
    ctx.pushLog(`${def.label} берёт: ${itemDef?.label ?? itemId} ×${quantity}.`)
    ctx.notify()
    return true
  },

  /** Забрать предмет из сумки напарника себе. */
  takeItemFromCompanion(ctx: EngineCtx, entity: string, itemId: string, quantity = 1): boolean {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    const slot = comp?.inventory?.find((i) => i.item === itemId)
    if (!comp || !slot || slot.quantity < quantity || quantity <= 0) return false
    slot.quantity -= quantity
    if (slot.quantity <= 0) {
      comp.inventory = comp.inventory!.filter((i) => i.quantity > 0)
      // снятое/отданное: если предмет был надет и кончился — снимаем со слота
      for (const [k, v] of Object.entries(comp.equipment ?? {})) if (v === itemId && !comp.inventory!.some((i) => i.item === itemId)) delete comp.equipment![k]
    }
    ctx.addItem(itemId, quantity, { silent: true })
    const def = ctx.campaign.entities[entity] as NpcDef | undefined
    const itemDef = ctx.campaign.entities[itemId]
    ctx.pushLog(`${def?.label ?? entity} возвращает: ${itemDef?.label ?? itemId} ×${quantity}.`)
    ctx.notify()
    return true
  },

  /** Надеть/снять предмет из сумки напарника на слот экипировки (null — снять). */
  equipCompanionItem(ctx: EngineCtx, entity: string, slotId: string, itemId: string | null): void {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    if (!comp) return
    if (itemId && !comp.inventory?.some((i) => i.item === itemId)) return
    comp.equipment = { ...(comp.equipment ?? {}) }
    if (itemId) comp.equipment[slotId] = itemId
    else delete comp.equipment[slotId]
    ctx.notify()
  },

  /** Применить предмет из сумки героя к напарнику: перенаправляет on_use-эффекты
  *  «здоровье» (change_hp) и «потребности» (change_need) на напарника, остальные
  *  эффекты игнорируются; расход предмета — как у героя (on_use.consume). */
  useItemOnCompanion(ctx: EngineCtx, entity: string, itemId: string): boolean {
    const comp = ctx.state.party.find((c) => c.entity === entity)
    const def = ctx.campaign.entities[entity] as NpcDef | undefined
    const item = ctx.campaign.entities[itemId] as ItemDef | undefined
    if (!comp || !def || !item || item.type !== 'item' || !item.on_use) return false
    if (!(ctx.state.player.inventory.find((i) => i.item === itemId)?.quantity ?? 0)) return false
    let touched = false
    for (const eff of item.on_use.effects) {
      if (eff.type === 'change_hp' && comp.hp > 0) {
        const before = comp.hp
        comp.hp = Math.max(1, Math.min(comp.max_hp, comp.hp + eff.delta))
        if (comp.hp !== before) touched = true
      } else if (eff.type === 'change_need') {
        if (comp.needs?.[eff.need] !== undefined) {
          ctx.changeCompanionNeed(entity, eff.need, eff.delta)
          touched = true
        }
      }
    }
    if (!touched) return false
    playInteraction('use', { entity: item })
    if (item.on_use.consume !== false) ctx.removeItem(itemId, 1, { verb: 'Использовано' })
    ctx.pushLog(`${item.label} — применено к ${def.label}.`)
    ctx.checkRules()
    ctx.notify()
    return true
  },

  /** Напарник покидает отряд (отпустить, скрипт, гибель в бою).
  *  Его сумка возвращается герою — иначе переданные вещи стирались бы навсегда
  *  (до этого так и было: мягкая блокировка при гибели носильщика). */
  leaveParty(ctx: EngineCtx, entityId: string): void {
    const i = ctx.state.party.findIndex((c) => c.entity === entityId)
    if (i < 0) return
    const comp = ctx.state.party[i]
    const def = ctx.campaign.entities[entityId] as NpcDef | undefined
    const returned = (comp.inventory ?? []).filter((e) => e.quantity > 0)
    if (returned.length) {
      for (const e of returned) ctx.addItem(e.item, e.quantity, { silent: true })
      const list = returned
        .map((e) => `${ctx.campaign.entities[e.item]?.label ?? e.item}${e.quantity > 1 ? ` ×${e.quantity}` : ''}`)
        .join(', ')
      ctx.pushLog(`${def?.label ?? entityId} отдаёт вам: ${list}.`)
      ctx.pushToast(`${def?.label ?? entityId} отдаёт вам вещи из сумки: ${list}.`, 'get')
    }
    ctx.state.party.splice(i, 1)
    // состав отряда сменился: слоты сцен (isInParty), карточки и док чипов должны
    // перечитаться сразу; заодно даём правилам кампании шанс отреагировать на уход
    // (сторож вида «флаг найма стоит, а NPC не в отряде» — снять флаг и вернуть героя на сцену)
    ctx.notify()
  },

  isInParty(ctx: EngineCtx, entityId: string): boolean {
    return ctx.state.party.some((c) => c.entity === entityId)
  },
}
