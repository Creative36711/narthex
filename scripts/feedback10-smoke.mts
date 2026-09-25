import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const f = (p: string) => readFileSync(join(root, p), 'utf8')
let fails = 0
const must = (ok: boolean, name: string) => {
  console.log((ok ? '✓ ' : '✗ ') + name)
  if (!ok) fails++
}

const css = f('src/index.css')
const editor = f('src/editor/EditorApp.tsx')
const wizard = f('src/editor/AiWizard.tsx')
const mapScreen = f('src/player/MapScreen.tsx')
const combat = f('src/player/CombatScreen.tsx')
const icons = f('src/shared/icons.tsx')
const music = f('src/shared/music.ts')
const app = f('src/App.tsx')

// 1 — курсоры
must(css.includes('fill=\'%23ffffff\' stroke=\'%23000000\'') && css.includes('stroke-width=\'2\''),
  '1 курсор-стрелка белая с чёрной обводкой — контрастная')
must(css.includes('.wizard-field-head') && css.includes(', pointer;'),
  '1 кликабельные заголовки мастера (.wizard-field-head) получают руку-pointer')
must(!/input, textarea,\s*\[contenteditable/.test(css),
  '1 I-beam больше не цепляется глобально за input/textarea')
must(css.includes("input[type='checkbox']") && css.includes('14 2, pointer'),
  '1 чекбоксы/радио/файлы — рука-pointer, не I-beam (нет «двух полосок»)')
must(css.includes("input[type='range']") && css.includes('ew-resize'),
  '1 ползунки — горизонтальный курсор')

// 2 — тултипы
must(css.includes('top: calc(100% + 8px)') && css.includes('[data-tip]:hover::after'),
  '2 тултипы показываются НИЖЕ элемента — подсказки шапки не уходят за экран')
must(css.includes('white-space: normal') && css.includes('max-width: 260px'),
  '2 тултипы с переносом строк, max-width 260 — нет нижнего скроллбара')
must(mapScreen.includes("label-up") && css.includes('.map-pin.label-up .pin-label'),
  '2 метки карты у нижнего края переворачиваются вверх (label-up)')

// 3 — меню редактора
must(editor.includes('editor-nav-menu" key={menu.id} onClick={(e) => e.stopPropagation()}'),
  '3 клики по меню редактора не всплывают до window-close — попапы работают')

// 4 — ИИ-мастер: копирование с подтверждением
must(!wizard.includes("style={{ position: 'fixed', bottom: 28, right: 28 }}") && wizard.includes('copy-status'),
  '4 кнопки мастера внутри окна — клик не закрывает модалку')
must(wizard.includes('Промпт скопирован в буфер обмена') && wizard.includes("document.execCommand('copy')"),
  '4 видимое подтверждение копирования + фолбэк без Clipboard API')

// 5 — зум карты
must(mapScreen.includes('Math.max(1, Math.min(2.5') && !mapScreen.includes('Math.min(6, z'),
  '5 зум карты ограничен 1–2.5: без чёрных полей и пикселей')

// 6 — гексы и трупы
must(!/cls \+= 'hex/.test(combat) && (combat.match(/cls \+= ' hex-/g) ?? []).length >= 5,
  '6 классы гексов через пробел — рельеф/запрет снова видны, нет чёрных гексов')
must(css.includes('opacity: 0.55; filter: grayscale(1)') && combat.includes("token-dead'"),
  '6 труп заметный (opacity 0.55)')

// 7 — чипсы и поиск
must(css.includes('.chip-on') && css.includes('.chips') && css.includes('gap: 6px'),
  '7 чипсы «Все/Надето/Не надето» — пилюли с зазором, активная золотая')
must(css.includes('background: var(--panel-2)') && css.includes('border-color: var(--gold)') && css.includes('panel-tools input, .editor-list-search'),
  '7 поиск инвентаря/квестов/редактора оформлен: тёмное поле, золотой фокус')

// 8 — иконки
must(icons.includes("| 'exit'") && icons.includes('exit: ') && icons.includes("M10 8l-4 4 4 4"),
  '8 иконка «Выход» — дверь со стрелкой (не квадрат)')
must(icons.includes("M15 12a3 3 0 11-6 0") && icons.includes("M3.5 12a8.5"),
  '8 шестерёнка и справка перерисованы чистыми контурами')
must(editor.includes('n="exit"') && editor.includes('Выйти'),
  '8 кнопка «Выйти» в редакторе использует новую иконку')

// 9 — фоновая музыка меню
must(music.includes('export function setMusicCampaign') && app.includes('setMusicCampaign(c)'),
  '9 кампания привязана к плееру сразу при загрузке — музыка меню есть до забега')
must(app.includes('refreshMusic(engine)') && app.includes('unlockAudio()'),
  '9 после первого жеста музыка стартует автоматически (разблокировка автоплея)')

console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'ALL GREEN')
if (fails) process.exitCode = 1
