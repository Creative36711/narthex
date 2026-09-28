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
// вложенный маркер получает класс вложенности
check('вложенный пункт списка получает book-li-nested', render(readFileSync('docs/book/07-ai.md', 'utf8')).includes('book-li-nested'))

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
