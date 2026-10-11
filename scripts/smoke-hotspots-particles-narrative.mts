import assert from 'node:assert/strict'
import type { SceneDef, SlotDef } from '../src/shared/types.ts'

console.log('Testing Environmental Hotspots, Atmospheric Particles, and Narrative Intro...')

const slot: SlotDef = {
  id: 'slot_chest',
  label: 'Ящик с кладью',
  shape: 'rect',
  type: ['item'],
  x: 200,
  y: 350,
  w: 160,
  h: 120,
  condition: null,
  environmental: true,
}

assert.equal(slot.environmental, true, 'Слот должен поддерживать флаг environmental')

const scene: SceneDef = {
  id: 'scene_mine',
  label: 'Заброшенная шахта',
  location: 'loc_shaft',
  canvas: { w: 1280, h: 720 },
  states: [{ id: 'normal', label: 'Обычное' }],
  slots: [slot],
  navigation: [],
  particles: 'steam',
  narrative_intro: [
    'Холодный воздух обжёг лёгкие.',
    'В глубине шахты загрохотали старые поршни.',
  ],
}

assert.equal(scene.particles, 'steam', 'Сцена должна поддерживать атмосферные частицы steam')
assert.equal(scene.narrative_intro?.length, 2, 'Сцена должна поддерживать 2 строки вводного монолога')
assert.equal(scene.narrative_intro[0], 'Холодный воздух обжёг лёгкие.')

console.log('✓ Все типы и структуры успешно проверены!')
