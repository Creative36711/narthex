import '../packs/narrative/operations'
/**
 * Изолированный смоук пустого реестра и политики идентичности кампаний.
 * Он использует временный in-memory API и не требует сервера, а также не пишет
 * в public/campaigns/index.json. Запуск: npm run smoke:no-campaign
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import {
  createCampaign,
  deleteCampaignFolder,
  newAvailableCampaignId,
  reserveCampaignId,
  fetchCampaignIndex,
  hydrateCampaignIndex,
  importChroniclePackage,
} from '../src/editor/newCampaign'
import { createCampaignUuid } from '../src/editor/ids'
import { EditorStore } from '../src/editor/store'

const fixtureFiles = new Map<string, string | Uint8Array>([['campaigns/index.json', '[]\n']])
const fixtureDirectories = new Set<string>()
const realIndexBefore = readFileSync('public/campaigns/index.json')

const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
})

/** A tiny editor API backed only by the in-memory empty-registry fixture. */
const fixtureFetch: typeof fetch = async (input, init) => {
  const rawUrl = input instanceof Request ? input.url : String(input)
  const url = new URL(rawUrl, 'http://no-campaign-fixture.local')
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {}

  if (url.pathname === '/__editor/campaign-exists' && method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    return jsonResponse({ exists: fixtureDirectories.has(id) })
  }
  if (url.pathname === '/__editor/campaign-files' && method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    if (!fixtureDirectories.has(id)) return new Response('campaign directory not found', { status: 404 })
    const prefix = `campaigns/${id}/`
    const files = [...fixtureFiles.keys()].filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length)).sort()
    return jsonResponse({ files })
  }
  if (url.pathname === '/__editor/reserve-campaign' && method === 'POST') {
    const id = body.id
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) return new Response('invalid campaign id', { status: 400 })
    if (fixtureDirectories.has(id)) return new Response('campaign id already exists', { status: 409 })
    fixtureDirectories.add(id)
    return jsonResponse({ reserved: true })
  }
  if (url.pathname === '/__editor/delete' && method === 'POST') {
    const id = body.path
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) return new Response('invalid campaign path', { status: 400 })
    fixtureDirectories.delete(id)
    const prefix = `campaigns/${id}/`
    for (const path of fixtureFiles.keys()) if (path.startsWith(prefix)) fixtureFiles.delete(path)
    return jsonResponse({ ok: true })
  }
  if (url.pathname === '/__editor/save' && method === 'POST') {
    const path = body.path
    if (typeof path !== 'string' || !path.startsWith('campaigns/') || path.split('/').includes('..')) {
      return new Response('path outside campaigns dir', { status: 400 })
    }
    if (typeof body.base64 === 'string') fixtureFiles.set(path, Buffer.from(body.base64, 'base64'))
    else fixtureFiles.set(path, typeof body.text === 'string' ? body.text : '')
    const campaignPath = /^campaigns\/([^/]+)\/.+/.exec(path)
    if (campaignPath) fixtureDirectories.add(campaignPath[1])
    return jsonResponse({ ok: true })
  }
  if (url.pathname === '/campaigns/index.json' && method === 'GET') {
    return new Response(fixtureFiles.get('campaigns/index.json') ?? '[]\n', {
      headers: { 'content-type': 'application/json' },
    })
  }
  if (url.pathname.startsWith('/campaigns/') && method === 'GET') {
    const path = url.pathname.slice(1)
    const data = fixtureFiles.get(path)
    if (data === undefined) return new Response('not found', { status: 404 })
    const contentType = path.endsWith('.json') ? 'application/json' : 'application/octet-stream'
    return new Response(data instanceof Uint8Array ? new Uint8Array(data) : data, {
      headers: { 'content-type': contentType },
    })
  }
  return new Response('not found in isolated fixture', { status: 404 })
}

const realFetch = globalThis.fetch
globalThis.fetch = fixtureFetch

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const read = (path: string) => readFileSync(path, 'utf8')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// ── Изолированная фикстура и пользовательские потоки ────────────────
{
  const index = JSON.parse(String(fixtureFiles.get('campaigns/index.json'))) as Array<{ id: string }>
  const editor = read('src/editor/EditorApp.tsx')
  const noCampaign = read('src/player/NoCampaignScreen.tsx')
  const newCampaign = read('src/editor/newCampaign.ts')
  check('изолированная фикстура начинается с пустого реестра', Array.isArray(index) && index.length === 0)
  check('пустая фикстура не включает ash-полигон', !index.some((entry) => entry.id === 'ash-of-caerden'))
  const fixture = 'public/campaigns/ash-of-caerden'
  check('полигон смоуков на месте и помечен', existsSync(join(fixture, 'smoke-fixture.json')))
  const oversized: string[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (statSync(path).size > 200_000) oversized.push(path)
    }
  }
  walk(fixture)
  check('полигон не содержит тяжёлых файлов', oversized.length === 0, oversized.join(', '))
  check('в полигоне нет экспортируемых изображений', !existsSync(join(fixture, 'assets/img')))
  const fixtureMeta = read(join(fixture, 'campaign.json'))
  check('данные полигона сохраняют ссылки на изображения', /assets\/img\//.test(fixtureMeta) || /assets\/img\//.test(read(join(fixture, 'entities/npc_maeva.json'))))
  const app = read('src/App.tsx')
  check('нет захардкоженной кампании по умолчанию', !/DEFAULT_CAMPAIGN/.test(app))
  check('выбор кампании идёт из реестра', app.includes('function pickCampaign('))
  check('пустой реестр не грузит несуществующий путь', app.includes('if (!campaignId) return'))
  check('движок показывает экран без кампаний', app.includes('<NoCampaignScreen'))
  check('экран пустого реестра предлагает создать и загрузить кампанию', read('src/player/NoCampaignScreen.tsx').includes('Создать кампанию') && read('src/player/NoCampaignScreen.tsx').includes('.narthex'))
  check('движок и редактор целы', existsSync('src/core/engine.ts') && existsSync('src/editor/EditorApp.tsx'))
  check('создание выдаёт UUID, а не slug названия', newCampaign.includes('newAvailableCampaignId(index.map') && newCampaign.includes('createCampaignUuid'))
  check('JSON-импорт пустого редактора выдаёт приложением новый ID', editor.includes('newAvailableCampaignId(index.map((entry) => entry.id))'))
  check('JSON-импорт существующей кампании сохраняет ID папки', editor.includes('const stableId = campaignIdFromPath(base)') && editor.includes('store.setCampaignId(stableId)'))
  check('Save не переносит папку при попытке изменить ID', editor.includes('ID кампании не изменён') && !editor.includes('copyCampaignFolder(fromId, targetId)'))
  check('редактор доступен без кампании', editor.includes('Кампаний пока нет'))
  check('из пустого редактора можно создать и импортировать кампанию', editor.includes('onClick={() => void newCampaign()}') && editor.includes('onClick={() => void doImportJson()}'))
  check('ID инициализируется при пустом JSON-импорте', editor.includes('newAvailableCampaignId(index.map((entry) => entry.id))'))
  check('импорт .narthex спрашивает об обновлении/копии при конфликте', noCampaign.includes('Обновить кампанию') && noCampaign.includes('Импортировать копию'))
}

const importedIds: string[] = []
try {
  const before = await fetchCampaignIndex()
  check('пустой локальный реестр доступен', before.length === 0, JSON.stringify(before))
  check('отсутствующий каталог не считается кампанией', (await hydrateCampaignIndex([{ id: 'no-such-campaign', title: 'Призрак' }])).length === 0)
  const raceId = createCampaignUuid()
  const reservations = await Promise.all([reserveCampaignId(raceId), reserveCampaignId(raceId)])
  importedIds.push(raceId)
  check('атомарная резервация даёт ровно одному процессу владение ID', reservations.filter(Boolean).length === 1)
  check('ID, уже занятый папкой, не резервируется повторно', !(await reserveCampaignId(raceId)))

  // Название можно полностью сменить, а ID новой кампании остаётся случайным UUID.
  const first = await createCampaign('Новая кампания')
  const second = await createCampaign('Новая кампания')
  importedIds.push(first, second)
  check('новая кампания получает UUID независимо от названия', UUID.test(first) && UUID.test(second) && first !== second, `${first} / ${second}`)
  const store = new EditorStore(`/campaigns/${first}`)
  await store.load()
  const originalId = store.meta.id
  store.meta.title = 'Колокол без имени'
  store.setCampaignId('id-из-ответа-ии')
  store.setCampaignId(originalId)
  check('смена названия не связана с ID', store.meta.id === originalId && store.meta.title === 'Колокол без имени')

  // Минимальный автономный архив .narthex.
  const fixtureMeta = JSON.parse(read('public/campaigns/ash-of-caerden/campaign.json')) as Record<string, unknown>
  const baseMeta = {
    ...fixtureMeta,
    id: 'offline-test-campaign',
    title: 'Офлайн-кампания',
    version: '1.0.0',
  }
  const makeArchive = async (meta: Record<string, unknown>, world: unknown = { regions: [] }, includeWorld = true) => {
    const zip = new JSZip()
    zip.file('campaign.json', JSON.stringify(meta, null, 2))
    if (includeWorld) zip.file('world.json', JSON.stringify(world, null, 2))
    zip.file('manifest.json', JSON.stringify({ scenes: [], entities: [], rules: [], quests: [], dialogues: [] }, null, 2))
    return new File([await zip.generateAsync({ type: 'uint8array' })], 'offline-test.narthex')
  }

  const initial = await importChroniclePackage(await makeArchive(baseMeta))
  importedIds.push(initial.id)
  check('свободный .narthex сохраняет исходный стабильный ID', initial.id === baseMeta.id)
  const same = await importChroniclePackage(await makeArchive(baseMeta))
  check('повторный идентичный импорт распознаётся и не дублируется', same.alreadyInstalled === true && same.id === initial.id)
  let missingFileConflict = false
  const missingFile = await importChroniclePackage(await makeArchive(baseMeta, undefined, false), async (conflict) => {
    missingFileConflict = conflict.id === initial.id && !conflict.identicalPackage
    return 'cancel'
  })
  check('отсутствующий в архиве файл считается конфликтом содержимого', missingFileConflict && missingFile.cancelled === true)
  const noConflictHandler = await importChroniclePackage(await makeArchive({ ...baseMeta, title: 'Неподтверждённая версия' }))
  check('без обработчика конфликта импорт безопасно отменяется', noConflictHandler.cancelled === true)

  // Разный контент с тем же ID не перезаписывается молча: вызывающий код выбирает действие.
  const modified = { ...baseMeta, title: 'Офлайн-кампания — новая версия' }
  let conflictPrompted = false
  const updated = await importChroniclePackage(await makeArchive(modified), async (conflict) => {
    conflictPrompted = conflict.id === initial.id && conflict.existingTitle === 'Офлайн-кампания' && !conflict.identicalPackage
    return 'update'
  })
  check('обновление сохраняет исходный ID и просит явный выбор', conflictPrompted && updated.id === initial.id)
  check('обновление заменило метаданные в существующей папке', (await (await fetch(`/campaigns/${initial.id}/campaign.json`)).json() as { title: string }).title === modified.title)

  const forked = await importChroniclePackage(await makeArchive({ ...modified, title: 'Отдельная копия' }), async () => 'copy')
  importedIds.push(forked.id)
  check('отдельная копия получает новый UUID', UUID.test(forked.id) && forked.id !== initial.id)
  check('копирование не перезаписывает исходную кампанию', (await (await fetch(`/campaigns/${initial.id}/campaign.json`)).json() as { title: string }).title === modified.title)

  const cancelled = await importChroniclePackage(await makeArchive({ ...modified, title: 'Отменённая версия' }), async () => 'cancel')
  check('отмена конфликта не пишет пакет', cancelled.cancelled === true && (await fetchCampaignIndex()).some((entry) => entry.id === initial.id))

  const withoutId = { ...baseMeta }
  delete withoutId.id
  const noIdPackage = await importChroniclePackage(await makeArchive(withoutId))
  importedIds.push(noIdPackage.id)
  check('пакет без ID получает новый UUID, не slug из названия', UUID.test(noIdPackage.id) && noIdPackage.id !== 'oflayn-kampaniya')
} finally {
  for (const id of new Set(importedIds)) {
    await fetch('/__editor/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: id }),
    }).catch(() => null)
  }
  await fetch('/__editor/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'campaigns/index.json', text: '[]\n' }),
  }).catch(() => null)
}

const afterSmoke = await fetchCampaignIndex()
check('после теста очищена изолированная фикстура', afterSmoke.length === 0 && fixtureDirectories.size === 0)
globalThis.fetch = realFetch
check('реальный public index не изменён', readFileSync('public/campaigns/index.json').equals(realIndexBefore))
console.log(failed ? `\nFAILED: ${failed}` : '\nALL GREEN')
if (failed) process.exitCode = 1
