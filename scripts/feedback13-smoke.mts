import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const f = (p: string) => readFileSync(join(root, p), 'utf8')
let fails = 0
const must = (ok: boolean, name: string) => {
  console.log((ok ? '✓ ' : '✗ ') + name)
  if (!ok) fails++
}

const css = f('src/index.css')
const ecss = f('src/editor/editor.css')
const ent = f('src/editor/EntityEditor.tsx')
const dlg = f('src/editor/DialogueBuilder.tsx')
const scene = f('src/editor/SceneEditor.tsx')
const arena = f('src/editor/ArenaEditor.tsx')

// 1 — селекты и чекбоксы больше не серые
must(css.includes("input[type='checkbox'], input[type='radio']") && css.includes('accent-color: var(--gold)'),
  '1 чекбоксы/радио золотые (accent-color) во всём приложении')
must(/\nselect \{[\s\S]*?background: var\(--panel-2\)/.test(css) && css.includes('select.emotion-pick'),
  '1 селекты (включая «+ состояние (выбрать из списка)…») стилизованы под формы')

// 2 — JSON во вкладках до самого низа
// фидбек «окна до низа»: страница — flex-колонка, textarea растягивается
must(css.includes('.advanced-json-page') && css.includes('height: calc(100vh - 118px)') && css.includes('.advanced-json-page textarea') && css.includes('flex: 1'),
  '2 JSON во вкладках заполняет окно до низа, без чёрного поля')

// 3 — у вкладок нет лишнего вертикального скролла
must(ecss.includes('overflow-x: auto; overflow-y: hidden'),
  '3 у строки вкладок нет вертикального скроллбара')

// 4 — «Регионы и локации» без горизонтального скролла
must(ecss.includes('margin: 0 0 14px; padding: 12px 2px 0;') && ecss.includes('.rule-editor > .ce-tabs') && ecss.includes('overflow-y: hidden'),
  '4 вкладки не вылезают за контейнер (без горизонтального скролла)')

// 5 — сцены/арены: JSON внизу свёрнутым, не справа
must(css.includes('.scene-editor > .advanced-json, .arena-editor > .advanced-json') && scene.includes('<FileAdvancedJson') && arena.includes('<FileAdvancedJson'),
  '5 в сценах/аренах JSON — свёрнутый блок внизу, как у сущностей')

// 6 — только дефолтное состояние
const ents = ['bran', 'corvin', 'guard_aldric', 'lena', 'maeva', 'yorek'].map((n) => f(`public/campaigns/ash-of-caerden/entities/npc_${n}.json`)).join('')
must(!/"happy"|"angry"|"sad"|"fear"/.test(ents),
  '6 у персонажей демо-кампании нет состояний happy/angry — только дефолтное')
const dlgs = ['aldric', 'bran', 'corvin', 'maeva', 'yorek'].map((n) => f(`public/campaigns/ash-of-caerden/dialogues/${n}.dlg.json`) + f(`public/campaigns/ash-of-caerden/dialogues/${n}.ink`)).join('')
must(!/emotion[":= ]+(happy|angry|sad|fear)/.test(dlgs),
  '6 диалоги и ink не переключают на удалённые состояния')

// 7 — урон оружия: широкие поля + итог
must(css.includes('min-width: 280px') && css.includes('width: 96px') && css.includes('dmg-summary') && ent.includes('dmg-summary'),
  '7 урон оружия: широкие поля и видимое итоговое значение')

// 8 — ink-исходник диалогов
must(dlg.includes('Ink-исходник') && dlg.includes('generateInk(doc)') && dlg.includes('advanced-json'),
  '8 у диалогов есть ink-исходник (как расширенный JSON)')

// 9 — боевые курсоры
must(css.includes('--cur-cross') && css.includes('--cur-sword') && css.includes('cursor: var(--cur-cross)') && css.includes('cursor: var(--cur-sword)'),
  '9 движение — курсор-прицел, атака — курсор-меч (не менюшные)')

console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'ALL GREEN')
if (fails) process.exitCode = 1
