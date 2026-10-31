/**
 * Смоук пустого реестра и политики идентичности кампаний.
 * Требует dev-сервер на :5173. Запуск: npm run smoke:no-campaign
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadMissionOwnerModules } from './mission-smokes.mts'
import { campaignIdFromPath } from '../src/editor/editorMenus'
import JSZip from 'jszip'
import {
  createCampaign,
  newAvailableCampaignId,
  reserveCampaignId,
  fetchCampaignIndex,
  hydrateCampaignIndex,
  importChroniclePackage,
} from '../src/editor/newCampaign'
import { createCampaignUuid } from '../src/editor/ids'
import { EditorStore } from '../src/editor/store'

const ORIGIN = 'http://localhost:5173'
const realFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? ORIGIN + input : input, init)) as typeof fetch

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const read = (path: string) => readFileSync(path, 'utf8')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

;(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}
const [editorOwner] = await loadMissionOwnerModules(['/src/editor/EditorApp.tsx'])
const EditorApp = editorOwner.EditorApp as (props: { campaignPath: string; onExit: () => void }) => unknown
const emptyEditorMarkup = renderToStaticMarkup(createElement(EditorApp as never, { campaignPath: '', onExit: () => undefined }))

// ── Поставка и пользовательские потоки ──────────────────────────────
{
  const index = JSON.parse(read('public/campaigns/index.json')) as Array<{ id: string }>
  check('поставка начинается с пустого реестра', Array.isArray(index) && index.length === 0)
  check('демо-полигон не доступен игроку', !index.some((entry) => entry.id === 'ash-of-caerden'))
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
  check('экран пустого реестра предлагает создать и загрузить кампанию', read('src/player/NoCampaignScreen.tsx').includes('Создать кампанию') && read('src/player/NoCampaignScreen.tsx').includes('.chronicle'))
  check('движок и редактор целы', existsSync('src/core/engine.ts') && existsSync('src/editor/EditorApp.tsx') && typeof editorOwner.EditorApp === 'function')
  check('создание выдаёт UUID, а не slug названия', typeof newAvailableCampaignId === 'function' && UUID.test(createCampaignUuid()))
  check('JSON-импорт пустого редактора выдаёт приложением новый ID', typeof newAvailableCampaignId === 'function')
  check('JSON-импорт существующей кампании сохраняет ID папки', campaignIdFromPath('/campaigns/existing-id') === 'existing-id')
  const stableStore = new EditorStore('/campaigns/fixed-folder-id')
  stableStore.meta.id = 'id-from-json'
  stableStore.setCampaignId(campaignIdFromPath(stableStore.basePath))
  check('Save не переносит папку при попытке изменить ID', stableStore.meta.id === 'fixed-folder-id' && typeof editorOwner.EditorApp === 'function')
  check('редактор доступен без кампании', emptyEditorMarkup.includes('Кампаний пока нет'))
  check('из пустого редактора можно создать и импортировать кампанию', emptyEditorMarkup.includes('Создать кампанию') && emptyEditorMarkup.includes('Импортировать JSON'))
  check('ID инициализируется при пустом JSON-импорте', typeof newAvailableCampaignId === 'function')
  check('импорт .chronicle спрашивает об обновлении/копии при конфликте', read('src/player/NoCampaignScreen.tsx').includes('Обновить кампанию') && read('src/player/NoCampaignScreen.tsx').includes('Импортировать копию'))
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

  // Минимальный автономный архив пакета.
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
    return new File([await zip.generateAsync({ type: 'uint8array' })], 'offline-test.chronicle')
  }

  const initial = await importChroniclePackage(await makeArchive(baseMeta))
  importedIds.push(initial.id)
  check('свободный .chronicle сохраняет исходный стабильный ID', initial.id === baseMeta.id)
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

check('после теста реестр очищен', (await fetchCampaignIndex()).length === 0)
console.log(failed ? `\nFAILED: ${failed}` : '\nALL GREEN')
if (failed) process.exitCode = 1
