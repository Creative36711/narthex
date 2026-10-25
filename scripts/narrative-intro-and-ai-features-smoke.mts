import assert from 'node:assert'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { createStory, bindExternals } from '../packs/narrative/index'
import type { CampaignData, SceneDef } from '../src/shared/types'

console.log('--- Смоук-тест: narrative_intro, сброс флагов и Ink binding ---')

// 1. Движок и нарративное интро
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
    ui_labels: {
      scene_intro_next: 'Вперёд ▶',
      scene_intro_done: 'Войти ▶',
    },
  },
  world: {
    name: 'World',
    regions: {},
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
    npc_ally: {
      id: 'npc_ally',
      name: 'Союзник',
      type: 'npc',
      roles: ['npc'],
      stats: {},
      disposition: 50,
      inventory: [],
    },
    npc_stranger: {
      id: 'npc_stranger',
      name: 'Незнакомец',
      type: 'npc',
      roles: ['npc'],
      disposition: 50,
      inventory: [],
      unknown_label: 'Тайный агент',
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
        'Мы стоим на краю бездны.',
        { text: 'Эхо разносит шорох.', voice: 'assets/voice/echo.mp3', sfx: 'snd_creak' },
      ],
      narrative_intro_once: true,
    },
    sc_repeat: {
      id: 'sc_repeat',
      label: 'Сцена повтора',
      location: 'loc_1',
      states: {},
      slots: [],
      navigation: [],
      narrative_intro: ['Снова здесь.'],
      narrative_intro_once: false,
    },
  },
  locations: {
    loc_1: {
      id: 'loc_1',
      name: 'Локация 1',
      scenes: ['sc_1', 'sc_repeat'],
      default_scene: 'sc_1',
    },
  },
  rules: [],
  quests: {},
  dialogues: {},
}

const engine = new GameEngine(mockCampaign)

// Проверяем нарративное интро sc_1
const sc1 = mockCampaign.scenes.sc_1
assert.ok(engine.shouldShowNarrativeIntro(sc1), 'Первый вход: narrative_intro должно показаться')
engine.markNarrativeIntroSeen('sc_1')
assert.ok(!engine.shouldShowNarrativeIntro(sc1), 'После отметки: narrative_intro_once=true не должно показываться повторно')
assert.ok(engine.state.seen_narrative_intros?.includes('sc_1'), 'sc_1 сохранена в seen_narrative_intros')

// Проверяем narrative_intro_once: false
const scRepeat = mockCampaign.scenes.sc_repeat
assert.ok(engine.shouldShowNarrativeIntro(scRepeat), 'Первый вход sc_repeat: показывать')
engine.markNarrativeIntroSeen('sc_repeat')
assert.ok(engine.shouldShowNarrativeIntro(scRepeat), 'narrative_intro_once=false: должно показываться всегда')

// 2. Сброс флагов и clearFlag
engine.setFlag('test_flag', true)
assert.equal(engine.state.flags.test_flag, true, 'Флаг установлен')
engine.setFlag('test_flag', false)
assert.equal(engine.state.flags.test_flag, undefined, 'setFlag(false) удаляет флаг')

engine.setFlag('test_flag2', 1)
assert.equal(engine.state.flags.test_flag2, 1, 'Числовой флаг установлен')
engine.clearFlag('test_flag2')
assert.equal(engine.state.flags.test_flag2, undefined, 'clearFlag удаляет флаг')

// 3. inParty и npc_known
assert.equal(engine.inParty('npc_ally'), false, 'Пока не в отряде')
engine.joinParty('npc_ally')
assert.equal(engine.inParty('npc_ally'), true, 'В отряде после добавления')

assert.equal(engine.isNpcNameKnown('npc_stranger'), false, 'Имя незнакомца пока неизвестно')
engine.setFlag('npc_known_npc_stranger', true)
assert.equal(engine.isNpcNameKnown('npc_stranger'), true, 'Имя раскрыто по флагу npc_known_*')

// 4. Ink bindings: set_flag, clear_flag, in_party, npc_known
const inkSource = `
EXTERNAL set_flag(id, val)
EXTERNAL clear_flag(id)
EXTERNAL in_party(id)
EXTERNAL npc_known(id)

-> start

=== start ===
~ set_flag("ink_flag", 1)
{ in_party("npc_ally"): Союзник с нами. | Один. }
{ npc_known("npc_stranger"): Агент раскрыт. }
~ clear_flag("ink_flag")
~ set_flag("another_flag", false)
-> DONE
`

const story = createStory(inkSource, 'test_story')
bindExternals(story, engine)
assert.ok(story, 'Диалог с новыми external функциями скомпилирован и создан')

let lines: string[] = []
while (story.canContinue) {
  const line = story.Continue()?.trim()
  if (line) lines.push(line)
}

assert.ok(lines.includes('Союзник с нами.'), 'in_party вернул 1 для спутника')
assert.ok(lines.includes('Агент раскрыт.'), 'npc_known вернул 1 для раскрытого незнакомца')
assert.equal(engine.state.flags.ink_flag, undefined, 'clear_flag очистил флаг в рантайме диалога')
assert.equal(engine.state.flags.another_flag, undefined, 'set_flag(false) удалил флаг в рантайме диалога')

console.log('✓ Все проверки narrative_intro, сброса флагов и Ink binding прошли успешно!')
