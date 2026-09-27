/** Аудит контрастности (WCAG) всех игровых профилей в src/index.css. */
import { readFileSync } from 'node:fs'

const css = readFileSync('src/index.css', 'utf8')

function srgb(v: number) {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
function lum(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return NaN
  const n = parseInt(m[1], 16)
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255)
}
function ratio(a: string, b: string) {
  const la = lum(a), lb = lum(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const blocks: Record<string, Record<string, string>> = {}
for (const m of css.matchAll(/\.cf-profile-([\w-]+) \{([\s\S]*?)\n\}/g)) {
  const id = m[1]
  const toks: Record<string, string> = {}
  for (const t of m[2].matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    if (!toks[t[1]]) toks[t[1]] = t[2].trim()
  }
  blocks[id] = toks
}

const checks: Array<[string, string, number, string]> = [
  ['--text', '--bg', 4.5, 'текст на фоне сцены (AA)'],
  ['--text', '--panel', 4.5, 'текст в панели (AA)'],
  ['--muted', '--panel', 4.5, 'вторичный текст (AA)'],
  ['--gold', '--panel', 3.0, 'акцент к панели (UI)'],
  ['--gold-bright', '--panel', 3.0, 'яркий акцент (UI)'],
  ['--red-bright', '--panel', 3.0, 'урон/крит (UI)'],
  ['--green-bright', '--panel', 3.0, 'лечение/успех (UI)'],
  ['--blue-bright', '--panel', 3.0, 'инфо (UI)'],
]

let problems = 0
console.log('профиль'.padEnd(18), 'пары')
for (const [id, toks] of Object.entries(blocks)) {
  for (const [a, b, min, label] of checks) {
    const ra = toks[a], rb = toks[b]
    if (!ra || !rb || !ra.startsWith('#') || !rb.startsWith('#')) continue
    const r = ratio(ra, rb)
    if (r < min) {
      console.log(`✗ ${id}  ${a} vs ${b} = ${r.toFixed(2)} < ${min}  (${label})`)
      problems++
    }
  }
}
console.log(problems === 0 ? `ВСЕ ПАРИТЫ OK (${Object.keys(blocks).length} профилей)` : `ПРОБЛЕМ: ${problems}`)
