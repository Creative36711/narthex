import assert from 'node:assert/strict'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { Campaign, ItemDef } from '../src/shared/types'

console.log('--- Запуск smoke-dialogue-skip-and-item-modal ---')

const testCampaign: Campaign = {
  meta: {
    id: 'test_skip_modal',
    title: 'Test Skip & Modal',
    engine_version: '0.8.0',
    default_player: 'player',
    start_scene: 'scene_start',
    needs: []
  },
  scenes: {
    scene_start: {
      id: 'scene_start',
      label: 'Старт',
      states: [{ id: 'state_1', label: 'Обычное' }],
      slots: [
        {
          id: 'slot_box',
          label: 'Ящик',
          type: ['container'],
          shape: 'rect',
          x: 10,
          y: 10,
          w: 50,
          h: 50,
          default_entity: 'item_test_box'
        }
      ],
      navigation: []
    }
  },
  entities: {
    player: {
      id: 'player',
      type: 'player',
      label: 'Герой',
      stats: { STR: 12, CON: 12, SIZ: 12, DEX: 12, INT: 12, POW: 12, CHA: 12 },
      skills: {},
      hp: 12,
      max_hp: 12,
      inventory: []
    },
    npc_talker: {
      id: 'npc_talker',
      type: 'npc',
      label: 'Собеседник',
      dialogue: 'dlg_talker'
    },
    item_test_box: {
      id: 'item_test_box',
      type: 'item',
      label: 'Ящик с кладью',
      category: 'container',
      description: 'Кованый ящик',
      weight: 10,
      interact_options: [
        {
          label: 'Взять мешок угля',
          effects: [
            { type: 'set_flag', flag: 'coal_taken' },
            { type: 'show_message', text: 'Мешок взят.' },
            { type: 'postcard', text: 'Квестовое изображение мешка', seconds: 4 }
          ]
        }
      ]
    }
  },
  dialogues: {
    dlg_talker: `
=== start ===
Первая реплика монолога.
Вторая реплика монолога.
Третья реплика: сделай выбор.
* [Вариант ответа 1] -> end
=== end ===
Конец разговора.
-> DONE
`
  },
  rules: [],
  quests: {},
  recipes: [],
  codex: []
}

// 1. Проверяем взаимодействие с ящиком и запуск открытки
const engine = new GameEngine(testCampaign)

const box = engine.campaign.entities['item_test_box'] as ItemDef
const opts = engine.itemInteractOptions(box)
assert.equal(opts.length, 1)

// Запускаем действие «Взять мешок угля»
engine.runItemInteract(box, opts[0])

// Проверяем, что открытка запустилась через showPostcard
assert.ok(engine.postcard, 'Открытка должна быть установлена')
assert.equal(engine.postcard.text, 'Квестовое изображение мешка')
assert.equal(engine.state.flags['coal_taken'], true, 'Флаг должен быть выставлен')
assert.equal(engine.messages.length, 1, 'Сообщение должно быть в очереди')

// Закрываем открытку
engine.hidePostcard()
assert.equal(engine.postcard, null, 'Открытка закрыта')
assert.equal(engine.messages.length, 1, 'Сообщение ожидает игрока')
engine.dismissMessage()
assert.equal(engine.messages.length, 0, 'Сообщение закрыто')

// 2. Проверяем диалог и структуру монолога
engine.startDialogue('npc_talker')
assert.ok(engine.dialogue, 'Диалог начат')
assert.equal(engine.dialogue.lines.length, 3, 'В узле 3 реплики')
assert.equal(engine.dialogue.choices.length, 1, 'Есть 1 вариант выбора')

console.log('✓ smoke-dialogue-skip-and-item-modal: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!')
