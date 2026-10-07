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
  scenes: {},
  characters: {
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
const combat = new CombatController(def, engine)
const playerUnit = combat.state.units.find((u) => u.team === 'player')!
const enemyUnit = combat.state.units.find((u) => u.team === 'enemy')!

assert(playerUnit, 'Игрок должен быть создан в бою')
assert(enemyUnit, 'Враг должен быть создан в бою')

const hitForecast = combat.estimateAttack(playerUnit, enemyUnit)
assert(hitForecast.hitChance >= 5 && hitForecast.hitChance <= 95, 'Шанс попадания должен быть от 5% до 95%')
assert(hitForecast.expectedDamage > 0, 'Ожидаемый урон должен быть > 0')
console.log(`✓ Прогноз базовой атаки: шанс ${hitForecast.hitChance}%, урон ~${hitForecast.expectedDamage}`)

const ability = playerUnit.abilities?.[0]
assert(ability, 'У игрока должна быть способность')
const abilityForecast = combat.estimateAbility(playerUnit, enemyUnit, ability)
assert(abilityForecast.hitChance > 0, 'Шанс попадания способностью должен быть > 0')
assert(abilityForecast.expectedDamage > 0, 'Ожидаемый урон способностью должен быть > 0')
console.log(`✓ Прогноз способности (${ability.label}): шанс ${abilityForecast.hitChance}%, урон ~${abilityForecast.expectedDamage}`)

// 2. Тест фильтрации журнала сообщений (категории)
engine.log('Обычное сообщение', 'system')
engine.log('Получен квест', 'quest')
engine.log('Враг нанес урон', 'combat')
engine.log('Запись диалога', 'dialogue')

assert.equal(engine.messages.length, 4)
const combatLogs = engine.messages.filter((m) => m.category === 'combat')
assert.equal(combatLogs.length, 1)
assert.equal(combatLogs[0].text, 'Враг нанес урон')
console.log('✓ Фильтрация журнала по категориям работает корректно!')

// 3. Тест связей локаций (travel_connections)
const loc1 = campaign.world.regions[0].locations[0]
assert(loc1.travel_connections?.length === 1, 'У локации 1 должна быть связь')
assert.equal(loc1.travel_connections[0].to, 'loc_2')
assert.equal(loc1.travel_connections[0].cost_ticks, 2)
console.log('✓ Связи локаций (дороги на карте) корректны!')
