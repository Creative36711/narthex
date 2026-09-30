import JSZip from 'jszip'
import { normalizeChronicleManifest } from './chronicleManifest'
export { normalizeChronicleManifest } from './chronicleManifest'
import type { EditorStore } from './store'
import { collectCampaignMedia } from './campaignAudit'
import { AI_TASK_DIR } from './aiKit'
export { AI_TASK_DIR } from './aiKit'

/**
 * Экспорт/импорт пакета кампании `.chronicle` (ТЗ 3.11, 5.4) — zip-архив
 * со структурой Campaign Package, включая ассеты.
 */


/** собрать все локальные пути изображений, звука, видео и шрифтов кампании */
export function collectAssetPaths(store: EditorStore): string[] {
  return collectCampaignMedia(store).local
}

export async function exportChronicle(
  store: EditorStore,
  options: { allowMissingMedia?: boolean } = {},
): Promise<Blob> {
  const zip = new JSZip()
  for (const p of store.allPaths()) zip.file(p, store.fileText(p))
  const assets = collectAssetPaths(store)
  const missing: string[] = []
  await Promise.all(assets.map(async (assetPath) => {
    const url = `${store.basePath}/${assetPath.split('/').map(encodeURIComponent).join('/')}`
    try {
      const response = await fetch(url)
      if (!response.ok || (response.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) {
        missing.push(assetPath)
        return
      }
      zip.file(assetPath, await response.arrayBuffer())
    } catch {
      missing.push(assetPath)
    }
  }))
  if (missing.length && !options.allowMissingMedia) {
    throw new Error(`Пакет не собран: не найдены медиафайлы (${missing.length}):\n${missing.join('\n')}`)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Импорт .chronicle: распаковка в память редактора; ассеты пишутся на диск
 * через dev-эндпоинт (только в vite dev).
 */
export async function importChronicle(store: EditorStore, file: File): Promise<string[]> {
  const zip = await JSZip.loadAsync(file)
  const warnings: string[] = []
  const campaignRel = store.campaignRel()
  const archiveEntries = Object.keys(zip.files).filter((p) => !zip.files[p].dir)

  // Сначала разбираем и проверяем структуру архива, чтобы ошибка JSON не
  // оставляла редактор частично перезаписанным. Метаданные AI-набора лежат
  // отдельно и никогда не попадают в файлы кампании.
  for (const p of archiveEntries) {
    if (p.startsWith('/') || p.split('/').includes('..')) throw new Error(`Недопустимый путь в архиве: ${p}`)
  }
  const entries = archiveEntries.filter((path) => !path.startsWith(AI_TASK_DIR))
  for (const required of ['campaign.json', 'world.json', 'manifest.json']) {
    if (!zip.files[required] || zip.files[required].dir) throw new Error(`В архиве нет обязательного файла ${required}`)
  }
  const meta = JSON.parse(await zip.files['campaign.json'].async('text'))
  const world = JSON.parse(await zip.files['world.json'].async('text'))
  const manifest = JSON.parse(await zip.files['manifest.json'].async('text'))
  const jsonFiles = new Map<string, unknown>()
  const textFiles = new Map<string, string>()
  const assets: string[] = []
  for (const p of entries) {
    if (p === 'campaign.json' || p === 'world.json' || p === 'manifest.json') continue
    if (p.endsWith('.ink')) textFiles.set(p, await zip.files[p].async('text'))
    else if (p.endsWith('.json')) jsonFiles.set(p, JSON.parse(await zip.files[p].async('text')))
    else assets.push(p)
  }

  // Исправляем распространённую ошибку AI-генераторов: в массивы манифеста
  // записываются пути с повтором каталога (entities/entities/...), а для
  // диалогов — путь к .dlg.json вместо ожидаемого .ink.
  const normalized = normalizeChronicleManifest(manifest, jsonFiles, textFiles)
  warnings.push(...normalized.notes)
  if (normalized.changed) jsonFiles.set('manifest.json', normalized.manifest)
  for (const p of textFiles.keys()) if (!entries.includes(p)) entries.push(p)

  // Архив — полная замена пакета. Удаляем из памяти модули, которых в новом
  // manifest больше нет, иначе они оставались бы «сиротами» и попадали в экспорт.
  store.meta = meta
  store.world = world
  store.manifest = normalized.manifest
  store.jsonFiles = jsonFiles
  store.textFiles = textFiles
  store.dirty.clear()
  for (const p of store.allPaths()) if (p.endsWith('.json') || p.endsWith('.ink')) store.dirty.add(p)
  if (normalized.changed) store.dirty.add('manifest.json')

  for (const p of assets) {
    // бинарный ассет → на диск через dev-эндпоинт
    const b64 = await zip.files[p].async('base64')
    const res = await fetch(store.saveEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: `${campaignRel}/${p}`, base64: b64 }),
    }).catch(() => null)
    if (!res || !res.ok) warnings.push(`ассет не сохранён: ${p}`)
  }
  store.notify()
  return warnings
}
