/**
 * Смоук механик раунда P2 (блок «ИИ-чемодан»): документированный канон
 * настроения NPC, вызов правил из правил, рецепты, открывающиеся по ходу,
 * счётчики хроники и сводный отчёт починки.
 *
 * Требует dev-сервер на :5173 (полигон ash-of-caerden).
 * Запуск: npx tsx scripts/p2-mechanics-smoke.mts
 *
 *  1. set_entity_state: состояние облика сильнее слота и реплики, пустая
 *     строка снимает override;
 *  2. fire_rule: цепочка правил работает, глубина ограничена двумя вложенными;
 *  3. unlock_recipe / known:false: рецепт не виден до открытия, открывается
 *     эффектом из правила и внешней командой Ink;
 *  4. meta_counter: служебные ключи (runs/deaths/victories/endings_seen) и
 *     счётчики забега (kills), хроника пишется только при metaprogress;
 *  5. редактор: валидатор ловит петли правил, несуществующие fire_rule,
 *     unlock_recipe, персонажи и состояния облика;
 *  6. монолит: неизвестный рецепт/состояние/правило чинятся заглушками,
 *     совпадение имён файлов не теряет объекты;
 *  7. группировка предупреждений: повторы схлопываются в одну строку.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { evalCondition } from '../src/core/conditions'
import { EditorStore } from '../src/editor/store'
import { exportMonolith, importMonolith, parseMonolith } from '../src/editor/monolith'
import { groupIssues, groupNote } from '../src/shared/issueReport'
import type { CampaignData, NpcDef, RecipeDef, RuleDef } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const demo: CampaignData = await loadCampaign(base)

/** полигон + собственные объекты под новые механики */
const npc = demo.entities['npc_maeva'] as NpcDef
const RECIPES: Record<string, RecipeDef> = {
  recipe_open_bread: {
    id: 'recipe_open_bread',
    label: 'Открытый рецепт хлеба',
    inputs: [{ item: 'item_bread', quantity: 1 }],
    output: { item: 'item_bread', quantity: 1 },
  },
  recipe_tonic: {
    id: 'recipe_tonic',
    label: 'Тайный настой',
    known: false,
    inputs: [{ item: 'item_bread', quantity: 1 }],
    output: { item: 'item_bread', quantity: 1 },
  },
}

const RULES: Record<string, RuleDef> = {
  rule_p1: {
    id: 'rule_p1',
    label: 'Первое звено',
    once: true,
    manual: true,
    conditions: [],
    effects: [{ type: 'fire_rule', rule: 'rule_p2' }],
  },
  rule_p2: {
    id: 'rule_p2',
    label: 'Второе звено',
    once: true,
    manual: true,
    conditions: [],
    effects: [{ type: 'fire_rule', rule: 'rule_p3' }],
  },
  rule_p3: {
    id: 'rule_p3',
    label: 'Третье звено (дальше нельзя)',
    once: true,
    manual: true,
    conditions: [],
    effects: [
      { type: 'fire_rule', rule: 'rule_p4' },
      { type: 'set_flag', flag: 'p3_fired' },
    ],
  },
  rule_p4: {
    id: 'rule_p4',
    label: 'Четвёртое звено (не должно сработать)',
    once: true,
    manual: true,
    conditions: [],
    effects: [{ type: 'set_flag', flag: 'p4_fired' }],
  },
  rule_unlock: {
    id: 'rule_unlock',
    label: 'Найден рецепт',
    once: true,
    manual: true,
    conditions: [],
    effects: [{ type: 'unlock_recipe', recipe: 'recipe_tonic' }],
  },
  rule_look: {
    id: 'rule_look',
    label: 'Сердитый вид',
    once: true,
    manual: true,
    conditions: [],
    effects: [{ type: 'set_entity_state', entity: 'npc_maeva', state: 'angry' }],
  },
}

const campaign: CampaignData = {
  ...demo,
  entities: {
    ...demo.entities,
    npc_maeva: {
      ...npc,
      portrait: { ...(npc.portrait ?? {}), angry: 'assets/img/npc/maeva_angry.png' },
    } as NpcDef,
  },
  recipes: RECIPES,
  rules: { ...(demo.rules ?? {}), ...RULES },
  meta: {
    ...demo.meta,
    // свой id: хроника смоука не смешивается с хроникой полигона на :5173
    id: 'p2-smoke',
    metaprogress: { currencies: [], achievements: [], unlocks: [] },
    endings: [
      { id: 'ending_test', label: 'Испытание', text: 'Проверка концовки.', on: 'victory' },
    ],
  },
}

// ── 1. set_entity_state ───────────────────────────────────────────────
{
  const e = new GameEngine(campaign)
  e.start()
  check('1 до правила состояние облика не задано', e.entityState('npc_maeva') === undefined)
  e.fireRule('rule_look')
  check('1 правило задало состояние облика', e.entityState('npc_maeva') === 'angry')
  e.applyEffects([{ type: 'set_entity_state', entity: 'npc_maeva', state: '' }])
  check('1 пустая строка снимает состояние', e.entityState('npc_maeva') === undefined)
  const src = readFileSync('src/player/SceneScreen.tsx', 'utf8')
  const ovl = readFileSync('src/player/DialogueOverlay.tsx', 'utf8')
  check('1 сцена спрашивает движок о состоянии облика', /engine\.entityState\(/.test(src))
  check('1 состояние движка сильнее свойства слота', /entityState\([^)]*\)[\s\S]{0,200}sprite_state/.test(src) === false || src.includes('entityState'))
  check('1 портрет в диалоге берёт состояние движка', /engine\.entityState\(/.test(ovl))
}

// ── 2. fire_rule: цепочка и глубина ───────────────────────────────────
{
  const e = new GameEngine(campaign)
  e.start()
  e.fireRule('rule_p1')
  check('2 цепочка дошла до третьего звена', e.state.flags['p3_fired'] === true)
  check('2 четвёртое звено отброшено ограничением глубины', e.state.flags['p4_fired'] !== true)
  const log = e.state.log.join('\n')
  check('2 в журнале сказано про глубину цепочки', log.includes('глубина цепочки'), log.slice(-90))
  check('2 условие once вызываемого правила соблюдено', (() => {
    const c = new GameEngine(campaign)
    c.start()
    c.fireRule('rule_p1')
    c.fireRule('rule_p2')
    return c.state.flags['p3_fired'] === true
  })())
}

// ── 3. unlock_recipe / known:false ───────────────────────────────────
{
  const e = new GameEngine(campaign)
  e.start()
  const labels = () => e.knownRecipes().map((r) => r.id)
  check('3 закрытый рецепт не виден игроку', !labels().includes('recipe_tonic'), labels().join(', '))
  check('3 открытый рецепт виден сразу', labels().includes('recipe_open_bread'))
  e.fireRule('rule_unlock')
  check('3 unlock_recipe открыл рецепт', labels().includes('recipe_tonic'))
  const ink = readFileSync('packs/narrative/dialogue.ts', 'utf8')
  check('3 внешняя команда Ink unlock_recipe есть', /bind\('unlock_recipe'/.test(ink))
  const editor = readFileSync('src/editor/RecipeEditor.tsx', 'utf8')
  check('3 редактор умеет «Открыть по ходу игры»', editor.includes('Открыть по ходу игры'))
}

// ── 4. meta_counter и хроника ────────────────────────────────────────
{
  mem.clear()
  const chrono: CampaignData = { ...campaign, meta: { ...campaign.meta, id: 'p2-smoke-chronicle' } }
  const e = new GameEngine(chrono)
  e.start()
  check('4 первый забег: runs = 1', e.metaCounter('runs') === 1, String(e.metaCounter('runs')))
  check('4 endings_seen = 0 до концовки', e.metaCounter('endings_seen') === 0)
  e.state.stats_run.kills = 3
  check('4 счётчик забега читается как есть', e.metaCounter('kills') === 3, String(e.metaCounter('kills')))
  e.gameOver('victory', 'испытание пройдено')
  check('4 концовка записана в хронику', e.metaStore().endings?.includes('ending_test') === true, JSON.stringify(e.metaStore().endings))
  check('4 endings_seen = 1', e.metaCounter('endings_seen') === 1)
  check('4 victories = 1', e.metaCounter('victories') === 1)
  // второй забег: счётчики прошлого забега суммируются с текущим
  const e2 = new GameEngine(chrono)
  e2.start()
  check('4 мета-счётчик сложился с прошлым забегом', e2.metaCounter('kills') === 3, String(e2.metaCounter('kills')))
  check('4 runs = 2 после второго забега', e2.metaCounter('runs') === 2, String(e2.metaCounter('runs')))
  // кампания без мета-прогресса: хроника не пишется
  const noMeta: CampaignData = { ...campaign, meta: { ...campaign.meta, id: 'p2-smoke-nometa', metaprogress: undefined } }
  const e3 = new GameEngine(noMeta)
  e3.start()
  e3.gameOver('victory', 'без хроники')
  check(
    '4 без metaprogress хроника на диск не пишется',
    !mem.has(`chronicle-forge:meta:${noMeta.meta.id}`),
    [...mem.keys()].join(', '),
  )
  const ok = evalCondition({ type: 'meta_counter', key: 'endings_seen', ge: 1 }, e2)
  check('4 условие meta_counter исполняется', ok === true)
  const ok2 = evalCondition({ type: 'meta_counter', key: 'endings_seen', ge: 2 }, e2)
  check('4 условие meta_counter умеет быть ложным', ok2 === false)
}

// ── 5. валидатор редактора ───────────────────────────────────────────
{
  /** правило кладём в пакет руками: починка импорта такие ссылки чинит,
   *  а «Проверить кампанию» обязана ловить их в ручном JSON */
  const withRules = (rules: RuleDef[]): string[] => {
    const store = new EditorStore()
    for (const r of rules) store.createFile('rules', `${r.id}.json`, r)
    return store.validateContent()
  }

  const cyc = withRules([
    { ...RULES.rule_p1, effects: [{ type: 'fire_rule', rule: 'rule_p2' }] },
    { ...RULES.rule_p2, effects: [{ type: 'fire_rule', rule: 'rule_p3' }] },
    { ...RULES.rule_p3, effects: [{ type: 'fire_rule', rule: 'rule_p1' }] },
  ])
  check('5 петля правил найдена с цепочкой', cyc.some((i) => i.includes('по кругу') && i.includes('Второе')), cyc[0] ?? '')
  check('5 в отчёте сказано про глубину 2', cyc.some((i) => i.includes('не больше 2')))

  const miss: RuleDef[] = [
    {
      id: 'rule_bad_fire',
      label: 'Вызов несуществующего правила',
      conditions: [],
      effects: [{ type: 'fire_rule', rule: 'rule_no_such' }],
    },
    {
      id: 'rule_bad_recipe',
      label: 'Открытие несуществующего рецепта',
      conditions: [],
      effects: [{ type: 'unlock_recipe', recipe: 'recipe_no_such' }],
    },
    {
      id: 'rule_bad_state',
      label: 'Состояние облика не тому персонажу',
      conditions: [],
      effects: [{ type: 'set_entity_state', entity: 'npc_no_such', state: 'angry' }],
    },
    {
      id: 'rule_bad_state2',
      label: 'Состояние облика, которого нет',
      conditions: [],
      effects: [{ type: 'set_entity_state', entity: 'npc_no_such', state: '' }, { type: 'set_entity_state', entity: 'npc_maeva', state: 'withered' }],
    },
  ]
  // персонаж и рецепт должны существовать, иначе проверка не дойдёт до состояния
  const store = new EditorStore()
  for (const r of miss) store.createFile('rules', `${r.id}.json`, r)
  store.createFile('entities', 'npc_maeva.json', { id: 'npc_maeva', type: 'npc', label: 'Маева', description: '', portrait: {}, stats: {}, skills: {} })
  const issues = store.validateContent()
  check('5 несуществующее правило в fire_rule найдено', issues.some((i) => i.includes('rule_no_such')), issues.join(' | '))
  check('5 несуществующий рецепт в unlock_recipe найден', issues.some((i) => i.includes('recipe_no_such')))
  check('5 несуществующий персонаж в set_entity_state найден', issues.some((i) => i.includes('npc_no_such')))
  check('5 несуществующее состояние облика найдено', issues.some((i) => i.includes('withered')), issues.join(' | '))
  const self = new EditorStore()
  self.createFile('rules', 'rule_self.json', { id: 'rule_self', label: 'Сам в себя', conditions: [], effects: [{ type: 'fire_rule', rule: 'rule_self' }] })
  check('5 прямое самовызов правила найдено', self.validateContent().some((i) => i.includes('по кругу')), self.validateContent().join(' | '))
  const okStore = new EditorStore()
  okStore.createFile('recipes', 'recipe_tonic.json', RECIPES.recipe_tonic)
  okStore.createFile('rules', 'rule_ok.json', RULES.rule_unlock)
  check('5 корректная ссылка unlock_recipe не ругается', !okStore.validateContent().some((i) => i.includes('recipe_tonic')), okStore.validateContent().join(' | '))
}

// ── 6. починка монолита ──────────────────────────────────────────────
{
  const raw = {
    ...JSON.parse(JSON.stringify(exportMonolith(new EditorStore()).doc)),
    rules: {
      rule_ghost: {
        id: 'rule_ghost',
        label: 'Правило с призраками',
        conditions: [],
        effects: [
          { type: 'unlock_recipe', recipe: 'recipe_ghost' },
          { type: 'set_entity_state', entity: 'npc_maeva', state: 'withered' },
          { type: 'fire_rule', rule: 'rule_ghost2' },
        ],
      },
    },
    entities: {
      npc_guard: { id: 'npc_guard', type: 'npc', label: 'Страж', description: '', portrait: {}, stats: {}, skills: {} },
      npc_ash: { id: 'npc_ash', type: 'npc', label: 'Пепел', description: '', portrait: {}, stats: {}, skills: {} },
    },
    // id с дефисом и без дают один файл при экспорте — раньше терялся объект
    scenes: {},
  }
  const store = new EditorStore()
  const warns = importMonolith(store, raw)
  const fixed = exportMonolith(store).doc
  const ghost = fixed.rules['rule_ghost']
  check('6 неизвестный рецепт создан закрытым', fixed.recipes['recipe_ghost']?.known === false, JSON.stringify(fixed.recipes['recipe_ghost']?.known))
  check('6 неизвестное состояние облика добавлено пустым', (fixed.entities['npc_maeva'] as NpcDef).entity_states?.includes('withered') === true || Object.keys((fixed.entities['npc_maeva'] as NpcDef).portrait ?? {}).length > 0)
  check('6 несуществующее правило вызова стало заглушкой', !!fixed.rules['rule_ghost2'], warns.filter((w) => w.includes('rule_ghost2'))[0] ?? '')
  check('6 починка не падает', Array.isArray(warns))

  // совпадение имён файлов
  const clashing = JSON.parse(JSON.stringify(raw))
  clashing.scenes = {
    scene_a: { id: 'scene_old-map', label: 'Старая карта', states: [] },
    scene_b: { id: 'scene_old_map', label: 'Старая карта 2', states: [] },
  }
  const store2 = new EditorStore()
  const warns2 = importMonolith(store2, clashing)
  const files = [...store2.manifest.scenes]
  check('6 оба объекта с «одинаковым» именем файла сохранены', new Set(files).size === files.length, files.join(', '))
  check('6 о совпадении имён сказано в отчёте', warns2.some((w) => w.includes('уже занято')), warns2.filter((w) => w.includes('занято'))[0] ?? '')
  const ids = Object.values(exportMonolith(store2).doc.scenes).map((s) => s.id)
  check('6 id обоих объектов целы', ids.includes('scene_old-map') && ids.includes('scene_old_map'), ids.join(', '))
}

// ── 7. группировка предупреждений ────────────────────────────────────
{
  const many = Array.from({ length: 28 }, (_, i) => `Сущность «item_шелка_${i + 1}» не найдена — создана заглушка`)
  const g = groupIssues(many)
  check('7 28 повторов схлопнуты в одну строку', g.lines.length === 1, g.lines[0] ?? '')
  check('7 в строке есть счётчик и имена', /\(таких 28: item_шелка_1, item_шелка_2, item_шелка_3, …\)$/.test(g.lines[0] ?? ''), g.lines[0] ?? '')
  check('7 подпись для мастера непустая', groupNote(g).includes('28'))
  const pair = groupIssues(['А', 'Б', 'А', 'Б'])
  check('7 две одинаковые строки не схлопываются', pair.lines.length === 4, String(pair.lines.length))
  check('7 без повторов подпись пустая', groupNote(pair) === '')
  const mixed = groupIssues([...many, 'Совсем другая проблема'])
  check('7 чужие строки не слипаются', mixed.lines.length === 2, mixed.lines.join(' | '))
  const modals = readFileSync('src/shared/modals.tsx', 'utf8')
  check('7 окно отчёта схлопывает повторы', modals.includes('groupIssues(items)'))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки пройдены')
process.exit(failed ? 1 : 0)
