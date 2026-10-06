import { GameEngine } from '../src/core/engine'
import type { CampaignData, ItemDef } from '../src/shared/types'
import { DEFAULT_DICE_RULES } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => { mem.set(k, v) },
  removeItem: (k) => { mem.delete(k) },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

const crate: ItemDef = {
  id: 'item_crate',
  type: 'item',
  category: 'container',
  label: 'Ящик с кладью',
  weight: 12.0,
  stackable: false,
  interact_options: [
    {
      label: 'Обыскать ящик',
      effects: [
        {
          type: 'skill_check_gate',
          skill: 'investigate',
          difficulty: 40,
          success_effects: [
            { type: 'add_item', item: 'item_cloth', quantity: 2 },
            { type: 'add_item', item: 'item_scrap', quantity: 1 },
            { type: 'show_message', text: 'Под тряпьём — обрезок троса от лебёдки и немного лома.' },
          ],
          fail_effects: [
            { type: 'show_message', text: 'Тряпьё, плесень и больше ничего.' },
          ],
        },
      ],
      once: true,
      sound: 'sfx_pickup',
    },
  ],
}

const campaign: CampaignData = {
  meta: {
    id: 'test_crate',
    title: 'Тест ящика',
    version: '1.0.0',
    package_format: 1,
    default_player: 'hero',
    starting_region: 'r',
    starting_location: 'loc',
    starting_scene: 'sc',
    needs: [],
    luck: {
      initial_multiplier: 5,
      reroll_cost: 10,
    },
    skills: [{ id: 'investigate', label: 'Внимательность', base: 40 }],
    dice_rules: DEFAULT_DICE_RULES,
  },
  world: {
    regions: [{ id: 'r', label: 'R', locations: [{ id: 'loc', label: 'L', scenes: ['sc'], travel_connections: [] }] }],
  },
  scenes: {
    sc: {
      id: 'sc',
      label: 'SC',
      location: 'loc',
      states: [{ id: 's0', label: 'S0', figure_positions: [{ slot_id: 'sl', entity_id: 'item_crate' }] }],
      slots: [{ id: 'sl', label: 'SL', kind: 'item', default_entity: 'item_crate', type: ['container'] }],
      navigation: [],
    },
  },
  entities: {
    hero: {
      id: 'hero',
      type: 'npc',
      label: 'Герой',
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10, HP: 100 },
      skills: { investigate: 40 },
      inventory: [],
    },
    item_crate: crate,
    item_cloth: { id: 'item_cloth', type: 'item', label: 'Тряпьё' },
    item_scrap: { id: 'item_scrap', type: 'item', label: 'Лом' },
  },
  dialogues: {},
  rules: {},
}

async function testReroll() {
  console.log('Testing luck reroll on item_crate...')
  const engine = new GameEngine(campaign)
  engine.start()

  // Гарантируем, что очков удачи достаточно (POW 10 * 5 = 50, cost = 10)
  console.log('Luck:', engine.luck(), '/', engine.luckMax())

  // Перехватим RNG, чтобы первый бросок был провалом (например d100 = 80), а второй — успехом (d100 = 20)
  let rollCount = 0
  engine.rng.next = () => {
    rollCount++
    if (rollCount === 1) return 0.80 // 80 -> fail
    return 0.20 // 20 -> success
  }

  const opt = crate.interact_options![0]
  engine.runItemInteract(crate, opt)

  console.log('After runItemInteract:')
  console.log('luckOffer active:', !!engine.luckOffer)
  if (!engine.luckOffer) throw new Error('Ожидался luckOffer!')

  console.log('Inventory before reroll:', engine.state.player.inventory)
  console.log('Resolving luckOffer with reroll=true...')
  engine.resolveLuckOffer(true)

  console.log('Inventory after reroll:', engine.state.player.inventory)
  console.log('Cloth count:', engine.itemCount('item_cloth'))
  console.log('Scrap count:', engine.itemCount('item_scrap'))

  if (engine.itemCount('item_cloth') !== 2 || engine.itemCount('item_scrap') !== 1) {
    throw new Error('Предметы НЕ ВЫДАЛИСЬ после успешного переброса за удачу!')
  }
  console.log('✓ Предметы успешно выданы в инвентарь при перебросе!')
}

testReroll().catch((e) => {
  console.error(e)
  process.exit(1)
})
