/**
 * Смоук-ревизия фидбека 15 (типизация текста диалогов + пропуск печати):
 * 1. баг скорости печати починен: переход к следующей строке сбрасывает счётчик;
 * 2. клик мыши показывает весь оставшийся текст сразу, без кнопок;
 * 3. клик прерывает текущую озвучку (файл и синтезатор);
 * 4. повтор последней реплики сохранён;
 * 5. варианты ответа — после полного показа.
 */
import { readFileSync } from 'node:fs'

const root = process.cwd()
const overlay = readFileSync(`${root}/src/player/DialogueOverlay.tsx`, 'utf-8')
const f14 = readFileSync(`${root}/scripts/feedback14-smoke.mts`, 'utf-8')
const speech = readFileSync(`${root}/src/shared/speech.ts`, 'utf-8')

const checks: Array<[string, boolean]> = []

// 1) БАГ «строка выстреливает с середины/конца» — починен: typed сбрасывается
checks.push([
  'Переход к следующей строке сбрасывает набранный счётчик (баг скорости печати)',
  /setTimeout\(\(\) => \{\s*setTyped\(0\)\s*setRevealed/.test(overlay) && overlay.includes('LINE_PAUSE_MS'),
])

// 2) клик — весь оставшийся текст сразу
checks.push([
  'Клик мыши показывает весь оставшийся текст сразу (setRevealed(lines.length))',
  overlay.includes('setRevealed(lines.length)') && overlay.includes('onClick={skip}'),
])

// 3) клик прерывает озвучку: файл и синтезатор
checks.push([
  'Клик прерывает текущую озвучку (файл + синтезатор)',
  overlay.includes('audioRef.current?.pause()') && overlay.includes('stopTtsRef.current?.()'),
])

// 4) никаких кнопок пропуска — только клик по окну
checks.push([
  'Пропуск — только кликом мыши, без кнопок',
  overlay.includes('onClick={skip}') && !/skip-кнопка|skip-button|«Пропустить»/.test(overlay),
])

// 5) повтор последней реплики сохранён
checks.push(['Клик по последней реплике — прослушать повтор', overlay.includes("playLine(l, 'replay')")])

// 6) варианты после полного показа
checks.push(['Варианты ответа появляются после полного показа текста', overlay.includes('allShown')])

// 7) синтезатор: возможность прервать (cancel) сохранена
checks.push(['Синтезатор: прерывание cancel() доступно', speech.includes('stopSpeaking') || speech.includes('synth.cancel()')])

let failed = 0
for (const [name, ok] of checks) {
  if (!ok) failed++
  console.log(`${ok ? 'ok ' : 'FAIL'} ${name}`)
}
console.log(failed === 0 ? 'ALL GREEN (feedback15)' : `FAILED: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
