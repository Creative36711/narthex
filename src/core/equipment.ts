import type { ItemDef, NpcDef, WeaponData } from '../shared/types'
import { equipmentSlots as getEquipmentSlots } from '../shared/types'
import type { EngineCtx } from './context'
import { playInteraction } from '../shared/audio'

export const equipment = {
  // ─────────────── экипировка (блок 7 ТЗ: слоты задаёт кампания) ───────────────
  
  /** список слотов экипировки кампании (встроенные + свои) */
  equipmentSlots(ctx: EngineCtx): Array<{ id: string; label: string }> {
    return getEquipmentSlots(ctx.campaign.meta)
  },

  slotLabel(ctx: EngineCtx, slotId: string): string {
    return equipment.equipmentSlots(ctx).find((s) => s.id === slotId)?.label ?? slotId
  },

  /** слот, в который экипируется предмет (нет — не экипируется) */
  itemSlot(ctx: EngineCtx, id: string): string | undefined {
    const def = ctx.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item') return undefined
    if (def.equip_slot) return def.equip_slot
    if (def.weapon_data) return 'weapon' // мягкая миграция старых предметов
    if (def.armor_data) return 'armor'
    return undefined
  },

  /** предмет надет? */
  isEquipped(ctx: EngineCtx, id: string): boolean {
    return Object.values(ctx.state.player.equipment).includes(id)
  },

  /** в каком слоте надет предмет (нет — '') */
  equippedSlotOf(ctx: EngineCtx, id: string): string {
    const eq = ctx.state.player.equipment
    for (const slot of Object.keys(eq)) if (eq[slot] === id) return slot
    return ''
  },

  /** надеть предмет из инвентаря в его слот */
  equipItem(ctx: EngineCtx, id: string): void {
    if (!ctx.hasItem(id)) return
    const def = ctx.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item') return
    const slot = ctx.itemSlot(id)
    if (!slot) return
    playInteraction('equip', { entity: def })
    ctx.state.player.equipment[slot] = id
    ctx.pushLog(slot === 'weapon' ? `Взято в руки: ${def.label}.` : `Надето: ${def.label}.`)
    ctx.pushToast(slot === 'weapon' ? `Взято в руки: ${def.label}.` : `Надето: ${def.label}.`, 'info')
    ctx.autosave()
    ctx.notify()
  },

  /** снять предмет из слота */
  unequipItem(ctx: EngineCtx, slot: string): void {
    const eq = ctx.state.player.equipment
    const id = eq[slot]
    if (!id) return
    const def = ctx.campaign.entities[id] as ItemDef | undefined
    if (def) playInteraction('unequip', { entity: def })
    delete eq[slot]
    ctx.pushLog(`Снято: ${def?.label ?? id}.`)
    ctx.pushToast(`Снято: ${def?.label ?? id}.`, 'info')
    ctx.autosave()
    ctx.notify()
  },

  /** текущее оружие игрока (для UI и боя): экипированное или кулаки; сломанное — кулаки */
  playerWeapon(ctx: EngineCtx): { itemId: string | null; weapon: WeaponData; label: string } {
    const id = ctx.state.player.equipment['weapon']
    // сломанное оружие (прочность 0) не годится — кулаки (аудит §5.6 п.10)
    if (id && ctx.isItemUsable(id)) {
      const def = ctx.campaign.entities[id] as ItemDef | undefined
      if (def?.weapon_data) return { itemId: id, weapon: def.weapon_data, label: def.label }
    }
    return {
      itemId: null,
      weapon: { skill: 'brawl', damage: '1d3', damage_bonus: true, range: 1, attacks_per_round: 1, parry_capable: false, label: 'Кулаки' },
      label: 'Кулаки',
    }
  },

  /** броня игрока: сумма очков ВСЕХ надетых предметов с бронёй (шлем+кираса) */
  playerArmor(ctx: EngineCtx): { itemId: string | null; points: number; label: string } {
    let points = 0
    let first: string | null = null
    const labels: string[] = []
    for (const slot of Object.keys(ctx.state.player.equipment)) {
      const id = ctx.state.player.equipment[slot]
      // сломанная броня (прочность 0) перестаёт поглощать урон (аудит §5.6 п.10)
      if (!id || !ctx.isItemUsable(id)) continue
      const def = ctx.campaign.entities[id] as ItemDef | undefined
      if (def?.armor_data) {
        points += def.armor_data.points
        labels.push(def.label)
        if (!first) first = id
      }
    }
    if (!points) return { itemId: null, points: 0, label: 'Без брони' }
    return { itemId: first, points, label: labels.join(' + ') }
  },

  useItem(ctx: EngineCtx, id: string): void {
    const def = ctx.campaign.entities[id] as ItemDef | undefined
    if (!def || def.type !== 'item' || !def.on_use) return
    playInteraction('use', { entity: def })
    ctx.applyEffects(def.on_use.effects)
    if (def.on_use.consume !== false) ctx.removeItem(id, 1, { verb: 'Использовано' })
    if (def.on_use.message) ctx.messages.push({ text: ctx.fmt(def.on_use.message) })
    ctx.checkRules()
    ctx.notify()
  },

  // ─────────────── груз и перегруз (ТЗ 4.6, универсальная BRP-система) ───────────────
  currentLoad(ctx: EngineCtx): number {
    let sum = 0
    for (const e of ctx.state.player.inventory) {
      const def = ctx.campaign.entities[e.item] as ItemDef | undefined
      if (def?.type === 'item') sum += (def.weight ?? 0) * e.quantity
    }
    return sum
  },

  /**
  * Подробный расчёт грузоподъёмности героя с учётом формулы кампании,
  * расовых/видовых множителей существа и надетой экипировки (рюкзаки, экзоскелеты).
  */
  maxLoadDetails(ctx: EngineCtx): {
    base: number
    formula: string
    worldMult: number
    charBonus: number
    charMult: number
    equipBonus: number
    equipMult: number
    total: number
  } {
    const s = ctx.state.player.stats
    const encRules = ctx.campaign.meta.encumbrance
    const formula = encRules?.formula ?? 'str_siz'

    let base = s.STR + s.SIZ
    if (formula === 'str_con') base = s.STR + s.CON
    else if (formula === 'str_only') base = s.STR * 2
    else if (formula === 'fixed') base = Math.max(1, encRules?.capacity_multiplier ?? 20)

    const worldMult = encRules?.capacity_multiplier && formula !== 'fixed' ? encRules.capacity_multiplier : 1.0

    // Расовые/индивидуальные параметры героя
    const playerDef = ctx.campaign.entities[ctx.state.player.entity] as NpcDef | undefined
    const charBonus = playerDef?.carry_capacity_bonus ?? 0
    const charMult = playerDef?.carry_capacity_mult ?? 1.0

    // Бонусы от надетой экипировки (рюкзаки, пояса, экзоскелеты)
    let equipBonus = 0
    let equipMult = 1.0
    for (const slotId of Object.keys(ctx.state.player.equipment)) {
      const itemId = ctx.state.player.equipment[slotId]
      if (!itemId) continue
      const itemDef = ctx.campaign.entities[itemId] as ItemDef | undefined
      if (!itemDef) continue
      if (typeof itemDef.carry_bonus === 'number') equipBonus += itemDef.carry_bonus
      if (typeof itemDef.carry_mult === 'number' && itemDef.carry_mult > 0) equipMult *= itemDef.carry_mult
    }

    const calculated = (base * worldMult * charMult + charBonus + equipBonus) * equipMult
    const total = Math.max(1, Math.round(calculated * 10) / 10)

    return {
      base,
      formula,
      worldMult,
      charBonus,
      charMult,
      equipBonus,
      equipMult,
      total,
    }
  },

  maxLoad(ctx: EngineCtx): number {
    return ctx.maxLoadDetails().total
  },

  /**
  * Ступенчатый статус перегруза:
  * 'normal' — в пределах лимита
  * 'light' — лёгкий перегруз (1.0x .. 1.5x)
  * 'heavy' — тяжёлый перегруз (1.5x .. 2.0x)
  * 'critical' — критический перегруз (> 2.0x, передвижение заблокировано)
  */
  encumbranceStatus(ctx: EngineCtx): 'normal' | 'light' | 'heavy' | 'critical' {
    const encRules = ctx.campaign.meta.encumbrance
    if (encRules?.enabled === false) return 'normal'
    const load = ctx.currentLoad()
    const max = ctx.maxLoad()
    if (load <= max) return 'normal'

    const critThresh = encRules?.critical_threshold ?? 2.0
    if (critThresh > 0 && load > max * critThresh) return 'critical'

    const heavyThresh = 1.5
    if (load > max * heavyThresh) return 'heavy'

    return 'light'
  },

  encumbranceDebuffs(ctx: EngineCtx): {
    status: 'normal' | 'light' | 'heavy' | 'critical'
    label: string
    dodgePenalty: number
    movPenalty: number
    skillPenalty: number
    travelMultiplier: number
    isBlocked: boolean
  } {
    const status = ctx.encumbranceStatus()
    const encRules = ctx.campaign.meta.encumbrance
    if (status === 'normal' || encRules?.enabled === false) {
      return {
        status: 'normal',
        label: 'В норме',
        dodgePenalty: 0,
        movPenalty: 0,
        skillPenalty: 0,
        travelMultiplier: 1.0,
        isBlocked: false,
      }
    }

    if (status === 'light') {
      return {
        status: 'light',
        label: 'Лёгкий перегруз',
        dodgePenalty: encRules?.light_dodge_penalty ?? 10,
        movPenalty: encRules?.light_mov_penalty ?? 1,
        skillPenalty: encRules?.light_agility_skills_penalty ?? 10,
        travelMultiplier: encRules?.travel_penalty === false ? 1.0 : (encRules?.light_travel_multiplier ?? 1.5),
        isBlocked: false,
      }
    }

    if (status === 'heavy') {
      return {
        status: 'heavy',
        label: 'Тяжёлый перегруз',
        dodgePenalty: encRules?.heavy_dodge_penalty ?? 25,
        movPenalty: encRules?.heavy_mov_penalty ?? 2,
        skillPenalty: encRules?.heavy_agility_skills_penalty ?? 25,
        travelMultiplier: encRules?.travel_penalty === false ? 1.0 : (encRules?.heavy_travel_multiplier ?? 2.0),
        isBlocked: false,
      }
    }

    // critical
    return {
      status: 'critical',
      label: 'Критический перегруз',
      dodgePenalty: encRules?.critical_dodge_penalty ?? 50,
      movPenalty: encRules?.critical_mov_penalty ?? 3,
      skillPenalty: encRules?.critical_agility_skills_penalty ?? 50,
      travelMultiplier: 999,
      isBlocked: encRules?.travel_penalty !== false,
    }
  },

  isOverloaded(ctx: EngineCtx): boolean {
    return ctx.encumbranceStatus() !== 'normal'
  },

  /**
  * Заблокировано ли перемещение между локациями из-за критического перегруза
  */
  isTravelBlockedByOverload(ctx: EngineCtx): boolean {
    const encRules = ctx.campaign.meta.encumbrance
    if (encRules?.enabled === false || encRules?.travel_penalty === false) return false
    return ctx.encumbranceStatus() === 'critical'
  },
}
