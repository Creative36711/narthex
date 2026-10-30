/**
 * Гейт правды о браузере.
 *
 * 26.10: приёмка фазы 2 прошла без браузера — агент сослался на устаревшую
 * фразу про недоступный браузер, хотя в репозитории уже лежала рабочая
 * инструкция docs/agents/browser.md. Причина: рядом остались старые фразы в шапке
 * scripts/visual/shots.mjs и docs/agents/visual.md. Проверка игрой в настоящем
 * Chromium сразу нашла то, что CLI не видит: битые ассеты, падение FMV-сцены.
 *
 * Этот страж делает две вещи:
 *   1) запрещает регресс текста «браузера нет / браузер не запускается»;
 *   2) требует, чтобы браузерный прогон существовал и был вызван из CI.
 *
 * Запуск: npm run check:browser-gate (входит в check:contracts).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.cwd()
const scanned = ['docs', 'scripts', 'src', '_tools', '.github', 'README.md']
const extensions = new Set(['.md', '.mjs', '.mts', '.ts', '.tsx', '.js', '.yml', '.yaml'])

/** Ложные формулировки. Разрешены только явные опровержения (см. allow). */
const forbidden = [
  /браузера\s+(в\s+песочнице\s+)?нет/i,
  /браузер\s+(в\s+песочнице\s+)?отсутствует/i,
  /браузер\s+не\s+запускается/i,
  /в\s+песочнице\s+агента\s+браузер\s+не/i,
  /пиксели\s*\(в\s+песочнице\s+невозможно/i,
  /браузер\s+жив[ёе]т\s+в\s+CI,?\s+а\s+не\s+в\s+песочнице/i,
  /browser\s+(is\s+)?(unavailable|not available)\s+in\s+(the\s+)?sandbox/i,
  /no browser in (the )?sandbox/i,
]

/**
 * Фразы в кавычках — это цитаты запрета, а не утверждения. Вырезаем их до
 * проверки, иначе страж будет ругать собственную документацию о запрете.
 */
function stripQuoted(line: string): string {
  return line
    .replace(/[«"'](?:[^«»"']|[»])*?[»"']/g, ' ')
    .replace(/`[^`]*`/g, ' ')
}

/** Строки, где те же слова использованы как опровержение без кавычек. */
const allowed = [
  /прошлый вывод был неверным/i,
  /это ложь/i,
  /запрет/i,
  /запрещено/i,
  /не потому, что/i,
  /не\s+является\s+поводом/i,
  /ложн/i,
  /был\s+ошибочным/i,
  /неверным/i,
  /forbidden/i,
  /never say/i,
]

interface Hit { file: string; line: number; text: string }

function walk(path: string, out: string[] = []): string[] {
  if (!existsSync(path)) return out
  const st = statSync(path)
  if (st.isFile()) { out.push(path); return out }
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
      walk(join(path, name), out)
    }
  }
  return out
}

const hits: Hit[] = []
for (const entry of scanned) {
  for (const file of walk(join(root, entry))) {
    const ext = file.slice(file.lastIndexOf('.'))
    if (!extensions.has(ext)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    const bare = lines.map(stripQuoted)
    bare.forEach((clean, i) => {
      if (!forbidden.some((re) => re.test(clean))) return
      // окрестность строки: опровержение часто на предыдущей/следующей строке
      const context = lines.slice(Math.max(0, i - 2), i + 3).join(' ')
      if (allowed.some((re) => re.test(context))) return
      hits.push({ file: relative(root, file).split(sep).join('/'), line: i + 1, text: lines[i]!.trim().slice(0, 160) })
    })
  }
}

const problems: string[] = []
for (const h of hits) problems.push(`${h.file}:${h.line} — ${h.text}`)

// Инфраструктура браузера должна существовать и быть вызвана из CI.
const mustExist = [
  'docs/agents/browser.md',
  'scripts/visual/local-browser.mjs',
  'scripts/visual/shot.mjs',
  'scripts/visual/playthrough.mjs',
  'scripts/visual/shots.mjs',
]
for (const f of mustExist) if (!existsSync(join(root, f))) problems.push(`нет файла ${f}`)

const workflow = existsSync(join(root, '.github/workflows/visual.yml'))
  ? readFileSync(join(root, '.github/workflows/visual.yml'), 'utf8') : ''
if (!/playthrough\.mjs/.test(workflow)) problems.push('visual.yml не запускает scripts/visual/playthrough.mjs')

const guide = existsSync(join(root, 'docs/agents/browser.md'))
  ? readFileSync(join(root, 'docs/agents/browser.md'), 'utf8') : ''
if (!/@sparticuz\/chromium/.test(guide)) problems.push('browser.md потерял команду установки @sparticuz/chromium')

if (problems.length) {
  console.error('Гейт браузера: проверка игрой обязательна. Найдено:')
  problems.forEach((p) => console.error('  ✗ ' + p))
  console.error('\nСм. docs/agents/browser.md и docs/agents/visual.md.')
  process.exit(1)
}
console.log(`Гейт браузера: ok — ложных формулировок 0, инфраструктура на месте, CI вызывает playthrough.`)
