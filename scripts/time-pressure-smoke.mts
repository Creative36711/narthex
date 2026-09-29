/**
 * Смоук «напряжение во времени» (три уровня, ТЗ «ИИ-агент делает кампанию»):
 * - Уровень 1: мировой дедлайн на правилах (tick_elapsed + эскалация правил);
 * - Уровень 2: таймер реплики в диалоге (choice_deadline_ticks / _to / _pick),
 *   ink-генерация и round-trip импорта,dialogue_tick_seconds = 0 выключает;
 * - Уровень 3: кризисный режим (start_crisis / extend_crisis / end_crisis),
 *   эскалации, дедлайн, условия crisis_active / crisis_ticks_le / _ge;
 * - редактор: validateContent объясняет битые таймеры, repairMonolith чинит их молча.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { repairMonolith, importMonolith, exportMonolith } from '../src/editor/monolith'
import { EditorStore } from '../src/editor/store'
import { generateInk } from '../src/editor/dialogueDoc'
import { inkToDlgDoc } from '../src/editor/inkImport'
import { campaignFromMonolith } from '../src/editor/playtest'
import { GameEngine } from '../src/core/engine'
import { evalCondition } from '../src/core/conditions'
import type { DlgDoc, Effect } from '../src/shared/types'

// ── документация: три уровня описаны в гайде и книге ──
const guide = readFileSync('docs/ai-campaign-guide.md', 'utf8')
const book05 = readFileSync('docs/book/05-mechanics.md', 'utf8')
assert.ok(guide.includes('choice_deadline_ticks'), 'В гайде нет таймера реплики (choice_deadline_ticks)')
assert.ok(guide.includes('start_crisis') && guide.includes('tick_elapsed'), 'В гайде нет кризисного режима / мирового дедлайна')
assert.ok(book05.includes('Три уровня') || book05.includes('три уровня'), 'В docs/book/05-mechanics.md нет раздела про три уровня напряжения')
console.log('✓ Документация: три уровня «напряжения во времени» описаны в гайде и книге')

// ── Уровень 2: генерация и round-trip ink ──
const dlgTo: DlgDoc = {
  version: 2,
  label: 'Кузнец торопится',
  nodes: [
    {
      id: 'main',
      label: 'Выбор',
      sections: [{ steps: [{ kind: 'line', line: { text: 'Ну что, берёшься?' } }] }],
      choices: [
        { text: 'Берусь.', sections: [{ steps: [{ kind: 'line', line: { text: 'Договорились.' } }] }], goto: 'end' },
        { text: 'Промолчать.', sections: [], goto: 'node_silence' },
      ],
      choice_deadline_ticks: 3,
      choice_deadline_to: 'node_late',
    },
    { id: 'node_late', label: 'Опоздал', sections: [{ steps: [{ kind: 'line', line: { text: 'Ты думал слишком долго.' } }] }], choices: [], goto: 'end' },
    { id: 'node_silence', label: 'Молчание', sections: [{ steps: [{ kind: 'line', line: { text: 'Молчание — тоже ответ.' } }] }], choices: [], goto: 'end' },
  ],
}
const dlgPick: DlgDoc = {
  version: 2,
  label: 'Допрос',
  nodes: [
    {
      id: 'main',
      label: 'Допрос',
      sections: [{ steps: [{ kind: 'line', line: { text: 'Говори!' } }] }],
      choices: [
        { text: 'Сознаться.', sections: [{ steps: [{ kind: 'line', line: { text: 'Он сломался.' } }] }], goto: 'end' },
        { text: 'Молчать.', sections: [{ steps: [{ kind: 'line', line: { text: 'Он молчал.' } }] }], goto: 'end' },
      ],
      choice_deadline_ticks: 2,
      choice_deadline_pick: 1,
    },
  ],
}

const inkTo = generateInk(dlgTo)
assert.ok(inkTo.includes('EXTERNAL set_choice_deadline(t, to, pick)'), 'В ink нет EXTERNAL-декларации таймера реплики')
assert.ok(inkTo.includes('~ set_choice_deadline(3, "node_late", -1)'), `Неверный вызов таймера в ink:\n${inkTo}`)
const backTo = inkToDlgDoc(inkTo).doc
assert.equal(backTo.nodes[0].choice_deadline_ticks, 3, 'round-trip потерял choice_deadline_ticks')
assert.equal(backTo.nodes[0].choice_deadline_to, 'node_late', 'round-trip потерял choice_deadline_to')

const inkPick = generateInk(dlgPick)
assert.ok(inkPick.includes('~ set_choice_deadline(2, "end", 1)'), `Неверный вызов таймера с автовыбором:\n${inkPick}`)
const backPick = inkToDlgDoc(inkPick).doc
assert.equal(backPick.nodes[0].choice_deadline_pick, 1, 'round-trip потерял choice_deadline_pick')
console.log('✓ Уровень 2: таймер реплики генерируется в ink и возвращается при импорте')

// ── фикстура кампании с двумя диалогами и правилами ──
const fixture = {
  campaign: {
    id: 'time_pressure_test',
    title: 'Напряжение (фикстура)',
    version: '0.1.0',
    engine_version: '0.7.0',
    min_engine: '0.7.0',
    package_format: 1,
    author: 'AI',
    description: 'Тест таймеров и кризиса',
    tick_label: 'час',
    ticks_per_day: 24,
    starting_region: 'region_town',
    starting_location: 'loc_square',
    starting_scene: 'scene_square',
    needs: [],
    currencies: [],
    default_player: 'player_hero',
  },
  world: {
    regions: [
      {
        id: 'region_town',
        label: 'Город',
        map_image: '',
        parent_region: null,
        locations: [
          {
            id: 'loc_square',
            label: 'Площадь',
            position: { x: 100, y: 100 },
            travel_connections: [],
            scenes: ['scene_square'],
            arrival_scene: 'scene_square',
          },
        ],
      },
    ],
  },
  scenes: {
    scene_square: {
      id: 'scene_square',
      label: 'Площадь',
      location: 'loc_square',
      canvas: { w: 1280, h: 720 },
      states: [{ id: 'st_main', label: 'День', art: { background: '#111', layers: [] }, condition: null }],
      slots: [],
      navigation: [],
    },
  },
  entities: {
    player_hero: {
      id: 'player_hero',
      type: 'npc',
      label: 'Герой',
      description: 'Герой.',
      portrait: {},
      stats: { STR: 50, CON: 50, SIZ: 50, DEX: 50, INT: 50, POW: 50, CHA: 50 },
      skills: {},
      inventory: [],
      equipment: {},
    },
    npc_smith: {
      id: 'npc_smith',
      type: 'npc',
      label: 'Кузнец',
      description: 'Торопится.',
      portrait: {},
      stats: { STR: 50, CON: 50, SIZ: 50, DEX: 50, INT: 50, POW: 50, CHA: 50 },
      skills: {},
      inventory: [],
      equipment: {},
      dialogue: 'dialogues/dlgsmith.ink',
    },
    npc_guard: {
      id: 'npc_guard',
      type: 'npc',
      label: 'Стражник',
      description: 'Допрашивает.',
      portrait: {},
      stats: { STR: 50, CON: 50, SIZ: 50, DEX: 50, INT: 50, POW: 50, CHA: 50 },
      skills: {},
      inventory: [],
      equipment: {},
      dialogue: 'dialogues/dlgguard.ink',
    },
  },
  rules: {
    // Уровень 1: мировой дедлайн на правилах — чем дольше герой не пришёл, тем хуже
    rule_late_warning: {
      id: 'rule_late_warning',
      label: 'Осада: предупреждение',
      once: true,
      manual: true,
      conditions: [{ type: 'tick_elapsed', min_tick: 30 }],
      effects: [{ type: 'set_flag', flag: 'siege_warned' }],
    },
    rule_late_fail: {
      id: 'rule_late_fail',
      label: 'Осада: город пал',
      once: true,
      manual: true,
      conditions: [{ type: 'tick_elapsed', min_tick: 48 }],
      effects: [{ type: 'set_flag', flag: 'city_fell' }],
    },
    // Уровень 3: правило реагирует на приближение дедлайна кризиса
    rule_crisis_panic: {
      id: 'rule_crisis_panic',
      label: 'Кризис: паника на финале',
      once: true,
      manual: true,
      conditions: [{ type: 'crisis_ticks_le', threshold: 2 }],
      effects: [{ type: 'set_flag', flag: 'panic' }],
    },
    rule_crisis_active: {
      id: 'rule_crisis_active',
      label: 'Кризис: идёт',
      once: true,
      manual: true,
      conditions: [{ type: 'crisis_active' }],
      effects: [{ type: 'set_flag', flag: 'crisis_seen' }],
    },
    rule_crisis_spare: {
      id: 'rule_crisis_spare',
      label: 'Кризис: ещё есть запас',
      once: true,
      manual: true,
      conditions: [{ type: 'crisis_ticks_ge', threshold: 3 }],
      effects: [{ type: 'set_flag', flag: 'plenty_of_time' }],
    },
  },
  quests: {},
  arenas: {},
  cutscenes: {},
  dialogues: {
    dlgsmith: dlgTo,
    dlgguard: dlgPick,
  },
}

const store = new EditorStore('/campaigns/time_pressure_test')
const repaired = repairMonolith(fixture)
importMonolith(store, repaired.doc)
const eng = new GameEngine(campaignFromMonolith(exportMonolith(store).doc))

// ── Уровень 2, ветка «увести в узел» ──
eng.startDialogue('npc_smith')
assert.ok(eng.dialogue, 'Диалог не открылся')
assert.deepEqual(
  { ticks: eng.dialogue!.deadline?.ticks, to: eng.dialogue!.deadline?.to },
  { ticks: 3, to: 'node_late' },
  'Узел не объявил таймер реплики',
)
assert.equal(eng.dialogue!.choices.length, 2, 'Варианты ответа не показаны')
eng.expireChoiceDeadline()
assert.ok(
  eng.dialogue!.lines.some((l) => l.text.includes('думал слишком долго')),
  `По истечении таймера разговор не ушёл в узел-развязку: ${JSON.stringify(eng.dialogue!.lines)}`,
)
assert.equal(eng.choiceDeadlineInfo(), null, 'Таймер должен быть снят после срабатывания')
console.log('✓ Уровень 2: по истечении таймера разговор уходит в заданный узел')

// ── Уровень 2, ветка «выбрать вариант за игрока» ──
eng.startDialogue('npc_guard')
assert.equal(eng.dialogue!.deadline?.pick, 1, 'Автовыбор варианта не объявлен')
eng.expireChoiceDeadline()
assert.equal(eng.dialogue!.deadline, undefined, 'Узел без таймера не должен объявлять дедлайн')
assert.ok(
  eng.dialogue!.lines.some((l) => l.text.includes('молчал')),
  `Автовыбор варианта не сработал: ${JSON.stringify(eng.dialogue!.lines)}`,
)
console.log('✓ Уровень 2: по истечении таймера движок сам выбирает заготовленный вариант')

// ── Уровень 2: dialogue_tick_seconds = 0 выключает таймеры (доступность) ──
const noTimers = structuredClone(fixture) as Record<string, any>
noTimers.campaign.dialogue_tick_seconds = 0
const store2 = new EditorStore('/campaigns/time_pressure_test')
importMonolith(store2, repairMonolith(noTimers).doc)
const eng2 = new GameEngine(campaignFromMonolith(exportMonolith(store2).doc))
eng2.startDialogue('npc_smith')
assert.equal(eng2.dialogue!.deadline, undefined, 'dialogue_tick_seconds = 0 должен выключать таймеры реплик')
assert.equal(eng2.dialogueTickSeconds(), 0)
eng2.expireChoiceDeadline()
assert.equal(eng2.dialogue!.lines.length, 1, 'Без таймеров разговор не должен прыгать сам')
console.log('✓ Уровень 2: dialogue_tick_seconds = 0 выключает таймеры (режим доступности)')

// ── Уровень 3: кризисный режим — отсчёт, эскалации, дедлайн ──
const crisisFx: Effect[] = [
  {
    type: 'start_crisis',
    ticks: 5,
    label: 'Осада',
    every: 2,
    severity: 2,
    on_escalate: [{ type: 'set_flag', flag: 'escalated' }],
    on_deadline: [{ type: 'set_flag', flag: 'city_fell' }],
  },
]
eng.applyEffects(crisisFx)
assert.ok(eng.crisisActive(), 'Кризис не начался')
assert.equal(eng.crisisTicksLeft(), 5)
assert.equal(evalCondition({ type: 'crisis_active' }, eng), true)
assert.equal(evalCondition({ type: 'crisis_ticks_ge', threshold: 8 }, eng), false, 'Запаса в 5 тиков от порога 8 быть не должно')
assert.equal(evalCondition({ type: 'crisis_ticks_ge', threshold: 3 }, eng), true, 'Запаса в 5 тиков от порога 3 хватает')
eng.fireRule('rule_crisis_active')
assert.equal(eng.state.flags.crisis_seen, true, 'Условие crisis_active не сработало в правиле')
eng.fireRule('rule_crisis_spare')
assert.equal(eng.state.flags.plenty_of_time, true, 'Условие crisis_ticks_ge не сработало в правиле')

// 4 тика: две эскалации (на 3-м и 1-м оставшемся) и дедлайн на нуле
eng.advanceTicks(4)
assert.equal(eng.state.flags.escalated, true, 'Эскалация кризиса не сработала')
eng.fireRule('rule_crisis_panic')
assert.equal(eng.state.flags.panic, true, 'Условие crisis_ticks_le не сработало в правиле')
assert.equal(eng.crisisActive(), true, 'Кризис ещё должен идти (остался 1 тик)')
assert.equal(eng.crisisTicksLeft(), 1)
eng.advanceTicks(1)
assert.equal(eng.crisisActive(), false, 'По истечении дедлайна кризис должен погаснуть сам')
assert.equal(eng.state.flags.city_fell, true, 'Эффекты on_deadline не сработали')
console.log('✓ Уровень 3: кризис тикает, эскалируется, срабатывает на дедлайне и гаснет сам')

// ── Уровень 3: отсрочка и досрочное снятие ──
eng.applyEffects([{ type: 'start_crisis', ticks: 3, label: 'Эпидемия', on_deadline: [{ type: 'set_flag', flag: 'plague_won' }] }])
eng.extendCrisis(4)
assert.equal(eng.crisisTicksLeft(), 7, 'extend_crisis должен отсрочить дедлайн')
eng.applyEffects([{ type: 'end_crisis' }])
assert.equal(eng.crisisActive(), false, 'end_crisis должен снять кризис')
eng.advanceTicks(10)
assert.equal(eng.state.flags.plague_won, undefined, 'После end_crisis дедлайн не должен наступать')
// тишина: extend/end без кризиса ничего не ломают
eng.extendCrisis(5)
eng.applyEffects([{ type: 'end_crisis' }])
console.log('✓ Уровень 3: extend_crisis отсрочивает, end_crisis снимает без последствий')

// ── Уровень 1: мировой дедлайн на правилах ──
assert.equal(eng.state.flags.siege_warned, undefined)
eng.state.tick = 30
eng.fireRule('rule_late_warning')
assert.equal(eng.state.flags.siege_warned, true, 'Правило по tick_elapsed не сработало')
eng.state.tick = 48
eng.fireRule('rule_late_fail')
assert.equal(eng.state.flags.city_fell, true, 'Правило-финал по tick_elapsed не сработало')
console.log('✓ Уровень 1: мировой дедлайн собирается из обычных правил по tick_elapsed')

// ── редактор: validateContent объясняет битые таймеры (без автопочинки) ──
const brokenDlg = {
  version: 2,
  label: 'Битый',
  nodes: [
    {
      id: 'main',
      label: 'Без вариантов',
      sections: [{ steps: [{ kind: 'line', line: { text: 'Монолог.' } }] }],
      choices: [],
      choice_deadline_ticks: 5,
    },
    {
      id: 'main2',
      label: 'Плохой автовыбор',
      sections: [{ steps: [{ kind: 'line', line: { text: 'Выбор.' } }] }],
      choices: [{ text: 'Один.', sections: [], goto: 'end' }],
      choice_deadline_ticks: 5,
      choice_deadline_pick: 4,
    },
    {
      id: 'main3',
      label: 'Плохой переход',
      sections: [{ steps: [{ kind: 'line', line: { text: 'Выбор.' } }] }],
      choices: [{ text: 'Один.', sections: [], goto: 'end' }],
      choice_deadline_ticks: 5,
      choice_deadline_to: 'node_missing',
    },
  ],
}
const vs = new EditorStore('/campaigns/time_pressure_test')
vs.jsonFiles.set('dialogues/dlgbroken.dlg.json', brokenDlg)
vs.manifest.dialogues.push('dlgbroken.ink')
const issues = vs.validateContent()
assert.ok(issues.some((w) => w.includes('таймер ответа снят')), `validateContent не сообщил про узел без вариантов: ${JSON.stringify(issues)}`)
assert.ok(issues.some((w) => w.includes('несуществующий вариант')), `validateContent не сообщил про битый автовыбор: ${JSON.stringify(issues)}`)
assert.ok(issues.some((w) => w.includes('таймер ответа ведёт в несуществующий узел')), `validateContent не сообщил про битый переход: ${JSON.stringify(issues)}`)
console.log('✓ Редактор: validateContent объясняет битые таймеры по-русски')

// ── редактор: repairMonolith чинит те же поля молча, с отчётом мастеру ──
const broken = structuredClone(fixture) as Record<string, any>
broken.dialogues.dlgbroken = brokenDlg
const brokenRepaired = repairMonolith(broken)
const nodes = (brokenRepaired.doc.dialogues.dlgbroken as { nodes: Array<Record<string, unknown>> }).nodes
assert.equal(nodes[0].choice_deadline_ticks, undefined, 'Таймер на узле без вариантов должен быть снят при починке')
assert.equal(nodes[1].choice_deadline_pick, undefined, 'Несуществующий автовыбор должен быть снят при починке')
assert.equal(nodes[1].choice_deadline_to, 'end', 'После снятия автовыбора должен быть конец разговора')
assert.equal(nodes[2].choice_deadline_to, 'end', 'Битый переход таймера должен быть заменён на конец разговора')
assert.ok(
  brokenRepaired.warnings.some((w) => w.includes('таймер ответа')),
  `Отчёт починки должен объяснить судьбу таймеров: ${JSON.stringify(brokenRepaired.warnings)}`,
)
console.log('✓ Редактор: repairMonolith чинит битые таймеры молча и объясняет это в отчёте')

console.log('\nВСЕ ПРОВЕРКИ «НАПРЯЖЕНИЯ ВО ВРЕМЕНИ» ПРОЙДЕНЫ')
