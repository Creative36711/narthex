import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignData, ItemDef } from '../src/shared/types'
import { DEFAULT_DICE_RULES } from '../src/shared/types'

const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
  length: 0,
  key: () => null,
}

const mockCampaign: CampaignData = {
  meta: {
    id: 'test_luck',
    title: 'Тест Удачи',
    author: 'Tester',
    version: '1.0.0',
    default_player: 'player_hero',
    needs: [],
    dice_rules: { ...DEFAULT_DICE_RULES, system: 'brp' },
    luck: { base_chance: 50, reroll_cost: 0 },
    starting_scene: 'scene_test',
    skills: [
      { id: 'lockpick', label: 'Взлом', category: 'thief', base: 10 },
      { id: 'spot', label: 'Внимание', category: 'perception', base: 10 },
    ],
    currencies: [{ id: 'silver', label: 'Серебро', symbol: 'с', item_id: 'item_silver' }],
  },
  world: { regions: [] },
  scenes: {
    scene_test: {
      id: 'scene_test',
      label: 'Тестовая сцена',
      location: 'loc_test',
      background: '',
      slots: [
        { id: 'slot_crate', x: 0, y: 0, w: 100, h: 100, type: ['container'], entity: 'item_crate' }
      ]
    }
  },
  entities: {
    player_hero: {
      id: 'player_hero',
      type: 'npc',
      label: 'Герой',
      is_player: true,
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: { lockpick: 5 },
    },
    item_cloth: {
      id: 'item_cloth',
      type: 'item',
      category: 'craft',
      label: 'Ткань',
      description: 'Отрез плотной ткани.',
      weight: 0.1,
      stackable: true,
    },
    item_scrap: {
      id: 'item_scrap',
      type: 'item',
      category: 'craft',
      label: 'Металлолом',
      description: 'Обломки шестерёнок.',
      weight: 0.5,
      stackable: true,
    },
    item_crate: {
      id: 'item_crate',
      type: 'item',
      category: 'container',
      label: 'Ящик с кладью',
      description: 'Тяжёлый опечатанный ящик.',
      weight: 10,
      stackable: false,
      interact_options: [
        {
          label: 'Вскрыть ящик',
          effects: [
            {
              type: 'skill_check_gate',
              skill: 'lockpick',
              difficulty: 50,
              success_effects: [
                { type: 'add_item', item: 'item_cloth', quantity: 2 },
                { type: 'add_item', item: 'item_scrap', quantity: 1 }
              ],
              fail_effects: [
                { type: 'set_flag', flag: 'crate_failed', value: true }
              ]
            }
          ]
        }
      ]
    }
  },
  dialogues: {},
  quests: {},
  recipes: {},
  rules: {},
  codex: {},
}

console.log('Testing luck reroll on item_crate...')
const engine = new GameEngine(mockCampaign)
engine.start()

// Даём игроку навык и Удачу
engine.state.player.skills['lockpick'] = 1
console.log(`Luck: ${engine.luck()} / ${engine.luckMax()}`)

const crate = engine.campaign.entities['item_crate'] as ItemDef
const opt = crate.interact_options![0]

// Вызываем интерактивное действие
engine.runItemInteract(crate, opt)

console.log('After runItemInteract:')
console.log(`luckOffer active: ${!!engine.luckOffer}`)
console.log('Inventory before reroll:', engine.state.inventory)

if (!engine.luckOffer) {
  throw new Error('Ожидался luckOffer после провала проверки навыка!')
}

// Принудительно задаём детерминированный успех броска на Удачу через PRNG / dice
// В GameEngine rollD100() возвращает 1..100.
// Разрешаем luckOffer с согласием на переброс:
console.log('Resolving luckOffer with reroll=true...')
engine.state.player.skills['lockpick'] = 100
engine.resolveLuckOffer(true)

console.log('Inventory after reroll:', engine.state.inventory)

const cloth = engine.itemCount('item_cloth')
const scrap = engine.itemCount('item_scrap')

console.log(`Cloth count: ${cloth}`)
console.log(`Scrap count: ${scrap}`)

if (cloth !== 2 || scrap !== 1) {
  throw new Error(`Предметы не выданы при успешном перебросе! cloth=${cloth}, scrap=${scrap}`)
}

console.log('✓ Предметы успешно выданы в инвентарь при перебросе!')
