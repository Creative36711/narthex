import assert from 'node:assert/strict'
import { CombatController } from '../src/core/combat.ts'
import { GameEngine } from '../src/core/engine.ts'
import type { ArenaDef, CombatDef, CampaignData } from '../src/shared/types.ts'

console.log('Testing Combat Forecast, Log Filter, and World Routes...')

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

const campaign: CampaignData = {
  meta: {
    id: 'test_camp',
    title: 'Test Campaign',
    authors: 'Test',
    version: '1.0.0',
    description: '',
    ticks_per_day: 24,
    start_tick: 0,
    money_name: 'золото',
    inventory_max_weight: 100,
    needs: [],
    default_player: 'player',
    starting_region: 'reg_1',
    starting_location: 'loc_1',
    starting_scene: 'scene_test',
  },
  world: {
    regions: [
      {
        id: 'reg_1',
        label: 'Регион 1',
        map_image: 'reg1.png',
        locations: [
          {
            id: 'loc_1',
            label: 'Локация 1',
            x: 100,
            y: 100,
            travel_connections: [{ to: 'loc_2', cost_ticks: 2 }],
          },
          {
            id: 'loc_2',
            label: 'Локация 2',
            x: 200,
            y: 200,
          },
        ],
      },
    ],
  },
  scenes: {
    scene_test: {
      id: 'scene_test',
      label: 'Тест',
      states: [{ id: 'default', label: 'Обычное' }],
      slots: [],
      navigation: [],
    },
  },
  entities: {
    player: {
      id: 'player',
      label: 'Герой',
      type: 'player',
      stats: { hp: 50, max_hp: 50, ap: 4, max_ap: 4, attack: 12, defense: 3 },
      abilities: [
        {
          id: 'strike',
          label: 'Удар',
          cost_ap: 2,
          damage_formula: '1d6+3',
          range: 1,
        },
      ],
    },
    foe_bandit: {
      id: 'foe_bandit',
      label: 'Разбойник',
      type: 'npc',
      stats: { hp: 20, max_hp: 20, ap: 3, max_ap: 3, attack: 8, defense: 1 },
    },
  },
  quests: {},
  factions: {},
  dialogues: {},
  dialogue_docs: {},
  loot_tables: {},
  trade: {},
  recipes: {},
  achievements: {},
  arenas: { arena_test: arena },
}

const engine = new GameEngine(campaign)

const def: CombatDef = {
  arena: 'arena_test',
  enemies: [{ entity: 'foe_bandit', count: 1 }],
}

// 1. Тест расчета прогноза (estimateAttack / estimateAbility)
const combat = new CombatController(engine, def)
const playerUnit = combat.combatants.find((u) => u.side === 'player')!
const enemyUnit = combat.combatants.find((u) => u.side === 'enemy')!

assert(playerUnit, 'Игрок должен быть создан в бою')
assert(enemyUnit, 'Враг должен быть создан в бою')

const hitForecast = combat.estimateAttack(playerUnit, enemyUnit)
assert(hitForecast.hitChance >= 1 && hitForecast.hitChance <= 95, 'Шанс попадания должен быть от 1% до 95%')
assert(hitForecast.damage, 'Ожидаемый урон должен присутствовать')
console.log(`✓ Прогноз базовой атаки: шанс ${hitForecast.hitChance}%, урон ~${hitForecast.damage}`)

const ability = playerUnit.abilities?.[0]
assert(ability, 'У игрока должна быть способность')
const abilityForecast = combat.estimateAbility(playerUnit, ability, enemyUnit)
assert(abilityForecast.hitChance > 0, 'Шанс попадания способностью должен быть > 0')
assert(abilityForecast.effectLabel, 'Ожидаемый эффект способности должен быть описан')
console.log(`✓ Прогноз способности (${ability.label}): шанс ${abilityForecast.hitChance}%, эффект: ${abilityForecast.effectLabel}`)

// 2. Тест фильтрации журнала сообщений (категории)
engine.pushLog('Обычное сообщение')
engine.pushLog('Новый квест получен: дело закрыто')
engine.pushLog('Бросок d100: успех!')
engine.pushLog('Получено золото: награда за задание')

assert.equal(engine.state.log.length, 4)
const rollLogs = engine.state.log.filter((l) => /(?:d100|d20|d6|d8|d10|d12|бросок|проверка|успех|провал|критическ|спасбросок)/i.test(l))
assert.equal(rollLogs.length, 1)
assert.equal(rollLogs[0], 'Бросок d100: успех!')

const storyLogs = engine.state.log.filter((l) => /(?:квест|задани|дело|цель|найден|открыт|глава|заметк|сцена|разговор|поговорил|журнал)/i.test(l))
assert.equal(storyLogs.length, 2)
console.log('✓ Фильтрация журнала по категориям работает корректно!')

// 3. Тест связей локаций (travel_connections)
const loc1 = campaign.world.regions[0].locations[0]
assert(loc1.travel_connections?.length === 1, 'У локации 1 должна быть связь')
assert.equal(loc1.travel_connections[0].to, 'loc_2')
assert.equal(loc1.travel_connections[0].cost_ticks, 2)
console.log('✓ Связи локаций (дороги на карте) корректны!')
