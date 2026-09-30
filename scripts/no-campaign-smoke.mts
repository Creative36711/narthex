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
import {
  copyCampaignFolder,
  createCampaign,
  deleteCampaignFolder,
  fetchCampaignIndex,
  hydrateCampaignIndex,
  importChroniclePackage,
  replaceCampaignIndexEntry,
  syncIndexEntry,
  uniqueAvailableCampaignId,
} from '../src/editor/newCampaign'
import { uniqueCampaignId } from '../src/editor/ids'
import { importMonolithText, exportMonolith } from '../src/editor/monolith'
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
  check('импорт JSON сохраняет id ИИ до сохранения и переносит каталог при Save', read('src/editor/monolith.ts').includes('здесь не подменяем авторский id') && ed.includes('copyCampaignFolder(fromId, targetId)') && ed.includes('replaceCampaignIndexEntry(move.fromId'))
  check('занятый id кампании получает локальный суффикс', read('src/editor/ids.ts').includes('uniqueCampaignId') && read('src/editor/newCampaign.ts').includes('uniqueAvailableCampaignId'))
  check('пустой JSON-импорт предупреждает о локальном конфликте id', ed.includes('campaignIdWarning = `ID «${normalizedId}» уже занят') && ed.includes('campaignIdWarning ?'))
  check('удаление последней кампании не строит путь в никуда', ed.includes("setBase(next.length ? `/campaigns/${next[0].id}` : '')"))
  check('создание кампании работает и при пустом реестре', read('src/editor/newCampaign.ts').includes('index.push({ id, title, author, description: meta.description })'))
}

// ── 5. живая проверка: авторский id, перенос папки и коллизии ────────
{
  const idx = await fetchCampaignIndex()
  check('fetchCampaignIndex отдаёт пустой массив', Array.isArray(idx) && idx.length === 0, JSON.stringify(idx))
  const missing = await hydrateCampaignIndex([{ id: 'no-such-campaign', title: 'Призрак' }])
  check('отсутствующая кампания не считается доступной', missing.length === 0)

  // В пустышку импортируем JSON с авторскими названием и id, отличающимися от временных.
  const id = await createCampaign('Пробная пустая долина', 'Смоук')
  let destinationId: string | undefined
  let collisionId: string | undefined
  let placeholderId: string | undefined
  let conflictMoveId: string | undefined
  let directId: string | undefined
  let chronicleId: string | undefined
  try {
    const after = await fetchCampaignIndex()
    check('созданная кампания попала в реестр', after.some((c) => c.id === id), after.map((c) => c.id).join(', '))
    const res = await fetch(`/campaigns/${id}/campaign.json`)
    check('файлы новой кампании отдаются dev-сервером', res.ok)
    check('фон стартовой сцены подставлен', (await fetch(`/campaigns/${id}/scenes/img/scene_start.jpg`)).ok)

    const store = new EditorStore(`/campaigns/${id}`)
    await store.load()
    const doc = exportMonolith(store).doc
    doc.campaign.id = 'tishina_orfeya'
    doc.campaign.title = 'Тишина Орфея'
    importMonolithText(store, JSON.stringify(doc))
    check('импорт сохраняет авторский id до сохранения', store.meta.id === 'tishina_orfeya', store.meta.id)
    check('импорт сразу обновляет название в сторе', store.meta.title === doc.campaign.title, store.meta.title)

    const currentIndex = await fetchCampaignIndex()
    destinationId = await uniqueAvailableCampaignId(store.meta.id, currentIndex.filter((entry) => entry.id !== id).map((entry) => entry.id))
    check('свободный авторский id сохраняется без суффикса', destinationId === 'tishina_orfeya', destinationId)
    check('исходная папка клонируется до сохранения', await copyCampaignFolder(id, destinationId))
    store.setCampaignId(destinationId)
    store.setBasePath(`/campaigns/${destinationId}`)
    await store.saveToDisk()
    await replaceCampaignIndexEntry(id, {
      id: store.meta.id,
      title: store.meta.title,
      author: store.meta.author,
      description: store.meta.description,
    })
    await deleteCampaignFolder(id)

    const afterImport = await fetchCampaignIndex()
    check('новый id зарегистрирован, старый удалён из реестра', afterImport.some((c) => c.id === destinationId) && !afterImport.some((c) => c.id === id), afterImport.map((c) => c.id).join(', '))
    check('авторское название попало в реестр', afterImport.find((c) => c.id === destinationId)?.title === doc.campaign.title, afterImport.find((c) => c.id === destinationId)?.title)
    const savedMeta = await (await fetch(`/campaigns/${destinationId}/campaign.json`)).json() as { id?: string; title?: string }
    check('campaign.json совпадает с новым каталогом', savedMeta.id === destinationId && savedMeta.title === doc.campaign.title, `${savedMeta.id} / ${destinationId}`)
    const playable = await loadCampaign(`/campaigns/${destinationId}`)
    check('после перезагрузки игрок загружает импортированную кампанию', playable.meta.id === destinationId && playable.meta.title === doc.campaign.title, playable.meta.title)

    // Импортируем из пустышки JSON с id уже существующей кампании: Save должен
    // перенести пакет в новый каталог, не трогая кампанию другого мастера.
    collisionId = await createCampaign('Коллизия ID кампании', 'Другой мастер')
    placeholderId = await createCampaign('Временная пустышка', 'Смоук')
    const conflictStore = new EditorStore(`/campaigns/${placeholderId}`)
    await conflictStore.load()
    const conflictDoc = JSON.parse(JSON.stringify(doc)) as typeof doc
    conflictDoc.campaign.id = collisionId
    conflictDoc.campaign.title = 'Импорт с конфликтующим ID'
    importMonolithText(conflictStore, JSON.stringify(conflictDoc))
    check('импорт в пустышку сохраняет конфликтный id до Save', conflictStore.meta.id === collisionId, conflictStore.meta.id)
    const beforeMove = await fetchCampaignIndex()
    const usedIds = beforeMove.filter((entry) => entry.id !== placeholderId).map((entry) => entry.id)
    let targetId = uniqueCampaignId(conflictStore.meta.id, usedIds)
    let copied = false
    for (let attempt = 0; attempt < 100; attempt++) {
      copied = await copyCampaignFolder(placeholderId, targetId)
      if (copied) break
      usedIds.push(targetId)
      targetId = uniqueCampaignId(conflictStore.meta.id, usedIds)
    }
    conflictMoveId = targetId
    check('конфликтный id переносится в свободную папку', copied && conflictMoveId !== collisionId, conflictMoveId)
    conflictStore.setCampaignId(conflictMoveId)
    conflictStore.setBasePath(`/campaigns/${conflictMoveId}`)
    await conflictStore.saveToDisk()
    await replaceCampaignIndexEntry(placeholderId, {
      id: conflictStore.meta.id,
      title: conflictStore.meta.title,
      author: conflictStore.meta.author,
      description: conflictStore.meta.description,
    })
    await deleteCampaignFolder(placeholderId)
    const afterMove = await fetchCampaignIndex()
    check('существующая кампания не перезаписана', afterMove.find((entry) => entry.id === collisionId)?.title === 'Коллизия ID кампании', afterMove.find((entry) => entry.id === collisionId)?.title)
    check('конфликтная кампания зарегистрирована под новым id', afterMove.find((entry) => entry.id === conflictMoveId)?.title === 'Импорт с конфликтующим ID', conflictMoveId)
    const playableConflict = await loadCampaign(`/campaigns/${conflictMoveId}`)
    check('после выхода конфликтный импорт тоже загружается', playableConflict.meta.id === conflictMoveId && playableConflict.meta.title === 'Импорт с конфликтующим ID', playableConflict.meta.title)

    // Проверяем и импорт с пустого экрана: тот же занятый id получает следующий суффикс.
    const emptyStore = new EditorStore('')
    const directDoc = JSON.parse(JSON.stringify(doc)) as typeof doc
    directDoc.campaign.id = collisionId
    directDoc.campaign.title = 'Прямая JSON кампания'
    importMonolithText(emptyStore, JSON.stringify(directDoc))
    directId = await uniqueAvailableCampaignId(emptyStore.meta.id, (await fetchCampaignIndex()).map((entry) => entry.id))
    check('коллизия ID при импорте с пустого экрана получает новый id', directId !== collisionId && directId !== conflictMoveId, directId)
    emptyStore.setCampaignId(directId)
    emptyStore.setBasePath(`/campaigns/${directId}`)
    await emptyStore.saveToDisk()
    await syncIndexEntry({
      id: emptyStore.meta.id,
      title: emptyStore.meta.title,
      author: emptyStore.meta.author,
      description: emptyStore.meta.description,
    })
    const afterCollision = await fetchCampaignIndex()
    check('оригинал с занятым id сохранён', afterCollision.find((entry) => entry.id === collisionId)?.title === 'Коллизия ID кампании', afterCollision.find((entry) => entry.id === collisionId)?.title)
    check('конфликтный JSON тоже доступен игроку', afterCollision.find((entry) => entry.id === directId)?.title === 'Прямая JSON кампания', directId)

    // Импорт .chronicle применяет такую же защиту для общего локального реестра.
    const packageMeta = await (await fetch(`/campaigns/${collisionId}/campaign.json`)).json() as Record<string, unknown>
    const zip = new (await import('jszip')).default()
    zip.file('campaign.json', JSON.stringify(packageMeta))
    zip.file('world.json', '{}')
    const archive = new File([await zip.generateAsync({ type: 'uint8array' })], 'duplicate.chronicle')
    const packageResult = await importChroniclePackage(archive)
    chronicleId = packageResult.id
    check('.chronicle получает уникальный id при локальной коллизии', chronicleId !== collisionId && chronicleId !== directId, chronicleId)
    check('.chronicle предупреждает о замене занятого id', packageResult.idWarning?.includes('уже занят'), packageResult.idWarning)
    const afterChronicle = await fetchCampaignIndex()
    check('.chronicle не изменяет исходную кампанию', afterChronicle.find((entry) => entry.id === collisionId)?.title === 'Коллизия ID кампании', afterChronicle.find((entry) => entry.id === collisionId)?.title)
  } finally {
    // возвращаем поставку к пустому реестру после всех проверок
    for (const removeId of [id, destinationId, collisionId, placeholderId, conflictMoveId, directId, chronicleId].filter((value): value is string => !!value)) {
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
