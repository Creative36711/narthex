/**
 * Смоук раунда фидбека 24. Запуск: npx tsx scripts/feedback24-smoke.mts
 *
 * 1. Справка: зелёная плашка «d100» в таблице проверок наезжала на текст —
 *    у .checks-mark был фиксированный width 1.2em (под односимвольные
 *    знаки). Стало min-width: содержимое определяет ширину, «d100» не
 *    вылезает за плашку.
 * 2. Вкладки JSON (Кампания → JSON, Мир → JSON): страница больше не
 *    скроллится — редактор кода уместился в экран (flex по цепочке
 *    .editor-main → .rule-editor/.world-main → .advanced-json-page),
 *    скроллится только сам редактор.
 * 3. Темы оформления редактора: хром «ателье» неизменен, выбирается
 *    рабочее полотно — Бумага (дефолт), Тёмная, Графит. Выбор мастера
 *    хранится в localStorage (cf_editor_theme), класс на .editor-root.
 */
import { readFileSync } from 'node:fs'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')
const css = f('src/index.css')
const edcss = f('src/editor/editor.css')
const app = f('src/editor/EditorApp.tsx')

// 1. справка: плашка d100 по содержимому, а не фиксированная
check('1 checks-mark по содержимому (min-width + nowrap)', /min-width: 1\.2em; text-align: center; white-space: nowrap;/.test(css))
const markRule = css.match(/\.checks-row \.checks-mark \{[^}]*\}/)?.[0] ?? ''
check('1 фиксированный width у checks-mark удалён', /min-width: 1\.2em/.test(markRule) && !/(?<!min-)width:/.test(markRule))

// 2. JSON во вкладках: страница без скролла, редактор кода — сам
check('2 Кампания→JSON: полотно-контейнер стал flex-колонкой', edcss.includes('.editor-main:has(> .rule-editor > .advanced-json-page) { display: flex; flex-direction: column; }'))
check('2 Кампания→JSON: редактор занимает остаток экрана', edcss.includes('.rule-editor > .advanced-json-page { flex: 1; min-height: 0; height: auto; }'))
check('2 Мир→JSON: мир-область стала flex-колонкой на всю высоту', edcss.includes('.world-main:has(> .advanced-json-page) { display: flex; flex-direction: column; height: 100%; }'))
check('2 Мир→JSON: редактор занимает остаток экрана', edcss.includes('.world-main > .advanced-json-page { flex: 1; min-height: 0; height: auto; }'))

// 3. темы редактора: токены полотна переопределяются классом
check('3 тема «тёмная» переопределяет бумажные токены', edcss.includes('.editor-root.ed-theme-dark {') && edcss.includes('--ed-paper: #171a20'))
check('3 тема «графит» переопределяет бумажные токены', edcss.includes('.editor-root.ed-theme-anthracite {') && edcss.includes('--ed-paper: #211e19'))
check('3 свечение полотна — токеном (не зажёванное белое)', edcss.includes('--ed-canvas-glow: rgba(255, 255, 255, 0.35);') && edcss.includes('var(--ed-canvas-glow)'))
check('3 хром ателье не зависит от темы полотна', !edcss.includes('.editor-root.ed-theme-dark --ed-bg'))
// 4. узлы диалога на бумажной карточке читаются (не светлые на светлом)
check('4 узлы диалога — бумажный стиль', edcss.includes('.dlg-nodes .editor-list-item { color: var(--ed-paper-text); }'))
check('4 активный узел диалога — бумажная подложка', edcss.includes('.dlg-nodes .editor-list-item.on { background: color-mix(in srgb, var(--ed-select) 12%, var(--ed-paper-card))'))
// переключатель и сохранение выбора мастера
check('3 переключатель темы в тулбаре', app.includes('editor-theme-select') && app.includes('Полотно: тёмная') && app.includes('Полотно: графит'))
check('3 выбор хранится в localStorage', app.includes("localStorage.getItem('cf_editor_theme')") && app.includes("localStorage.setItem('cf_editor_theme', v)"))
check('3 класс темы на .editor-root', app.includes('`editor-root ed-theme-${edTheme}`'))

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
