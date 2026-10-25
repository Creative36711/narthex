/**
 * Смоук раунда фидбека 18. Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback18-smoke.mts
 *
 *  1. Ctrl+Z работает на галочках/селектах как кнопка «Откатить»;
 *  2. навыки «обязательные/запрещённые» — понятные переключатели, не мусор;
 *  3. вёрстка происхождений — секции и сетка;
 *  4. финальные экраны: мастер задаёт концовки, движок выбирает по условиям;
 *  5. слои погоды — реестр кампании;
 *  6–8. спойлеры: эмбиент локации, состояния сцен, изображения НПС;
 *  9. длинные блоки НПС (способности/инвентарь/торговля) под спойлерами;
 * 10. справка без горизонтального скролла;
 * 11. «Названия» на карте — кнопка-переключатель;
 * 12. сцена не чёрная: диагностика фона + надёжная вёрстка;
 * 13. озвучка: прогрев первым жестом и детект «тихих» фраз.
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
const f = (p: string) => readFileSync(p, 'utf8')

// ── 1. Ctrl+Z на галочках ──
{
  const app = f('src/editor/EditorApp.tsx')
  check('1 Ctrl+Z пропускает только текстовые поля', app.includes('textLike') && app.includes("t.tagName === 'INPUT' && textLike.has"))
}

// ── 2/3. редактор создания персонажа ──
{
  const ce = f('src/editor/CampaignEditor.tsx')
  check('2 обязательные/запрещённые — переключатели с подписями', ce.includes('Обязательные навыки — у любого происхождения') && ce.includes('Запрещённые навыки — очки на них тратить нельзя'))
  check('3 карточка происхождения с секциями', ce.includes('prof-card') && ce.includes('prof-stats'))
  const css = f('src/editor/editor.css')
  check('3 вёрстка происхождений в стилях', css.includes('.prof-card') && css.includes('.prof-stats') && css.includes('.prof-line'))
}

// ── 4. концовки ──
{
  check('4 демо задаёт концовки', (demo.meta.endings ?? []).length >= 3)
  const schema = JSON.parse(f('docs/campaign.schema.json'))
  check('4 схема знает EndingDef', !!schema.$defs.EndingDef)

  // движок выбирает первую подходящую по исходу и условиям
  const e = new GameEngine(demo)
  e.start()
  e.state.flags['met_guard'] = true
  const c = JSON.parse(JSON.stringify(demo)) as typeof demo
  c.meta.endings = [
    { id: 'end_a', label: 'А', title: 'Экран А', on: 'victory', conditions: [{ type: 'flag_set', flag: 'nope' } as never] },
    { id: 'end_b', label: 'Б', title: 'Экран Б', on: 'victory', conditions: [{ type: 'flag_set', flag: 'met_guard' } as never] },
  ]
  const e2 = new GameEngine(c)
  e2.start()
  e2.state.flags['met_guard'] = true
  e2.gameOver('victory', 'тест')
  check('4 выбрана первая концовка с выполненными условиями', e2.state.game_over?.ending === 'end_b', e2.state.game_over?.ending)

  const e3 = new GameEngine(c)
  e3.start()
  e3.gameOver('death', 'тест')
  check('4 для гибели условия не подошли — стандартный экран', e3.state.game_over?.ending === undefined)

  const death = new GameEngine(demo)
  death.start()
  death.gameOver('death', 'тест')
  check('4 демо: гибель показывает финал «Пепельный»', death.state.game_over?.ending === 'ending_ashes')

  const end = f('src/player/EndScreen.tsx')
  check('4 экран финала рисует концовку мастера', end.includes('ending?.title') && end.includes('ending?.image'))
  const ce = f('src/editor/CampaignEditor.tsx')
  check('4 редактор: блок концовок с условиями', ce.includes('Финальные экраны (концовки)') && ce.includes('ConditionListEditor'))
}

// ── 5. слои погоды из кампании ──
{
  check('5 демо объявляет слои погоды', (demo.meta.overlay_layers ?? []).length >= 4)
  const ce = f('src/editor/CampaignEditor.tsx')
  check('5 редактор: реестр слоёв и управление им', ce.includes('Слои погоды (реестр кампании)') && ce.includes('overlay_layers'))
  check('5 селект «Слой» строится из реестра', ce.includes('(m.overlay_layers ?? []).map((l) => ('))
}

// ── 6–9. спойлеры ──
{
  const we = f('src/editor/WorldEditor.tsx')
  check('6 эмбиент локации под спойлером', we.includes('spoiler-block') && we.includes('Фоновые звуки локации'))
  const se = f('src/editor/SceneEditor.tsx')
  check('7 состояния сцен: первое видно, остальные в спойлере', se.includes('Остальные состояния'))
  const ee = f('src/editor/EntityEditor.tsx')
  check('8 изображения НПС под спойлером', ee.includes('Изображения: портреты, спрайт, фигурка'))
  check('9 способности/инвентарь/торговля под спойлерами', ee.includes('<summary>Способности и мораль</summary>') && ee.includes('<summary>Снаряжение и инвентарь</summary>') && ee.includes('<summary>Торговля</summary>'))
}

// ── 10/11. справка и карта ──
{
  const help = f('src/player/HelpPanel.tsx')
  check('10 таблица исходов без pre и скролла', help.includes('checks-table') && !help.includes('padEnd'))
  const css = f('src/index.css')
  check('10 стили таблицы исходов', css.includes('.checks-row'))
  const map = f('src/player/MapScreen.tsx')
  check('11 «Названия» — кнопка с состоянием', map.includes('map-labels-toggle') && !map.includes('type="checkbox" checked={labels}'))
}

// ── 12. сцена не чёрная ──
{
  const ss = f('src/player/SceneScreen.tsx')
  check('12 ошибка фона видна на экране', ss.includes('bgError') && ss.includes('scene-bg-note'))
  const css = f('src/index.css')
  check('12 сцена не схлопывается (ширина всегда полная)', css.includes('.scene-stage') && css.includes('width: 100%;'))
}

// ── 13. озвучка ──
{
  const sp = f('src/shared/speech.ts')
  check('13 прогрев синтезатора первым жестом', sp.includes("addEventListener('pointerdown', onFirstGesture"))
  check('13 повторы фраз исключены (очередь только вперёд)', !sp.includes('queue.unshift') && !sp.includes('retryItem'))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
