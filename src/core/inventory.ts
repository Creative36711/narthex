import type { ItemDef } from '../shared/types'
import type { EngineCtx } from './context'
import { playUi } from '../shared/audio'

export const inventory = {
  // ─────────────── инвентарь ───────────────
  hasItem(ctx: EngineCtx, id: string): boolean {
    return ctx.itemCount(id) > 0
  },

  itemCount(ctx: EngineCtx, id: string): number {
    return ctx.state.player.inventory
      .filter((i) => i.item === id)
      .reduce((s, i) => s + i.quantity, 0)
  },

  addItem(ctx: EngineCtx, id: string, quantity = 1, opts: { silent?: boolean; freshness?: number } = {}): void {
    const inv = ctx.state.player.inventory
    const itemDef = ctx.campaign.entities[id] as ItemDef | undefined
    const isPerishable = itemDef?.decay_ticks !== undefined && itemDef.decay_ticks > 0
    const initialFreshness = opts.freshness ?? itemDef?.decay_ticks

    // изнашиваемые или скоропортящиеся предметы — отдельные экземпляры
    if (ctx.itemMaxDurability(id) !== undefined || isPerishable) {
      for (let i = 0; i < quantity; i++) {
        inv.push({
          item: id,
          quantity: 1,
          durability: ctx.itemMaxDurability(id),
          freshness: initialFreshness,
        })
      }
    } else {
      const entry = inv.find((i) => i.item === id && i.durability === undefined && i.freshness === undefined)
      if (entry) entry.quantity += quantity
      else inv.push({ item: id, quantity })
    }
    if (!opts.silent) ctx.pushToast(`Получено: ${ctx.itemTitle(id)}${quantity > 1 ? ` ×${quantity}` : ''}.`, 'get')
  },

  removeItem(ctx: EngineCtx, id: string, quantity = 1, opts: { silent?: boolean; verb?: string } = {}): void {
    const inv = ctx.state.player.inventory
    let left = quantity
    // сначала расходим наиболее изношенные экземпляры
    while (left > 0) {
      const entries = inv.filter((i) => i.item === id)
      if (!entries.length) break
      const max = ctx.itemMaxDurability(id)
      let pick = entries[0]
      if (max !== undefined) {
        pick = entries.reduce((a, b) => ((a.durability ?? max) <= (b.durability ?? max) ? a : b))
      } else if (entries.some((e) => e.freshness !== undefined)) {
        // сначала расходуем наиболее близкие к концу срока годности экземпляры
        pick = entries.reduce((a, b) => ((a.freshness ?? Infinity) <= (b.freshness ?? Infinity) ? a : b))
      }
      if (pick.quantity > left) {
        pick.quantity -= left
        left = 0
      } else {
        left -= pick.quantity
        inv.splice(inv.indexOf(pick), 1)
      }
    }
    // предмет закончился — снимаем со всех слотов
    if (!ctx.hasItem(id)) {
      const eq = ctx.state.player.equipment
      for (const slot of Object.keys(eq)) {
        if (eq[slot] === id) delete eq[slot]
      }
    }
    const lost = quantity - left
    if (!opts.silent && lost > 0) {
      const verb = opts.verb ?? (lost >= quantity ? 'Потеряно' : 'Частично потеряно')
      ctx.pushToast(`${verb}: ${ctx.itemTitle(id)}${lost > 1 ? ` ×${lost}` : ''}.`, 'lose')
    }
  },

  // ─────────────── износ снаряжения (аудит §5.6 п.10) ───────────────
  
  /** максимальная прочность предмета (оружие — weapon_data, броня — armor_data); нет — вечный */
  itemMaxDurability(ctx: EngineCtx, itemId: string): number | undefined {
    const def = ctx.campaign.entities[itemId] as ItemDef | undefined
    if (!def || def.type !== 'item') return undefined
    return def.weapon_data?.durability ?? def.armor_data?.durability
  },

  /** осталось прочности у первого пригодного экземпляра (нет — null) */
  itemDurabilityOf(ctx: EngineCtx, id: string): { left: number; max: number } | null {
    const max = ctx.itemMaxDurability(id)
    if (max === undefined) return null
    const entry = ctx.state.player.inventory.find((i) => i.item === id)
    if (!entry) return null
    return { left: entry.durability ?? max, max }
  },

  /** пригоден ли предмет к использованию (есть экземпляр с прочностью > 0) */
  isItemUsable(ctx: EngineCtx, id: string): boolean {
    const max = ctx.itemMaxDurability(id)
    if (max === undefined) return ctx.hasItem(id)
    return ctx.state.player.inventory.some((i) => i.item === id && (i.durability ?? max) > 0)
  },

  /** экземпляры с износом от меньшей прочности (для UI) */
  durabilityEntries(ctx: EngineCtx, id: string): Array<{ entry: { item: string; quantity: number; durability?: number }; left: number }> {
    const max = ctx.itemMaxDurability(id)
    if (max === undefined) return []
    return ctx.state.player.inventory
      .filter((i) => i.item === id)
      .map((entry) => ({ entry, left: entry.durability ?? max }))
      .sort((a, b) => a.left - b.left)
  },

  /**
  * Износ предмета игрока (урон в бою): −amount самому надетому экземпляру.
  * Сломанный экземпляр с прочностью 0 сохраняется (для починки рецептом).
  * Истина — предмет сломался этим износом.
  */
  damageItemDurability(ctx: EngineCtx, itemId: string, amount = 1): boolean {
    const max = ctx.itemMaxDurability(itemId)
    if (max === undefined) return false
    const entry = ctx.state.player.inventory
      .filter((i) => i.item === itemId && (i.durability ?? max) > 0)
      .sort((a, b) => (a.durability ?? max) - (b.durability ?? max))[0]
    if (!entry) return false
    const before = entry.durability ?? max
    entry.durability = Math.max(0, before - amount)
    if (entry.durability === 0 && before > 0) {
      const def = ctx.campaign.entities[itemId]
      ctx.pushLog(`«${def?.label ?? itemId}» сломался!`)
      playUi('defeat')
      return true
    }
    return false
  },

  /**
  * Починка (мастер помечает рецепт `repair: true`): восстанавливает самый
  * изношенный экземпляр до максимума. Истина — нашелся изношенный.
  */
  repairItem(ctx: EngineCtx, itemId: string): boolean {
    const max = ctx.itemMaxDurability(itemId)
    if (max === undefined) return false
    const entry = ctx.state.player.inventory
      .filter((i) => i.item === itemId)
      .sort((a, b) => (a.durability ?? max) - (b.durability ?? max))[0]
    if (!entry || (entry.durability ?? max) >= max) return false
    entry.durability = max
    const def = ctx.campaign.entities[itemId]
    ctx.pushLog(`«${def?.label ?? itemId}» отремонтирован.`)
    ctx.notify()
    ctx.autosave()
    return true
  },

  /** свободные «еда предмета» нет изношенных экземпляров — для рецепта починки */
  hasDamaged(ctx: EngineCtx, itemId: string): boolean {
    const max = ctx.itemMaxDurability(itemId)
    if (max === undefined) return false
    return ctx.state.player.inventory.some((i) => i.item === itemId && (i.durability ?? max) < max)
  },
}
