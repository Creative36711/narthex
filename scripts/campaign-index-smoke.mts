/**
 * Смоук реестра кампаний: название и описание берутся из файлов кампании,
 * а не из записи в index.json (правка раунда «после прогона ИИ-агента»).
 * Прежде список в меню и в редакторе показывал старое имя/текст, хотя кампания
 * давно переименована.
 * Прогон: npx tsx scripts/campaign-index-smoke.mts (с dev-сервером на :5173)
 */
import { readFileSync } from 'node:fs'
import { hydrateCampaignIndex } from '../src/editor/newCampaign'

// в Node нет базового адреса: ведём относительные пути на dev-сервер, чтобы
// проверять настоящую функцию, а не её копию
const ORIGIN = 'http://localhost:5173'
const realFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? ORIGIN + input : input, init)) as typeof fetch

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const read = (p: string) => readFileSync(p, 'utf8')

// ── 1. гидратация: запись реестра подменяется данными из campaign.json ──
{
  const res = await fetch('/campaigns/index.json')
  check('реестр кампаний отдаётся dev-сервером', res.ok)
  const index = (await res.json()) as Array<{ id: string; title: string; description?: string }>
  check('реестр не пуст', index.length > 0)

  // подставка: запись реестра намеренно устаревшая
  const stale = [{ id: 'ash-of-caerden', title: 'Пепел Караэна', description: 'Долину душит банда Серого Йорека.' }]
  const fresh = await hydrateCampaignIndex(stale)
  const meta = (await (await fetch('/campaigns/ash-of-caerden/campaign.json')).json()) as {
    title: string
    description: string
  }
  check('название берётся из campaign.json, а не из реестра', fresh[0].title === meta.title, `${fresh[0].title}`)
  check('описание берётся из campaign.json (а не «захардкоженное»)', fresh[0].description === meta.description)
  check('в списке нет устаревшего текста про банду Серого Йорека', !String(fresh[0].description).includes('Йорека'))
  check('id сохраняется', fresh[0].id === 'ash-of-caerden')

  // несуществующая кампания не ломает реестр
  const mixed = await hydrateCampaignIndex([{ id: 'ash-of-caerden', title: 'x' }, { id: 'no-such-campaign', title: 'Призрак' }])
  check('несуществующая кампания не роняет реестр', mixed.length === 2 && mixed[1].title === 'Призрак')
}

// ── 2. создание кампании пишет описание в реестр ──
{
  const nc = read('src/editor/newCampaign.ts')
  check('новая кампания кладёт описание в реестр', /index\.push\(\{ id, title, author, description: meta\.description \}\)/.test(nc))
  check('есть функция долива строки реестра', nc.includes('export async function syncIndexEntry'))
  check('описание новой кампании не пустое', read('src/editor/newCampaign.ts').includes("description: 'Новая кампания."))
}

// ── 3. редактор и меню обновляют список сами ──
{
  const ed = read('src/editor/EditorApp.tsx')
  check('редактор обновляет реестр после сохранения', /await store\.saveToDisk\(\)\s*\n\s*\/\/[\s\S]{0,160}?await pushIndex\(\)/.test(ed))
  check('редактор обновляет реестр после импорта .chronicle', ed.includes('await pushIndex()'))
  check('в выпадающем списке редактора живое название открытой кампании', ed.includes('c.id === store.meta.id ? store.meta.title : c.title'))
  const app = read('src/App.tsx')
  check('меню дописывает текущую кампанию в список из файла', app.includes('const entry = {\n      id: campaign.meta.id,') || app.includes('title: campaign.meta.title'))
  check('запасное название вынесено в константу с комментарием', app.includes('DEFAULT_CAMPAIGN_TITLE'))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
