/**
 * Смоук рендера «Книги мастера» (MarkdownView): мини-парсер markdown обязан
 * вести себя как настоящий markdown для типового текста книги —
 * склеивать мягкие переносы внутри пунктов списка и абзацев, не плодить
 * «осиротевшие» строки (регресс 29-09: пункт 6 оглавления разваливался
 * на две строки, вторая «версии» висела голым абзацем посреди списка).
 *
 * Прогон: npx tsx scripts/book-md-smoke.mts
 */
import React from 'react'
;(globalThis as unknown as { React: typeof React }).React = React // classic-jsx в tsx-прогоне
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import { MarkdownView } from '../src/editor/MarkdownView'

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const noop = () => undefined
const render = (source: string) => renderToStaticMarkup(h(MarkdownView, { source, onNavigate: noop }))

// точечный регресс из скриншота 28-09: оглавление «О книге»
const readme = readFileSync('docs/book/README.md', 'utf8')
{
  const html = render(readme)
  const li6 = html.match(/<li[^>]*>[\s\S]*?Технические вопросы[\s\S]*?<\/li>/)
  check('пункты оглавления не разваливаются (6 — один li)', !!li6)
  check('продолжение пункта («версии») внутри того же li', !!li6 && li6[0].includes('версии'))
  check('маркированные пункты «О книге» без осиротевших строк', !/<p>у вас будет кампания/.test(html))
}

// все главы: общие инварианты
const files = readdirSync('docs/book').filter((f) => f.endsWith('.md'))
check('файлы книги на месте', files.length >= 10, `${files.length}`)
for (const f of files) {
  const src = readFileSync(`docs/book/${f}`, 'utf8')
  const html = render(src)
  // мягкий перенос не должен становиться жёстким <br/> внутри параграфа
  check(`${f}: в параграфах нет <br/>`, !/<p[^>]*>[\s\S]*?<br/.test(html.replace(/<p[^>]*><\/p>/g, '')))
  // обрывок пункта списка — абзац со строчной буквы сразу за </ul>/<ol>
  // (легальный новый абзац мастер начинает с заглавной/болда/цифры)
  check(`${f}: за списками не болтаются обрывки`, !/<\/[uo]l><p>[а-яё]/u.test(html))
}
// В design_doc используются те же типовые Markdown-конструкции, что и в книге.
const designDoc = render(`# Паспорт **кампании**\n\nКороткое описание с *акцентом* и \`кодом\`.\n\n## Решения\n\n- Первый пункт\n  - Вложенный пункт\n\n> Важное ограничение.\n\n| Поле | Значение |\n| --- | --- |\n| Тон | Мрачный |\n\n\`\`\`json\n{ "id": "stable" }\n\`\`\``)
check('дизайн-документ отображает заголовки и inline Markdown', designDoc.includes('<h1>Паспорт <strong>кампании</strong></h1>') && designDoc.includes('<em>акцентом</em>') && designDoc.includes('<code>кодом</code>'))
check('дизайн-документ отображает списки, цитату, таблицу и fenced code', designDoc.includes('book-li-nested') && designDoc.includes('<blockquote>') && designDoc.includes('<table') && designDoc.includes('<pre'))
const editorCss = readFileSync('src/editor/editor.css', 'utf8')
check('форма задания ИИ ограничена высотой окна и имеет внутреннюю прокрутку', editorCss.includes('.modal-box.ai-wizard') && editorCss.includes('max-height: calc(100dvh - 24px)') && editorCss.includes('.ai-wizard-content') && editorCss.includes('overflow-y: auto'))
check('чипы задания ИИ используют одну контрастную палитру во всех темах редактора', editorCss.includes('.modal-overlay .ai-wizard .chip {') && editorCss.includes('background: #2a303d;') && editorCss.includes('color: #c8ced8;') && editorCss.includes('.modal-overlay .ai-wizard .chip.chip-on'))

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
