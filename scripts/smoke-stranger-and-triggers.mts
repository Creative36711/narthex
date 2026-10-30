import assert from 'node:assert/strict'
import { GameEngine } from '../src/core/engine.ts'
import '../packs/narrative/operations'
import { evalCondition } from '../src/core/conditions.ts'
import type { CampaignData, NavigationZone, NpcDef } from '../src/shared/types.ts'

console.log('Testing Stranger Mechanics and Event Triggers...')

const npcIra: NpcDef = {
  id: 'npc_ira',
  type: 'npc',
  label: 'Ира Ярова',
  unknown_label: 'Незнакомка в платке',
  description: 'Помощница мастера',
  portrait: { neutral: '' },
  stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
  skills: { repair: 50 },
}

const npcGuard: NpcDef = {
  id: 'npc_guard',
  type: 'npc',
  label: 'Караульный Яров',
  description: 'Охранник врат',
  portrait: { neutral: '' },
  dialogue: 'dlg_guard',
  stats: { STR: 12, CON: 12, SIZ: 12, DEX: 10, INT: 10, POW: 10, CHA: 10 },
  skills: { brawl: 40 },
}

const testCamp: CampaignData = {
  meta: {
    id: 'test_mechanics',
    title: 'Test Mechanics',
    default_player: 'player',
    needs: [],
    ticks_per_day: 24,
    start_tick: 0,
    starting_region: 'reg_1',
    starting_location: 'loc_1',
    starting_scene: 'scene_room',
  },
  world: {
    regions: [{
      id: 'reg_1',
      label: 'Регион 1',
      locations: [{
        id: 'loc_1',
        label: 'Локация 1',
        x: 0, y: 0,
        travel_connections: [],
      }],
    }],
  },
  scenes: {
    scene_room: {
      id: 'scene_room',
      label: 'Комната',
      location: 'loc_1',
      states: [{ id: 'default', label: 'Обычное' }],
      slots: [],
      navigation: [],
    },
    scene_street: {
      id: 'scene_street',
      label: 'Улица',
      location: 'loc_1',
      states: [{ id: 'default', label: 'Обычное' }],
      slots: [],
      navigation: [],
    },
  },
  entities: {
    player: {
      id: 'player',
      type: 'player',
      label: 'Герой',
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: {},
    },
    npc_ira: npcIra,
    npc_guard: npcGuard,
  },
  rules: {
    rule_on_enter: {
      id: 'rule_on_enter',
      label: 'Реакция на вход на улицу',
      once: true,
      trigger: 'enter_scene',
      conditions: [{ type: 'player_enters_scene', scene: 'scene_street' }],
      effects: [{ type: 'set_flag', flag: 'street_entered' }],
    },
  },
  quests: {},
  factions: {},
  dialogues: {
    dlg_guard: '=== main ===\nСтой! Кто идет?\n-> END',
  },
  dialogue_docs: {},
  loot_tables: {},
  trade: {},
  recipes: {},
  achievements: {},
}

const engine = new GameEngine(testCamp)

// ──────────────────── 1. Тест механики «Незнакомец» ────────────────────
console.log('1. Проверка механики «Незнакомец»...')
assert.equal(engine.isNpcNameKnown('npc_ira'), false, 'Ира изначально не должна быть знакома')
assert.equal(engine.npcLabel('npc_ira'), 'Незнакомка в платке', 'Должно отображаться неизвестное имя')
assert.equal(engine.isNpcNameKnown('npc_guard'), true, 'NPC без unknown_label известен сразу')
assert.equal(engine.npcLabel('npc_guard'), 'Караульный Яров', 'Имя охранника видно сразу')

// Проверка условий npc_known
assert.equal(evalCondition({ type: 'npc_known', entity: 'npc_ira' }, engine), false)
assert.equal(evalCondition({ type: 'npc_known', entity: 'npc_ira', known: false }, engine), true)

// Раскрытие имени
engine.learnNpcName('npc_ira')
assert.equal(engine.isNpcNameKnown('npc_ira'), true, 'Ира теперь известна')
assert.equal(engine.npcLabel('npc_ira'), 'Ира Ярова', 'Теперь отображается настоящее имя')
assert.equal(evalCondition({ type: 'npc_known', entity: 'npc_ira' }, engine), true)
assert.equal(evalCondition({ type: 'npc_known', entity: 'npc_ira', known: false }, engine), false)
console.log('✓ Механика «Незнакомец» работает безошибочно!')

// ──────────────────── 2. Тест перехвата навигации и блокировки ────────────────────
console.log('2. Проверка условий перехода и блокировки...')
const navBlocked: NavigationZone = {
  area: { x: 0, y: 0, w: 10, h: 10 },
  label: 'Тайный ход',
  go_to_scene: 'scene_street',
  conditions: [{ type: 'flag_set', flag: 'key_found' }],
  blocked_message: 'Ход заперт на ключ.',
}

const resBlocked = engine.navigate(navBlocked)
assert.equal(resBlocked, false, 'Переход должен быть заблокирован')
assert.equal(engine.state.scene, 'scene_room', 'Игрок остался в комнате')
assert.ok(engine.messages.some((m) => m.text === 'Ход заперт на ключ.'), 'Игрок получил сообщение о блокировке')

// Открываем ключ
engine.state.flags.key_found = true
const resAllowed = engine.navigate(navBlocked)
assert.equal(resAllowed, true, 'Переход теперь разрешён')
assert.equal(engine.state.scene, 'scene_street', 'Игрок переместился на улицу')
console.log('✓ Блокировка и условия перехода работают корректно!')

// ──────────────────── 3. Тест триггера enter_scene ────────────────────
console.log('3. Проверка событийного триггера enter_scene...')
assert.equal(engine.state.flags.street_entered, true, 'Правило на enter_scene должно было сработать при входе')
console.log('✓ Событийный триггер enter_scene сработал штатно!')

// ──────────────────── 4. Тест оклика-диалога перед переходом ────────────────────
console.log('4. Проверка оклика-диалога перед выходом...')
const navIntercept: NavigationZone = {
  area: { x: 0, y: 0, w: 10, h: 10 },
  label: 'Выход на склад',
  go_to_scene: 'scene_room',
  intercept_dialogue: 'dlg_guard',
}

const resIntercept = engine.navigate(navIntercept)
assert.equal(resIntercept, false, 'Переход прерван окликом')
assert.equal(engine.dialogue?.npc.id, 'npc_guard', 'Запустился диалог оклика с охранником')
console.log('✓ Перехват перехода диалогом (оклик стража) работает корректно!')

console.log('✓ Все тесты механики «Незнакомец» и событийных триггеров успешно пройдены!')
