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
import { repairMonolith, importMonolith } from '../src/editor/monolith'
import { EditorStore } from '../src/editor/store'
import { decideCampaignCollision } from '../src/editor/newCampaign'

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
console.log('\nВСЕ ПРОВЕРКИ P0 ПРОЙДЕНЫ')
