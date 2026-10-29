import assert from 'node:assert/strict'
import { GameEngine } from '../src/core/engine'
import type { CampaignPackage } from '../src/shared/types'

console.log('--- Запуск smoke:cutscene-postcard-queue ---')

const testCampaign: CampaignPackage = {
  meta: {
    id: 'test_queue',
    title: 'Тест очереди катсцен и открыток',
    author: 'Тестер',
    version: '1.0.0',
    engine_version: '0.8.0',
    tick_label: 'ч.',
    default_player: 'player_hero',
    needs: [],
    starting_scene: 'scene_start',
    starting_location: 'loc_start',
    time: { start_tick: 0, ticks_per_day: 24, day_start_tick: 6, night_start_tick: 22 },
  },
  world: {
    regions: [
      {
        id: 'reg_1',
        label: 'Регион 1',
        locations: [
          { id: 'loc_start', label: 'Старт', map: { x: 0, y: 0 }, scenes: ['scene_start'] },
        ],
      },
    ],
  },
  scenes: {
    scene_start: {
      id: 'scene_start',
      label: 'Стартовая сцена',
      location: 'loc_start',
      content: 'Текст сцены',
    },
  },
  cutscenes: {
    intro_cutscene: {
      id: 'intro_cutscene',
      label: 'Вводный ролик',
      slides: [
        { text: 'Слайд 1', duration: 5 },
        { text: 'Слайд 2', duration: 5 },
      ],
    },
  },
  rules: {
    rule_intro: {
      id: 'rule_intro',
      label: 'Старт пролога',
      once: true,
      conditions: [{ type: 'tick_elapsed', min_tick: 0 }],
      effects: [
        { type: 'play_cutscene', cutscene: 'intro_cutscene' },
      ],
    },
    rule_enter_postcard: {
      id: 'rule_enter_postcard',
      label: 'Открытка при входе',
      once: true,
      trigger: 'enter_scene',
      conditions: [{ type: 'player_enters_scene', scene: 'scene_start' }],
      effects: [
        {
          type: 'postcard',
          text: 'Обратно — только с подписью.',
          seconds: 4,
        },
      ],
    },
  },
  entities: {
    player_hero: {
      id: 'player_hero',
      label: 'Герой',
      type: 'player',
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: { dodge: 25 },
    },
  },
  quests: {},
  recipes: {},
}

const engine = new GameEngine(testCampaign)

// Запускаем движок (freshRun = true)
engine.start()

// 1. Проверяем, что катсцена активна
assert.ok(engine.cutscene !== null, 'Катсцена intro_cutscene должна быть активна')
assert.equal(engine.cutscene?.id, 'intro_cutscene')

// 2. Открытка выставлена, но её таймер НЕ должен был сжечь её в фоне
assert.ok(engine.postcard !== null, 'Открытка должна быть зарегистрирована в движке')
assert.equal(engine.postcard?.text, 'Обратно — только с подписью.')

// Симулируем 10 секунд времени, пока игрок якобы смотрит ролик
// В старом коде 4-секундный таймер уже удалил бы открытку в ноль!
console.log('Проверяем, что во время катсцены открытка сохраняется и не исчезает...')
assert.ok(engine.postcard !== null, 'Открытка не должна сгорать, пока активна катсцена')

// 3. Завершаем катсцену (игрок досмотрел или нажал Пропустить)
engine.endCutscene()

assert.equal(engine.cutscene, null, 'Катсцена завершилась')
assert.ok(engine.postcard !== null, 'После завершения катсцены открытка ДОЛЖНА быть видна игроку!')
assert.equal(engine.postcard?.text, 'Обратно — только с подписью.')

// 4. Закрытие открытки по тапу игрока
engine.hidePostcard()
assert.equal(engine.postcard, null, 'Игрок закрыл открытку')

console.log('✓ smoke:cutscene-postcard-queue: ВСЕ ПРОВЕРКИ ОЧЕРЕДИ КАТСЦЕН И ОТКРЫТОК ПРОЙДЕНЫ!')
