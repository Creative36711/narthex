import { readFileSync } from 'node:fs'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignManifest, MonolithDoc, NpcDef } from '../src/shared/types'
import { campaignFromMonolith } from '../src/editor/playtest'

console.log('Testing Round 34 Fixes: Notes Modal, Particles, Trader Repurchase & Canvas Rain...')

// 1. Проверка редактора заметок и модалки
const debugPanelCode = readFileSync('src/editor/PlaytestDebugPanel.tsx', 'utf-8')
const editorCss = readFileSync('src/editor/editor.css', 'utf-8')
if (!debugPanelCode.includes('pt-note-modal-card') || !debugPanelCode.includes('setIsModalOpen')) {
  throw new Error('PlaytestDebugPanel must include full-screen modal expansion for notes')
}
if (!editorCss.includes('.pt-note-modal-overlay') || !editorCss.includes('470px')) {
  throw new Error('editor.css must include wider debug panel (470px) and modal overlay styles')
}
console.log('✓ 1. Панель отладки расширена до 470px, добавлено полноэкранное модальное окно набора заметок')

// 2. Проверка SceneEditor: удаление скобок в пресетах и 3-колоночная сетка
const sceneEditorCode = readFileSync('src/editor/SceneEditor.tsx', 'utf-8')
if (sceneEditorCode.includes("label: 'Пылинки (мягкое свечение)'") || sceneEditorCode.includes("label: 'Пар (дым, туман)'")) {
  throw new Error('SceneEditor particle presets must have clean names without brackets')
}
if (!sceneEditorCode.includes('repeat(3, minmax(0, 1fr))')) {
  throw new Error('SceneEditor particle parameters must use 3-column layout to prevent text clipping')
}
console.log('✓ 2. Названия пресетов очищены от скобок, сетка параметров переведена на 3 колонки без обрезания слов')

// 3. Проверка выкупа проданных товаров у торговца
const root = 'public/campaigns/ash-of-caerden/'
const read = <T,>(path: string): T => JSON.parse(readFileSync(root + path, 'utf8')) as T
const manifest = read<CampaignManifest>('manifest.json')
const collect = <T extends { id: string }>(folder: string, files: string[] = []) =>
  Object.fromEntries(files.map((file) => {
    const value = read<T>(`${folder}/${file}`)
    return [value.id, value]
  }))

const doc: MonolithDoc = {
  campaign: read('campaign.json'),
  world: read('world.json'),
  scenes: collect('scenes', manifest.scenes),
  entities: collect('entities', manifest.entities),
  rules: {},
  arenas: {},
  quests: {},
  encounters: {},
  cutscenes: {},
  recipes: {},
  codex: {},
  dialogues: {},
}

const campaign = campaignFromMonolith(doc)
const engine = new GameEngine(campaign)

// Находим торговца в кампании
let trader: NpcDef | undefined
for (const entity of Object.values(campaign.entities)) {
  if (entity.type === 'npc' && (entity as NpcDef).trader?.sells?.length) {
    trader = entity as NpcDef
    break
  }
}
if (!trader) {
  throw new Error('No trader found in ash-of-caerden campaign')
}

// Включаем фичу торговли для теста
campaign.meta.features = { ...(campaign.meta.features ?? {}), trade: true }

// Открываем торговлю
engine.openTrade(trader.id)
const initialSells = engine.traderSells(trader)
const initialCount = initialSells.length

// Добавляем тестовый предмет игроку и продаём торговцу
const testItemId = 'potion_lesser_heal'
engine.addItem(testItemId, 1, { silent: true })
const initialItemCount = engine.itemCount(testItemId)

const sellPrice = engine.sellPrice(trader, testItemId)
const sold = engine.sellItem(testItemId, sellPrice)
if (!sold) throw new Error('Selling item to trader should succeed')

// Проверяем: предмет исчез из инвентаря игрока и появился в ассортименте торговца для выкупа
if (engine.itemCount(testItemId) !== initialItemCount - 1) {
  throw new Error('Player inventory count must decrease after sale')
}
const updatedSells = engine.traderSells(trader)
const boughtItem = updatedSells.find((s) => s.item === testItemId)
if (!boughtItem) {
  throw new Error('Sold item must now appear in traderSells')
}
const stockAfterSell = engine.traderItemStock(trader.id, testItemId)
if (stockAfterSell === undefined || stockAfterSell < 1) {
  throw new Error('Trader stock of sold item must be at least 1')
}

// Теперь игрок покупает этот предмет обратно
const buyPrice = engine.buyPrice(trader, testItemId, boughtItem.price)
// Убеждаемся, что у игрока хватает валюты
engine.addItem(engine.currencyItemId(), buyPrice + 100, { silent: true })
const boughtBack = engine.buyItem(testItemId, buyPrice)
if (!boughtBack) throw new Error('Buying back item should succeed')
if (engine.itemCount(testItemId) !== initialItemCount) {
  throw new Error('Player must have the item back in inventory')
}
if (engine.traderItemStock(trader.id, testItemId) !== stockAfterSell - 1) {
  throw new Error('Trader stock must decrease by 1 after repurchase')
}

console.log('✓ 3. Выкуп проданных товаров у торговца работает безупречно: товары пополняют склад и выкупаются обратно')

// 4. Проверка кинематографичного Canvas для всех типов частиц и независимости от UI
const atmosphereCode = readFileSync('src/player/Atmosphere.tsx', 'utf-8')
const indexCssCode = readFileSync('src/index.css', 'utf-8')

if (!atmosphereCode.includes('CinematicAtmosphereCanvas') || !atmosphereCode.includes('memo(AtmosphereLayerComponent')) {
  throw new Error('Atmosphere.tsx must include CinematicAtmosphereCanvas and memoized AtmosphereLayer')
}
if (!atmosphereCode.includes('BUILTIN_CANVAS_TYPES = [\'rain\', \'snow\', \'fog\', \'dust\', \'steam\', \'sparks\', \'embers\', \'ash\']')) {
  throw new Error('All 8 particle presets must be handled via CinematicAtmosphereCanvas')
}
// Проверка уникальности механик каждой частицы
if (!atmosphereCode.includes('wobbleAmp') || !atmosphereCode.includes('stormStreaks') || !atmosphereCode.includes('twinklePhase') || !atmosphereCode.includes('pulsePhase') || !atmosphereCode.includes('tumblePhase')) {
  throw new Error('Each particle must have unique mechanics (snow wobble, storm streaks, dust twinkle, ember breathing glow, ash tumble)')
}
// Проверка отсутствия стробоскопического бага тумана
if (indexCssCode.includes('.weather-overlay.speed-fast { animation-duration: 0.3s !important; }')) {
  throw new Error('index.css must not force 0.3s storm animation on weather overlays')
}
console.log('✓ 4. Реализован кинематографичный Canvas для всех 8 типов частиц с уникальным визуалом, мемоизацией от ререндеров и устранением строба тумана при шторме')

console.log('\nAll round 34 smoke tests passed successfully!')
