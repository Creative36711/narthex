import type { EngineCtx } from './context'
import type { ItemDef, NpcDef, RecipeDef } from '../shared/types'
import { featureOn } from './caps'
import { evalCondition } from './conditions'
import { playInteraction, playUi } from '../shared/audio'

// ─────────────── торговля (ТЗ 4.7) ───────────────
function openTrade(this: EngineCtx, entityId: string): void {
    if (!featureOn(this.campaign.meta, 'trade')) return
    const npc = this.campaign.entities[entityId] as NpcDef | undefined
    if (!npc || npc.type !== 'npc' || !npc.trader) return
    this.dialogue = null
    this.dialogueTimer = null
    this.trade = npc
    this.notify()
  }

function closeTrade(this: EngineCtx): void {
    this.trade = null
    this.autosave()
    this.notify()
  }

/**
   * Открыть окно изготовления по ходу игры (эффект `open_craft`, реплика
   * `~ open_craft("recipe_id")`). Неизвестный или незаданный рецепт — просто
   * открывается список: рецепт может открыться позже эффектом unlock_recipe.
   * Разговор и торговля при этом закрываются, как у `open_trade`.
   */
function openCraft(this: EngineCtx, recipeId?: string, sourceEntity?: ItemDef): void {
    if (!featureOn(this.campaign.meta, 'inventory')) return
    const known = recipeId && this.knownRecipes().some((r: RecipeDef) => r.id === recipeId)
    this.dialogue = null
    this.dialogueTimer = null
    this.activeStory = null
    this.activeNpc = null
    this.trade = null
    if (sourceEntity) this.craftSourceEntity = sourceEntity
    this.craftRequest = { recipe: known ? recipeId : undefined }
    this.notify()
  }

function closeCraft(this: EngineCtx): void {
    this.craftRequest = null
    this.craftSourceEntity = null
    this.autosave()
    this.notify()
  }

/** Модификатор цены: репутация и навык торговли (ТЗ 4.7). */
function priceModifier(this: EngineCtx, npc: NpcDef): number {
    const disp = this.getDisposition(npc.id)
    const bargain = this.state.player.skills['bargain'] ?? 0
    const mod = 1.25 - disp * 0.003 - bargain * 0.004
    return Math.min(1.6, Math.max(0.7, mod))
  }

/** id основной валюты кампании (первая в реестре) */
function mainCurrency(this: EngineCtx): string {
    return this.campaign.meta.currencies[0]?.id ?? 'silver'
  }

/** id предмета-монеты, который является единственным источником баланса */
function currencyItemId(this: EngineCtx, currencyId = this.mainCurrency): string {
    const currency = this.campaign.meta.currencies.find((c) => c.id === currencyId)
    return currency?.item_id || `item_${currencyId}`
  }

/** Баланс валюты читается из инвентаря, а не из устаревшего поля сохранения. */
function currencyAmount(this: EngineCtx, currencyId = this.mainCurrency): number {
    return this.itemCount(this.currencyItemId(currencyId))
  }

function buyPrice(this: EngineCtx, npc: NpcDef, itemId: string, basePrice?: number): number {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    const base = basePrice ?? item?.value?.[this.mainCurrency] ?? 1
    const dynamic = item ? this.priceEventMultiplier(item) : 1
    const diff = this.difficultyDef()?.prices ?? 1
    return Math.max(1, Math.round(base * this.priceModifier(npc) * dynamic * diff))
  }

function sellPrice(this: EngineCtx, npc: NpcDef, itemId: string): number {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    if (item?.quest_item) return 0
    const base = item?.value?.[this.mainCurrency] ?? 0
    const rate = npc.trader?.buy_rate ?? 0.4
    const dynamic = item ? this.priceEventMultiplier(item) : 1
    return Math.max(0, Math.floor((base * rate * dynamic) / this.priceModifier(npc)))
  }

/** полный список продаваемых торговцем товаров, включая выкупленные у игрока */
function traderSells(this: EngineCtx, npc: NpcDef): Array<{ item: string; price?: number; stock?: number }> {
    if (!npc.trader) return []
    const base = [...npc.trader.sells]
    const bought = this.state.trader_bought_items?.[npc.id] ?? []
    for (const b of bought) {
      if (!base.some((s) => s.item === b.item)) {
        base.push(b)
      }
    }
    return base
  }

/** текущий остаток товара на складе торговца (undefined — бесконечный запас) */
function traderItemStock(this: EngineCtx, npcId: string, itemId: string): number | undefined {
    const npc = this.campaign.entities[npcId] as NpcDef | undefined
    if (!npc?.trader) return undefined
    const traderSaved = this.state.trader_stocks?.[npcId]
    if (traderSaved && itemId in traderSaved) {
      return traderSaved[itemId]
    }
    const sellDef = npc.trader.sells.find((s) => s.item === itemId)
    if (sellDef && sellDef.stock !== undefined) return sellDef.stock
    const boughtDef = (this.state.trader_bought_items?.[npcId] ?? []).find((s) => s.item === itemId)
    if (boughtDef && boughtDef.stock !== undefined) return boughtDef.stock
    return undefined
  }

function buyItem(this: EngineCtx, itemId: string, price: number): boolean {
    const currencyItem = this.currencyItemId()
    if (this.itemCount(currencyItem) < price) return false

    if (this.trade) {
      const stock = this.traderItemStock(this.trade.id, itemId)
      if (stock !== undefined && stock <= 0) return false
    }

    this.removeItem(currencyItem, price, { silent: true })
    this.addItem(itemId, 1, { silent: true })

    if (this.trade) {
      const stock = this.traderItemStock(this.trade.id, itemId)
      if (stock !== undefined) {
        if (!this.state.trader_stocks) this.state.trader_stocks = {}
        if (!this.state.trader_stocks[this.trade.id]) this.state.trader_stocks[this.trade.id] = {}
        this.state.trader_stocks[this.trade.id][itemId] = Math.max(0, stock - 1)
      }
    }

    this.markSkill('bargain')
    playUi('coin')
    this.notify()
    return true
  }

function sellItem(this: EngineCtx, itemId: string, price: number): boolean {
    const item = this.campaign.entities[itemId] as ItemDef | undefined
    if (item?.quest_item) return false
    if (this.itemCount(itemId) < 1) return false
    this.removeItem(itemId, 1, { silent: true })
    this.addItem(this.currencyItemId(), price, { silent: true })

    // Добавляем проданный предмет торговцу для обратного выкупа
    if (this.trade) {
      const traderId = this.trade.id
      const npc = this.campaign.entities[traderId] as NpcDef | undefined
      if (npc?.trader) {
        const inBase = npc.trader.sells.some((s) => s.item === itemId)
        if (inBase) {
          const curStock = this.traderItemStock(traderId, itemId)
          if (curStock !== undefined) {
            if (!this.state.trader_stocks) this.state.trader_stocks = {}
            if (!this.state.trader_stocks[traderId]) this.state.trader_stocks[traderId] = {}
            this.state.trader_stocks[traderId][itemId] = curStock + 1
          }
        } else {
          if (!this.state.trader_bought_items) this.state.trader_bought_items = {}
          if (!this.state.trader_bought_items[traderId]) this.state.trader_bought_items[traderId] = []
          const existing = this.state.trader_bought_items[traderId].find((s) => s.item === itemId)
          const curStock = this.traderItemStock(traderId, itemId) ?? 0
          const nextStock = curStock + 1
          if (!existing) {
            this.state.trader_bought_items[traderId].push({ item: itemId, stock: nextStock })
          } else {
            existing.stock = nextStock
          }
          if (!this.state.trader_stocks) this.state.trader_stocks = {}
          if (!this.state.trader_stocks[traderId]) this.state.trader_stocks[traderId] = {}
          this.state.trader_stocks[traderId][itemId] = nextStock
        }
      }
    }

    this.markSkill('bargain')
    playUi('coin')
    this.notify()
    return true
  }

// ─────────────── крафт (блок 4 ТЗ «Гибкий движок») ───────────────

  /** название предмета по id (фолбэк — сам id) */
function itemTitle(this: EngineCtx, id: string): string {
    return (this.campaign.entities[id] as ItemDef | undefined)?.label ?? id
  }

/** все рецепты кампании, по алфавиту (русский) */
function allRecipes(this: EngineCtx): RecipeDef[] {
    return Object.values(this.campaign.recipes).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }

/** доступен ли конкретный верстак / рабочее место в текущем контексте */
function isWorkbenchAvailable(this: EngineCtx, workbenchReq?: boolean | string): boolean {
    if (!workbenchReq) return true

    // Если запрошен конкретный id предмета или категория
    if (typeof workbenchReq === 'string') {
      // 1. Проверяем источник текущего открытого окна крафта
      if (this.craftSourceEntity) {
        if (this.craftSourceEntity.id === workbenchReq || this.craftSourceEntity.category === workbenchReq) {
          return true
        }
      }
      // 2. Текущая сцена: есть ли в сцене предмет с таким id или категорией
      const sc = this.campaign.scenes[this.state.scene]
      if (sc) {
        const occupants = this.slotOccupants(sc)
        for (const occ of occupants) {
          if (!occ.entity) continue
          const it = occ.entity as ItemDef
          if (it.id === workbenchReq || it.category === workbenchReq) return true
          if (occ.slot.type.includes(workbenchReq)) return true
        }
      }
      // 3. Текущая локация
      const loc = this.findLocation(this.state.location)?.location
      if (loc && (loc as unknown as Record<string, unknown>)[workbenchReq]) return true

      return false
    }

    // Если workbenchReq === true — подходит любое рабочее место
    // 1. Окно крафта открыто по запросу у верстака
    if (this.craftRequest || this.craftSourceEntity) return true

    // 2. Текущая сцена
    const sc = this.campaign.scenes[this.state.scene]
    if (sc) {
      if ((sc as unknown as { workbench?: boolean }).workbench) return true
      const occupants = this.slotOccupants(sc)
      for (const occ of occupants) {
        if (!occ.entity) continue
        const it = occ.entity as ItemDef
        if (it.id === 'item_bench' || it.category === 'workbench') return true
        if (occ.slot.type.includes('workbench')) return true
        if (it.interact_options?.some((o) => o.effects?.some((ef) => ef.type === 'open_craft'))) return true
      }
    }

    // 3. Текущая локация
    const loc = this.findLocation(this.state.location)?.location
    if (loc && (loc as unknown as { workbench?: boolean }).workbench) return true

    return false
  }

/** Название рабочего места для подсказки в интерфейсе */
function workbenchLabel(this: EngineCtx, req?: boolean | string): string {
    if (!req) return ''
    if (req === true) return 'Верстак или мастерская'
    if (typeof req === 'string') {
      const ent = this.campaign.entities[req]
      if (ent) return ent.label
      const cat = this.campaign.meta.item_categories?.find((c) => c.id === req)
      if (cat) return cat.label
      return req
    }
    return ''
  }

/** чего не хватает для рецепта: компоненты, инструменты, условия, верстак */
function recipeMissing(this: EngineCtx, r: RecipeDef): string[] {
    const missing: string[] = []
    if (r.workbench && !this.isWorkbenchAvailable(r.workbench)) {
      missing.push(`требуется: ${this.workbenchLabel(r.workbench)}`)
    }
    for (const need of r.inputs ?? []) {
      const have = this.itemCount(need.item)
      if (have < need.quantity) missing.push(`${itemTitle.call(this, need.item)} ×${need.quantity} (есть ${have})`)
    }
    for (const tool of r.tools ?? []) {
      if (!this.hasItem(tool)) missing.push(`инструмент: ${itemTitle.call(this, tool)}`)
    }
    let blocked = false
    for (const c of r.requires ?? []) {
      if (!evalCondition(c, this)) blocked = true
    }
    if (blocked) missing.push('не выполнены условия')
    return missing
  }

/**
   * Изготовление по рецепту. Если у рецепта есть проверка навыка — бросок
   * идёт первым: провал сохраняет компоненты. Успех расходует компоненты,
   * выдаёт результат и проматывает время.
   */
function craft(this: EngineCtx, recipeId: string): boolean {
    const r = this.campaign.recipes[recipeId]
    if (!r || this.recipeMissing(r).length > 0) return false
    // рецепт починки (аудит §5.6 п.10): нужен изношенный экземпляр результата
    if (r.repair && !this.hasDamaged(r.output.item)) {
      this.messages.push({ text: `Не изнашившийся «${itemTitle.call(this, r.output.item)}» — чинить нечего.` })
      return false
    }
    if (r.skill) {
      const out = this.playerSkillCheck(r.skill.id, r.skill.difficulty)
      if (!out.success) {
        // время промаха (экономика попыток): мастерская работа заполняет часы и при неудаче
        const spent = Math.max(0, Math.floor(r.fail_time_ticks ?? 0))
        if (spent > 0 && !this.state.game_over) this.advanceTicks(spent)
        this.messages.push({ text: `Не получилось изготовить «${r.label}». Материалы остались целы.${spent > 0 ? ` Потрачено ${spent} тик(ов) времени.` : ''}` })
        this.autosave()
        this.notify()
        return false
      }
    }
    for (const need of r.inputs ?? []) this.removeItem(need.item, need.quantity, { silent: true })
    if (r.repair) {
      this.repairItem(r.output.item)
    } else {
      this.addItem(r.output.item, r.output.quantity ?? 1)
    }
    if (r.time_ticks) this.advanceTicks(r.time_ticks)
    const outLabel = itemTitle.call(this, r.output.item)
    this.pushLog(`Изготовлено: ${outLabel} (рецепт «${r.label}»).`)
    this.messages.push({ text: r.message ?? `Изготовлено: ${outLabel}.` })
    if (r.sound) playInteraction(r.sound, { sound: r.sound }, r.sound_volume ?? 1)
    else playUi('craft')
    this.autosave()
    this.notify()
    return true
  }

/**
   * Открыть рецепт крафта «по ходу игры». Рецепты без `known: false` открыты
   * всегда; этот эффект лишь снимает «закрытость» и один раз радует игрока.
   */
function unlockRecipe(this: EngineCtx, recipeId: string): void {
    const r = this.campaign.recipes[recipeId]
    if (!r) return
    const s = this.state
    if (!s.recipes_unlocked) s.recipes_unlocked = []
    if (s.recipes_unlocked.includes(recipeId)) return
    s.recipes_unlocked.push(recipeId)
    this.messages.push({ text: `Новый рецепт: ${r.label}.` })
    this.pushLog(`Открыт рецепт: ${r.label}.`)
    playInteraction('pickup', {})
    this.notify()
    this.autosave()
  }

/** рецепт виден игроку? (неизвестные закрыты до unlock_recipe или выполнения условий) */
function recipeKnown(this: EngineCtx, id: string): boolean {
    const r = this.campaign.recipes[id]
    if (!r) return false
    // Проверка явного флага скрытости (unlock_recipe)
    if (r.known === false && !this.state.recipes_unlocked?.includes(id)) return false
    // Проверка динамических условий доступности рецепта (изучение, навыки, черты, квесты)
    if (r.conditions && r.conditions.length > 0) {
      if (!r.conditions.every((c) => evalCondition(c, this))) return false
    }
    return true
  }

/** список рецептов, доступных игроку (вкладка «Крафт») */
function knownRecipes(this: EngineCtx): RecipeDef[] {
    return Object.values(this.campaign.recipes)
      .filter((r) => this.recipeKnown(r.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }

export const economy = {
  openTrade,
  closeTrade,
  openCraft,
  closeCraft,
  priceModifier,
  mainCurrency,
  currencyItemId,
  currencyAmount,
  buyPrice,
  sellPrice,
  traderSells,
  traderItemStock,
  buyItem,
  sellItem,
  itemTitle,
  allRecipes,
  isWorkbenchAvailable,
  workbenchLabel,
  recipeMissing,
  craft,
  unlockRecipe,
  recipeKnown,
  knownRecipes,
}
