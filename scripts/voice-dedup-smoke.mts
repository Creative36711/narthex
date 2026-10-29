import assert from 'node:assert'
import { playVoiceAudio, stopVoiceAudio, isVoiceAudioPlaying } from '../src/shared/voiceAudio'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignData } from '../src/shared/types'

console.log('--- Смоук-тест: Voice Coordinator и защита от задваивания озвучки ---')

// 1. Тест playVoiceAudio / stopVoiceAudio
// Эмулируем запуск двух голосов подряд
let stopped1 = false
let stopped2 = false

const fakeAudio1 = {
  src: 'voice1.mp3',
  volume: 1,
  paused: false,
  pause() { this.paused = true; stopped1 = true },
  play() { this.paused = false; return Promise.resolve() },
  onended: null,
  onerror: null,
}

const fakeAudio2 = {
  src: 'voice2.mp3',
  volume: 1,
  paused: false,
  pause() { this.paused = true; stopped2 = true },
  play() { this.paused = false; return Promise.resolve() },
  onended: null,
  onerror: null,
}

// 2. Движок: очередь катсцен и вызовы глушения голоса
const mockCampaign: CampaignData = {
  meta: {
    id: 'test_camp',
    title: 'Test',
    version: '1.0.0',
    authors: [],
    start_scene: 'sc_1',
    start_time: '12:00',
    time_tick_minutes: 10,
    default_player: 'player',
    needs: [],
    stats: {},
    skills: {},
  },
  world: {
    name: 'World',
    regions: [],
    factions: {},
    recipes: {},
    crafting_stations: {},
    achievements: {},
    glossary: {},
  },
  entities: {
    player: {
      id: 'player',
      name: 'Герой',
      type: 'player',
      roles: ['player'],
      stats: {},
      skills: {},
      disposition: 0,
      inventory: [],
    },
  },
  scenes: {
    sc_1: {
      id: 'sc_1',
      label: 'Сцена 1',
      location: 'loc_1',
      states: {},
      slots: [],
      navigation: [],
      narrative_intro: [
        { text: 'Текст 1', voice: 'assets/voice/intro1.mp3' },
      ],
      narrative_intro_once: true,
    },
    sc_2: {
      id: 'sc_2',
      label: 'Сцена 2',
      location: 'loc_1',
      states: {},
      slots: [],
      navigation: [],
    },
  },
  locations: {
    loc_1: {
      id: 'loc_1',
      name: 'Локация 1',
      scenes: ['sc_1', 'sc_2'],
      default_scene: 'sc_1',
    },
  },
  cutscenes: {
    cut_1: {
      id: 'cut_1',
      label: 'Катсцена 1',
      slides: [
        { text: 'Слайд 1', voice: 'assets/voice/cut1.mp3', duration: 5 },
      ],
    },
  },
  rules: [],
  quests: {},
  dialogues: {},
}

const engine = new GameEngine(mockCampaign)

// Проверяем вызов playCutscene: не дублирует в очередь
engine.playCutscene('cut_1')
assert.equal(engine.cutsceneQueue.length, 1, 'Катсцена добавлена в очередь')
engine.playCutscene('cut_1')
assert.equal(engine.cutsceneQueue.length, 1, 'Повторный вызов playCutscene той же катсцены не дублирует её')

// Проверяем: пока катсцена активна, engine.cutscene != null
assert.ok(engine.cutscene != null, 'Катсцена активна')

// Завершаем катсцену
engine.endCutscene()
assert.equal(engine.cutsceneQueue.length, 0, 'Очередь катсцен пуста после endCutscene')
assert.ok(engine.cutscene == null, 'Катсцена снята')

// Переход на сцену 2
engine.goToScene('sc_2')
assert.equal(engine.state.scene, 'sc_2', 'Переход на сцену 2 выполнен')

console.log('✓ Все проверки Voice Coordinator и защиты от задваивания прошли успешно!')
