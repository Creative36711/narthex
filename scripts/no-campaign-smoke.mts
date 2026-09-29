/**
 * Смоук «кампаний нет»: движок обязан работать с пустым реестром.
 *
 * Демо-кампания убрана из поставки — публичный реестр campaigns/index.json
 * пуст, а полигон ash-of-caerden лежит на диске только для смоуков. Проверяем
 * контракт целиком: игрок не видит полигон, пустой реестр не ломает ни меню,
 * ни редактор, и удалить можно всё содержимое реестра.
 *
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/no-campaign-smoke.mts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createCampaign, fetchCampaignIndex } from '../src/editor/newCampaign'

// в Node нет базового адреса: ведём относительные пути на dev-сервер, чтобы
// проверять настоящий код реестра, а не его копию
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

// ── 1. поставка: полигон есть, но игроку не предложен ────────────────
{
  const index = JSON.parse(read('public/campaigns/index.json')) as Array<{ id: string }>
  check('реестр поставки — массив', Array.isArray(index))
  check('реестр поставки пуст (игроку нечего играть)', index.length === 0)
  const dirs = readdirSync('public/campaigns', { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  check('полигон смоуков на месте', dirs.includes('ash-of-caerden'), dirs.join(', '))
  check('полигон не внесён в реестр', !index.some((c) => c.id === 'ash-of-caerden'))
  check('полигон помечен как полигон (smoke-fixture.json)', existsSync('public/campaigns/ash-of-caerden/smoke-fixture.json'))
}

// ── 2. полигон лёгкий: картинок нет, тексты и правила на месте ───────
{
  const base = 'public/campaigns/ash-of-caerden'
  const big: string[] = []
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (statSync(p).size > 200_000) big.push(`${p} (${Math.round(statSync(p).size / 1024)} КБ)`)
    }
  }
  walk(base)
  check('в полигоне нет тяжёлых файлов', big.length === 0, big.join(', '))
  check('картинки из полигона удалены', !existsSync(join(base, 'assets/img')))
  // ссылки на картинки в JSON остались: проверки путей и подстановки картинок
  // в смоуках должны работать и на файлах, которых нет
  const meta = read(join(base, 'campaign.json'))
  check('ссылки на картинки в данных остались (проверки путей живы)', /assets\/img\//.test(meta) || /assets\/img\//.test(read(join(base, 'entities/npc_maeva.json'))))
  check('движок и редактор целы', existsSync('src/core/engine.ts') && existsSync('src/editor/EditorApp.tsx'))
}

// ── 3. приложение: пустой реестр = экран «Кампаний пока нет» ────────
{
  const app = read('src/App.tsx')
  check('нет захардкоженной кампании по умолчанию', !/DEFAULT_CAMPAIGN/.test(app))
  check('выбор кампании идёт из реестра', app.includes('function pickCampaign('))
  check('пустой реестр не грузит несуществующий путь', app.includes('if (!campaignId) return'))
  check('показан экран «Кампаний пока нет»', app.includes('<NoCampaignScreen') && existsSync('src/player/NoCampaignScreen.tsx'))
  const screen = read('src/player/NoCampaignScreen.tsx')
  check('экран предлагает создать кампанию', screen.includes('Создать кампанию'))
  check('экран предлагает импорт .chronicle', screen.includes('.chronicle') && screen.includes('importChroniclePackage'))
  check('экран не показывает «Новый забег» без кампании', !screen.includes('Новый забег'))
  check('реестр ждёт загрузки, а не мигает пустотой', app.includes('indexReady'))
  check('битые кампании не гоняют друг друга по кругу', app.includes('const broken = useRef<Set<string>>') && app.includes('campaigns.find((c) => !broken.current.has(c.id))'))
  check('из ошибки загрузки есть выход (пересканировать/редактор)', app.includes('Пересканировать кампании') && app.includes('Открыть редактор'))
}

// ── 4. редактор: без кампании он остаётся рабочим ───────────────────
{
  const ed = read('src/editor/EditorApp.tsx')
  check('пустой путь не грузит стор', ed.includes("if (!base) {"))
  check('редактор показывает экран «Кампаний пока нет»', ed.includes('Кампаний пока нет'))
  check('из экрана можно создать кампанию', ed.includes('<button className="btn btn-primary" onClick={() => void newCampaign()}'))
  check('удаление последней кампании не строит путь в никуда', ed.includes("setBase(next.length ? `/campaigns/${next[0].id}` : '')"))
  check('создание кампании работает и при пустом реестре', read('src/editor/newCampaign.ts').includes('index.push({ id, title, author, description: meta.description })'))
}

// ── 5. живая проверка: пустой реестр, создание, откат ────────────────
{
  const idx = await fetchCampaignIndex()
  check('fetchCampaignIndex отдаёт пустой массив', Array.isArray(idx) && idx.length === 0, JSON.stringify(idx))

  // создаём кампанию через настоящий код и сразу убираем её обратно
  const id = await createCampaign('Пробная пустая долина', 'Смоук')
  try {
    const after = await fetchCampaignIndex()
    check('созданная кампания попала в реестр', after.some((c) => c.id === id), after.map((c) => c.id).join(', '))
    const res = await fetch(`/campaigns/${id}/campaign.json`)
    check('файлы новой кампании отдаются dev-сервером', res.ok)
    check('фон стартовой сцены подставлен', (await fetch(`/campaigns/${id}/scenes/img/scene_start.jpg`)).ok)
  } finally {
    // возврат к пустому реестру: папку сносит dev-эндпоинт, запись — перезапись
    await fetch('/__editor/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: id }),
    }).catch(() => null)
    await fetch('/__editor/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'campaigns/index.json', text: '[]\n' }),
    }).catch(() => null)
  }
  const restored = await fetchCampaignIndex()
  check('после уборки реестр снова пуст', restored.length === 0, restored.map((c) => c.id).join(', '))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
