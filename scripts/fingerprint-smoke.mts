/**
 * Смоук отпечатка кампании: канон стабилен, поля публикации не влияют,
 * смена контента меняет подпись. Прогон: npx tsx scripts/fingerprint-smoke.mts
 */
import { campaignFingerprint, canonicalJson } from '../src/shared/fingerprint'

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const base = {
  meta: { id: 'ash-of-caerden', title: 'Пепел Каэрдена', author: 'Мастер', version: '1.2.0', attribution: { author: 'Мастер' }, series: { part: 1 } },
  scenes: { alpha: { label: 'Ворота', states: [{ id: 'day' }] }, beta: { label: 'Рынок' } },
  meta_nested: undefined,
}
const reordered = {
  scenes: { beta: { label: 'Рынок' }, alpha: { states: [{ id: 'day' }], label: 'Ворота' } },
  meta: { version: '1.2.0', author: 'Мастер', title: 'Пепел Каэрдена', id: 'ash-of-caerden', series: { part: 1 }, attribution: { author: 'Мастер' } },
}

check('канонический JSON не зависит от порядка ключей', canonicalJson(base) === canonicalJson(reordered))

const f1 = await campaignFingerprint(base)
const f2 = await campaignFingerprint(reordered)
check('отпечаток стабилен при перемешивании ключей', f1 === f2)

const thief = structuredClone(base)
thief.meta.author = 'Вася Перелив'
thief.meta.attribution = { author: 'Вася Перелив', origin_url: 'https://github.com/vasya/stolen' }
thief.meta.series = { base: 'ash-of-caerden', part: 2, label: 'Кабель у автора' }
const f3 = await campaignFingerprint(thief)
check('смена полей публикации (author/attribution/series) отпечаток НЕ меняет', f1 === f3, 'вор не «заначит» чужую кампанию сменой титула')

const changed = structuredClone(base)
changed.scenes.alpha.label = 'Успех'
const f4 = await campaignFingerprint(changed)
check('смена контента отпечаток меняет', f1 !== f4)

const missing = { meta: { id: 'x', version: '0.0.1' }, scenes: {} }
check('отпечаток считается без author/attribution вообще', /^[0-9a-f]{64}$/.test(await campaignFingerprint(missing)))

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
