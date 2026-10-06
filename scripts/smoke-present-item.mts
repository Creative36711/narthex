import { GameEngine } from '../src/core/engine'
import type { CampaignData, NpcDef, SceneDef } from '../src/shared/types'
import { DEFAULT_DICE_RULES } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => { mem.set(k, v) },
  removeItem: (k) => { mem.delete(k) },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

const hero: NpcDef = {
  id: 'hero',
  type: 'npc',
  label: 'Детектив',
  stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10, HP: 100 },
  skills: {},
  inventory: [
    { item: 'item_coin', count: 10 },
    { item: 'item_clue_ledger', count: 1 },
    { item: 'item_junk', count: 1 },
  ],
}

const inspector: NpcDef = {
  id: 'npc_inspector',
  type: 'npc',
  label: 'Инспектор',
  dialogue: 'kast_interrogation',
  stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10, HP: 50 },
  skills: {},
  inventory: [],
}

const sceneTest: SceneDef = {
  id: 'scene_test',
  label: 'Кабинет',
  location: 'loc',
  states: [
    {
      id: 's0',
      label: 'Обычный',
      description: 'Тестовая комната',
      figure_positions: [{ slot_id: 'slot_inspector', entity_id: 'npc_inspector' }],
    },
  ],
  slots: [{ id: 'slot_inspector', label: 'Инспектор', kind: 'npc', default_entity: 'npc_inspector' }],
}

const inkSource = `
=== Начало ===
Инспектор смотрит на вас выжидающе.
+ [Предъявить улику]
  ~ present_item("Успех", "Провал", "item_clue_ledger")
  -> Конец
+ [Уйти]
  -> Конец

=== Успех ===
Инспектор берёт гроссбух: "Это неопровержимая улика!"
-> Конец

=== Провал ===
Инспектор недовольно хмурится: "Это не то, что мне нужно."
-> Конец

=== Конец ===
Разговор окончен.
-> END
`

const campaign: CampaignData = {
  meta: {
    id: 'test_present',
    title: 'Тест предъявления улики',
    version: '1.0.0',
    package_format: 1,
    default_player: 'hero',
    starting_region: 'r',
    starting_location: 'loc',
    starting_scene: 'scene_test',
    needs: [],
    dice_rules: DEFAULT_DICE_RULES,
  },
  world: {
    regions: [
      {
        id: 'r',
        label: 'R',
        locations: [
          {
            id: 'loc',
            label: 'L',
            scenes: ['scene_test'],
            travel_connections: [],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_test: sceneTest,
  },
  entities: {
    hero,
    npc_inspector: inspector,
    item_coin: { id: 'item_coin', type: 'item', label: 'Монета', kind: 'misc', weight: 0.01, cost: 1, stackable: true },
    item_clue_ledger: { id: 'item_clue_ledger', type: 'item', label: 'Гроссбух смены', kind: 'misc', weight: 0.5, cost: 0 },
    item_junk: { id: 'item_junk', type: 'item', label: 'Обломок шестерни', kind: 'misc', weight: 1, cost: 0 },
  },
  dialogues: {
    kast_interrogation: inkSource,
  },
  rules: {},
}

async function run() {
  console.log('Testing present_item dialogue mechanic...')
  const engine = new GameEngine(campaign)
  engine.start()

  // 1. Начинаем диалог
  engine.startDialogue('npc_inspector')
  const d1 = engine.dialogue
  if (!d1) throw new Error(`Диалог не начался: ${engine.lastDialogueError}`)
  console.log('1. Начало диалога:', d1.lines.map((l) => l.text).join(' '))

  // Выбираем вариант "[Предъявить улику]"
  const choiceIdx = d1.choices.findIndex((c) => c.text.includes('Предъявить улику'))
  if (choiceIdx < 0) throw new Error('Вариант предъявить улику не найден')

  // Делаем выбор
  engine.chooseDialogueOption(choiceIdx)

  // Проверяем, что движок вошёл в режим выбора предмета
  const d2 = engine.dialogue
  if (!d2) throw new Error('Диалог пропал')
  if (!d2.presenting) throw new Error('Режим presenting не активен!')
  console.log('2. Presenting активирован. Ожидается предмет:', d2.presenting.required)

  // Сценарий А: предъявляем неправильный предмет (item_junk)
  console.log('3. Предъявляем item_junk...')
  engine.submitPresentedItem('item_junk')
  const dAfterWrong = engine.dialogue
  if (!dAfterWrong) throw new Error('Диалог пропал после предъявления')
  console.log('   Реплика после неверного предмета:', dAfterWrong.lines.map((l) => l.text).join(' '))
  if (!dAfterWrong.lines.some((l) => l.text.includes('Это не то, что мне нужно'))) {
    throw new Error('Ожидался переход в узел "Провал"')
  }
  console.log('✓ Ветвление на неверный предмет отработало успешно!')

  // Сценарий Б: снова открываем диалог и предъявляем правильный предмет (item_clue_ledger)
  engine.startDialogue('npc_inspector')
  const d3 = engine.dialogue!
  const choiceIdx2 = d3.choices.findIndex((c) => c.text.includes('Предъявить улику'))
  engine.chooseDialogueOption(choiceIdx2)
  console.log('4. Предъявляем верный предмет item_clue_ledger...')
  engine.submitPresentedItem('item_clue_ledger')
  const dAfterRight = engine.dialogue
  if (!dAfterRight) throw new Error('Диалог пропал после предъявления')
  console.log('   Реплика после верного предмета:', dAfterRight.lines.map((l) => l.text).join(' '))
  if (!dAfterRight.lines.some((l) => l.text.includes('неопровержимая улика'))) {
    throw new Error('Ожидался переход в узел "Успех"')
  }
  console.log('✓ Ветвление на правильный предмет отработало успешно!')

  // Сценарий В: отмена предъявления (submitPresentedItem(null))
  engine.startDialogue('npc_inspector')
  const d4 = engine.dialogue!
  const choiceIdx3 = d4.choices.findIndex((c) => c.text.includes('Предъявить улику'))
  engine.chooseDialogueOption(choiceIdx3)
  console.log('5. Отмена предъявления...')
  engine.submitPresentedItem(null)
  const dAfterCancel = engine.dialogue
  if (!dAfterCancel) throw new Error('Диалог пропал после отмены')
  console.log('   Реплика после отмены:', dAfterCancel.lines.map((l) => l.text).join(' '))
  if (!dAfterCancel.lines.some((l) => l.text.includes('Это не то, что мне нужно'))) {
    throw new Error('Ожидался переход в узел "Провал" при отмене')
  }
  console.log('✓ Отмена предъявления отработала корректно!')

  console.log('\nВСЕ ТЕСТЫ present_item УСПЕШНО ПРОЙДЕНЫ!')
}

run().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
