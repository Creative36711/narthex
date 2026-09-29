/**
 * Смоук P0 (Задачи 2, 3, 4):
 * - Задача 2: рецепт «интерактивный проп / говорящий предмет» в гайде, книге и validateContent
 * - Задача 3: схлопывание повторов prop_* (3 пропа → одна сводка с обучающим суффиксом) +
 *             текст ошибки структурного перехода goto: "stay" в узле диалога
 * - Задача 4: decideCampaignCollision — три ветки при совпадении id (совпали отпечатки → update,
 *             разные отпечатки → replace / side_by_side (<old>_2) / cancel)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { repairMonolith, importMonolith, exportMonolith } from '../src/editor/monolith'
import { EditorStore } from '../src/editor/store'
import { decideCampaignCollision } from '../src/editor/newCampaign'
import { buildCfFeedbackIssue, parseCfFeedback } from '../src/editor/cfFeedback'
import { campaignFromMonolith } from '../src/editor/playtest'
import { GameEngine } from '../src/core/engine'
import { evalCondition } from '../src/core/conditions'

// ── Задача 2: документация рецепта ──
const guide = readFileSync('docs/ai-campaign-guide.md', 'utf8')
const book03 = readFileSync('docs/book/03-content.md', 'utf8')
assert.ok(guide.includes('интерактивный проп') && guide.includes('Говорящий объект') && guide.includes('Осматриваемый объект'), 'В гайде нет рецепта «интерактивный проп»')
assert.ok(book03.includes('интерактивный проп') && book03.includes('говорящий объект') && book03.includes('осматриваемый объект'), 'В docs/book/03-content.md нет рецепта «интерактивный проп»')
console.log('✓ Задача 2: рецепт «интерактивный проп / говорящий предмет» описан в гайде и книге')

// ── Задача 3: фикстура-монолит с 3 пропами-предметами и 1 структурным goto: "stay" ──
const fixture = {
  campaign: {
    id: 'kruzhilikha_test',
    title: 'Кружилиха (фикстура)',
    version: '0.1.0',
    engine_version: '0.7.0',
    min_engine: '0.7.0',
    package_format: 1,
    author: 'AI',
    description: 'Тест валидатора',
    tick_label: 'час',
    ticks_per_day: 24,
    starting_region: 'region_factory',
    starting_location: 'loc_shop',
    starting_scene: 'scene_shop',
    needs: [],
    currencies: [],
    default_player: 'player_hero',
  },
  world: {
    regions: [
      {
        id: 'region_factory',
        label: 'Завод',
        map_image: '',
        parent_region: null,
        locations: [
          {
            id: 'loc_shop',
            label: 'Цех',
            position: { x: 100, y: 100 },
            travel_connections: [],
            scenes: ['scene_shop'],
            arrival_scene: 'scene_shop',
          },
        ],
      },
    ],
  },
  scenes: {
    scene_shop: {
      id: 'scene_shop',
      label: 'Ночной цех',
      location: 'loc_shop',
      canvas: { w: 1280, h: 720 },
      states: [{ id: 'st_main', label: 'Ночь', art: { background: '#111', layers: [] }, condition: null }],
      slots: [
        { id: 'slot_a', label: 'Слот А', type: ['item'], shape: 'rect', x: 10, y: 10, w: 50, h: 50, default_entity: 'prop_a', condition: null },
        { id: 'slot_b', label: 'Слот Б', type: ['item'], shape: 'rect', x: 70, y: 10, w: 50, h: 50, default_entity: 'prop_b', condition: null },
        { id: 'slot_c', label: 'Слот В', type: ['item'], shape: 'rect', x: 130, y: 10, w: 50, h: 50, default_entity: 'prop_c', condition: null },
      ],
      navigation: [],
    },
  },
  entities: {
    player_hero: {
      id: 'player_hero',
      type: 'npc',
      label: 'Мастер смены',
      description: 'Герой.',
      portrait: {},
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: {},
      inventory: [],
      equipment: {},
    },
    prop_a: { id: 'prop_a', type: 'item', category: 'misc', label: 'Станок А', description: 'Станок.', weight: 1, stackable: false },
    prop_b: { id: 'prop_b', type: 'item', category: 'misc', label: 'Радиоточка Б', description: 'Радио.', weight: 1, stackable: false },
    prop_c: { id: 'prop_c', type: 'item', category: 'misc', label: 'Сейф В', description: 'Сейф.', weight: 1, stackable: false },
  },
  rules: {},
  quests: {},
  arenas: {},
  cutscenes: {},
  dialogues: {
    liola: {
      version: 2,
      label: 'Лиола',
      nodes: [
        {
          id: 'main',
          label: 'Разговор',
          sections: [{ steps: [{ kind: 'line', line: { text: 'Слушаю тебя.' } }] }],
          choices: [],
          goto: 'stay',
        },
      ],
    },
  },
}

const { warnings } = repairMonolith(fixture)
const propWarnings = warnings.filter((w) => w.includes('используются как персонажи, но описаны как предметы'))
assert.equal(propWarnings.length, 1, `Ожидалась ровно одна сводка по пропам, получено: ${JSON.stringify(warnings)}`)
assert.equal(
  propWarnings[0],
  'Сущности prop_a, prop_b, prop_c (3 шт.) используются как персонажи, но описаны как предметы — оставлено как есть. Как правильно: см. рецепт «интерактивный проп» в гайде',
)
const stayWarnings = warnings.filter((w) => w.includes('переход «stay»'))
assert.equal(stayWarnings.length, 1, `Ожидалось предупреждение про goto:stay, получено: ${JSON.stringify(warnings)}`)
assert.ok(
  stayWarnings[0].includes('переход «stay» ведёт в несуществующий узел диалога — заменён на «конец» («stay» допустим только в вариантах ответа)'),
  `Неверный текст ошибки stay: ${stayWarnings[0]}`,
)

// Проверим также validateContent («Проверить кампанию» до импорта)
const store = new EditorStore('/campaigns/kruzhilikha_test')
importMonolith(store, fixture)
const contentIssues = store.validateContent()
assert.ok(
  contentIssues.some((w) => w.includes('Сущности prop_a, prop_b, prop_c (3 шт.) используются как персонажи, но описаны как предметы') && w.includes('интерактивный проп')),
  `validateContent не выдал сводку с рецептом: ${JSON.stringify(contentIssues)}`,
)
console.log('✓ Задача 3: 3 пропа схлопнуты в 1 сводку с рецептом + обучающий текст для goto: "stay"')

// ── Задача 4: decideCampaignCollision (три ветки при совпадении id) ──
const docA = {
  campaign: { id: 'demo_camp', title: 'Кампания Первая', version: '1.0.0', author: 'Автор А' },
  world: { regions: [] },
}
const docASame = {
  campaign: { id: 'demo_camp', title: 'Кампания Первая', version: '1.0.0', author: 'Другой автор (стрипается)' },
  world: { regions: [] },
}
const docBDifferent = {
  campaign: { id: 'demo_camp', title: 'Совсем другая кампания', version: '2.0.0', author: 'Автор Б' },
  world: { regions: [{ id: 'reg_other', label: 'Другой мир' }] },
}

// Ветка 1: отпечатки совпали → update без вопросов
let asked = false
const resSame = await decideCampaignCollision({
  incomingDoc: docASame,
  existingDoc: docA,
  existingIds: ['demo_camp'],
  askUser: async () => {
    asked = true
    return 'cancel'
  },
})
assert.equal(resSame.resolution, 'update', 'При совпадении отпечатков должен быть update без модалки')
assert.equal(resSame.targetId, 'demo_camp')
assert.equal(asked, false, 'При совпадении отпечатков модалка не должна вызываться')

// Ветка 2: отпечатки отличаются → выбор «replace»
const resReplace = await decideCampaignCollision({
  incomingDoc: docBDifferent,
  existingDoc: docA,
  existingIds: ['demo_camp'],
  askUser: async () => 'replace',
})
assert.equal(resReplace.resolution, 'replace')
assert.equal(resReplace.targetId, 'demo_camp')

// Ветка 3: отпечатки отличаются → выбор «side_by_side» (цепочка <old>_2, <old>_3)
const resSide2 = await decideCampaignCollision({
  incomingDoc: docBDifferent,
  existingDoc: docA,
  existingIds: ['demo_camp'],
  askUser: async () => 'side_by_side',
})
assert.equal(resSide2.resolution, 'side_by_side')
assert.equal(resSide2.targetId, 'demo_camp_2')

const resSide3 = await decideCampaignCollision({
  incomingDoc: docBDifferent,
  existingDoc: docA,
  existingIds: ['demo_camp', 'demo_camp_2'],
  askUser: async () => 'side_by_side',
})
assert.equal(resSide3.resolution, 'side_by_side')
assert.equal(resSide3.targetId, 'demo_camp_3')

// Ветка 4: отпечатки отличаются → выбор «cancel»
const resCancel = await decideCampaignCollision({
  incomingDoc: docBDifferent,
  existingDoc: docA,
  existingIds: ['demo_camp'],
  askUser: async () => 'cancel',
})
assert.equal(resCancel.resolution, 'cancel')
console.log('✓ Задача 4: decideCampaignCollision корректно обрабатывает все ветки (update / replace / side_by_side / cancel)')

// ── Задача 7: cf-feedback разбор, склейка дублей и ссылка на GitHub Issue ──
const sampleFeedback = `
Вот готовая кампания.

\`\`\`cf-feedback
[
  {
    "id": "missing-effect:set_mood",
    "kind": "missing_effect",
    "detail": "Не хватило прямого переключения состояния портрета NPC",
    "workaround": "Выдал статус",
    "severity": "mid"
  },
  {
    "id": "missing-effect:set_mood",
    "kind": "missing_effect",
    "detail": "Дубль того же id должен склеиться",
    "workaround": "Выдал статус",
    "severity": "mid"
  }
]
\`\`\`
`
const parsedFb = parseCfFeedback(sampleFeedback)
assert.equal(parsedFb.error, undefined)
assert.equal(parsedFb.items.length, 1, 'Дубли с одинаковым id должны склеиваться')
assert.equal(parsedFb.items[0].id, 'missing-effect:set_mood')
const ghIssue = buildCfFeedbackIssue(parsedFb.items, 'Тестовая кампания')
assert.ok(
  ghIssue.url.startsWith('https://github.com/Creative36711/chronicle-forge/issues/new?labels=ai-feedback'),
  'URL должен вести на создание GitHub Issue с меткой ai-feedback',
)
assert.ok(ghIssue.body.includes('| `missing-effect:set_mood` | `missing_effect` | **mid** |'), 'Body должен содержать markdown-таблицу')
console.log('✓ Задача 7: cf-feedback разбирается, склеивает дубли по id и собирает GitHub Issue URL')

// ── Задачи 8–11 (P2): unlock_recipe, set_entity_state, fire_rule (с защитой от циклов), meta_counter ──
const p2Monolith = structuredClone(fixture) as Record<string, any>
p2Monolith.entities.npc_guard = {
  id: 'npc_guard',
  type: 'npc',
  label: 'Стражник',
  description: 'У ворот.',
  portrait: { neutral: 'portraits/g.png', angry: 'portraits/g_angry.png' },
  stats: { STR: 50, CON: 50, SIZ: 50, DEX: 50, INT: 50, POW: 50, CHA: 50 },
  skills: {},
  inventory: [],
  equipment: {},
}
p2Monolith.entities.item_herb = {
  id: 'item_herb',
  type: 'item',
  category: 'misc',
  label: 'Трава',
  description: 'Лечебный лист.',
  weight: 1,
  value: { silver: 5 },
  stackable: true,
}
p2Monolith.recipes = {
  rec_open: {
    id: 'rec_open',
    label: 'Открытый отвар',
    inputs: [{ item: 'item_herb', quantity: 1 }],
    output: { item: 'item_herb', quantity: 1 },
  },
  rec_secret: {
    id: 'rec_secret',
    label: 'Тайный эликсир',
    known: false,
    inputs: [{ item: 'item_herb', quantity: 1 }],
    output: { item: 'item_herb', quantity: 1 },
  },
}
p2Monolith.rules = {
  rule_step1: {
    id: 'rule_step1',
    label: 'Шаг 1',
    trigger: { type: 'manual' },
    conditions: [],
    effects: [
      { type: 'set_flag', flag: 'step1_done' },
      { type: 'fire_rule', rule: 'rule_step2' },
    ],
    once: true,
  },
  rule_step2: {
    id: 'rule_step2',
    label: 'Шаг 2',
    trigger: { type: 'manual' },
    conditions: [],
    effects: [
      { type: 'set_flag', flag: 'step2_done' },
      { type: 'unlock_recipe', recipe: 'rec_secret' },
      { type: 'set_entity_state', entity: 'npc_guard', state: 'angry' },
      { type: 'fire_rule', rule: 'rule_step3' },
    ],
    once: true,
  },
  rule_step3: {
    id: 'rule_step3',
    label: 'Шаг 3 (предел глубины 2)',
    trigger: { type: 'manual' },
    conditions: [],
    effects: [
      { type: 'set_flag', flag: 'step3_done' },
      { type: 'fire_rule', rule: 'rule_step4_too_deep' },
    ],
    once: true,
  },
  rule_step4_too_deep: {
    id: 'rule_step4_too_deep',
    label: 'Шаг 4 (превышение глубины > 2, не должен сработать)',
    trigger: { type: 'manual' },
    conditions: [],
    effects: [{ type: 'set_flag', flag: 'step4_should_not_fire' }],
    once: true,
  },
  rule_cycle_a: {
    id: 'rule_cycle_a',
    label: 'Цикл А',
    trigger: { type: 'manual' },
    conditions: [],
    effects: [
      { type: 'change_variable', var: 'cycle_hits', delta: 1 },
      { type: 'fire_rule', rule: 'rule_cycle_b' },
    ],
    once: false,
  },
  rule_cycle_b: {
    id: 'rule_cycle_b',
    label: 'Цикл Б',
    trigger: { type: 'manual' },
    conditions: [],
    effects: [
      { type: 'change_variable', var: 'cycle_hits', delta: 1 },
      { type: 'fire_rule', rule: 'rule_cycle_a' },
    ],
    once: false,
  },
}

const p2Store = new EditorStore('/campaigns/kruzhilikha_test')
const p2Repaired = repairMonolith(p2Monolith)
importMonolith(p2Store, p2Repaired.doc)

// Проверим, что валидатор ловит цикл fire_rule и цепочку глубже 2
const p2Issues = p2Store.validateContent()
assert.ok(
  p2Issues.some((w) => w.includes('обнаружен цикл вызова fire_rule')),
  `validateContent должен ловить цикл fire_rule: ${JSON.stringify(p2Issues)}`,
)
assert.ok(
  p2Issues.some((w) => w.includes('глубина цепочки fire_rule превышает 2')),
  `validateContent должен предупреждать о глубине > 2: ${JSON.stringify(p2Issues)}`,
)

// Проверим рантайм: рецепты, состояния сущностей, цепочка fire_rule и meta_counter
const eng = new GameEngine(campaignFromMonolith(exportMonolith(p2Store).doc))
assert.equal(eng.allRecipes().length, 1, 'Скрытый рецепт known:false не должен быть в списке до разблокировки')
assert.equal(eng.allRecipes()[0].id, 'rec_open')
assert.equal(eng.entityState('npc_guard'), undefined)

// Запускаем rule_step1 → цепочкой вызывает rule_step2 (глубина 1) и rule_step3 (глубина 2), но НЕ rule_step4_too_deep (глубина 3)
eng.fireRule('rule_step1')
assert.equal(eng.state.flags.step1_done, true)
assert.equal(eng.state.flags.step2_done, true)
assert.equal(eng.state.flags.step3_done, true)
assert.equal(eng.state.flags.step4_should_not_fire, undefined, 'Глубина > 2 не должна выполняться')
assert.equal(eng.allRecipes().length, 2, 'После unlock_recipe секретный рецепт должен появиться в списке')
assert.equal(eng.entityState('npc_guard'), 'angry', 'После set_entity_state состояние стражника должно стать angry')

// Проверим защиту от цикла в рантайме (rule_cycle_a ↔ rule_cycle_b не уходит в бесконечную рекурсию)
eng.fireRule('rule_cycle_a')
assert.equal(eng.state.variables.cycle_hits, 2, 'Цикл A -> B должен остановиться на повторном входе в A')

// Проверим условие meta_counter
assert.equal(evalCondition({ type: 'meta_counter', key: 'victories', ge: 1 }, eng), false)
assert.equal(evalCondition({ type: 'meta_counter', key: 'runs', ge: 0 }, eng), true)
eng.state.ng_cycle = 2
assert.equal(evalCondition({ type: 'meta_counter', key: 'ng_cycle', ge: 2 }, eng), true)
console.log('✓ Задачи 8–11 (P2): unlock_recipe, set_entity_state, fire_rule (глубина ≤ 2 + защита от циклов) и meta_counter работают')

console.log('\nВСЕ ПРОВЕРКИ P0 + P1 + P2 ПРОЙДЕНЫ')
