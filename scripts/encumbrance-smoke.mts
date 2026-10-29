import assert from 'node:assert/strict'
import { GameEngine } from '../src/core/engine'
import type { CampaignDef } from '../src/shared/types'

const campaign: CampaignDef = {
  meta: {
    id: 'test_encumbrance',
    title: 'Тест перегруза',
    author: 'Tester',
    version: '1.0.0',
    engine_version: '0.8.0',
    tick_label: 'ч',
    default_player: 'hero',
    starting_region: 'reg_1',
    starting_location: 'loc_start',
    starting_scene: 'scene_start',
    needs: [],
    encumbrance: {
      enabled: true,
      formula: 'str_siz_sum',
      travel_penalty: true,
      light_travel_multiplier: 1.5,
      heavy_travel_multiplier: 2.0,
      critical_threshold: 2.0,
      light_dodge_penalty: 10,
      heavy_dodge_penalty: 25,
      critical_dodge_penalty: 50,
      light_mov_penalty: 1,
      heavy_mov_penalty: 2,
      critical_mov_penalty: 3,
    },
    currencies: [{ id: 'coins', label: 'Монеты' }],
  },
  player: {
    entity: 'hero',
    name: 'Тестовый Герой',
    portrait: { neutral: '' },
    stats: { STR: 12, CON: 10, SIZ: 14, DEX: 12, INT: 10, POW: 10, CHA: 10 },
    skills: { dodge: 45, athletics: 50, stealth: 40 },
    hp: 12,
    max_hp: 12,
    mp: 10,
    max_mp: 10,
    inventory: [],
    equipment: {},
    location: 'loc_start',
    scene: 'scene_start',
    revealed_locations: ['loc_start', 'loc_target'],
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
      stats: { STR: 12, CON: 10, SIZ: 14, DEX: 12, INT: 10, POW: 10, CHA: 10 },
      skills: { dodge: 45 },
    },
    backpack: {
      id: 'backpack',
      type: 'item',
      label: 'Походный рюкзак',
      weight: 1.5,
      equip_slot: 'back',
      carry_bonus: 10,
    },
    heavy_stone: {
      id: 'heavy_stone',
      type: 'item',
      label: 'Тяжёлый валун',
      weight: 15,
      stackable: true,
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
            travel_connections: [{ to: 'loc_target', cost_ticks: 2 }],
          },
          {
            id: 'loc_target',
            label: 'Цель',
            position: { x: 300, y: 100 },
            scenes: ['scene_target'],
            travel_connections: [{ to: 'loc_start', cost_ticks: 2 }],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_start: { id: 'scene_start', label: 'Стартовая сцена', text: '', actions: [] },
    scene_target: { id: 'scene_target', label: 'Целевая сцена', text: '', actions: [] },
  },
  dialogues: {},
  quests: {},
  recipes: {},
  rules: {},
  codex: {},
  cutscenes: {},
  arenas: {},
}

console.log('--- Запуск encumbrance-smoke ---')

const engine = new GameEngine(campaign)

// 1. Проверка базовой вместимости: STR (12) + SIZ (14) = 26 кг
assert.equal(engine.maxLoad(), 26, 'Базовая вместимость должна быть 26 кг')
assert.equal(engine.currentLoad(), 0, 'Начальный вес 0')
assert.equal(engine.encumbranceStatus(), 'normal', 'Статус в норме')

// 2. Добавляем походный рюкзак (equip_bonus +10 кг)
engine.addItem('backpack', 1)
engine.equipItem('backpack')
assert.equal(engine.maxLoad(), 36, 'С рюкзаком вместимость должна стать 36 кг')
assert.equal(engine.currentLoad(), 1.5, 'Вес с надетым рюкзаком — 1.5 кг')

// 3. Добавляем валуны до лёгкого перегруза: лимит 36 кг, кладем 3 валуна по 15 кг = 45 + 1.5 = 46.5 кг (1.29x)
engine.addItem('heavy_stone', 3)
assert.equal(engine.currentLoad(), 46.5)
assert.equal(engine.encumbranceStatus(), 'light', 'Должен быть лёгкий перегруз')
let debuffs = engine.encumbranceDebuffs()
assert.equal(debuffs.dodgePenalty, 10, 'Штраф к уклонению 10%')
assert.equal(debuffs.movPenalty, 1, 'Штраф к движению 1')
// Базовая стоимость пути 2 тика, при лёгком перегрузе 2 * 1.5 = 3 тика
assert.equal(engine.travelCost('loc_target'), 3, 'Стоимость пути должна вырасти с 2 до 3 тиков')

// 4. Добавляем ещё валун: 4 валуна = 60 + 1.5 = 61.5 кг (1.7x > 1.5x) -> тяжёлый перегруз
engine.addItem('heavy_stone', 1)
assert.equal(engine.currentLoad(), 61.5)
assert.equal(engine.encumbranceStatus(), 'heavy', 'Должен быть тяжёлый перегруз')
debuffs = engine.encumbranceDebuffs()
assert.equal(debuffs.dodgePenalty, 25, 'Штраф к уклонению 25%')
assert.equal(debuffs.movPenalty, 2, 'Штраф к движению 2')
// Базовая стоимость пути 2 тика, при тяжёлом перегрузе 2 * 2.0 = 4 тика
assert.equal(engine.travelCost('loc_target'), 4, 'Стоимость пути должна вырасти с 2 до 4 тиков')

// 5. Добавляем валуны до критического перегруза: лимит 36 кг, порог 2.0x = 72 кг. Добавим еще 1 валун = 76.5 кг (> 72 кг)
engine.addItem('heavy_stone', 1)
assert.equal(engine.currentLoad(), 76.5)
assert.equal(engine.encumbranceStatus(), 'critical', 'Должен быть критический перегруз')
assert.equal(engine.isTravelBlockedByOverload(), true, 'Перемещение должно быть заблокировано')
assert.equal(engine.travelCost('loc_target'), null, 'travelCost должен возвращать null при блокировке')

// Попытка отправиться в путь при критическом перегрузе
const prevLoc = engine.state.location
engine.travelTo('loc_target')
assert.equal(engine.state.location, prevLoc, 'Локация не должна измениться при заблокированном перегрузе')
assert.ok(engine.messages.some((m) => m.text.includes('Груз слишком велик')), 'Должно появиться понятное сообщение о невозможности пути')

// 6. Сброс валунов — возвращение в норму
engine.removeItem('heavy_stone', 5)
assert.equal(engine.currentLoad(), 1.5)
assert.equal(engine.encumbranceStatus(), 'normal', 'Статус снова normal')
assert.equal(engine.isTravelBlockedByOverload(), false)
assert.equal(engine.travelCost('loc_target'), 2, 'Стоимость пути вернулась к базовой (2)')

// Переход теперь успешен
engine.travelTo('loc_target')
assert.equal(engine.state.location, 'loc_target', 'Герой успешно переместился')

console.log('✓ encumbrance-smoke: ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!')
