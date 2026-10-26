/**
 * Смоук блока 10 ТЗ «Гибкий движок» — кодекс/бестиарий.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz10-codex-smoke.mts
 *
 *  1. демо: записи и категории загружаются;
 *  2. эффект unlock_codex: разблокировка, повтор — no-op, чужой id игнорируется;
 *  3. демо-правила разблокируют записи (вход в долину / победа над крысами);
 *  4. плеер и редактор: панель и формы на месте;
 *  5. монолит: экспорт/импорт записей кодекса; схема.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'

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

// ── 1. загрузка ──
{
  check('1 демо: три записи кодекса', Object.keys(demo.codex).length === 3)
  check('1 демо: запись о крысе', demo.codex['codex_rat_giant']?.category === 'creatures' && !!demo.codex['codex_rat_giant'].text)
  check('1 демо: запись о долине', demo.codex['codex_kaerden_valley']?.category === 'places')
  const e = new GameEngine(demo)
  e.start()
  const cats = e.codexCategories()
  check('1 встроенные категории', cats.map((c) => c.id).join() === 'creatures,places,chronicles')
}

// ── 2. эффект разблокировки (на копии без правил — чистая проверка эффекта) ──
{
  const bare = JSON.parse(JSON.stringify(demo))
  bare.rules = {}
  const e = new GameEngine(bare)
  e.start()
  check('2 старт: записей нет', (e.state.codex_unlocked ?? []).length === 0 && e.unlockedCodexEntries().length === 0)
  e.applyEffects([{ type: 'unlock_codex', entry: 'codex_rat_giant' }])
  check('2 разблокировано', (e.state.codex_unlocked ?? []).join() === 'codex_rat_giant')
  check('2 сообщение игроку', e.messages.some((m) => m.text.includes('Новая запись в кодексе: Гигантская крыса')))
  e.applyEffects([{ type: 'unlock_codex', entry: 'codex_rat_giant' }])
  check('2 повтор — no-op', (e.state.codex_unlocked ?? []).length === 1)
  e.applyEffects([{ type: 'unlock_codex', entry: 'codex_missing' }])
  check('2 неизвестный id игнорируется', (e.state.codex_unlocked ?? []).length === 1)
  e.applyEffects([{ type: 'unlock_codex', entry: 'codex_oaken_shield' }])
  check('2 вторая запись добавляется', e.unlockedCodexEntries().length === 2)
}

// ── 3. демо-правила ──
{
  const e = new GameEngine(demo)
  e.start()
  // старт в Городских воротах — правило приветствия открывает запись о долине
  check('3 долина открыта на старте', (e.state.codex_unlocked ?? []).includes('codex_kaerden_valley'))
  const rats = readFileSync('public/campaigns/ash-of-caerden/rules/encounter_cellar_rats.json', 'utf8')
  check('3 победа над крысами открывает бестиарий', rats.includes('unlock_codex') && rats.includes('codex_rat_giant'))
  const maeva = readFileSync('public/campaigns/ash-of-caerden/rules/rule_maeva_thanks.json', 'utf8')
  check('3 таверна открыта у Маэвы', maeva.includes('codex_oaken_shield'))
}

// ── 4. плеер и редактор ──
{
  const hud = readFileSync('src/player/HUD.tsx', 'utf8')
  check('4 HUD: кнопка только с записями', hud.includes("codex_unlocked ?? []).length > 0") && hud.includes('Кодекс'))
  const panel = readFileSync('src/player/CodexPanel.tsx', 'utf8')
  check('4 панель: категории и записи', panel.includes('codexCategories()') && panel.includes('unlockedCodexEntries()'))
  check('4 панель: текст шрифтом темы', readFileSync('src/index.css', 'utf8').includes('.codex-text'))
  const gv = readFileSync('src/player/GameView.tsx', 'utf8')
  check('4 GameView подключает панель', gv.includes('CodexPanel') && gv.includes("panel === 'codex'"))
  const app = readFileSync('src/editor/EditorApp.tsx', 'utf8')
  check('4 редактор: раздел «Кодекс»', app.includes("label: 'Кодекс'") && app.includes('CodexEditor'))
  const ed = readFileSync('src/editor/CodexEditor.tsx', 'utf8')
  check('4 редактор записи: форма', ed.includes('Категория') && ed.includes('Текст записи') && ed.includes('assets/img/codex'))
  const schemas = readFileSync('src/editor/schemas.ts', 'utf8')
  check('4 схемы: unlock_codex + codexRef', schemas.includes('unlock_codex:') && schemas.includes('codexRef'))
  const { condInk, generateInk } = await import('../src/editor/dialogueDoc')
  const ink = generateInk({
    version: 2,
    label: 'смоук кодекса',
    nodes: [{
      id: 'n1',
      label: 'тест',
      choices: [],
      sections: [{ steps: [{ kind: 'effect', effect: { type: 'unlock_codex', entry: 'codex_rat_giant' } }] }],
    }],
  } as never)
  check('4 диалог: эффект в ink', ink.includes('~ unlock_codex("codex_rat_giant")'))
  check('4 диалог: external привязан', readFileSync('packs/narrative/dialogue.ts', 'utf8').includes("bind('unlock_codex'"))
  void condInk
}

// ── 5. монолит и схема ──
{
  const { EditorStore } = await import('../src/editor/store')
  const { exportMonolith, importMonolith, parseMonolith } = await import('../src/editor/monolith')
  const store = new EditorStore(base)
  await store.load()
  check('5 стор видит записи', store.codexPaths().length === 3 && store.options('codex').length === 3)
  const entry = store.codexEntry('codex/codex_rat_giant.json')
  entry.text = 'смоук-правка текста'
  store.touch('codex/codex_rat_giant.json')
  const { doc } = exportMonolith(store)
  check('5 экспорт: записи в монолите', Object.keys(doc.codex ?? {}).length === 3 && doc.codex!['codex_rat_giant'].text === 'смоук-правка текста')

  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parseMonolith(JSON.stringify(doc)))
  const path2 = store2.codexPaths().find((p) => store2.codexEntry(p).id === 'codex_rat_giant')
  check('5 импорт: запись возвращается', !!path2 && store2.codexEntry(path2!).text === 'смоук-правка текста')
  check('5 импорт: манифест знает раздел', (store2.manifest.codex ?? []).length === 3)

  const schema = readFileSync('docs/campaign.schema.json', 'utf8')
  check('5 схема знает кодекс', schema.includes('CodexEntryDef') && schema.includes('codex_categories') && schema.includes('unlock_codex'))
}

console.log(failed ? `\n${failed} ПРОВАЛОВ` : '\nВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ')
process.exit(failed ? 1 : 0)
