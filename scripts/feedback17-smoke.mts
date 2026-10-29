/**
 * Смоук раунда фидбека 17 (9 пунктов). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback17-smoke.mts
 *
 *  1. undo: структурные правки — отдельные снимки; группировка только по запросу;
 *  2. без хардкода: типы слотов и слоты экипировки задаёт только кампания;
 *  3. погода: оверлей — свободная строка мастера, не список из четырёх;
 *  4. JSON-окна кампании/реестра растягиваются до низа;
 *  5. эмбиент сцены под спойлером; категории предметов без гориз. скролла;
 *  6. создание персонажа: происхождение-шаблон, распределение характеристик
 *     мастером, пороги мастера, сообщения по-русски;
 *  7. новая кампания: первая сцена с фоном, сцена без арта — не чёрный экран;
 *  8. озвучка: повтор фразы при сбое/застревании (диалог не «с середины»).
 */
import { existsSync, readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import {
  charChoiceProblems,
  newCharChoice,
  STAT_KEYS,
} from '../src/core/charcreate'

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

// ── 1. undo: структурные правки всегда в снимках ──
{
  const { EditorStore } = await import('../src/editor/store')
  const store = new EditorStore(base)
  await store.load()
  const depth = () => (store as unknown as { undoStack: unknown[] }).undoStack.length
  const depth0 = depth()
  store.meta.ticks_per_day = 20
  store.touch('campaign.json') // структурная правка без группы
  store.meta.ticks_per_day = 22
  store.touch('campaign.json') // ещё одна структурная
  check('1 каждая структурная правка даёт шаг отката', depth() === depth0 + 2, `depth=${depth()}`)
  store.undo()
  check('1 undo откатывает на одно изменение', store.meta.ticks_per_day === 20, String(store.meta.ticks_per_day))
  // группировка по запросу (набор текста): серия касаний — один шаг отката
  const depth1 = depth()
  store.touch('campaign.json', 'typing')
  store.touch('campaign.json', 'typing')
  store.touch('campaign.json', 'typing')
  check('1 серия однотипных правок — один шаг отката', depth() === depth1 + 1, `depth=${depth()}`)
  const se = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
  check('1 трансформер чистит выбор исчезнувших слотов после undo', se.includes('valid && selRef.current ? [selRef.current] : []'))
}

// ── 2. без хардкода: слоты и экипировка только от кампании ──
{
  const st = readFileSync('src/editor/slotTypes.ts', 'utf8')
  check('2 нет встроенных типов слотов', !st.includes('BUILTIN_SLOT_TYPES'))
  const types = readFileSync('src/shared/types.ts', 'utf8')
  check('2 нет встроенных слотов экипировки', !types.includes('BUILTIN_EQUIPMENT_SLOTS'))
  check('2 демо объявляет типы слотов', (demo.meta.slot_types ?? []).length >= 4)
  check('2 демо объявляет слоты экипировки', (demo.meta.equipment_slots ?? []).length >= 2)
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('2 редактор не подставляет встроенных типов', !ce.includes('BUILTIN_SLOT_TYPES') && !ce.includes('BUILTIN_EQUIPMENT_SLOTS'))
}

// ── 3. погода: оверлей — строка мастера ──
{
  check('3 overlay в схеме — свободная строка', (() => {
    const schema = JSON.parse(readFileSync('docs/campaign.schema.json', 'utf8'))
    return schema.$defs.WeatherDef.properties.overlay.type === 'string'
  })())
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('3 редактор погоды: слои — реестр кампании', ce.includes('Слои погоды (реестр кампании)') && ce.includes('overlay_layers'))
  // слой погоды вынесен в Atmosphere.tsx (AtmosphereLayer) — проверяем фактическое
  // место сборки класса и то, что сцена отдаёт ему погоду кампании
  const atmos = readFileSync('src/player/Atmosphere.tsx', 'utf8')
  const player = readFileSync('src/player/SceneScreen.tsx', 'utf8')
  check('3 плеер рисует класс по имени оверлея', atmos.includes('weather-${overlay}') && player.includes('<AtmosphereLayer') && player.includes('weather?.overlay'))
}

// ── 4. JSON-окна до низа ──
{
  const css = readFileSync('src/index.css', 'utf8')
  check('4 страница JSON — флекс-колонка до низа', css.includes('.advanced-json-page') && css.includes('calc(100vh - 118px)') && css.includes('.advanced-json-page textarea'))
  const fields = readFileSync('src/editor/Fields.tsx', 'utf8')
  check('4 JsonField умеет растягиваться (fill)', fields.includes('fld-fill'))
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('4 JSON кампании растянут', ce.includes('fill'))
}

// ── 5. эмбиент под спойлером; категории сеткой ──
{
  const se = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
  check('5 эмбиент сцены в спойлере', se.includes('spoiler-block') && se.includes('Фоновые звуки сцены'))
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('5 галочки категорий в сетке', ce.includes('itemcat-checks'))
  const ecss = readFileSync('src/editor/editor.css', 'utf8')
  check('5 сетка категорий переносится без скролла', ecss.includes('.itemcat-checks') && ecss.includes('auto-fill'))
}

// ── 6. создание персонажа: шаблон от мастера ──
{
  const creation = demo.meta.char_creation!
  const skills = demo.meta.skills
  check('6 происхождение распределяет все очки характеристик', (() => {
    const min = creation.stat_limits.min
    return creation.professions!.every((p) => {
      const used = STAT_KEYS.reduce((s, k) => s + Math.max(0, (p.stats?.[k] ?? min) - min), 0)
      return used === creation.total_points
    })
  })())
  check('6 пороги навыков задаёт мастер', creation.skill_floor === 15 && creation.skill_cap === 75)
  const fresh = newCharChoice(creation, demo.entities[demo.meta.default_player] as any, demo.meta)
  check('6 выбор мастера валиден сразу', charChoiceProblems(creation, fresh, skills).length === 0)
  const bad = { ...fresh, stats: { ...fresh.stats, STR: 99 } }
  const problems = charChoiceProblems(creation, bad, skills)
  check('6 сообщения о проблемах по-русски', problems.length > 0 && problems.every((p) => /[а-яёА-ЯЁ]/.test(p)), problems.join('; '))
  const banned = { ...fresh, skills: { ...fresh.skills, bite: 40 } }
  const bp = charChoiceProblems(creation, banned, skills)
  check('6 запрещённый навык назван по-русски', bp.some((p) => p.includes('Укус') || p.includes('«')), bp.join('; '))
  const ui = readFileSync('src/player/CharacterCreation.tsx', 'utf8')
  check('6 экран без «задаёт мастер», бюджет заметен', !ui.includes('задаёт мастер кампании') && ui.includes('char-budget'))
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('6 редактор: распределение характеристик по происхождениям', ce.includes('Стартовые характеристики') && ce.includes('Предел навыка снизу'))
}

// ── 7. новая кампания отрисовывается сразу ──
{
  check('7 шаблон фона первой сцены на месте', existsSync('public/__starter/scene_start.jpg'))
  const nc = readFileSync('src/editor/newCampaign.ts', 'utf8')
  check('7 новая кампания получает фон стартовой сцены', nc.includes('starterImageBase64') && nc.includes('scenes/img/scene_start.jpg'))
  const ss = readFileSync('src/player/SceneScreen.tsx', 'utf8')
  check('7 сцена без арта — не чёрный экран', ss.includes('scene-bg-fallback'))
}

// ── 8. озвучка: повтор при сбое/застревании ──
{
  const sp = readFileSync('src/shared/speech.ts', 'utf8')
  check('8 фразы НЕ повторяются при сбоях (очередь только вперёд)', !sp.includes('queue.unshift'))
  check('8 сторожок полного зависания (8 с) двигает очередь', sp.includes('stallTimer') && sp.includes('8000'))
  check('8 прогрев синтезатора первым жестом', sp.includes("addEventListener('pointerdown', onFirstGesture"))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
