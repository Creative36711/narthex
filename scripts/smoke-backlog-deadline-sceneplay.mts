import { GameEngine } from '../src/core/engine'
import type { CampaignData } from '../src/shared/types'

console.log('Testing Dialogue Backlog, Campaign Deadline, and Scene Playtest...')

// 1. Тест дедлайна в HUD / Meta
const dummyCampaign: CampaignData = {
  meta: {
    id: 'test_camp',
    title: 'Тест',
    version: '1.0.0',
    min_engine: '0.8.0',
    package_format: 1,
    tick_label: 'ч',
    ticks_per_day: 24,
    starting_region: 'reg_1',
    starting_location: 'loc_1',
    starting_scene: 'scene_1',
    starting_tick: 0,
    default_player: 'player',
    deadline_ticks: 72,
    deadline_label: 'До затопления',
    currencies: [{ id: 'silver', label: 'Серебро' }],
    needs: [],
    slots: [],
    rules: [],
  },
  world: {
    regions: [
      {
        id: 'reg_1',
        label: 'Регион 1',
        locations: [
          {
            id: 'loc_1',
            label: 'Локация 1',
            scenes: ['scene_1', 'scene_2'],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_1: {
      id: 'scene_1',
      label: 'Сцена 1',
      canvas: { w: 1280, h: 720 },
      states: [{ id: 'normal', label: 'Обычное' }],
      slots: [],
      navigation: [],
    },
    scene_2: {
      id: 'scene_2',
      label: 'Сцена 2',
      canvas: { w: 1280, h: 720 },
      states: [{ id: 'normal', label: 'Обычное' }],
      slots: [],
      navigation: [],
    },
  },
  entities: {
    player: {
      id: 'player',
      type: 'character',
      label: 'Герой',
      stats: { str: 10, con: 10, siz: 10, dex: 10, int: 10, pow: 10, cha: 10 },
      skills: {},
    },
    npc_kell: {
      id: 'npc_kell',
      type: 'npc',
      label: 'Келл',
      dialogue: 'dlg_kell',
    },
    item_key: {
      id: 'item_key',
      type: 'item',
      label: 'Старый ключ',
    },
  },
  dialogues: {
    dlg_kell: '=== main ===\n— Привет, дознаватель.\n+ [Спросить про аварию] -> авария\n=== авария ===\n— Это не я, клянусь!\n-> END\n',
  },
  quests: {},
  rules: {},
  cutscenes: {},
  recipes: {},
  codex: {},
}

const engine = new GameEngine(dummyCampaign)
engine.start()

// Проверка дедлайна
if (engine.campaign.meta.deadline_ticks !== 72) {
  throw new Error('deadline_ticks не совпадают!')
}
console.log('✓ Дедлайн кампании 72ч успешно зарегистрирован!')

// 2. Тест накопления истории диалога (Dialogue Backlog)
engine.startDialogue('npc_kell')
if (!engine.dialogue) throw new Error('Диалог не открылся: ' + engine.lastDialogueError)

if (!engine.dialogue.history || engine.dialogue.history.length === 0) {
  throw new Error('История диалога пуста!')
}

console.log('Начальная реплика в истории:', engine.dialogue.history[0])
if (!engine.dialogue.history[0].text.includes('Привет, дознаватель.')) {
  throw new Error(`Ожидался текст реплики "Привет, дознаватель.", получено "${engine.dialogue.history[0].text}"`)
}

// Игрок выбирает реплику
engine.chooseDialogueOption(0)

if (engine.dialogue.history.length < 3) {
  throw new Error(`В истории должно быть не менее 3 записей, найдено ${engine.dialogue.history.length}`)
}

console.log('Записи в истории после выбора:', engine.dialogue.history.map((h) => `${h.speaker}: ${h.text}`))
const choiceEntry = engine.dialogue.history.find((h) => h.isChoice)
if (!choiceEntry || !choiceEntry.text.includes('Спросить про аварию')) {
  throw new Error('Выбор игрока не зафиксирован в истории!')
}
console.log('✓ История диалога (Dialogue Backlog) полностью сохраняет реплики и выборы игрока!')

// 3. Тест запуска сцены
const playtestEngine = new GameEngine(dummyCampaign)
playtestEngine.state.location = 'loc_1'
playtestEngine.state.scene = 'scene_2'
playtestEngine.freshRun = false
playtestEngine.start()

if (playtestEngine.state.scene !== 'scene_2') {
  throw new Error('Сцена плейтеста не установилась на scene_2!')
}
console.log('✓ Быстрый плейтест сцены переключает активную сцену на выбранную мастер-комнату!')

console.log('Все проверки успешно пройдены!')
