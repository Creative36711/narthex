import assert from 'node:assert/strict'

// Мок localStorage для Node.js среды тестирования
const store: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = String(v) },
  removeItem: (k: string) => { delete store[k] },
  clear: () => { for (const k in store) delete store[k] },
}

import { GameEngine, openSave } from '../src/core/engine.js'
import type { CampaignPackage } from '../src/shared/types.js'

// Создаём минимальную кампанию с двумя сценами в одной локации
const campaign: CampaignPackage = {
  meta: {
    id: 'test-autosave-campaign',
    title: 'Тест автосейва переходов сцен',
    version: '1.0.0',
    starting_region: 'reg_lower',
    starting_location: 'loc_gate',
    starting_scene: 'scene_gate',
    default_player: 'default_player',
    needs: [],
    theme: { profile: 'dark_fantasy' },
    ruleset: {
      stats: [{ id: 'STR', label: 'Сила', base: 10 }],
      skills: [{ id: 'brawl', label: 'Драка', base: 25, stat: 'STR' }],
      needs: [],
    },
  },
  world: {
    regions: [
      {
        id: 'reg_lower',
        label: 'Нижний уровень',
        locations: [
          {
            id: 'loc_gate',
            label: 'Шлюз',
            scenes: ['scene_gate', 'scene_office'],
            travel_connections: [],
          },
        ],
      },
    ],
  },
  scenes: {
    scene_gate: {
      id: 'scene_gate',
      label: 'Шлюзовая камера',
      location: 'loc_gate',
      slots: [],
      states: [{ id: 'default', label: 'Обычное' }],
      default_state: 'default',
      navigation: [
        { id: 'to_office', label: 'В контору', target_scene: 'scene_office', x: 10, y: 10, w: 20, h: 20 },
      ],
    },
    scene_office: {
      id: 'scene_office',
      label: 'Контора смотрителя',
      location: 'loc_gate',
      slots: [],
      states: [{ id: 'default', label: 'Обычное' }],
      default_state: 'default',
      narrative_intro: [
        { text: 'Кабинет смотрителя пропах дешёвым табаком.' },
        { text: 'На столе лежат тяжёлые регистрационные книги.' },
      ],
      narrative_intro_once: true,
      navigation: [],
    },
  },
  entities: {
    default_player: {
      id: 'default_player',
      label: 'Герой',
      type: 'player',
      stats: { STR: 10 },
      skills: { brawl: 25 },
      inventory: [],
      equipment: {},
    },
  },
  dialogues: {},
  quests: {},
  recipes: {},
  rules: {},
  codex: {},
  encounters: {},
}

console.log('--- Смоук-тест: автосохранение перехода внутри локации и narrative intro ---')

const engine = new GameEngine(campaign)
engine.start()

assert.equal(engine.state.scene, 'scene_gate', 'Стартовая сцена — scene_gate')
assert.equal(engine.state.location, 'loc_gate', 'Стартовая локация — loc_gate')

// Проверяем автосейв в начале игры
let save = openSave(campaign.meta.id, campaign)
assert.ok(save, 'Автосейв существует после старта')
assert.equal(save?.state.scene, 'scene_gate', 'В автосейве сцена scene_gate')

// Переходим в сцену scene_office (та же локация loc_gate)
console.log('Переход в scene_office...')
engine.goToScene('scene_office')

assert.equal(engine.state.scene, 'scene_office', 'Текущая сцена стала scene_office')

// Проверяем автосейв после перехода внутри одной локации:
save = openSave(campaign.meta.id, campaign)
assert.ok(save, 'Автосейв существует после перехода')
assert.equal(save?.state.scene, 'scene_office', 'В автосейве сцена ОБНОВИЛАСЬ до scene_office!')

// Проверяем показ интро
assert.equal(engine.shouldShowNarrativeIntro(campaign.scenes['scene_office']!), true, 'Интро должно показываться в первый раз')

// Отмечаем просмотр нарративного интро
console.log('Просмотр нарративного интро...')
engine.markNarrativeIntroSeen('scene_office')

assert.ok(engine.state.seen_narrative_intros?.includes('scene_office'), 'Интро отмечено в seen_narrative_intros в памяти')
assert.equal(engine.shouldShowNarrativeIntro(campaign.scenes['scene_office']!), false, 'Интро больше не должно показываться')

// Проверяем, что markNarrativeIntroSeen сохранилось в автосейв:
save = openSave(campaign.meta.id, campaign)
assert.ok(save?.state.seen_narrative_intros?.includes('scene_office'), 'seen_narrative_intros зафиксирован в автосейве!')

// Симулируем выход в главное меню и загрузку:
console.log('Симуляция продолжения игры из автосейва...')
const resumedEngine = new GameEngine(campaign, save?.state)
assert.equal(resumedEngine.state.scene, 'scene_office', 'Загруженная игра восстановила сцену scene_office, а не вернулась в шлюз!')
assert.equal(resumedEngine.shouldShowNarrativeIntro(campaign.scenes['scene_office']!), false, 'В загруженной игре интро не повторяется!')

console.log('✓ Смоук-тест автосохранения переходов и нарратива успешно пройден!')
