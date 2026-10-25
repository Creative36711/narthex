/**
 * Смоук блока 9 ТЗ «Гибкий движок» — календарь и погода.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz9-weather-smoke.mts
 *
 *  1. календарь: граничные тики (полночь, конец месяца, конец года), строка даты;
 *  2. погода: set_weather меняет состояние, '' — ясно; условие weather_is в правиле;
 *  3. демо: правила погоды горят при входе в локацию;
 *  4. монолог/диалог/редактор: зеркала и формы;
 *  5. монолит: экспорт/импорт календаря и реестра погод; схема.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { tickToDate, formatDate } from '../src/core/time'
import type { CampaignData, RuleDef } from '../src/shared/types'

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
const meta = demo.meta
const TPD = meta.ticks_per_day // 24
const DPM = meta.calendar!.days_per_month! // 30

// ── 1. календарь: граничные тики ──
{
  const d0 = tickToDate(meta, 0)
  check('1 старт: 1-й день первого месяца', d0.day === 1 && d0.monthIndex === 0 && d0.year === 137)
  check('1 старт: имя месяца и дня недели', d0.monthName === 'Углемес' && d0.dayName === 'Пепельник')

  // полночь: ровно начало второго дня
  const dMid = tickToDate(meta, TPD)
  check('1 полночь: новый день', dMid.day === 2 && dMid.dayName === 'Кузнецов')

  // последний тик первого месяца и первый тик второго
  const dEnd = tickToDate(meta, TPD * DPM - 1)
  check('1 конец месяца: 30-й день Углемеса', dEnd.day === DPM && dEnd.monthIndex === 0)
  const dNext = tickToDate(meta, TPD * DPM)
  check('1 конец месяца: переход на 1-е Гарева', dNext.day === 1 && dNext.monthIndex === 1 && dNext.monthName === 'Гаревей')

  // граница года: 12 месяцев по 30 дней
  const yLen = DPM * meta.calendar!.months!.length
  const dYEnd = tickToDate(meta, TPD * (yLen - 1))
  check('1 конец года: 30 Жатвеня', dYEnd.day === DPM && dYEnd.monthName === 'Жатвень' && dYEnd.year === 137)
  const dYNew = tickToDate(meta, TPD * yLen)
  check('1 конец года: новый год', dYNew.day === 1 && dYNew.monthIndex === 0 && dYNew.year === 138)

  const line = formatDate(meta, 0)
  check('1 строка даты с летоисчислением', line === '1 Углемес, Пепельник, 137-й год Пепла', line)
}

// ── 2. set_weather и условие weather_is ──
{
  const c: CampaignData = JSON.parse(JSON.stringify(demo))
  const rule: RuleDef = {
    id: 'rule_smoke_weather',
    label: 'смоук',
    once: false,
    conditions: [{ type: 'weather_is', weather: 'weather_thick_fog' }],
    effects: [{ type: 'set_flag', flag: 'smoke_fog_flag' }],
  }
  c.rules[rule.id] = rule
  const e = new GameEngine(c)
  e.start()
  check('2 старт: погоды нет (ясно)', (e.state.weather ?? '') === '')
  e.checkRules()
  check('2 правило не горит без тумана', !e.state.flags['smoke_fog_flag'])

  e.applyEffects([{ type: 'set_weather', weather: 'weather_thick_fog' }])
  check('2 set_weather меняет состояние', e.state.weather === 'weather_thick_fog')
  e.checkRules()
  check('2 weather_is срабатывает в правиле', !!e.state.flags['smoke_fog_flag'])

  e.applyEffects([{ type: 'set_weather', weather: '' }])
  check('2 пустой id — снова ясно', (e.state.weather ?? '') === '')
  check('2 журнал фиксирует смену погоды', e.state.log.some((l) => l.includes('Густой туман')) && e.state.log.some((l) => l.includes('проясняется')))
}

// ── 3. демо: правила погоды горят при входе в локацию ──
{
  const e = new GameEngine(demo)
  e.start()
  e.travelTo('loc_forest')
  check('3 опушка: пеплопад по правилу', e.state.weather === 'weather_ashfall')
  e.travelTo('loc_ravine')
  check('3 балка: дождь по правилу', e.state.weather === 'weather_cold_rain')
  check('3 HUD-строка погоды известна', (meta.weathers ?? []).some((w) => w.id === 'weather_cold_rain' && w.label === 'Холодный дождь'))
}

// ── 4. зеркала и редактор ──
{
  const { condInk, generateInk } = await import('../src/editor/dialogueDoc')
  check('4 диалог: условие погоды в ink', condInk({ type: 'weather_is', weather: 'weather_thick_fog' } as never) === 'weather_is("weather_thick_fog")')
  const ink = generateInk({
    version: 2,
    label: 'смоук погоды',
    nodes: [{
      id: 'n1',
      label: 'тест',
      choices: [],
      sections: [{ steps: [{ kind: 'effect', effect: { type: 'set_weather', weather: 'weather_cold_rain' } }] }],
    }],
  } as never)
  check('4 диалог: эффект погоды в ink', ink.includes('~ set_weather("weather_cold_rain")'))
  const ext = readFileSync('src/core/dialogue.ts', 'utf8')
  check('4 externals: weather_is и set_weather привязаны', ext.includes("bind('weather_is'") && ext.includes("bind('set_weather'"))

  const hud = readFileSync('src/player/HUD.tsx', 'utf8')
  check('4 HUD: строка даты под часами', hud.includes('hud-date') && hud.includes('formatDate'))
  check('4 HUD: метка погоды', hud.includes('hud-weather'))
  const scene = readFileSync('src/player/SceneScreen.tsx', 'utf8')
  // слой погоды рисует AtmosphereLayer (src/player/Atmosphere.tsx): сцена отдаёт
  // ему имя оверлея из реестра, класс собирается уже там
  const atmos = readFileSync('src/player/Atmosphere.tsx', 'utf8')
  check('4 сцена: слой погоды', scene.includes('<AtmosphereLayer') && scene.includes('weather?.overlay') && atmos.includes('weather-overlay'))
  const css = readFileSync('src/index.css', 'utf8')
  check('4 CSS: четыре оверлея', css.includes('.weather-rain') && css.includes('.weather-snow') && css.includes('.weather-fog') && css.includes('.weather-ash'))
  check('4 CSS: оверлеи не ловят клики', /\.weather-overlay[^}]*pointer-events: none/.test(css))

  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('4 редактор: формы календаря', ce.includes('Дней в месяце') && ce.includes('Месяцы (через запятую)') && ce.includes('Дни недели'))
  check('4 редактор: реестр погод', ce.includes('+ погода') && ce.includes('Зацикленные звуки погоды'))
  const schemas = readFileSync('src/editor/schemas.ts', 'utf8')
  check('4 схемы: set_weather и weather_is', schemas.includes('set_weather:') && schemas.includes('weather_is:') && schemas.includes('weatherRef'))
}

// ── 5. монолит и схема ──
{
  const { EditorStore } = await import('../src/editor/store')
  const { exportMonolith, importMonolith, parseMonolith } = await import('../src/editor/monolith')
  const store = new EditorStore(base)
  await store.load()
  store.meta.calendar = { year_label: 'тестовая эра', start_year: 5, days_per_month: 8, months: ['А', 'Б'], day_names: ['Х'] }
  store.meta.weathers = [{ id: 'weather_test', label: 'Тестовая вьюга', overlay: 'snow', ambient: [] }]
  store.touch('campaign.json')
  const { doc } = exportMonolith(store)
  check('5 экспорт: календарь в монолите', doc.campaign.calendar?.year_label === 'тестовая эра' && doc.campaign.calendar?.months?.join() === 'А,Б')
  check('5 экспорт: погоды в монолите', doc.campaign.weathers?.[0]?.id === 'weather_test' && doc.campaign.weathers?.[0]?.overlay === 'snow')

  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parseMonolith(JSON.stringify(doc)))
  check('5 импорт: календарь возвращается', store2.meta.calendar?.days_per_month === 8 && store2.meta.calendar?.day_names?.[0] === 'Х')
  check('5 импорт: погоды возвращаются', store2.meta.weathers?.[0]?.label === 'Тестовая вьюга')
  check('5 погода видна в опциях редактора', store2.options('weather').some((o) => o.id === 'weather_test'))

  const schema = readFileSync('docs/campaign.schema.json', 'utf8')
  check('5 схема знает календарь и погоду', schema.includes('WeatherDef') && schema.includes('days_per_month') && schema.includes('year_label'))
}

console.log(failed ? `\n${failed} ПРОВАЛОВ` : '\nВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ')
process.exit(failed ? 1 : 0)
