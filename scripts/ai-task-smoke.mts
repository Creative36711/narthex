import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { createAiTaskBundle } from '../src/editor/aiTask'
import { collectCampaignMedia } from '../src/editor/campaignAudit'
import { createCampaign, deleteCampaignFolder, fetchCampaignIndex, importChroniclePackage } from '../src/editor/newCampaign'
import { EditorStore } from '../src/editor/store'

const ORIGIN = 'http://localhost:5173'
const realFetch = globalThis.fetch

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const target = typeof input === 'string' && input.startsWith('/')
    ? `${ORIGIN}${input}`
    : typeof input === 'string' && input.startsWith('ai/')
      ? `${ORIGIN}/${input}`
      : input
  return realFetch(target, init)
}) as typeof fetch

let failed = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const originalIndex = readFileSync('public/campaigns/index.json', 'utf8')
const createdIds: string[] = []
try {
  const id = await createCampaign('AI Task Smoke')
  createdIds.push(id)
  const store = new EditorStore(`/campaigns/${id}`)
  await store.load()
  store.dirty.add('campaign.json')
  await store.saveToDisk()

  const media = collectCampaignMedia(store)
  check('медиа-аудит видит локальные ссылки, не только assets/', media.local.includes('scenes/img/scene_start.jpg'))
  const bundle = await createAiTaskBundle(store, { mode: 'edit', task: 'Проверь пакет без изменения сюжета.' })
  check('пакет редактирования получает расширение .chronicle', bundle.filename === `${id}-ai-task.chronicle`, bundle.filename)

  const zip = await JSZip.loadAsync(bundle.blob)
  check('AI-пакет сохраняет структуру Campaign Package', !!zip.files['campaign.json'] && !!zip.files['world.json'] && !!zip.files['manifest.json'])
  check('AI-пакет содержит единый brief и отчёт по категориям', !!zip.files['__chronicle_ai__/TASK.md'] && !!zip.files['__chronicle_ai__/validation-report.md'])
  check('AI-пакет несёт руководство, схему и бланк',
    !!zip.files['__chronicle_ai__/campaign-guide.md'] && !!zip.files['__chronicle_ai__/campaign.schema.json'] && !!zip.files['__chronicle_ai__/design-template.md'])
  check('плейтест/медиа/структура присутствуют в отчёте', (await zip.files['__chronicle_ai__/validation-report.md'].async('text')).includes('СТРУКТУРА И ССЫЛКИ')
    && (await zip.files['__chronicle_ai__/validation-report.md'].async('text')).includes('МЕДИА И ФАЙЛЫ')
    && (await zip.files['__chronicle_ai__/validation-report.md'].async('text')).includes('ПЛЕЙТЕСТ'))
  check('AI-пакет передаёт агенту существующий ID', (await zip.files['__chronicle_ai__/TASK.md'].async('text')).includes(id))

  const noCampaignBundle = await createAiTaskBundle(new EditorStore(''), { mode: 'new', task: 'Создай камерную историю.' })
  check('новая кампания получает пакет инструкций без фиктивного исходного проекта', noCampaignBundle.filename.endsWith('-ai-task.zip')
    && noCampaignBundle.assignedCampaignId.length === 36)

  // Возвращённый AI-пакет может сохранить служебную папку; импортёр не должен
  // считать её содержимым кампании и не записывает её в public/campaigns.
  const editedArchive = await JSZip.loadAsync(bundle.blob)
  const campaignMeta = JSON.parse(await editedArchive.files['campaign.json'].async('text')) as Record<string, unknown>
  campaignMeta.title = 'AI Task Smoke — modified'
  editedArchive.file('campaign.json', JSON.stringify(campaignMeta, null, 2))
  const returned = new File([await editedArchive.generateAsync({ type: 'uint8array' })], 'returned-ai.chronicle')
  const copied = await importChroniclePackage(returned, async () => 'copy')
  createdIds.push(copied.id)
  const directory = await fetch(`/__editor/campaign-files?id=${encodeURIComponent(copied.id)}`).then((response) => response.json()) as { files: string[] }
  check('служебная папка AI не попадает в установленную кампанию', !directory.files.some((path) => path.startsWith('__chronicle_ai__/')))

  const identical = await importChroniclePackage(new File([await zip.generateAsync({ type: 'uint8array' })], 'same-ai-task.chronicle'))
  check('повтор того же AI-пакета распознаётся как тот же пакет', identical.alreadyInstalled === true && identical.id === id, JSON.stringify(identical))
} finally {
  for (const id of new Set(createdIds)) await deleteCampaignFolder(id).catch(() => undefined)
  await fetch('/__editor/save', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'campaigns/index.json', text: originalIndex }),
  }).catch(() => null)
}

const restored = await fetchCampaignIndex()
check('AI-task smoke-test восстановил исходный реестр', restored.length === JSON.parse(originalIndex).length)
console.log(failed ? `FAILED: ${failed}` : 'ALL GREEN')
if (failed) process.exitCode = 1
