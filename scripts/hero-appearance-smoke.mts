/**
 * Проверка постоянной внешности и портретных слоёв экипировки.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/hero-appearance-smoke.mts
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { newCharChoice } from '../src/core/charcreate'
import type { CampaignData, HeroPortraitLayerDef, ItemDef } from '../src/shared/types'

const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
}

let failed = 0
function check(name: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}`)
  if (!ok) failed++
}

const source = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
const campaign = structuredClone(source) as CampaignData
const creation = campaign.meta.char_creation!
const portraitLayers: HeroPortraitLayerDef[] = [
  { id: 'skin', label: 'Цвет кожи', category: 'skin', options: [
    { id: 'fair', label: 'Светлая', image: 'hero/skin-fair.png' },
    { id: 'olive', label: 'Оливковая', image: 'hero/skin-olive.png', combat_figure: 'hero/figure-olive.png', combat_figure_mode: 'static' },
  ] },
  { id: 'hair', label: 'Волосы', category: 'hair', options: [{ id: 'braid', label: 'Коса', image: 'hero/hair-braid.png' }] },
]
creation.portraits = [{ id: 'portrait', label: 'Портрет', image: 'hero/base.png', combat_figure: 'hero/base-figure.png' }]
creation.portrait_layers = portraitLayers
const item: ItemDef = {
  id: 'item_appearance_test', type: 'item', category: 'clothing', label: 'Плащ', description: '', weight: 0, stackable: false,
  hero_appearance: { overlay: 'hero/cloak.png', order: 3 },
}
campaign.entities[item.id] = item
const choice = newCharChoice(creation, campaign.entities[campaign.meta.default_player] as any, campaign.meta)
check('создание заранее выбирает по первому варианту каждого сегмента', choice.portrait === 'portrait' && choice.portrait_layers?.skin === 'fair' && choice.portrait_layers?.hair === 'braid')
choice.portrait_layers = { ...choice.portrait_layers, skin: 'olive' }
const engine = new GameEngine(campaign)
engine.applyCharCreation(choice)
check('постоянный внешний вид сохраняется в состоянии игрока', engine.state.player.portrait_choice?.layers?.skin === 'olive')
check('базовый портрет строится по слоям в заданном порядке', engine.heroPortraitImages().join('|') === 'hero/skin-olive.png|hero/hair-braid.png')
const staticFigure = engine.heroCombatFigure()
check('черта внешности задаёт постоянную фигурку боя', staticFigure.figure === 'hero/figure-olive.png' && staticFigure.mode === 'static')
engine.state.player.equipment.chest = item.id
check('надетый предмет появляется поверх портрета героя', engine.heroPortraitImages().at(-1) === 'hero/cloak.png')
const afterEquip = engine.heroCombatFigure()
check('смена экипировки не меняет боевую фигурку', afterEquip.figure === staticFigure.figure && afterEquip.mode === staticFigure.mode)
engine.state.player.equipment.chest = 'item_gambeson'
check('снятие слоя экипировки убирает его с портрета', !engine.heroPortraitImages().includes('hero/cloak.png'))

console.log(failed ? `FAILED: ${failed}` : 'ALL GREEN')
if (failed) process.exitCode = 1
