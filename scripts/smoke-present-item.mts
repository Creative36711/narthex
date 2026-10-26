import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignData } from '../src/shared/types'
import { DEFAULT_DICE_RULES } from '../src/shared/types'

const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
  length: 0,
  key: () => null,
}

const mockCampaign: CampaignData = {
  meta: {
    id: 'test_present_item',
    title: 'Тест Present Item',
    author: 'Tester',
    version: '1.0.0',
    default_player: 'player_hero',
    needs: [],
    dice_rules: { ...DEFAULT_DICE_RULES, system: 'brp' },
    starting_scene: 'scene_test',
    skills: [],
    currencies: [{ id: 'silver', label: 'Серебро', symbol: 'с', item_id: 'item_silver' }],
  },
  world: { regions: [] },
  scenes: {
    scene_test: {
      id: 'scene_test',
      label: 'Тестовая сцена',
      location: 'loc_test',
      background: '',
      slots: [
        { id: 'slot_npc', x: 0, y: 0, w: 100, h: 100, type: ['npc'], entity: 'npc_inspector' }
      ]
    }
  },
  entities: {
    player_hero: {
      id: 'player_hero',
      type: 'npc',
      label: 'Герой',
      is_player: true,
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: {},
    },
    npc_inspector: {
      id: 'npc_inspector',
      type: 'npc',
      label: 'Инспектор',
      description: 'Строгий следователь.',
      dialogue: 'dlg_inspector',
    },
    item_clue_ledger: {
      id: 'item_clue_ledger',
      type: 'item',
      category: 'clue',
      label: 'Гроссбух седьмой помпы',
      description: 'Главная улика.',
      weight: 1,
      stackable: false,
    },
    item_junk: {
      id: 'item_junk',
      type: 'item',
      category: 'junk',
      label: 'Старая гайка',
      description: 'Бесполезный мусор.',
      weight: 0.1,
      stackable: true,
    }
  },
  dialogues: {
    dlg_inspector: `
=== main ===
Инспектор смотрит на вас выжидающе.
~ present_item("success_knot", "fail_knot", "item_clue_ledger")
+ [Ждать...] -> main

=== success_knot ===
Это неопровержимая улика! Разговор окончен.
-> END

=== fail_knot ===
Это не то, что мне нужно. Разговор окончен.
-> END
`
  },
  quests: {},
  recipes: {},
  rules: {},
  codex: {},
}

console.log('Testing present_item dialogue mechanic...')
const engine = new GameEngine(mockCampaign)
engine.start()

// Даём игроку улику и мусор
engine.addItem('item_clue_ledger', 1)
engine.addItem('item_junk', 1)

// 1. Начинаем диалог
engine.startDialogue('npc_inspector')
console.log('1. Начало диалога:', engine.dialogue?.lines[0]?.text)

if (!engine.dialogue?.presenting) {
  throw new Error('Ожидался dialogue.presenting!')
}
console.log('2. Presenting активирован. Ожидается предмет:', engine.dialogue.presenting.required)

// 2. Предъявляем неверный предмет
console.log('3. Предъявляем item_junk...')
engine.submitPresentedItem('item_junk')
console.log('   Реплика после неверного предмета:', engine.dialogue?.lines[0]?.text)
if (!engine.dialogue?.lines[0]?.text.includes('не то, что мне нужно')) {
  throw new Error('Ветвление на fail_knot не сработало!')
}
console.log('✓ Ветвление на неверный предмет отработало успешно!')

// 3. Перезапускаем диалог и предъявляем верный предмет
engine.endDialogue()
engine.startDialogue('npc_inspector')
console.log('4. Предъявляем верный предмет item_clue_ledger...')
engine.submitPresentedItem('item_clue_ledger')
console.log('   Реплика после верного предмета:', engine.dialogue?.lines[0]?.text)
if (!engine.dialogue?.lines[0]?.text.includes('неопровержимая улика')) {
  throw new Error('Ветвление на success_knot не сработало!')
}
console.log('✓ Ветвление на правильный предмет отработало успешно!')

// 4. Проверяем отмену предъявления (submitPresentedItem(null))
engine.endDialogue()
engine.startDialogue('npc_inspector')
console.log('5. Отмена предъявления...')
engine.submitPresentedItem(null)
console.log('   Реплика после отмены:', engine.dialogue?.lines[0]?.text)
if (!engine.dialogue?.lines[0]?.text.includes('не то, что мне нужно')) {
  throw new Error('Отмена предъявления не перешла в fail_knot!')
}
console.log('✓ Отмена предъявления отработала корректно!')

console.log('\nВСЕ ТЕСТЫ present_item УСПЕШНО ПРОЙДЕНЫ!')
