/**
 * Смоук блока 4 ТЗ «Гибкий движок» — крафт.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz4-craft-smoke.mts
 *
 *  1. движок: доступность, недостающие компоненты/инструменты/условия;
 *  2. изготовление: расход компонентов, результат, промотка времени;
 *  3. проверка навыка: провал сохраняет материалы, успех — галочка опыта;
 *  4. загрузчик: рецепты из пакета попадают в CampaignData;
 *  5. редактор: секция «Рецепты крафта» + RecipeEditor;
 *  6. монолит: экспорт/импорт рецептов;
 *  7. схема знает RecipeDef.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { EditorStore } from '../src/editor/store'
import { exportMonolith, importMonolith, parseMonolith } from '../src/editor/monolith'
import type { CampaignData, RecipeDef } from '../src/shared/types'

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
const demo = await loadCampaign(base)

const RECIPES: Record<string, RecipeDef> = {
  recipe_silver: {
    id: 'recipe_silver',
    label: 'Алхимия серебра',
    inputs: [{ item: 'item_bread', quantity: 1 }],
    output: { item: 'item_silver', quantity: 3 },
  },
  recipe_slow: {
    id: 'recipe_slow',
    label: 'Долгая ковка',
    inputs: [{ item: 'item_bread', quantity: 1 }],
    output: { item: 'item_silver', quantity: 1 },
    time_ticks: 4,
  },
  recipe_tool: {
    id: 'recipe_tool',
    label: 'Нужен нож',
    inputs: [{ item: 'item_bread', quantity: 1 }],
    tools: ['item_knife'],
    output: { item: 'item_silver', quantity: 1 },
  },
  recipe_flag: {
    id: 'recipe_flag',
    label: 'Тайное знание',
    inputs: [{ item: 'item_bread', quantity: 1 }],
    requires: [{ type: 'flag_set', flag: 'knows_secret' }],
    output: { item: 'item_silver', quantity: 1 },
  },
  recipe_skill: {
    id: 'recipe_skill',
    label: 'Тонкая работа',
    inputs: [{ item: 'item_bread', quantity: 1 }],
    skill: { id: 'craft', difficulty: 40 },
    output: { item: 'item_silver', quantity: 2 },
  },
}

function withRecipes(): CampaignData {
  return { ...demo, recipes: JSON.parse(JSON.stringify(RECIPES)) }
}

// ── 1. доступность ──
{
  const e = new GameEngine(withRecipes())
  e.start()
  const all = e.allRecipes()
  check('1 allRecipes: все рецепты, по алфавиту', all.length === 5 && all[0].id === 'recipe_silver')
  check('1 recipeMissing: нет компонента', e.recipeMissing({ ...RECIPES.recipe_silver, inputs: [{ item: 'item_bread', quantity: 999 }] }).length === 1)
  check('1 recipeMissing: нет инструмента', e.recipeMissing(RECIPES.recipe_tool).some((m) => m.includes('инструмент')))
  check('1 recipeMissing: условие не выполнено', e.recipeMissing(RECIPES.recipe_flag).some((m) => m.includes('условия')))
  check('1 недоступный рецепт не крафтится', e.craft('recipe_flag') === false)
  check('1 несуществующий рецепт не крафтится', e.craft('recipe_none') === false)
}

// ── 2. изготовление ──
{
  const e = new GameEngine(withRecipes())
  e.start()
  const bread = e.itemCount('item_bread')
  check('2 в демо-инвентаре есть хлеб', bread >= 1, `хлеб=${bread}`)
  const silver = e.itemCount('item_silver')
  const tick0 = e.state.tick
  check('2 craft: успех', e.craft('recipe_silver') === true)
  check('2 craft: компонент израсходован', e.itemCount('item_bread') === bread - 1)
  check('2 craft: результат выдан', e.itemCount('item_silver') === silver + 3)
  check('2 craft без времени: тики не двигаются', e.state.tick === tick0)
  // время
  const t1 = e.state.tick
  e.craft('recipe_slow')
  check('2 craft: время промотано', e.state.tick === t1 + 4, `тик ${t1} → ${e.state.tick}`)
  // условия: ставим флаг — рецепт открывается (хлеб уже потрачен, пополняем)
  e.addItem('item_bread', 5)
  e.applyEffects([{ type: 'set_flag', flag: 'knows_secret' }])
  check('2 requires: после флага рецепт доступен', e.recipeMissing(RECIPES.recipe_flag).length === 0)
  check('2 requires: крафт с условием работает', e.craft('recipe_flag') === true)
  // инструменты: даём нож — инструмент не расходуется
  e.addItem('item_knife', 1)
  check('2 инструмент: появился', e.itemCount('item_knife') === 1)
  check('2 инструмент: крафт работает', e.craft('recipe_tool') === true)
  check('2 инструмент: не израсходован', e.itemCount('item_knife') === 1)
}

// ── 3. проверка навыка ──
{
  const e = new GameEngine(withRecipes())
  e.start()
  // провал: навыка нет вообще, сложность 40 → цель 10, бросок 100 невозможен… делаем детерминированно:
  ;(e as any).rng = { int: () => 100, next: () => 0.999 }
  const bread = e.itemCount('item_bread')
  const ok = e.craft('recipe_skill')
  check('3 навык: провал броска', ok === false)
  check('3 навык: провал сохраняет материалы', e.itemCount('item_bread') === bread)
  // успех: бросок 1, навык есть
  ;(e as any).rng = { int: () => 1, next: () => 0.001 }
  e.state.player.skills['craft'] = 40
  const silver = e.itemCount('item_silver')
  check('3 навык: успех броска', e.craft('recipe_skill') === true)
  check('3 навык: результат ×2', e.itemCount('item_silver') === silver + 2)
  check('3 навык: галочка опыта поставлена', e.state.player.skill_marks['craft'] === true)
}

// ── 4. загрузчик ──
{
  // демо-кампания пока без рецептов — поле должно существовать и быть пустым
  check('4 лоадер: поле рецептов есть', typeof demo.recipes === 'object' && demo.recipes !== null)
  // манифест с рецептами загружается (виртуальный пакет на базе демо)
  const doc = await (await fetch(`${base}/manifest.json`)).json()
  check('4 манифест демо читаем', Array.isArray(doc.scenes), `сцен=${doc.scenes.length}`)
}

// ── 5. редактор ──
{
  const app = readFileSync('src/editor/EditorApp.tsx', 'utf8')
  check('5 EditorApp: секция рецептов в меню', app.includes("id: 'recipes'") && app.includes('Рецепты крафта'))
  check('5 EditorApp: создание рецепта', app.includes("makeId('recipe_'"))
  const editor = readFileSync('src/editor/RecipeEditor.tsx', 'utf8')
  check('5 RecipeEditor: компоненты/инструменты/навык/время/результат',
    editor.includes('Компоненты') && editor.includes('Инструменты') && editor.includes('Проверка навыка') &&
    editor.includes('Время') && editor.includes('Результат'))
  const hud = readFileSync('src/player/HUD.tsx', 'utf8')
  check('5 HUD: кнопка «Крафт»', hud.includes('Крафт') && hud.includes('hammer'))
}

// ── 6. монолит ──
{
  const store = new EditorStore(base)
  await store.load()
  store.manifest.recipes = ['recipe_silver.json']
  store.jsonFiles.set('recipes/recipe_silver.json', RECIPES.recipe_silver)
  store.touch('recipes/recipe_silver.json')
  const { doc } = exportMonolith(store)
  check('6 экспорт: рецепты в монолите', doc.recipes?.recipe_silver?.label === 'Алхимия серебра')

  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parseMonolith(JSON.stringify(doc)))
  const r = store2.recipePaths().map((p) => store2.recipe(p)).find((x) => x.id === 'recipe_silver')
  check('6 импорт: рецепт на месте', r?.output.item === 'item_silver' && r?.output.quantity === 3)
  check('6 импорт: файл в манифесте', (store2.manifest.recipes ?? []).length === 1)
}

// ── 7. схема ──
{
  const schema = JSON.parse(readFileSync('docs/campaign.schema.json', 'utf8'))
  check('7 схема: RecipeDef в $defs', !!schema.$defs?.RecipeDef)
  check('7 схема: у рецепта есть output и inputs',
    !!schema.$defs.RecipeDef.properties?.output && !!schema.$defs.RecipeDef.properties?.inputs)
}

if (failed > 0) {
  console.error(`\nПРОВАЛЕНО ПРОВЕРОК: ${failed}`)
  process.exit(1)
}
console.log('\nALL GREEN (tz4-craft)')
