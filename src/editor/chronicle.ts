import JSZip from 'jszip'
import type { EditorStore } from './store'

/**
 * Экспорт/импорт пакета кампании `.chronicle` (ТЗ 3.11, 5.4) — zip-архив
 * со структурой Campaign Package, включая ассеты.
 */

/** собрать список путей ассетов, упомянутых в JSON-документах ("assets/...") */
export function collectAssetPaths(store: EditorStore): string[] {
  const found = new Set<string>()
  const scan = (text: string) => {
    for (const m of text.matchAll(/"(assets\/[^"\\]+)"/g)) found.add(m[1])
  }
  scan(JSON.stringify(store.meta))
  scan(JSON.stringify(store.world))
  for (const [, v] of store.jsonFiles) scan(JSON.stringify(v))
  return [...found].sort()
}

export async function exportChronicle(store: EditorStore): Promise<Blob> {
  const zip = new JSZip()
  for (const p of store.allPaths()) zip.file(p, store.fileText(p))
  // ассеты — бинарно
  const assets = collectAssetPaths(store)
  await Promise.all(
    assets.map(async (a) => {
      const res = await fetch(`${store.basePath}/${a}`)
      if (res.ok) zip.file(a, await res.arrayBuffer())
    }),
  )
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
  const entries = Object.keys(zip.files).filter((p) => !zip.files[p].dir)

  // Сначала разбираем и проверяем структуру архива, чтобы ошибка JSON не
  // оставляла редактор частично перезаписанным.
  for (const p of entries) {
    if (p.startsWith('/') || p.split('/').includes('..')) throw new Error(`Недопустимый путь в архиве: ${p}`)
  }
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

  // Архив — полная замена пакета. Удаляем из памяти модули, которых в новом
  // manifest больше нет, иначе они оставались бы «сиротами» и попадали в экспорт.
  store.meta = meta
  store.world = world
  store.manifest = manifest
  store.jsonFiles = jsonFiles
  store.textFiles = textFiles
  store.dirty.clear()
  for (const p of entries) if (p.endsWith('.json') || p.endsWith('.ink')) store.dirty.add(p)

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
