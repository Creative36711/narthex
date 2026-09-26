/**
 * Смоук раунда фидбека 20. Запуск: npx tsx scripts/feedback20-smoke.mts
 *
 *  1. создание героя: длинные названия навыков не сдвигают кнопки (сетка);
 *  2. инвентарь: экипировка — отдельные строки «слот | предмет | кнопка»;
 *  3. озвучка: до первого жеста очередь ждёт (фразы не теряются), видно логи;
 *  4. сбой приложения — не «тёмный экран», а текст ошибки (ErrorBoundary);
 *     плюс команда диагностики __cf_diag() в консоли;
 *  5. экран поражения поверх всего (position: fixed + z-index).
 */
import { readFileSync } from 'node:fs'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')

// ── 1. строки навыков ──
{
  const css = f('src/index.css')
  check('1 строка навыка — сетка с фиксированными колонками', /\.char-skill-row\s*\{\s*display:\s*grid/.test(css))
  check('1 название навыка не рвёт строку', /\.char-skill-name\s*\{[^}]*min-width:\s*0/.test(css))
}

// ── 2. экипировка в инвентаре ──
{
  const css = f('src/index.css')
  check('2 ячейки экипировки — отдельные карточки', /\.equip-slot\s*\{[^}]*display:\s*grid/.test(css))
  check('2 колонки: слот | предмет | кнопка', /grid-template-columns:\s*minmax\(90px/.test(css))
}

// ── 3. озвучка ждёт первого жеста ──
{
  const sp = f('src/shared/speech.ts')
  check('3 очередь не говорит до первого жеста', sp.includes('gestureSeen') && /if \(!gestureSeen\)/.test(sp))
  check('3 жест запускает накопленные фразы', sp.includes('onFirstGesture'))
  check('3 повторов по-прежнему нет', !sp.includes('queue.unshift'))
  check('3 логи озвучки видны (уровень warn)', sp.includes("console.warn('[tts]"))
  check('3 самодиагностика __cf_tts()', sp.includes('__cf_tts'))
}

// ── 4. тёмный экран объясняется ──
{
  const eb = f('src/shared/ErrorBoundary.tsx')
  const main = f('src/main.tsx')
  check('4 ErrorBoundary существует', eb.includes('componentDidCatch'))
  check('4 App обёрнут в ErrorBoundary', main.includes('<ErrorBoundary>'))
  check('4 команда диагностики __cf_diag()', main.includes('__cf_diag'))
  check('4 ошибки страницы собираются для диагностики', main.includes('__cf_errs'))
}

// ── 5. поражение поверх всего ──
{
  const css = f('src/index.css')
  check('5 оверлей поражения фиксирован и сверху', /\.end-overlay\s*\{\s*z-index:\s*200/.test(css))
  check('5 оверлеи занимают весь экран', /\.overlay\s*\{[^}]*position:\s*fixed/.test(css))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
