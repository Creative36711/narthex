/**
 * Смоук раунда фидбека 21. Запуск: npx tsx scripts/feedback21-smoke.mts
 *
 * Озвучка диалогов — по образцу катсцен: одна фраза за раз, темп диалога
 * ведёт окончание озвучки (а не таймер печати), поэтому голос не «отстаёт»
 * и не стартует с середины разговора.
 */
import { readFileSync } from 'node:fs'
import { speechCompletionTimeoutMs } from '../src/shared/speechTiming'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')

const dlg = f('src/player/DialogueOverlay.tsx')
const cs = f('src/shared/CutscenePlayer.tsx')
const speech = f('src/shared/speech.ts')

// диалог больше не копит фразы в очереди — одна за раз, как в катсцене
check('диалог не использует очередь фраз', !dlg.includes('queue: true'))
check('реплика озвучивается одной фразой со сбросом очереди', dlg.includes('stopTtsRef.current = speak('))
// темп ведёт озвучка: следующая реплика — только после конца голоса
check('переход к следующей реплике ждёт окончания озвучки', /typed < full\.length \|\| !lineDone/.test(dlg))
check('озвучка сообщает об окончании через onEnd', /onEnd: done/.test(dlg))
// Короткая страховка остаётся для аудиофайлов; TTS управляется onEnd и отдельным watchdog.
const ttsBranch = dlg.slice(dlg.indexOf('else if (settings.tts_enabled'))
check('страховочный таймер не обрывает TTS-реплики', dlg.indexOf('fallbackReadMs(line.text)') < dlg.indexOf('else if (settings.tts_enabled') && !ttsBranch.slice(0, ttsBranch.indexOf('} else {')).includes('fallbackReadMs'))
check('длинные и медленные реплики получают больший watchdog',
  speechCompletionTimeoutMs('Одна фраза.', 0.5) < speechCompletionTimeoutMs('Длинная реплика '.repeat(20), 1))
check('таймаут старта не обрезает уже звучащую или ожидающую фразу',
  speech.includes('synth.speaking || synth.pending') && speech.includes('armCompletionWatchdog(item, synth)'))
// катсцена дожидается и минимальной длительности, и окончания озвучки
check('катсцена ждёт onEnd и заданную длительность', cs.includes('onEnd: () => finishVoice(600)') && cs.includes('!minimumElapsed || !voiceComplete'))
// клик по окну прерывает озвучку и показывает весь текст
check('клик пропускает текст и глушит звук', dlg.includes('clearLineAudio()') && dlg.includes('setRevealed(lines.length)'))

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
