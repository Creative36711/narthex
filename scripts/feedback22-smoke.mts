/**
 * Смоук раунда фидбека 22. Запуск: npx tsx scripts/feedback22-smoke.mts
 *
 * Баг: после выбора ответа движок заменяет `dialogue` новым объектом (только
 * новые строки). Сброс `revealed` в useEffect происходил ПОСЛЕ коммита, и в
 * промежуточном рендере `current = lines[старый revealed]` указывал в середину
 * нового списка — озвучка стартовала со средней фразы («Если ищешь монету…»),
 * а первые строки ответа («Неспокойно — мягко сказано», «Банда с холмов…»)
 * молча пропускались.
 *
 * Фикс: сброс состояния СИНХРОННО в фазе рендера (паттерн «корректировка
 * состояния при рендере») — коммит уже видит revealed=0 и озвучка идёт с
 * первой фразы ответа.
 */
import { readFileSync } from 'node:fs'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')
const dlg = f('src/player/DialogueOverlay.tsx')

// сброс происходит в фазе рендера, а не в пост-коммитном useEffect
check('сброс диалога — синхронно в рендере (сравнение ссылки)', dlg.includes('lastDRef.current !== d'))
check('при смене диалога озвучка глушится до новой фразы', /lastDRef\.current = d[\s\S]{0,220}clearLineAudio\(\)/.test(dlg))
check('старый пост-коммитный сброс состояний удалён', !/useEffect\(\(\) => \{\s*setRevealed\(0\)/.test(dlg))
// защита от повторного озвучивания той же строки осталась
check('защита от двойного озвучивания — идемпотентный эффект с уборкой', /return \(\) => clearLineAudio\(\)/.test(dlg))
// темп по-прежнему ведёт голос (катсценный подход, фидбек 21)
check('темп диалога ведёт озвучка', /typed < full\.length \|\| !lineDone/.test(dlg))

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
