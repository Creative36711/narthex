/**
 * Смоук блока 8 ТЗ «Гибкий движок» — предмет → слот сцены («ключ к двери»).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz8-usewith-smoke.mts
 *
 *  1. применение предмета к слоту: эффекты, расход по флагу, сообщение;
 *  2. без предмета — обычное поведение (описание);
 *  3. два подходящих предмета — выбор через useItemOnSlot(slotId, itemId);
 *  4. демо-пазл (сундук в таверне) и редактор/схема.
 */
import { scenePlayerSource } from './scene-sources.mts'
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { EditorStore } from '../src/editor/store'
import { exportMonolith } from '../src/editor/monolith'
import type { CampaignData, SlotDef } from '../src/shared/types'

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

function tavernEngine(): GameEngine {
  const e = new GameEngine(demo)
  e.start()
  e.applyEffects([{ type: 'teleport_player', location: 'loc_tavern', scene: 'scene_tavern_hall' }])
  return e
}

const tavernScene = demo.scenes['scene_tavern_hall']
const chestSlot = tavernScene.slots.find((s) => s.id === 'slot_chest') as SlotDef | undefined

// ── 1. применение: эффекты, расход, сообщение ──
{
  check('1 демо: слот сундука с use существует', !!chestSlot && !!chestSlot.use_with?.length)
  const e = tavernEngine()
  e.addItem('item_tavern_key', 1)
  const opts = e.slotUseOptions(chestSlot!)
  check('1 с ключом в инвентаре есть вариант применения', opts.length === 1 && opts[0].itemId === 'item_tavern_key')
  const silver0 = e.itemCount('item_silver')
  const ok = e.useItemOnSlot('slot_chest', 'item_tavern_key')
  check('1 useItemOnSlot: успех', ok === true)
  check('1 ключ израсходован (consume)', e.itemCount('item_tavern_key') === 0)
  check('1 эффекты применены: серебро', e.itemCount('item_silver') === silver0 + 20)
  check('1 эффекты применены: мазь', e.itemCount('item_healing_salve') >= 1)
  check('1 флаг установлен', !!e.state.flags['tavern_chest_opened'])
  check('1 сообщение показано', e.messages.some((m) => m.text.includes('Замок щёлкает')))
  check('1 сундук убран из сцены (remove_entity)', e.state.removed_entities.includes('item_locked_chest'))
}

// ── 2. без предмета — обычное поведение ──
{
  const e = tavernEngine()
  check('2 без ключа вариантов нет', e.slotUseOptions(chestSlot!).length === 0)
  const occupant = e.slotOccupants(e.currentScene()!).find((o) => o.slot.id === 'slot_chest')
  check('2 сундук занимает слот', !!occupant?.entity)
  e.interactWithSlot(occupant!)
  // описание предмета больше не выводится сообщением при клике (осознанно:
  // оно живёт в подсказке data-tip, см. interactWithSlot), но клик без ключа
  // не должен ни открывать сундук, ни тратить предметы
  const chest = e.campaign.entities['item_locked_chest']
  check('2 клик без ключа — без эффектов, описание видно в подсказке',
    !e.state.flags['tavern_chest_opened']
      && !e.state.removed_entities.includes('item_locked_chest')
      && !!chest?.description?.includes('Заперт'))
  check('2 неподходящий предмет не применяется', e.useItemOnSlot('slot_chest', 'item_bread') === false)
}

// ── 3. два предмета — выбор через движковый метод ──
{
  const c: CampaignData = JSON.parse(JSON.stringify(demo))
  const slot = c.scenes['scene_tavern_hall'].slots.find((s) => s.id === 'slot_chest')!
  slot.use_with!.push({
    item: 'item_lockpick',
    effects: [{ type: 'set_flag', flag: 'picked_lock' }],
    message: 'Отмычка провернулась.',
  })
  c.entities['item_lockpick'] = {
    id: 'item_lockpick', type: 'item', category: 'misc', label: 'Отмычка',
    description: '', weight: 0.1, stackable: false,
  }
  const e = new GameEngine(c)
  e.start()
  e.applyEffects([{ type: 'teleport_player', location: 'loc_tavern', scene: 'scene_tavern_hall' }])
  e.addItem('item_tavern_key', 1)
  e.addItem('item_lockpick', 1)
  const opts = e.slotUseOptions(slot)
  check('3 модалка выбора: два варианта', opts.length === 2 && opts.map((o) => o.itemId).includes('item_lockpick'))
  check('3 выбор отмычки', e.useItemOnSlot('slot_chest', 'item_lockpick') === true)
  check('3 отмычка НЕ израсходована (нет consume)', e.itemCount('item_lockpick') === 1)
  check('3 сработал эффект выбранного предмета', !!e.state.flags['picked_lock'] && !e.state.flags['tavern_chest_opened'])
}

// ── 4. редактор, схема, монолит ──
{
  const se = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
  check('4 редактор сцены: форма use_with', se.includes('Использование предметов на слоте') && se.includes('Израсходовать'))
  const ss = scenePlayerSource()
  check('4 сцена игрока: модалка выбора', ss.includes('useModal') && ss.includes('slotUseOptions'))
  const schema = JSON.parse(readFileSync('docs/campaign.schema.json', 'utf8'))
  check('4 схема: SlotUseWith', !!schema.$defs.SlotUseWith && !!schema.$defs.SlotDef.properties.use_with)
  const store = new EditorStore(base)
  await store.load()
  const { doc } = exportMonolith(store)
  const slot2 = doc.scenes['scene_tavern_hall']?.slots?.find((s: SlotDef) => s.id === 'slot_chest')
  check('4 монолит: use сцены переживает экспорт', !!slot2?.use_with?.length)
}

if (failed > 0) {
  console.error(`\nПРОВАЛЕНО ПРОВЕРОК: ${failed}`)
  process.exit(1)
}
console.log('\nALL GREEN (tz8-usewith)')
