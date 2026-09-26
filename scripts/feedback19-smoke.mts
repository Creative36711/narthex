/**
 * Смоук раунда фидбека 19. Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback19-smoke.mts
 *
 *  1. в реестре слоёв погоды нет английских id в скобках;
 *  2. новый слой — мастер задаёт только название, id скрыт и автогенерируется;
 *  3. слой добавляется простой кнопкой «+ слой», а не селектом-в-селекте;
 *  4. все списки-селекты редактора — в алфавитном порядке;
 *  5. эффект «Показать сообщение»: портрет берётся из персонажа или грузится
 *     картинкой — никакого ручного ввода пути;
 *  6. создание героя: нет «(задаёт мастер)», остаток очков заметен, хардкор
 *     (старт с недотраченными очками) разрешён, но предупреждает;
 *  7. второй шаблон «Призвание» (стартовые навыки): мастер распределяет ВЕСЬ
 *     бюджет навыков, игрок может убавлять;
 *  8. навыки игроку — только из json кампании, никакого хардкода движка;
 *  9. озвучка: никакого повтора фраз (очередь строго вперёд);
 * 10. сцена заполняет остаток экрана без вертикальной прокрутки.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { allSkillIds, newCharChoice, withCalling, skillPointsUsed, skillMinVal, type CharChoice } from '../src/core/charcreate'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const demo = await loadCampaign(base)
const f = (p: string) => readFileSync(p, 'utf8')

// ── 1–3. реестр слоёв погоды ──
{
  const ce = f('src/editor/CampaignEditor.tsx')
  // 1: в списке слоёв не показывают английские id в скобках
  check('1 в списке слоёв нет «(id)»', !/\{\s*w\.id\s*\}/.test(ce.split('+ слой погоды')[0].slice(-4000) || ce))
  // 2: добавление идёт через askText + makeId, мастер id не вводит
  check('2 id слоя генерируется автоматически', ce.includes("makeId('overlay_'"))
  // 3: обычная кнопка, не селект внутри селекта
  check('3 слой добавляется кнопкой «+ слой погоды»', ce.includes('+ слой погоды'))
  // сама кампания: слои названы по-русски
  const layers = demo.meta.overlay_layers ?? []
  check('1–3 слои кампании названы по-русски', layers.length > 0 && layers.every((l: any) => /[а-яёА-ЯЁ]/.test(l.label || '')))
}

// ── 4. алфавитные селекты ──
{
  const fields = f('src/editor/Fields.tsx')
  check('4 типы условий сортируются по алфавиту', fields.includes('CONDITION_SCHEMAS[a].label.localeCompare'))
  check('4 типы эффектов сортируются по алфавиту', fields.includes('EFFECT_SCHEMAS[a].label.localeCompare'))
  const store = f('src/editor/store.ts')
  check('4 списки из реестров сортируются по алфавиту', store.includes('localeCompare'))
}

// ── 5. портрет сообщения без ручного пути ──
{
  const schemas = f('src/editor/schemas.ts')
  const fields = f('src/editor/Fields.tsx')
  check('5 поле портрета — пикер, не строка пути', schemas.includes("'portraitPick'"))
  check('5 пикер портрета существует', fields.includes('function PortraitPick'))
  check('5 пикер берёт портрет персонажа или грузит файл', fields.includes('Портрет персонажа') && fields.includes('ImageUpload'))
}

// ── 6. экран создания: бюджет заметен, без «задаёт мастер» ──
{
  const ui = f('src/player/CharacterCreation.tsx')
  check('6 нет пометки «задаёт мастер кампании»', !ui.includes('задаёт мастер кампании'))
  check('6 остаток очков выделен отдельно', ui.includes('char-budget'))
  check('6 хардкор-старт предупреждает', ui.includes('хардкор'))
}

// ── 7. призвание: второй шаблон стартовых навыков ──
{
  const creation = demo.meta.char_creation!
  check('7 у кампании есть призвания', (creation.callings ?? []).length >= 2)
  // мастер распределяет ВЕСЬ бюджет навыков в каждом призвании
  const budget = creation.skill_points ?? 0
  const floorOf = (id: string) =>
    Math.max(creation.skill_floor ?? 0, (creation.mandatory_skills ?? []).includes(id) ? 25 : 0)
  check('7 каждое призвание тратит весь бюджет навыков', (creation.callings ?? []).every((c: any) => {
    const spent = Object.entries(c.skills).reduce((t, [id, v]) => t + Math.max(0, (v as number) - floorOf(id)), 0)
    return spent === budget
  }))
  // при выборе призвания навыки расставляются мастером
  const template = demo.entities[demo.meta.default_player] as any
  const choice = newCharChoice(creation, template, demo.meta)
  check('7 старт берёт первое призвание', choice.calling === (creation.callings ?? [])[0]?.id)
  const second = (creation.callings ?? [])[1]?.id
  const swapped = withCalling(creation, choice, second)
  check('7 смена призвания меняет навыки', swapped.calling === second)
  // игрок может убавить навык (хардкор) — потрачено станет меньше бюджета
  const withPurchase = Object.keys(swapped.skills).find((id) => swapped.skills[id] > skillMinVal(creation, swapped, id))
  check('7 у призвания есть вложения выше порога', !!withPurchase)
  const reduced: CharChoice = withPurchase
    ? { ...swapped, skills: { ...swapped.skills, [withPurchase]: swapped.skills[withPurchase] - 5 } }
    : swapped
  check('7 игрок может убавить навык', skillPointsUsed(creation, reduced) < skillPointsUsed(creation, swapped))
  const cc = f('src/editor/CampaignEditor.tsx')
  check('7 редактор показывает распределение бюджета навыков', cc.includes('Распределено навыков'))
}

// ── 8. навыки — только из json кампании ──
{
  const cc = f('src/core/charcreate.ts')
  check('8 allSkillIds не подмешивает встроенные навыки', !cc.includes('BUILTIN_SKILL_LABELS'))
  const fromRegistry = allSkillIds(demo.meta).map((s) => s.id)
  const registry = (demo.meta.skills ?? []).map((s: any) => s.id)
  check('8 список навыков игрока = реестр кампании', fromRegistry.every((id) => registry.includes(id)))
}

// ── 9. озвучка: без повторов ──
{
  const sp = f('src/shared/speech.ts')
  check('9 очередь озвучки строго вперёд', !sp.includes('queue.unshift'))
  check('9 нет механизма повтора при тишине', !sp.includes('MAX_RETRIES') && !/retryItem/.test(sp))
  check('9 зависший синтезатор просто пропускается', sp.includes('synth.cancel') && sp.includes('8000'))
}

// ── 10. сцена без вертикальной прокрутки ──
{
  const css = f('src/index.css')
  const ss = f('src/player/SceneScreen.tsx')
  check('10 сцена растягивается на остаток высоты', /\.scene-stage[^{]*\{[^}]*flex:\s*1/.test(css) || /\.scene-stage[^{]*\{[^}]*flex:1/.test(css))
  check('10 сцена не задаёт фиксированную высоту', !/height:\s*\d+vh/.test(ss))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
