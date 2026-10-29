import type { CampaignData, CampaignMeta, GameState } from '../../shared/types'
import { equipmentSlots } from '../../shared/types'
import { BUILTIN_SKILL_LABELS } from '../../shared/skills'
import { allLocations } from '../../shared/migrate'
import { derivedHP, derivedMP } from '../brp'
import type { ReportCtx } from './migrations'

/** «Мечи», «Топоры» и ещё 3 — чтобы отчёт не занимал пол-экрана */
function listShort(labels: string[], max = 3): string {
  if (labels.length === 0) return ''
  const quoted = labels.map((l) => `«${l}»`)
  if (quoted.length <= max) return quoted.join(', ')
  return `${quoted.slice(0, max).join(', ')} и ещё ${quoted.length - max}`
}

// ─────────────────────── починка ссылок на кампанию ───────────────────────

/**
 * Название сущности для отчёта. Если её уже нет в кампании (именно поэтому
 * сейв и чинится), имени взять неоткуда — показываем id в кавычках.
 */
function entityLabel(campaign: CampaignData, id: string): string {
  const e = campaign.entities[id] as { label?: string } | undefined
  return e?.label || id
}

/**
 * Название слота экипировки для отчёта.
 */
function slotLabel(meta: CampaignMeta, slotId: string): string {
  const slot = equipmentSlots(meta).find((s) => s.id === slotId)
  return slot?.label ?? slotId
}

/**
 * Приведение сейва в соответствие с кампанией: убираются ссылки на то, чего
 * в пакете больше нет. Ничего не удаляется «на всякий случай» — только то,
 * что действительно не найдено в кампании.
 */
export function repairState(state: GameState, campaign: CampaignData, ctx: ReportCtx): void {
  const meta: CampaignMeta = campaign.meta
  const ents = campaign.entities

  if (!state.player || typeof state.player !== 'object') {
    ctx.note('warning', 'В сохранении нет данных героя — забег начнётся заново.')
    return
  }
  const p = state.player

  // герой: если шаблон удалён — берём стандартного героя кампании
  if (!ents[p.entity]) {
    const fallback = meta.default_player
    if (fallback && ents[fallback]) {
      ctx.note('repaired', `Шаблон героя «${p.entity}» удалён из кампании — взят стандартный герой.`)
      p.entity = fallback
    }
  }

  // инвентарь: только существующие предметы
  if (Array.isArray(p.inventory)) {
    const gone: string[] = []
    p.inventory = p.inventory.filter((entry) => {
      if (entry && ents[entry.item]) return true
      gone.push(entry?.item ?? '?')
      return false
    })
    if (gone.length) {
      ctx.note('repaired', `Из инвентаря убрано: ${listShort(gone.map((i) => entityLabel(campaign, i)))} — этих предметов больше нет в кампании.`)
    }
  } else {
    p.inventory = []
  }

  // экипировка: слот из реестра кампании + предмет, существующий в кампании.
  // Предмет НЕ обязан лежать в инвентаре: шаблонное снаряжение героя
  // (default_player / шаблоны создания) надевается без копии в инвентаре —
  // прежняя проверка «есть в инвентаре» снимала его при каждом продолжении
  // (фидбек 27, п.7: «начал забег, вышел, продолжил — оружие сняли»).
  const declaredSlots = new Set(equipmentSlots(meta).map((s) => s.id))
  // Слоты, явно используемые предметами кампании (weapon, armor и др.)
  for (const ent of Object.values(ents)) {
    if (ent.type === 'item') {
      const s = (ent as { equip_slot?: string; slot?: string }).equip_slot || (ent as { equip_slot?: string; slot?: string }).slot
      if (s) declaredSlots.add(s)
    }
  }

  if (p.equipment && typeof p.equipment === 'object') {
    const removed: string[] = []
    for (const [slot, item] of Object.entries(p.equipment)) {
      if (!declaredSlots.has(slot)) {
        if (item && ents[item]) {
          p.inventory.push({ item, quantity: 1 })
          removed.push(`слот «${slotLabel(meta, slot)}» (предмет «${entityLabel(campaign, item)}» перемещён в инвентарь)`)
        } else {
          removed.push(`слот «${slotLabel(meta, slot)}»`)
        }
        delete p.equipment[slot]
      } else if (!item || !ents[item]) {
        removed.push(`${slotLabel(meta, slot)}: ${item ? entityLabel(campaign, item) : 'пусто'}`)
        delete p.equipment[slot]
      }
    }
    if (removed.length) {
      ctx.note('repaired', `Снято с героя: ${listShort(removed)} — в кампании этого больше нет.`)
    }
  } else {
    p.equipment = {}
  }

  // навыки: реестр кампании + встроенный словарь
  const known = new Set([...(meta.skills ?? []).map((s) => s.id), ...Object.keys(BUILTIN_SKILL_LABELS)])
  const dropSkills = (bag: Record<string, number> | Record<string, boolean> | undefined, out: string[]) => {
    if (!bag) return
    for (const id of Object.keys(bag)) {
      if (!known.has(id)) {
        out.push(id)
        delete bag[id]
      }
    }
  }
  const goneSkills: string[] = []
  dropSkills(p.skills, goneSkills)
  dropSkills(p.skill_marks, goneSkills)
  if (state.char_choice?.skills) dropSkills(state.char_choice.skills, goneSkills)
  if (goneSkills.length) {
    ctx.note('repaired', `Убраны навыки, которых нет в кампании: ${listShort([...new Set(goneSkills)])}.`)
  }

  // потребности: новые — на максимум, значения — в пределах 0…max
  const needsNow = p.needs && typeof p.needs === 'object' ? p.needs : (p.needs = {})
  const added: string[] = []
  const clamped: string[] = []
  for (const need of meta.needs ?? []) {
    const cur = needsNow[need.id]
    if (typeof cur !== 'number') {
      needsNow[need.id] = need.max
      added.push(need.label)
      continue
    }
    const next = Math.max(0, Math.min(need.max, cur))
    if (next !== cur) {
      needsNow[need.id] = next
      clamped.push(need.label)
    }
  }
  if (added.length) ctx.note('repaired', `Добавлены новые потребности кампании: ${listShort(added)} (значения — максимум).`)
  if (clamped.length) ctx.note('repaired', `Значения приведены к новому пределу: ${listShort(clamped)}.`)
  // потребности, исчезнувшие из кампании, больше не убывают — убираем, чтобы не висели в HUD
  const needIds = new Set((meta.needs ?? []).map((n) => n.id))
  const goneNeeds = Object.keys(needsNow).filter((id) => !needIds.has(id))
  for (const id of goneNeeds) delete needsNow[id]
  if (goneNeeds.length) ctx.note('repaired', `Убраны потребности, которых больше нет в кампании: ${listShort(goneNeeds)}.`)

  // статусы игрока — только из реестра
  if (Array.isArray(p.statuses)) {
    const statusIds = new Set((meta.statuses ?? []).map((s) => s.id))
    const before = p.statuses.length
    p.statuses = p.statuses.filter((s) => s && statusIds.has(s.id))
    if (p.statuses.length !== before) ctx.note('repaired', 'Сняты статусы, которых больше нет в реестре кампании.')
  }

  // характеристики и производные
  if (p.stats && typeof p.stats === 'object') {
    const maxHp = typeof p.max_hp === 'number' && p.max_hp > 0 ? p.max_hp : derivedHP(p.stats)
    const maxMp = typeof p.max_mp === 'number' && p.max_mp >= 0 ? p.max_mp : derivedMP(p.stats)
    p.max_hp = maxHp
    p.max_mp = maxMp
    if (typeof p.hp !== 'number' || p.hp > maxHp) p.hp = maxHp
    if (p.hp < 0) p.hp = 0
    if (typeof p.mp !== 'number' || p.mp > maxMp) p.mp = maxMp
    if (p.mp < 0) p.mp = 0
  }

  // напарники: только живые сущности кампании
  if (Array.isArray(state.party)) {
    const gone = state.party.filter((c) => !c || !ents[c.entity]).map((c) => entityLabel(campaign, c?.entity ?? '?'))
    state.party = state.party.filter((c) => c && ents[c.entity])
    for (const c of state.party) {
      if (typeof c.hp !== 'number' || c.hp > c.max_hp) c.hp = c.max_hp
    }
    if (gone.length) ctx.note('repaired', `Отряд покинули: ${listShort(gone)} — их больше нет в кампании.`)
  } else {
    state.party = []
  }

  // квесты: стадия обязана существовать
  if (state.quests && typeof state.quests === 'object') {
    const dropped: string[] = []
    const reset: string[] = []
    for (const [qid, qs] of Object.entries(state.quests)) {
      const def = campaign.quests[qid]
      if (!def || !qs) {
        dropped.push(campaign.quests[qid]?.label ?? qid)
        delete state.quests[qid]
        continue
      }
      if (!def.stages.some((s) => s.id === qs.stage)) {
        const first = def.stages[0]
        if (first) {
          qs.stage = first.id
          reset.push(def.label)
        } else {
          delete state.quests[qid]
          dropped.push(def.label)
        }
      }
    }
    if (dropped.length) ctx.note('repaired', `Из журнала убраны квесты, которых больше нет в кампании: ${listShort(dropped)}.`)
    if (reset.length) ctx.note('repaired', `Квесты возвращены на первую стадию (стадии перестроены): ${listShort(reset)}.`)
  } else {
    state.quests = {}
  }

  // правила: id несуществующих правил не должны оставаться в «сработавших»
  if (Array.isArray(state.fired_rules)) {
    const before = state.fired_rules.length
    const gone = state.fired_rules.filter((id) => !campaign.rules[id])
    state.fired_rules = state.fired_rules.filter((id) => !!campaign.rules[id])
    if (state.fired_rules.length !== before) {
      ctx.note('repaired', `Убраны отметки о ${before - state.fired_rules.length} правиле(ах), которых больше нет в кампании.`)
    }
    void gone
  }

  // мир: регион → локация → сцена
  const locations = allLocations(campaign.world)
  const locIds = new Set(locations.map((l) => l.id))
  const regionIds = new Set<string>()
  const walkRegions = (regions: typeof campaign.world.regions) => {
    for (const r of regions) {
      regionIds.add(r.id)
      if (r.sub_regions) walkRegions(r.sub_regions)
    }
  }
  walkRegions(campaign.world.regions)

  if (!locIds.has(state.location)) {
    ctx.note('repaired', `Локация «${state.location}» удалена из кампании — герой перенесён на старт (${meta.starting_location}).`)
    state.location = meta.starting_location
    state.scene = meta.starting_scene
  } else {
    const loc = locations.find((l) => l.id === state.location)!
    if (!campaign.scenes[state.scene] || !loc.scenes.includes(state.scene)) {
      const next = loc.arrival_scene && campaign.scenes[loc.arrival_scene] ? loc.arrival_scene : loc.scenes[0]
      if (next) {
        ctx.note('repaired', `Сцена «${state.scene}» удалена — герой в сцене «${next}».`)
        state.scene = next
      }
    }
  }
  if (!regionIds.has(state.region)) {
    state.region = meta.starting_region
    ctx.note('repaired', 'Регион удалён из кампании — открыт стартовый регион.')
  }
  if (Array.isArray(state.revealed_locations)) {
    const before = state.revealed_locations.length
    state.revealed_locations = state.revealed_locations.filter((id) => locIds.has(id))
    if (state.revealed_locations.length !== before) ctx.note('repaired', 'С карты убраны отметки удалённых локаций.')
  }
  if (Array.isArray(state.blocked_paths)) {
    const before = state.blocked_paths.length
    state.blocked_paths = state.blocked_paths.filter((pair) => {
      const [a, b] = String(pair).split('->')
      return locIds.has(a) && locIds.has(b)
    })
    if (state.blocked_paths.length !== before) ctx.note('repaired', 'Убраны перекрытые дороги к удалённым локациям.')
  }

  // сущности: мёртвые/убранные/заспавненные/описания — только существующие
  for (const field of ['dead_entities', 'removed_entities'] as const) {
    const list = state[field]
    if (Array.isArray(list)) state[field] = list.filter((id) => !!ents[id])
  }
  if (Array.isArray(state.spawned)) {
    const before = state.spawned.length
    state.spawned = state.spawned.filter(
      (s) => s && ents[s.entity] && campaign.scenes[s.scene] && !!campaign.scenes[s.scene].slots.some((sl) => sl.id === s.slot),
    )
    if (state.spawned.length !== before) ctx.note('repaired', 'Убраны вызванные персонажи, которых или чьих мест больше нет в кампании.')
  }
  if (state.desc_overrides) {
    const keys = Object.keys(state.desc_overrides).filter((id) => !ents[id])
    for (const k of keys) delete state.desc_overrides![k]
    if (keys.length) ctx.note('repaired', 'Убраны описания удалённых персонажей и предметов.')
  }

  // прочее: погода, кодекс, фракции
  if (state.weather && !(meta.weathers ?? []).some((w) => w.id === state.weather)) {
    delete state.weather
    ctx.note('repaired', 'Погода убрана: такой погоды больше нет в реестре кампании.')
  }
  if (Array.isArray(state.codex_unlocked)) {
    const before = state.codex_unlocked.length
    state.codex_unlocked = state.codex_unlocked.filter((id) => !!campaign.codex[id])
    if (state.codex_unlocked.length !== before) ctx.note('repaired', 'Из кодекса убраны записи, которых больше нет в кампании.')
  }
  if (state.dispositions) {
    // в dispositions живут и значения фракций, и ЛИЧНЫЕ сдвиги к NPC
    // (getDisposition/changeDisposition берут ключом id цели); фильтрация только
    // по фракциям стирала личные отношения при каждой загрузке (фидбек 27, п.7)
    const factionIds = new Set((meta.factions ?? []).map((f) => f.id))
    const keys = Object.keys(state.dispositions).filter((id) => !factionIds.has(id) && !ents[id])
    for (const k of keys) delete state.dispositions[k]
    if (keys.length) ctx.note('repaired', 'Убраны отношения с фракциями и персонажами, которых больше нет в кампании.')
  }
}

