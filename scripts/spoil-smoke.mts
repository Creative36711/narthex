import assert from 'node:assert/strict'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignDef } from '../src/shared/types'

const campaign: CampaignDef = {
  meta: {
    id: 'test_spoil',
    title: 'Тест порчи предметов',
    author: 'Tester',
    version: '1.0.0',
    engine_version: '0.8.0',
    tick_label: 'ч',
    default_player: 'hero',
    starting_region: 'reg_1',
    starting_location: 'loc_start',
    starting_scene: 'scene_start',
    needs: [],
    currencies: [{ id: 'coins', label: 'Монеты' }],
  },
  player: {
    entity: 'hero',
    name: 'Тестовый Герой',
    portrait: { neutral: '' },
    stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
    skills: {},
    hp: 10,
    max_hp: 10,
    mp: 10,
    max_mp: 10,
    inventory: [],
    equipment: {},
    location: 'loc_start',
    scene: 'scene_start',
    revealed_locations: ['loc_start'],
    flags: {},
    variables: {},
    stats_run: { moves: 0, turns: 0, kills: 0, rolls: 0, travels: 0 },
    history: [],
    statuses: [],
    dispositions: {},
    npc_mood: {},
    factions: {},
    quests: {},
    time: { day: 1, hour: 12, minute: 0, ticks: 0 },
    weather: 'clear',
    known_recipes: [],
    achievements: [],
    journal: [],
  },
  entities: {
    hero: {
      id: 'hero',
      type: 'npc',
      label: 'Герой',
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: {},
    },
    item_stew: {
      id: 'item_stew',
      type: 'item',
      label: 'Горячая похлёбка',
      weight: 0.5,
      stackable: true,
      decay_ticks: 10,
      spoil_action: 'transform',
      spoil_into: 'item_stew_cold',
      spoil_msg: 'Похлёбка в котелке остыла.',
    },
    item_stew_cold: {
      id: 'item_stew_cold',
      type: 'item',
      label: 'Холодная похлёбка',
      weight: 0.5,
      stackable: true,
    },
    item_fresh_berry: {
      id: 'item_fresh_berry',
      type: 'item',
      label: 'Свежая ягода',
      weight: 0.1,
      stackable: true,
      decay_ticks: 4,
      spoil_action: 'destroy',
      spoil_msg: 'Ягоды сгнили и превратились в прах.',
    },
  },
  world: {
    regions: [
      {
        id: 'reg_1',
        label: 'Регион 1',
        locations: [
          {
            id: 'loc_start',
            label: 'Старт',
            position: { x: 100, y: 100 },
            scenes: ['scene_start'],
            travel_connections: [],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_start: { id: 'scene_start', label: 'Стартовая сцена', text: '', actions: [] },
  },
  dialogues: {},
  quests: {},
  recipes: {},
  rules: {},
  codex: {},
  cutscenes: {},
  arenas: {},
}

console.log('--- Запуск spoil-smoke ---')

const engine = new GameEngine(campaign)

// 1. Добавляем 2 порции похлебки — скоропортящиеся предметы создаются отдельными экземплярами со своим freshness
engine.addItem('item_stew', 2)
let stewEntries = engine.state.player.inventory.filter((i) => i.item === 'item_stew')
assert.equal(stewEntries.length, 2, 'Скоропортящиеся предметы отслеживаются отдельными записями')
assert.equal(stewEntries[0].freshness, 10, 'Начальный freshness равен decay_ticks (10)')
assert.equal(stewEntries[1].freshness, 10)

// 2. Проходит 4 часа (тика)
engine.advanceTicks(4)
stewEntries = engine.state.player.inventory.filter((i) => i.item === 'item_stew')
assert.equal(stewEntries[0].freshness, 6, 'Осталось 6 часов свежести')
assert.equal(stewEntries[1].freshness, 6)

// 3. Подбираем ещё 1 свежую похлебку (у неё freshness = 10)
engine.addItem('item_stew', 1)
stewEntries = engine.state.player.inventory.filter((i) => i.item === 'item_stew')
assert.equal(stewEntries.length, 3, 'В инвентаре 3 порции с разным сроком')

// 4. Тратим 1 похлебку — движок обязан сначала списать ту, у которой осталось 6 ч, а не свежую (10 ч)!
engine.removeItem('item_stew', 1)
stewEntries = engine.state.player.inventory.filter((i) => i.item === 'item_stew')
assert.equal(stewEntries.length, 2)
const remainingFreshness = stewEntries.map((e) => e.freshness).sort((a, b) => (a ?? 0) - (b ?? 0))
assert.deepEqual(remainingFreshness, [6, 10], 'Списана порция с 6 ч, остались порции с 6 ч и 10 ч')

// 5. Проходит ещё 6 часов (порция с 6 ч остывает, свежая становится 4 ч)
engine.advanceTicks(6)
stewEntries = engine.state.player.inventory.filter((i) => i.item === 'item_stew')
assert.equal(stewEntries.length, 1, 'Остывшая похлебка превратилась')
assert.equal(stewEntries[0].freshness, 4, 'У оставшейся похлебки 4 часа')

const coldEntries = engine.state.player.inventory.filter((i) => i.item === 'item_stew_cold')
assert.equal(coldEntries.length, 1, 'Появилась холодная похлебка')

// 6. Проверка spoil_action: уничтожение при отсутствии spoil_into
engine.addItem('item_fresh_berry', 2)
assert.equal(engine.itemCount('item_fresh_berry'), 2)
engine.advanceTicks(5) // ягоды портятся через 4 тика
assert.equal(engine.itemCount('item_fresh_berry'), 0, 'Испорченные ягоды удалены из инвентаря')

console.log('✓ spoil-smoke: ВСЕ ТЕСТЫ ПОРЧИ ПРЕДМЕТОВ ПРОЙДЕНЫ УСПЕШНО!')
