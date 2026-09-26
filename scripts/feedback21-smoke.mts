/**
 * Смоук раунда фидбека 21. Запуск: npx tsx scripts/feedback21-smoke.mts
 *
 * Озвучка диалогов — по образцу катсцен: одна фраза за раз, темп диалога
 * ведёт окончание озвучки (а не таймер печати), поэтому голос не «отстаёт»
 * и не стартует с середины разговора.
 */
import { readFileSync } from 'node:fs'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')

const dlg = f('src/player/DialogueOverlay.tsx')
const cs = f('src/shared/CutscenePlayer.tsx')

// диалог больше не копит фразы в очереди — одна за раз, как в катсцене
check('диалог не использует очередь фраз', !dlg.includes('queue: true'))
check('реплика озвучивается одной фразой со сбросом очереди', dlg.includes('stopTtsRef.current = speak('))
// темп ведёт озвучка: следующая реплика — только после конца голоса
check('переход к следующей реплике ждёт окончания озвучки', /typed < full\.length \|\| !lineDone/.test(dlg))
check('озвучка сообщает об окончании через onEnd', /onEnd: done/.test(dlg))
// страховка от «немого» синтезатора — диалог не зависнет
check('страховочный таймер против немого синтеза', dlg.includes('fallbackReadMs'))
// катсцена осталась при своём подходе (не сломали образец)
check('катсцена по-прежнему ведёт темп по onEnd', cs.includes('onEnd: () => after(600)'))
// клик по окну прерывает озвучку и показывает весь текст
check('клик пропускает текст и глушит звук', dlg.includes('clearLineAudio()') && dlg.includes('setRevealed(lines.length)'))

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
