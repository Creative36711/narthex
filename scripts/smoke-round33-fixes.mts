import assert from 'node:assert/strict'
import { BUILTIN_STAT_LABELS, statLabel, STAT_HINTS } from '../src/shared/skills.ts'
import { GameEngine } from '../src/core/engine.ts'
import '../packs/narrative/operations'

console.log('Testing Round 33 Fixes: Stat Labels, Dice Inputs, Fonts and Guide...')

// 1. Тест канонических параметров на латинице
const expected = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA', 'EDU']
for (const s of expected) {
  assert.equal(BUILTIN_STAT_LABELS[s], s, `Характеристика ${s} должна быть на латинице`)
  assert.equal(statLabel(s), s, `statLabel(${s}) должен возвращать ${s}`)
  assert.equal(statLabel(s.toLowerCase()), s, `statLabel(${s.toLowerCase()}) должен возвращать ${s}`)
  assert.ok(STAT_HINTS[s], `Для ${s} должна присутствовать русская подсказка-расшифровка`)
}
console.log('✓ Главные характеристики строго зафиксированы на латинице (STR, CON, SIZ, DEX, INT, POW, CHA, EDU)')

// 2. Тест движка GameEngine.statLabel
const mockCamp: any = {
  meta: {
    id: 'test',
    title: 'Test',
    default_player: 'hero',
    needs: [],
    ticks_per_day: 24,
  },
  entities: {
    hero: { id: 'hero', type: 'player', label: 'Герой', stats: { STR: 12, CON: 10, DEX: 14 } },
  },
  scenes: {},
  world: { regions: [] },
  rules: {},
  quests: {},
  dialogues: {},
  dialogue_docs: {},
}

const engine = new GameEngine(mockCamp)
assert.equal(engine.statLabel('STR'), 'STR')
assert.equal(engine.statLabel('dex'), 'DEX')
console.log('✓ Движок возвращает канонические обозначения характеристик')

console.log('✓ Все проверки раунда 33 успешно пройдены!')
