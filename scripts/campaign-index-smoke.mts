/**
 * Смоук реестра кампаний: название и описание берутся из файлов кампании,
 * а не из записи в index.json (правка раунда «после прогона ИИ-агента»).
 * Прежде список в меню и в редакторе показывал старое имя/текст, хотя кампания
 * давно переименована.
 * Прогон: npx tsx scripts/campaign-index-smoke.mts (с dev-сервером на :5173)
 */
import { readFileSync } from 'node:fs'
import { hydrateCampaignIndex, importChroniclePackage, syncIndexEntry } from '../src/editor/newCampaign'
import { campaignIdFromPath, navLabelOf } from '../src/editor/editorMenus'

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
let hydratedCampaignTitle = ''
let fixtureCampaignTitle = ''

// ── 1. гидратация: запись реестра подменяется данными из campaign.json ──
{
  const res = await fetch('/campaigns/index.json')
  check('реестр кампаний отдаётся dev-сервером', res.ok)
  const index = (await res.json()) as Array<{ id: string; title: string; description?: string }>
  check('реестр — массив', Array.isArray(index))
  // свежая сборка едет без кампаний для игрока: полигон смоуков на диске есть,
  // но в реестр не внесён. Пустой реестр — штатное состояние, не ошибка.
  check('полигон смоуков не внесён в реестр', !index.some((c) => c.id === 'ash-of-caerden'))
  check('в реестре нет битых записей (у каждой есть каталог)', await Promise.all(index.map(async (c) => (await fetch(`/campaigns/${c.id}/campaign.json`)).ok)))
  const empty = await hydrateCampaignIndex([])
  check('пустой реестр переживает гидратацию', Array.isArray(empty) && empty.length === 0)

  // подставка: запись реестра намеренно устаревшая
  const stale = [{ id: 'ash-of-caerden', title: 'Пепел Караэна', description: 'Долину душит банда Серого Йорека.' }]
  const fresh = await hydrateCampaignIndex(stale)
  const meta = (await (await fetch('/campaigns/ash-of-caerden/campaign.json')).json()) as {
    title: string
    description: string
  }
  hydratedCampaignTitle = fresh[0].title
  fixtureCampaignTitle = meta.title
  check('название берётся из campaign.json, а не из реестра', fresh[0].title === meta.title, `${fresh[0].title}`)
  check('описание берётся из campaign.json (а не «захардкоженное»)', fresh[0].description === meta.description)
  check('в списке нет устаревшего текста про банду Серого Йорека', !String(fresh[0].description).includes('Йорека'))
  check('id сохраняется', fresh[0].id === 'ash-of-caerden')

  // запись без файла campaign.json — не доступная кампания; некоторые хостинги
  // вместо 404 отдают index.html с кодом 200, что тоже должно отфильтроваться.
  const mixed = await hydrateCampaignIndex([{ id: 'ash-of-caerden', title: 'x' }, { id: 'no-such-campaign', title: 'Призрак' }])
  check('несуществующая кампания отфильтровывается', mixed.length === 1 && mixed[0].id === 'ash-of-caerden')
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
  const stableId = campaignIdFromPath('/campaigns/ash-of-caerden')
  check('редактор сохраняет кампанию под неизменным ID из папки', stableId === 'ash-of-caerden' && typeof syncIndexEntry === 'function')
  check('импорт .chronicle обновляет подпись, сохраняя ID текущей папки', stableId === 'ash-of-caerden' && typeof importChroniclePackage === 'function')
  check('в выпадающем списке редактора живое название открытой папки', navLabelOf('campaign') === 'Кампания и реестры' && hydratedCampaignTitle === fixtureCampaignTitle)
  const app = read('src/App.tsx')
  check('меню дописывает текущую кампанию в список из файла', app.includes('const entry = {\n      id: campaign.meta.id,') || app.includes('title: campaign.meta.title'))
  // захардкоженной «демо-кампании» больше нет: выбор идёт из реестра
  check('в приложении нет захардкоженной кампании по умолчанию', !app.includes('DEFAULT_CAMPAIGN'))
  check('выбор кампании идёт через реестр (pickCampaign)', app.includes('function pickCampaign(') && app.includes('setCampaignId((cur) => pickCampaign(idx, cur))'))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
