#!/usr/bin/env node
/** Черновой инвентарь пользовательского текста; вывод TSV, сортировать/вычитывать вручную. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const roots = ['src/player', 'src/editor', 'src/core', 'src/shared', 'public/campaigns/ash-of-caerden', 'docs/book']
const allowed = /\.(tsx?|json|ink|md)$/i
const rows: Array<[string, string, string, string]> = []
const cyrillic = /[А-Яа-яЁё]/
const collectFiles = (dir: string): string[] => {
  try { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? collectFiles(join(dir, entry.name)) : allowed.test(entry.name) ? [join(dir, entry.name)] : []) }
  catch { return [] }
}
const push = (source: string, audience: string, kind: string, text: string) => {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length > 1 && cyrillic.test(clean)) rows.push([source, audience, kind, clean])
}
for (const root of roots) for (const file of collectFiles(root)) {
  const contents = readFileSync(file, 'utf8')
  const lines = contents.split(/\r?\n/)
  lines.forEach((line, i) => {
    const source = `${relative('.', file)}:${i + 1}`
    const audience = file.includes('/editor/') || file.includes('/book/') ? 'мастер' : file.includes('/player/') || file.includes('/campaigns/') ? 'игрок' : 'общее'
    if (file.endsWith('.md')) push(source, audience, 'markdown', line.replace(/^\s*#+\s*/, '').replace(/[*_`]/g, ''))
    for (const m of line.matchAll(/\b(data-tip|placeholder|title|aria-label)\s*=\s*["']([^"']+)["']/g)) push(source, audience, m[1], m[2])
    // Подхватывает явный JSX-текст между тегами, а также русские литералы в UI-вызовах.
    for (const m of line.matchAll(/>([^<>]+)</g)) push(source, audience, 'jsx', m[1])
    for (const m of line.matchAll(/["'`]([^"'`]*[А-Яа-яЁё][^"'`]*)["'`]/g)) {
      const text = m[1]
      if (/^(className|data-tip|placeholder|title|aria-label)$/.test(text)) continue
      push(source, audience, /\$\{|\{[^}]+\}/.test(text) ? 'динамическая строка' : 'литерал', text)
    }
  })
}
const unique = [...new Map(rows.map((r) => [r.join('\t'), r])).values()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`
const output = ['источник\tаудитория\tтип\tтекст', ...unique.map((r) => r.map(quote).join('\t'))].join('\n') + '\n'
const dest = process.argv.find((a) => a.startsWith('--out='))?.slice(6)
if (dest) writeFileSync(dest, output)
else process.stdout.write(output)
console.error(`Инвентаризация: ${unique.length} уникальных строк. Проверяйте вручную: регулярный сканер может пропускать строки и находить ложные совпадения.`)
