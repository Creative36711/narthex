/**
 * Смоук блока 7 ТЗ «Гибкий движок» — слоты экипировки.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz7-slots-smoke.mts
 *
 *  1. миграция сейва в3 {weapon, armor} → рекорд слотов (в4);
 *  2. старые предметы без equip_slot экипируются по данным;
 *  3. свой слот кампании + броня из нескольких слотов суммируется в бою;
 *  4. редактор и схема; слоты экипировки объявляет кампания (встроенных нет).
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine, loadSave } from '../src/core/engine'
import '../packs/narrative/operations'
import { migrateEntity } from '../src/shared/migrate'
import { equipmentSlots, type CampaignData, type ItemDef } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const demo = await loadCampaign(base)

// ── 1. миграция сейва в3 → в4 ──
{
  const key = 'narthex:save:tz7-test'
  const v3 = {
    save_version: 3,
    seed: 'x',
    tick: 8,
    player: {
      entity: 'player_mercenary',
      equipment: { weapon: 'item_short_sword', armor: 'item_leather_jerkin' },
      inventory: [],
      skills: {},
      skill_marks: {},
      needs: {},
      currencies: {},
      hp: 10, max_hp: 10, mp: 10, max_mp: 10,
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
    },
  }
  mem.set(key, JSON.stringify(v3))
  const state = loadSave('tz7-test')
  check('1 в3-сейв принят (не отброшен)', state !== null)
  check('1 версия поднята до в4', state?.save_version === 4)
  check('1 экипировка стала рекордом слотов', state?.player.equipment['weapon'] === 'item_short_sword' && state?.player.equipment['armor'] === 'item_leather_jerkin')
  // в2 — переносится цепочкой миграций (политика «чиним, а не выбрасываем»)
  mem.set(key, JSON.stringify({ ...v3, save_version: 2 }))
  const fromV2 = loadSave('tz7-test')
  check('1 в2-сейв перенесён, а не отброшен', fromV2 !== null)
  check('1 в2 → в4: версия поднята', fromV2?.save_version === 4)
  check('1 в2 → в4: устаревшие валюты убраны', fromV2?.player.currencies === undefined)
  // сейв из более нового движка — не трогаем (иначе потеряем данные игрока)
  mem.set(key, JSON.stringify({ ...v3, save_version: 99 }))
  check('1 сейв новее движка отброшен', loadSave('tz7-test') === null)
  mem.delete(key)
}

// ── 2. старые предметы без equip_slot ──
{
  check('2 миграция сущности: меч → слот Оружие', (migrateEntity(demo.entities['item_short_sword'] as ItemDef) as ItemDef).equip_slot === 'weapon')
  check('2 миграция сущности: дублет → слот Броня', (migrateEntity(demo.entities['item_leather_jerkin'] as ItemDef) as ItemDef).equip_slot === 'armor')
  const e = new GameEngine(demo)
  e.start()
  check('2 itemSlot: меч (старый формат) → оружие', e.itemSlot('item_short_sword') === 'weapon')
  check('2 itemSlot: хлеб не экипируется', e.itemSlot('item_bread') === undefined)
  e.addItem('item_short_sword', 1)
  e.equipItem('item_short_sword')
  check('2 старый меч наделся в слот оружия', e.state.player.equipment['weapon'] === 'item_short_sword')
  check('2 isEquipped работает по рекорду', e.isEquipped('item_short_sword'))
  e.unequipItem('weapon')
  check('2 снятие по id слота', !e.state.player.equipment['weapon'])
}

// ── 3. свой слот + суммирование брони ──
{
  const c: CampaignData = JSON.parse(JSON.stringify(demo))
  // встроенных слотов нет: мастер объявляет весь реестр сам
  c.meta.equipment_slots = [
    { id: 'weapon', label: 'Оружие' },
    { id: 'armor', label: 'Броня' },
    { id: 'helm', label: 'Шлем' },
  ]
  c.entities['item_iron_helm'] = {
    id: 'item_iron_helm', type: 'item', category: 'armor', label: 'Железный шлем',
    description: '', weight: 1, stackable: false,
    armor_data: { points: 2 }, equip_slot: 'helm',
  }
  const e = new GameEngine(c)
  e.start()
  const slots = e.equipmentSlots()
  check('3 реестр мастера целиком виден движку', slots.map((s) => s.id).join(',') === 'weapon,armor,helm', slots.map((s) => s.id).join(','))
  check('3 свой слот добавлен', slots.some((s) => s.id === 'helm' && s.label === 'Шлем'))
  e.addItem('item_leather_jerkin', 1)
  e.addItem('item_iron_helm', 1)
  e.equipItem('item_leather_jerkin')
  e.equipItem('item_iron_helm')
  check('3 шлем наделся в свой слот', e.state.player.equipment['helm'] === 'item_iron_helm')
  const armor = e.playerArmor()
  check('3 броня двух слотов суммируется', armor.points === 3, `очки=${armor.points}`)
  // в бою — та же сумма
  e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_bandit', count: 1 }], arena: 'arena_cellar' })
  const pc = e.combat!.combatants.find((x) => x.id === 'c_player')!
  check('3 броня в бою = сумма слотов', pc.armor === 3, `броня=${pc.armor}`)
  check('3 снятие последнего предмета чистит слот', (() => {
    e.removeItem('item_iron_helm', 1)
    return e.state.player.equipment['helm'] === undefined
  })())
}

// ── 4. редактор, схема, демо ──
{
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('4 редактор: реестр слотов экипировки', ce.includes('Слоты экипировки') && !ce.includes('BUILTIN_EQUIPMENT_SLOTS'))
  const ee = readFileSync('src/editor/EntityEditor.tsx', 'utf8')
  check('4 редактор предмета: селект слота', ee.includes('Слот экипировки') && ee.includes('Не экипируется'))
  const inv = readFileSync('src/player/Panels.tsx', 'utf8')
  check('4 инвентарь: секция «Экипировка»', inv.includes('Экипировка') && inv.includes('equip-slots'))
  const schema = JSON.parse(readFileSync('docs/campaign.schema.json', 'utf8'))
  check('4 схема: equipment_slots у кампании', !!schema.$defs.CampaignMeta.properties?.equipment_slots)
  check('4 схема: equip_slot у предмета', !!schema.$defs.ItemDef.properties?.equip_slot)
  const e = new GameEngine(demo)
  e.start()
  // встроенных слотов нет: реестр целиком задаёт кампания (мастер)
  check('4 демо: слоты экипировки объявлены кампанией', equipmentSlots(demo.meta).length === (demo.meta.equipment_slots ?? []).length && equipmentSlots(demo.meta).length > 0, equipmentSlots(demo.meta).map((s) => s.label).join(', '))
}

if (failed > 0) {
  console.error(`\nПРОВАЛЕНО ПРОВЕРОК: ${failed}`)
  process.exit(1)
}
console.log('\nALL GREEN (tz7-slots)')
