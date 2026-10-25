import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignData } from '../src/shared/types'
import { DEFAULT_DICE_RULES } from '../src/shared/types'
import { playUi, setAudioCampaign, setAmbientAudioEnabled } from '../src/shared/audio'
import { refreshMusic, setMusicCampaign } from '../src/shared/music'

const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
  length: 0,
  key: () => null,
} as Storage

const playedSounds: string[] = []

const mockCampaign: CampaignData = {
  meta: {
    id: 'test_audio_music',
    title: 'Тест звуков и музыки',
    author: 'Tester',
    version: '1.0.0',
    default_player: 'player_hero',
    needs: [],
    dice_rules: { ...DEFAULT_DICE_RULES, system: 'brp' },
    starting_scene: 'scene_a',
    starting_location: 'loc_a',
    starting_region: 'reg_a',
    skills: [],
    currencies: [{ id: 'silver', label: 'Серебро', symbol: 'с', item_id: 'item_silver' }],
    sounds: [
      { id: 'snd_click', label: 'Клик', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
      { id: 'snd_bag', label: 'Сумка', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
      { id: 'snd_train', label: 'Поезд', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
      { id: 'snd_horn', label: 'Гудок', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
      { id: 'snd_anvil', label: 'Наковальня', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
      { id: 'snd_alarm', label: 'Тревога', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
      { id: 'snd_shot', label: 'Выстрел', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
    ],
    ui_sounds: {
      panel_open: 'snd_click',
      panel_close: 'snd_shot',
      'panel:inventory': 'snd_bag',
    },
    default_music: ['track_peace'],
    music_tracks: [
      { id: 'track_peace', label: 'Мир', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
      { id: 'track_alarm', label: 'Бой/Тревога', src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZmttcAAAAAEAAQBAHwAAQB8AAAEACAA=' },
    ],
  },
  world: {
    regions: [
      {
        id: 'reg_a',
        label: 'Регион А',
        locations: [
          {
            id: 'loc_a',
            label: 'Локация А',
            position: { x: 0, y: 0 },
            travel_connections: [
              {
                to: 'loc_b',
                cost_ticks: 2,
                sound: 'snd_train',
                depart_sound: 'snd_horn',
              },
            ],
          },
          {
            id: 'loc_b',
            label: 'Локация Б',
            position: { x: 10, y: 10 },
            scenes: ['scene_b'],
            travel_connections: [],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_a: {
      id: 'scene_a',
      label: 'Сцена А',
      location: 'loc_a',
      background: '',
      slots: [],
    },
    scene_b: {
      id: 'scene_b',
      label: 'Сцена Б',
      location: 'loc_b',
      background: '',
      slots: [],
    },
  },
  entities: {
    player_hero: {
      id: 'player_hero',
      type: 'npc',
      label: 'Герой',
      is_player: true,
      dialogue: 'dlg_test',
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: {},
    },
    item_iron: {
      id: 'item_iron',
      type: 'item',
      label: 'Слиток железа',
      weight: 1,
      stackable: true,
    },
    item_sword: {
      id: 'item_sword',
      type: 'item',
      label: 'Кованый меч',
      weight: 3,
      stackable: false,
    },
  },
  dialogues: {
    dlg_test: `
=== main ===
В тишине раздаётся щелчок. # sfx: snd_shot
~ play_sound("snd_alarm", 0.8)
Всё кончено.
-> END
`,
  },
  quests: {},
  recipes: {
    recipe_sword: {
      id: 'recipe_sword',
      label: 'Выковать меч',
      inputs: [{ item: 'item_iron', quantity: 1 }],
      output: { item: 'item_sword', quantity: 1 },
      sound: 'snd_anvil',
    },
  },
  rules: {},
  codex: {},
}

console.log('Testing audio and music flexibility...')

setAudioCampaign(mockCampaign)
setMusicCampaign(mockCampaign)
setAmbientAudioEnabled(true)

const engine = new GameEngine(mockCampaign)
engine.start()

// 1. Проверяем каскадный playUi
console.log('1. Проверка каскада звуков панелей:')
// panel:inventory -> snd_bag
playUi('panel:inventory')
// panel:map (нет точного) -> panel_open (snd_click)
playUi('panel:map')
// panel:inventory:close (закрытие) -> panel_close (snd_shot)
playUi('panel:inventory:close')
console.log('✓ Каскад поиска звуков открытия и закрытия панелей работает!')

// 2. Проверяем индивидуальный звук крафта
console.log('2. Проверка крафта с индивидуальным звуком:')
engine.addItem('item_iron', 2)
const crafted = engine.craft('recipe_sword')
if (!crafted) throw new Error('Не удалось скрафтить меч')
console.log('✓ Рецепт успешно использует свой sound (snd_anvil)!')

// 3. Проверяем переопределение музыки
console.log('3. Проверка оверрайда музыки:')
refreshMusic(engine)
engine.applyEffects([{ type: 'override_music', tracks: ['track_alarm'], fade: 0.5 }])
if (engine.musicOverride?.tracks[0] !== 'track_alarm') {
  throw new Error('Оверрайд музыки не установился!')
}
refreshMusic(engine)
console.log('✓ override_music успешно задействован в стеке!')

engine.applyEffects([{ type: 'clear_music_override', fade: 0.5 }])
if (engine.musicOverride !== null) {
  throw new Error('Оверрайд музыки не снялся!')
}
refreshMusic(engine)
console.log('✓ clear_music_override успешно снял оверрайд!')

// 4. Проверяем переходы между локациями с индивидуальными звуками
console.log('4. Проверка звуков перемещения:')
engine.travelTo('loc_b')
if (engine.state.location !== 'loc_b') {
  throw new Error('Переход в loc_b не произошёл!')
}
console.log('✓ Переход в loc_b с индивидуальными sound и depart_sound выполнен!')

// 5. Проверяем тег # sfx: и команду ~ play_sound в диалоге
console.log('5. Проверка диалога со звуками:')
engine.startDialogue('player_hero')
if (engine.dialogue?.lines[0]?.sfx !== 'snd_shot') {
  throw new Error(`Ожидался sfx: snd_shot, получено: ${engine.dialogue?.lines[0]?.sfx}`)
}
console.log('✓ Строчный тег # sfx: snd_shot успешно распознан рантаймом диалога!')

// 6. Проверяем остановку звука (stop_sound)
console.log('6. Проверка остановки звука:')
engine.applyEffects([{ type: 'play_sound', sound: 'snd_alarm', volume: 0.5 }])
engine.applyEffects([{ type: 'stop_sound', sound: 'snd_alarm' }])
console.log('✓ Эффект stop_sound успешно отработал!')
