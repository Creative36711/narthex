import type { EngineCtx } from '../../src/core/context'
import type { CodexEntryDef, ImageValue, ItemDef, ItemInteractOption, NpcDef, SlotDef, SlotUseWith } from '../../src/shared/types'
import { BUILTIN_CODEX_CATEGORIES } from '../../src/shared/types'
import { evalCondition } from '../../src/core/conditions'
import { playInteraction } from '../../src/shared/audio'
import type { SoundHook } from '../../src/shared/types'
import type { SlotOccupant } from './world'

function heroPortraitStateKey(this: EngineCtx): string {
    const p = this.state.player
    if (p.statuses?.length) return p.statuses[0].id
    if (p.hp * 2 < p.max_hp) return 'wounded'
    for (const v of Object.values(this.state.player.needs ?? {})) if (v <= 25) return 'tired'
    return 'neutral'
  }

function heroPortraitImages(this: EngineCtx): ImageValue[] {
    const meta = this.campaign.meta
    const choice = this.state.player.portrait_choice
    const key = this.heroPortraitStateKey()
    const withState = (img: ImageValue, states?: Record<string, ImageValue>): ImageValue => states?.[key] || img
    const out: ImageValue[] = []
    if (choice?.layers && meta.char_creation?.portrait_layers?.length) {
      for (const layer of meta.char_creation.portrait_layers) {
        const opt = layer.options.find((o) => o.id === choice.layers![layer.id]) ?? layer.options[0]
        if (opt) out.push(withState(opt.image, opt.states))
      }
    } else if (choice?.gallery) {
      const def = meta.char_creation?.portraits?.find((p) => p.id === choice.gallery)
      if (def) out.push(withState(def.image, def.states))
    }
    // Текущая экипировка меняет только портрет на листе героя, не боевую фигурку.
    const overlays = Object.entries(this.state.player.equipment ?? {}).flatMap(([slot, id], index) => {
      const item = this.campaign.entities[id] as ItemDef | undefined
      return item?.type === 'item' && item.hero_appearance?.overlay
        ? [{ slot, index, order: item.hero_appearance.order ?? index, image: item.hero_appearance.overlay }]
        : []
    }).sort((a, b) => a.order - b.order || a.index - b.index)
    out.push(...overlays.map((x) => x.image))
    return out
  }

function heroCombatFigure(this: EngineCtx): {
    figure?: ImageValue
    mode?: 'topdown' | 'side' | 'static'
    offset?: number
  } {
    const meta = this.campaign.meta.char_creation
    const choice = this.state.player.portrait_choice
    if (!meta || !choice) return {}
    if (choice.layers && meta.portrait_layers?.length) {
      for (const layer of meta.portrait_layers) {
        const option = layer.options.find((o) => o.id === choice.layers![layer.id])
        if (option?.combat_figure)
          return {
            figure: option.combat_figure,
            mode: option.combat_figure_mode,
            offset: option.combat_facing_offset,
          }
      }
    }
    const portrait = meta.portraits?.find((p) => p.id === choice.gallery)
    return portrait?.combat_figure
      ? {
          figure: portrait.combat_figure,
          mode: portrait.combat_figure_mode,
          offset: portrait.combat_facing_offset,
        }
      : {}
  }

function isNpcNameKnown(this: EngineCtx, entityId: string): boolean {
    if (this.state.flags[`known_${entityId}`] || this.state.flags[`npc_known_${entityId}`]) return true
    const def = this.campaign.entities[entityId] as NpcDef | undefined
    if (!def || !def.unknown_label) return true
    return (this.state.known_npcs ?? []).includes(entityId)
  }

function npcLabel(this: EngineCtx, entity: string | NpcDef): string {
    const def = typeof entity === 'string' ? (this.campaign.entities[entity] as NpcDef | undefined) : entity
    if (!def) return typeof entity === 'string' ? entity : ''
    if (!def.unknown_label) return def.label
    if (this.isNpcNameKnown(def.id)) return def.label
    return def.unknown_label
  }

function learnNpcName(this: EngineCtx, npcId: string, silent = false): void {
    const def = this.campaign.entities[npcId] as NpcDef | undefined
    const list = (this.state.known_npcs ??= [])
    if (list.includes(npcId)) return
    list.push(npcId)
    if (!silent && def?.unknown_label) {
      const msg = `Вы узнали: «${def.unknown_label}» — это ${def.label}.`
      this.pushLog(msg)
      this.pushToast(msg, 'info')
    }
    this.notify()
    this.checkRules()
  }

function descOf(this: EngineCtx, entityId: string): string {
    const def = this.campaign.entities[entityId] as { description?: string } | undefined
    return this.state.desc_overrides?.[entityId] ?? def?.description ?? ''
  }

function setEntityDescription(this: EngineCtx, entityId: string, text: string): void {
    const s = this.state
    s.desc_overrides = { ...(s.desc_overrides ?? {}), [entityId]: text }
  }

function slotUseOptions(this: EngineCtx, slot: SlotDef): Array<{ itemId: string; label: string; use: SlotUseWith }> {
    return (slot.use_with ?? [])
      .filter((u) => u.item && this.hasItem(u.item))
      .map((u) => ({
        itemId: u.item,
        label: (this.campaign.entities[u.item] as ItemDef | undefined)?.label ?? u.item,
        use: u,
      }))
  }

function useItemOnSlot(this: EngineCtx, slotId: string, itemId: string): boolean {
    const scene = this.currentScene()
    const slot = scene?.slots.find((s: SlotDef) => s.id === slotId)
    const use = slot?.use_with?.find((u: SlotUseWith) => u.item === itemId)
    if (!slot || !use || !this.hasItem(itemId)) return false
    const def = this.campaign.entities[itemId] as ItemDef | undefined
    if (use.consume) this.removeItem(itemId, 1, { verb: 'Использовано' })
    this.applyEffects(use.effects)
    if (use.message) this.messages.push({ text: use.message })
    this.pushLog(`${def?.label ?? itemId}: использовано на «${slot.label ?? slotId}».`)
    playInteraction('use', { entity: def })
    this.checkRules()
    this.autosave()
    this.notify()
    return true
  }

function entityState(this: EngineCtx, id: string): string | undefined {
    return this.state.entity_states?.[id] || undefined
  }

function unlockCodex(this: EngineCtx, entryId: string): void {
    const entry = this.campaign.codex[entryId]
    if (!entry) return
    const s = this.state
    if (!s.codex_unlocked) s.codex_unlocked = []
    if (s.codex_unlocked.includes(entryId)) return
    s.codex_unlocked.push(entryId)
    this.messages.push({ text: `Новая запись в кодексе: ${entry.label}.` })
    this.pushLog(`Кодекс пополнен: ${entry.label}.`)
    playInteraction('pickup', {})
    this.notify()
    this.autosave()
  }

function unlockedCodexEntries(this: EngineCtx): CodexEntryDef[] {
    return (this.state.codex_unlocked ?? [])
      .map((id) => this.campaign.codex[id])
      .filter((e): e is CodexEntryDef => !!e)
  }

function codexCategories(this: EngineCtx): Array<{ id: string; label: string }> {
    return this.campaign.meta.codex_categories ?? BUILTIN_CODEX_CATEGORIES
  }

function fmt(this: EngineCtx, text: string): string {
    if (!text.includes('{')) return text
    const st = this.state
    const p = st.player
    const day = Math.floor((st.tick ?? 0) / Math.max(1, this.campaign.meta.ticks_per_day || 24)) + 1
    const out: Record<string, string> = {
      'имя': p.name ?? 'герой',
      'герой': p.name ?? 'герой',
      'имя_героя': p.name ?? 'герой',
      'здоровье': String(Math.max(0, p.hp)),
      'здоровье_макс': String(p.max_hp),
      'мана': String(Math.max(0, p.mp)),
      'мана_макс': String(p.max_mp),
      'удача': String(this.luck()),
      'уровень': String(p.level ?? 1),
      'опыт': String(p.xp ?? 0),
      'день': String(day),
    }
    return text.replace(/\{([^{}]+)\}/g, (_m, raw: string) => {
      if (raw in out) return out[raw]!
      const cut = raw.indexOf(':')
      if (cut > 0) {
        const kind = raw.slice(0, cut)
        const id = raw.slice(cut + 1).trim()
        switch (kind) {
          case 'счёт': case 'счет': return String(this.itemCount(id))
          case 'навык': return String(p.skills[id] ?? 0)
          case 'потребность': return String(p.needs[id] ?? 0)
          case 'стат': return String((p.stats as unknown as Record<string, number>)[id] ?? 0)
          case 'валюта': return String(p.currencies?.[id] ?? 0)
        }
      }
      return `{${raw}}`
    })
  }

function itemInteractable(this: EngineCtx, item: ItemDef): boolean {
    return (item.interactable_when ?? []).every((c) => evalCondition(c, this))
  }

function itemInteractOptions(this: EngineCtx, item: ItemDef): ItemInteractOption[] {
    const itemOptions = item.interact_options ?? []
    return itemOptions.filter((o, index) => {
      // Фильтруем по условиям; условий нет — вариант доступен всегда.
      // (Классическая ошибка: `!o.conditions?.every(...)` при отсутствии
      // условий даёт `!undefined` → вариант молча пропадал, и клик по
      // предмету «ничего не делал» — фидбек 29, п.7.)
      if (o.conditions && o.conditions.length > 0 && !o.conditions.every((c) => evalCondition(c, this))) return false
      // Фильтруем одноразовые варианты
      if (o.once) {
        const key = `item:${item.id}:${index}`
        if (this.state.used_item_interacts?.includes(key)) return false
      }
      return true
    })
  }

function runItemInteract(this: EngineCtx, item: ItemDef, option: ItemInteractOption): void {
    const soundOpt = option.sound ?? 'use'
    playInteraction(soundOpt as SoundHook, { entity: item, sound: option.sound }, option.sound_volume ?? 1)
    if (option.effects?.some((ef) => ef.type === 'open_craft')) {
      this.craftSourceEntity = item
    }
    this.applyEffects(option.effects)
    if (option.message) {
      if (this.craftRequest || this.combat || this.dialogue) {
        this.pushToast(this.fmt(option.message), 'info')
      } else {
        this.messages.push({ text: this.fmt(option.message), portrait: item.portrait?.[option.emotion ?? 'neutral'] ?? item.portrait?.['neutral'] })
      }
    }
    if (option.consume) this.state.removed_entities.push(item.id)
    // Одноразовые варианты: добавляем в список использованных
    if (option.once) {
      const itemOptions = item.interact_options ?? []
      const optionIndex = itemOptions.findIndex(o => o === option)
      if (optionIndex >= 0) {
        const key = `item:${item.id}:${optionIndex}`
        if (!this.state.used_item_interacts) this.state.used_item_interacts = []
        if (!this.state.used_item_interacts.includes(key)) {
          this.state.used_item_interacts.push(key)
        }
      }
    }
    this.checkRules()
    this.notify()
  }

function interactWithSlot(this: EngineCtx, occ: SlotOccupant): boolean {
    if (!occ.entity) return false
    this.inspectedEntityId = occ.entity.id
    if (occ.slot.sound) {
      playInteraction(occ.slot.sound, { sound: occ.slot.sound }, occ.slot.sound_volume ?? 1)
    }
    if (occ.entity.type === 'npc') {
      const npc = occ.entity as NpcDef
      if (npc.dialogue) {
        this.startDialogue(occ.entity.id)
      } else {
        const desc = this.descOf(npc.id)
        if (desc) {
          this.messages.push({
            text: desc,
            portrait: npc.portrait?.neutral || undefined,
          })
          this.notify()
        }
      }
      return true
    }
    const item = occ.entity as ItemDef
    if (!this.itemInteractable(item)) return false
    const slotType = occ.slot.type[0]
    // предмет с вариантами действий — окно выбора; собирается стороной UI
    const opts = this.itemInteractOptions(item)
    if (opts.length) {
      // варианты действий показывает UI; в headless-прогоне это просто «не авто-действие»
      return false
    }
    if (item.on_interact) {
      // «открыть контейнер» vs «использовать»: по типу слота/категории
      const isOpen = occ.slot.type.includes('container') || item.category === 'container'
      playInteraction(isOpen ? 'open' : 'use', { entity: item, slotType })
      this.applyEffects(item.on_interact.effects)
      const desc = this.descOf(item.id) || item.description
      if (item.on_interact.message) {
        this.messages.push({ text: this.fmt(item.on_interact.message) })
      } else if (desc) {
        this.messages.push({
          text: desc,
          portrait: item.portrait?.neutral || undefined,
        })
      }
      if (item.on_interact.consume) {
        this.state.removed_entities.push(item.id)
      }
      this.checkRules()
      this.notify()
    } else {
      // Предмет без специального взаимодействия: при клике показываем описание сущности
      const desc = this.descOf(item.id)
      const textToShow = desc || item.description
      if (textToShow) {
        this.messages.push({
          text: textToShow,
          portrait: item.portrait?.neutral || undefined,
        })
      } else {
        this.pushToast(`«${item.label}» (нет подробного описания)`)
      }
      this.notify()
    }
    return true
  }

export const sceneSlots = {
  heroPortraitStateKey,
  heroPortraitImages,
  heroCombatFigure,
  isNpcNameKnown,
  npcLabel,
  learnNpcName,
  descOf,
  setEntityDescription,
  slotUseOptions,
  useItemOnSlot,
  entityState,
  unlockCodex,
  unlockedCodexEntries,
  codexCategories,
  fmt,
  itemInteractable,
  itemInteractOptions,
  runItemInteract,
  interactWithSlot,
}
