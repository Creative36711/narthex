import assert from 'node:assert/strict'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignData, LocationDef, NpcDef, SceneDef, ArenaDef } from '../src/shared/types'

console.log('Testing Dialogue Transitions (Scene, Combat, State, Endings)...')

const locMain: LocationDef = {
  id: 'loc_main',
  label: 'Главный район',
  description: 'Центр',
  default_scene: 'scene_room',
  scenes: ['scene_room', 'scene_street'],
  map_coordinates: { x: 10, y: 10 },
}

const sceneRoom: SceneDef = {
  id: 'scene_room',
  location: 'loc_main',
  label: 'Комната героя',
  description: 'Маленькая комната с телевизором',
  states: [
    { id: 'day', label: 'День', image: '' },
    { id: 'tv_on', label: 'Телевизор включён', image: '' },
  ],
  slots: [],
  navigation: [],
}

const sceneStreet: SceneDef = {
  id: 'scene_street',
  location: 'loc_main',
  label: 'Улица перед домом',
  description: 'Холодная вечерняя улица',
  states: [{ id: 'day', label: 'День', image: '' }],
  slots: [],
  navigation: [],
}

const arenaAlley: ArenaDef = {
  id: 'arena_alley',
  label: 'Глухой переулок',
  image: '',
  hex_grid: {
    cols: 5,
    rows: 5,
    hex_size: 32,
    offset: 'odd-r',
    blocked_hexes: [],
    difficult_terrain: [],
  },
  spawn_zones: {
    player: { hexes: [[0, 0] as any] },
    enemy: { hexes: [[4, 4] as any] },
  },
}

const npcHooligan: NpcDef = {
  id: 'npc_hooligan',
  type: 'npc',
  label: 'Хулиган Васька',
  description: 'Местный задира',
  portrait: { neutral: '' },
  dialogue: 'dlg_test',
  stats: { STR: 12, CON: 12, SIZ: 12, DEX: 10, INT: 10, POW: 10, CHA: 10 },
  skills: { brawl: 40 },
}

const testInk = `
=== Начало ===
Ты чего тут стоишь?
+ [Включить телевизор в комнате.]
    ~ change_scene_state("tv_on")
    Экран зашипел помехами.
    -> Начало
+ [Пойдём на улицу, поговорим там.]
    ~ go_to_scene("scene_street")
    -> DONE
+ [Я начищу тебе морду!]
    ~ start_combat("arena_alley")
    -> DONE
+ [Сдаться и прыгнуть в пропасть.]
    ~ game_over_death("Ты разбился в ущелье.")
    -> DONE
`

const campaign: CampaignData = {
  meta: {
    title: 'Тест переходов из диалога',
    authors: ['Tester'],
    version: '1.0.0',
    default_player: 'hero',
    features: ['combat'],
    dice_rules: { system: 'brp' },
    needs: [],
  },
  locations: { loc_main: locMain },
  world: { default_location: 'loc_main', regions: [{ id: 'reg1', label: 'Регион', locations: ['loc_main'] }] },
  scenes: { scene_room: sceneRoom, scene_street: sceneStreet },
  entities: {
    npc_hooligan: npcHooligan,
    hero: {
      id: 'hero',
      type: 'player',
      label: 'Герой',
      description: 'Главный герой',
      stats: { STR: 14, CON: 14, SIZ: 14, DEX: 12, INT: 12, POW: 12, CHA: 10 },
      skills: { brawl: 50 },
    },
  },
  rules: {},
  quests: {},
  arenas: { arena_alley: arenaAlley },
  dialogues: {
    dlg_test: testInk,
  },
}

const engine = new GameEngine(campaign)
engine.start()
engine.goToScene('scene_room', 0)

// 1. Проверка change_scene_state из диалога
console.log('1. Проверка смены состояния сцены прямо из диалога...')
engine.startDialogue('npc_hooligan')
assert.equal(engine.activeSceneState(sceneRoom).id, 'day', 'Сцена в исходном дневном состоянии')
engine.chooseDialogueOption(0) // Включить телевизор
assert.equal(engine.activeSceneState(sceneRoom).id, 'tv_on', 'Сцена переключилась на состояние tv_on под диалогом')
console.log('✓ change_scene_state работает штатно!')

// 2. Проверка go_to_scene из диалога
console.log('2. Проверка перехода в другую сцену из диалога...')
assert.equal(engine.state.scene, 'scene_room', 'Игрок в комнате')
engine.chooseDialogueOption(1) // Пойдём на улицу
assert.equal(engine.state.scene, 'scene_street', 'Игрок переместился на улицу')
assert.equal(engine.dialogue, null, 'Диалог корректно завершился при смене сцены')
console.log('✓ go_to_scene работает штатно!')

// 3. Проверка start_combat из диалога
console.log('3. Проверка запуска боя из диалога...')
engine.startDialogue('npc_hooligan')
assert.notEqual(engine.dialogue, null, 'Диалог открыт')
assert.equal(engine.combat, null, 'Бой ещё не начат')
engine.chooseDialogueOption(2) // Начищу морду -> бой
assert.equal(engine.dialogue, null, 'Диалог закрылся перед началом боя')
assert.notEqual(engine.combat, null, 'Боевой режим успешно активирован')
assert.equal(engine.combat?.arena.id, 'arena_alley', 'Арена боя соответствует arena_alley')
console.log('✓ start_combat работает штатно!')

// 4. Проверка game_over_death из диалога
console.log('4. Проверка завершения игры (Bad End) из диалога...')
engine.endCombat()
engine.startDialogue('npc_hooligan')
engine.chooseDialogueOption(3) // Сдаться и прыгнуть в пропасть
assert.equal(engine.state.game_over?.type, 'death', 'Зафиксирован экран гибели')
assert.equal(engine.state.game_over?.reason, 'Ты разбился в ущелье.', 'Текст причины совпадает')
assert.equal(engine.dialogue, null, 'Диалог закрыт экраном финала')
console.log('✓ game_over_death работает штатно!')

console.log('✓ Все 4 вида диалоговых переходов успешно верифицированы!')
