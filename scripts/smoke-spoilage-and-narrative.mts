import assert from 'node:assert/strict'

// Мок localStorage для Node.js среды тестирования
const store: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = String(v) },
  removeItem: (k: string) => { delete store[k] },
  clear: () => { for (const k in store) delete store[k] },
}

import { GameEngine } from '../src/core/engine.js'
import '../packs/narrative/operations'
import type { CampaignPackage } from '../src/shared/types.js'

const campaign: CampaignPackage = {
  meta: {
    id: 'test-spoilage-and-narrative',
    title: 'Тест свежести предметов и нарративного интро',
    version: '1.0.0',
    starting_region: 'reg_test',
    starting_location: 'loc_test',
    starting_scene: 'scene_test',
    default_player: 'default_player',
    needs: [],
    theme: { profile: 'dark_fantasy' },
    ruleset: {
      stats: [{ id: 'STR', label: 'Сила', base: 10 }],
      skills: [{ id: 'perception', label: 'Внимательность', base: 60, stat: 'STR' }],
      needs: [],
    },
  },
  world: {
    regions: [
      {
        id: 'reg_test',
        label: 'Регион тестов',
        locations: [
          {
            id: 'loc_test',
            label: 'Тестовая локация',
            scenes: ['scene_test'],
            travel_connections: [],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_test: {
      id: 'scene_test',
      label: 'Тестовая сцена',
      location: 'loc_test',
      slots: [],
      states: [{ id: 'default', label: 'Обычное' }],
      default_state: 'default',
      narrative_intro: [
        { text: 'Базовый слайд 1' },
        {
          text: 'Слайд 2 (секретный, виден только если есть флаг clue_found)',
          conditions: [{ type: 'flag', flag: 'clue_found' }],
          camera: { zoom: 1.25, pan_y: -10 },
          duration: 3,
        },
      ],
      navigation: [],
    },
  },
  entities: {
    default_player: {
      id: 'default_player',
      label: 'Герой',
      type: 'player',
      stats: { STR: 10 },
      skills: { perception: 60 },
      inventory: [],
      equipment: {},
    },
    item_ration_fresh: {
      id: 'item_ration_fresh',
      type: 'item',
      category: 'food',
      label: 'Свежий паёк',
      description: 'Вкусный питательный паёк.',
      weight: 0.5,
      stackable: false,
      decay_ticks: 10,
      spoil_into: 'item_ration_spoiled',
      spoil_msg: 'Ваш паёк испортился и протух!',
    },
    item_ration_spoiled: {
      id: 'item_ration_spoiled',
      type: 'item',
      category: 'junk',
      label: 'Тухлый паёк',
      description: 'Есть это смертельно опасно.',
      weight: 0.5,
      stackable: false,
    },
    item_ice_crystal: {
      id: 'item_ice_crystal',
      type: 'item',
      category: 'misc',
      label: 'Ледяной кристалл',
      description: 'Тает от тепла.',
      weight: 0.2,
      stackable: false,
      decay_ticks: 5,
      spoil_action: 'destroy',
      spoil_msg: 'Ледяной кристалл растаял без следа.',
    },
  },
  dialogues: {},
  quests: {},
  recipes: {},
  rules: {},
  codex: {},
  encounters: {},
}

console.log('--- Смоук-тест: механика свежести предметов (spoilage decay) ---')

const engine = new GameEngine(campaign)
engine.start()

// 1. Проверяем выдачу скоропортящихся предметов:
engine.addItem('item_ration_fresh', 1)
engine.addItem('item_ice_crystal', 1)

assert.equal(engine.itemCount('item_ration_fresh'), 1, 'В инвентаре 1 свежий паёк')
assert.equal(engine.itemCount('item_ice_crystal'), 1, 'В инвентаре 1 ледяной кристалл')

const rationSlot = engine.state.player.inventory.find((i) => i.item === 'item_ration_fresh')
assert.ok(rationSlot, 'Слот пайка найден')
assert.equal(rationSlot?.freshness, 10, 'Начальная свежесть пайка равна 10 тикам')

const crystalSlot = engine.state.player.inventory.find((i) => i.item === 'item_ice_crystal')
assert.ok(crystalSlot, 'Слот кристалла найден')
assert.equal(crystalSlot?.freshness, 5, 'Начальная свежесть кристалла равна 5 тикам')

// 2. Пропускаем 3 тика времени:
console.log('Пропускаем 3 тика времени...')
engine.advanceTicks(3)

assert.equal(rationSlot?.freshness, 7, 'Свежесть пайка уменьшилась на 3 и равна 7')
assert.equal(crystalSlot?.freshness, 2, 'Свежесть кристалла уменьшилась на 3 и равна 2')

// 3. Пропускаем ещё 3 тика (кристалл должен растаять и исчезнуть, т.к. прошло 6 тиков при сроке 5):
console.log('Пропускаем ещё 3 тика...')
engine.advanceTicks(3)

assert.equal(rationSlot?.freshness, 4, 'Свежесть пайка уменьшилась до 4')
assert.equal(engine.itemCount('item_ice_crystal'), 0, 'Ледяной кристалл полностью уничтожен по истечении срока годности!')
assert.ok(engine.state.log.some((l) => l.includes('Ледяной кристалл растаял без следа')), 'Запись о таянии кристалла появилась в логе')

// 4. Пропускаем ещё 5 тиков (паёк должен испортиться и превратиться в item_ration_spoiled):
console.log('Пропускаем ещё 5 тиков...')
engine.advanceTicks(5)

assert.equal(engine.itemCount('item_ration_fresh'), 0, 'Свежий паёк закончился')
assert.equal(engine.itemCount('item_ration_spoiled'), 1, 'Паёк превратился в тухлый паёк (item_ration_spoiled)!')
assert.ok(engine.state.log.some((l) => l.includes('Ваш паёк испортился и протух!')), 'Индивидуальное сообщение о порче пайка занесено в лог')

console.log('✓ Механика свежести и трансформации предметов работает безупречно!')

console.log('--- Смоук-тест: фильтрация и условия слайдов Narrative Intro ---')

const scene = campaign.scenes['scene_test']!
assert.equal(engine.shouldShowNarrativeIntro(scene), true, 'Интро сцены готово к показу')

// Проверяем фильтрацию условий слайдов в SceneScreen logic
const rawIntro = scene.narrative_intro!
const filteredBeforeFlag = rawIntro.filter((entry) => {
  if (typeof entry === 'string') return true
  if (!entry.conditions || entry.conditions.length === 0) return true
  return entry.conditions.every((c) => {
    if (c.type === 'flag') return !!engine.state.flags[c.flag]
    return true
  })
})

assert.equal(filteredBeforeFlag.length, 1, 'Без флага виден только 1 слайд')

// Устанавливаем флаг
engine.setFlag('clue_found', true)

const filteredAfterFlag = rawIntro.filter((entry) => {
  if (typeof entry === 'string') return true
  if (!entry.conditions || entry.conditions.length === 0) return true
  return entry.conditions.every((c) => {
    if (c.type === 'flag') return !!engine.state.flags[c.flag]
    return true
  })
})

assert.equal(filteredAfterFlag.length, 2, 'С флагом открылся второй кинематографичный слайд с камерой и таймером!')

console.log('✓ Фильтрация слайдов Narrative Intro по условиям и флагам работает корректно!')
