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
import { createCampaign, fetchCampaignIndex, hydrateCampaignIndex, syncIndexEntry } from '../src/editor/newCampaign'
import { makeId } from '../src/editor/ids'
import { importMonolith, exportMonolith } from '../src/editor/monolith'
import { EditorStore } from '../src/editor/store'
import { loadCampaign } from '../src/core/loader'

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
  check('первое нажатие создаёт кампанию и открывает её в редакторе', screen.includes('onCreate: () => Promise<void>') && app.includes('onCreate={createFirstCampaign}') && app.includes("window.location.hash = '#editor'"))
  check('экран предлагает загрузить .chronicle', screen.includes('Загрузить кампанию') && screen.includes('.chronicle') && screen.includes('importChroniclePackage'))
  check('экран не показывает «Новый забег» без кампании', !screen.includes('Новый забег'))
  check('ошибка загрузки всех пакетов ведёт на экран импорта', app.includes('setCampaignId(null)') && app.includes('Не удалось загрузить файлы кампании'))
  check('реестр фильтрует отсутствующие/HTML-кампании', read('src/editor/newCampaign.ts').includes('if (!res.ok) return null') && read('src/editor/newCampaign.ts').includes('return hydrated.filter'))
  check('реестр ждёт загрузки, а не мигает пустотой', app.includes('indexReady'))
  check('битые кампании не гоняют друг друга по кругу', app.includes('const broken = useRef<Set<string>>') && app.includes('campaigns.find((c) => !broken.current.has(c.id))'))
  check('из ошибки загрузки есть выход (пересканировать/редактор)', app.includes('Пересканировать кампании') && app.includes('Открыть редактор'))
}

// ── 4. редактор: без кампании он остаётся рабочим ───────────────────
{
  const ed = read('src/editor/EditorApp.tsx')
  check('пустой путь не грузит стор', ed.includes("if (!base) {"))
  check('редактор показывает экран «Кампаний пока нет»', ed.includes('Кампаний пока нет'))
  check('из пустого редактора можно создать кампанию', ed.includes('<button className="btn btn-primary" onClick={() => void newCampaign()}'))
  check('из пустого редактора можно импортировать JSON', ed.includes('onClick={() => void doImportJson()}') && ed.includes('Импортировать JSON'))
  check('импорт обновляет или добавляет название кампании в селектор', ed.includes('const i = list.findIndex((item) => item.id === entry.id)') && ed.includes('next[i] = entry'))
  check('после JSON из пустого редактора файлы сохраняются до регистрации', ed.includes('await store.saveToDisk()') && ed.includes('await pushIndex()') && ed.includes('setBase(`/campaigns/${id}`)'))
  check('импорт в пакет сохраняет id его каталога', read('src/editor/monolith.ts').includes('const destinationId = store.meta.id'))
  check('удаление последней кампании не строит путь в никуда', ed.includes("setBase(next.length ? `/campaigns/${next[0].id}` : '')"))
  check('создание кампании работает и при пустом реестре', read('src/editor/newCampaign.ts').includes('index.push({ id, title, author, description: meta.description })'))
}

// ── 5. живая проверка: пустой реестр, JSON-импорт, регистрация ───────
{
  const idx = await fetchCampaignIndex()
  check('fetchCampaignIndex отдаёт пустой массив', Array.isArray(idx) && idx.length === 0, JSON.stringify(idx))
  const missing = await hydrateCampaignIndex([{ id: 'no-such-campaign', title: 'Призрак' }])
  check('отсутствующая кампания не считается доступной', missing.length === 0)

  // Создаём пакет назначения, затем импортируем JSON с чужим id и новым названием.
  const id = await createCampaign('Пробная пустая долина', 'Смоук')
  let directId: string | undefined
  try {
    const after = await fetchCampaignIndex()
    check('созданная кампания попала в реестр', after.some((c) => c.id === id), after.map((c) => c.id).join(', '))
    const res = await fetch(`/campaigns/${id}/campaign.json`)
    check('файлы новой кампании отдаются dev-сервером', res.ok)
    check('фон стартовой сцены подставлен', (await fetch(`/campaigns/${id}/scenes/img/scene_start.jpg`)).ok)

    const store = new EditorStore(`/campaigns/${id}`)
    await store.load()
    const doc = exportMonolith(store).doc
    doc.campaign.id = 'ai_generated_other_id'
    doc.campaign.title = 'Название из импортированного JSON'
    const warnings = importMonolith(store, doc)
    check('импорт сохраняет id папки кампании', store.meta.id === id, store.meta.id)
    check('импорт сразу обновляет название в сторе', store.meta.title === doc.campaign.title, store.meta.title)
    check('смена чужого id объяснена в отчёте', warnings.some((warning) => warning.includes('ID кампании') && warning.includes(id)))

    await store.saveToDisk()
    await syncIndexEntry({
      id: store.meta.id,
      title: store.meta.title,
      author: store.meta.author,
      description: store.meta.description,
    })
    const afterImport = await fetchCampaignIndex()
    check('импортированная кампания осталась в реестре по id папки', afterImport.some((c) => c.id === id), afterImport.map((c) => c.id).join(', '))
    check('новое название попало в реестр', afterImport.find((c) => c.id === id)?.title === doc.campaign.title, afterImport.find((c) => c.id === id)?.title)
    const savedMeta = await (await fetch(`/campaigns/${id}/campaign.json`)).json() as { id?: string; title?: string }
    check('campaign.json сохранён в папке с тем же id', savedMeta.id === id, `${savedMeta.id} / ${id}`)
    const playable = await loadCampaign(`/campaigns/${id}`)
    check('после перезагрузки игрок загружает импортированную кампанию', playable.meta.id === id && playable.meta.title === doc.campaign.title, playable.meta.title)

    // Проверяем и пользовательский путь без заранее созданного пакета: импорт
    // присваивает безопасный id, сохраняет каталог и регистрирует его.
    const emptyStore = new EditorStore('')
    const directDoc = JSON.parse(JSON.stringify(doc)) as typeof doc
    directDoc.campaign.id = 'json_only_import'
    directDoc.campaign.title = 'Прямая JSON кампания'
    importMonolith(emptyStore, directDoc)
    directId = makeId('', emptyStore.meta.id || emptyStore.meta.title || 'campaign', (await fetchCampaignIndex()).map((entry) => entry.id))
    emptyStore.setCampaignId(directId)
    emptyStore.setBasePath(`/campaigns/${directId}`)
    await emptyStore.saveToDisk()
    await syncIndexEntry({
      id: emptyStore.meta.id,
      title: emptyStore.meta.title,
      author: emptyStore.meta.author,
      description: emptyStore.meta.description,
    })
    const directEntry = (await fetchCampaignIndex()).find((entry) => entry.id === directId)
    check('JSON без исходной кампании сохраняется и регистрируется', !!directEntry, directId)
    check('название прямого JSON-импорта доступно игроку', directEntry?.title === 'Прямая JSON кампания', directEntry?.title)
  } finally {
    // возвращаем поставку к пустому реестру после проверки обоих вариантов импорта
    for (const removeId of [id, directId].filter((value): value is string => !!value)) {
      await fetch('/__editor/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: removeId }),
      }).catch(() => null)
    }
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
