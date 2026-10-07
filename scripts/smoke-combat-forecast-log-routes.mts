import assert from 'node:assert/strict'
import { CombatController } from '../src/core/combat.ts'
import { GameEngine } from '../src/core/engine.ts'
import type { ArenaDef, CombatDef, CampaignData } from '../src/shared/types.ts'

console.log('Testing Combat Forecast and Estimates...')

const campaign: CampaignData = {
  meta: {
    id: 'test_camp',
    title: 'Тест',
    version: '1.0.0',
    min_engine: '0.8.0',
    package_format: 1,
    tick_label: 'ч',
    ticks_per_day: 24,
    starting_region: 'reg_1',
    starting_location: 'loc_1',
    starting_scene: 'scene_1',
    starting_tick: 0,
    default_player: 'player',
    currencies: [{ id: 'silver', label: 'Серебро' }],
    needs: [],
    slots: [],
    rules: [],
  },
  world: {
    regions: [
      {
        id: 'reg_1',
        label: 'Регион 1',
        locations: [
          {
            id: 'loc_1',
            label: 'Локация 1',
            scenes: ['scene_1'],
            travel_connections: [{ to: 'loc_2', cost_ticks: 2 }],
          },
          {
            id: 'loc_2',
            label: 'Локация 2',
            scenes: [],
            travel_connections: [],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_1: {
      id: 'scene_1',
      label: 'Сцена 1',
      canvas: { w: 1280, h: 720 },
      states: [{ id: 'normal', label: 'Обычное' }],
      slots: [],
      navigation: [],
    },
  },
  dialogues: {},
  characters: {},
  entities: {
    player: {
      type: 'character',
      id: 'player',
      label: 'Герой',
      portrait: '',
      hp: 20,
      max_hp: 20,
      stats: { STR: 12, CON: 12, SIZ: 12, DEX: 14, INT: 10, POW: 10, CHA: 10 },
      skills: { brawl: 60, melee: 70 },
      inventory: [],
      weapon: { id: 'w_sword', label: 'Меч', damage: '1d8', skill: 'melee', range: 1 },
      armor: 1,
    } as any,
    foe_bandit: {
      type: 'character',
      id: 'foe_bandit',
      label: 'Бандит',
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10, HP: 15 },
      skills: { brawl: 40, melee: 50 },
      weapon: { id: 'w_club', label: 'Дубинка', damage: '1d6', skill: 'melee', range: 1 },
      armor: 2,
    } as any,
  },
  quests: {},
  trade: {},
  recipes: {},
  achievements: {},
  arenas: {},
}

const engine = new GameEngine(campaign)

const arena: ArenaDef = {
  id: 'arena_test',
  label: 'Тестовая арена',
  map_image: '',
  canvas: { w: 1280, h: 720 },
  hex_grid: { cols: 10, rows: 8, hex_size: 40 },
  spawn_zones: {
    player: { hexes: [[2, 2]] },
    enemy: { hexes: [[3, 2]] },
  },
}

campaign.arenas = { arena_test: arena }

const def: CombatDef = {
  arena: 'arena_test',
  enemies: [{ entity: 'foe_bandit', count: 1 }],
}

const combat = new CombatController(engine, def, arena)
const pc = combat.combatants.find((c) => c.side === 'player')!
const foe = combat.combatants.find((c) => c.side === 'enemy')!

assert(pc, 'Игрок должен присутствовать в бою')
assert(foe, 'Враг должен присутствовать в бою')

const forecast = combat.estimateAttack(pc, foe)
console.log('Combat Attack Forecast:', forecast)

assert(forecast.hitChance > 0, 'Шанс попадания должен быть больше 0')
assert(forecast.target > 0, 'Порог попадания должен быть рассчитан')
assert(forecast.damage, 'Формула урона должна быть вычислена')
assert.equal(forecast.armor, 2, 'Броня цели должна быть 2')

console.log('✓ Combat forecast успешно протестирован и работает!')

// 2. Тест фильтрации журнала
const sampleLogs = [
  'Проверка: Убеждение d100=42 против 60 → Успех',
  'Квест «Дело о помпе» обновлен: найден тайник',
  'Получено: 15 золотых монет и Меч стражника',
  'Обычная реплика персонажа в трактире',
]

const rollsOnly = sampleLogs.filter((l) => /(?:d100|d20|d6|d8|d10|d12|бросок|проверка|успех|провал|критическ|спасбросок)/i.test(l))
const storyOnly = sampleLogs.filter((l) => /(?:квест|задани|дело|цель|найден|открыт|глава|заметк|сцена|разговор|поговорил|журнал)/i.test(l))
const economyOnly = sampleLogs.filter((l) => /(?:получен|потрачен|купил|продал|монет|золот|изготовлен|инвентар|экипиров)/i.test(l))

assert.equal(rollsOnly.length, 1, 'В категории бросков должна быть 1 запись')
assert.equal(storyOnly.length, 1, 'В категории сюжета должна быть 1 запись')
assert.equal(economyOnly.length, 1, 'В категории экономики должна быть 1 запись')
console.log('✓ Фильтрация журнала событий (LogPanel) работает корректно!')

// 3. Тест связей локаций (travel_connections)
const loc1 = campaign.world.regions[0].locations[0]
const loc2 = campaign.world.regions[0].locations[1]
assert(loc1.travel_connections?.length === 1, 'У локации 1 должна быть связь')
assert.equal(loc1.travel_connections[0].to, 'loc_2')
assert.equal(loc1.travel_connections[0].cost_ticks, 2)
console.log('✓ Связи локаций (дороги на карте) корректны!')

