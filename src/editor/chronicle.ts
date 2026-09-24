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
  for (const p of entries) {
    const f = zip.files[p]
    if (p === 'campaign.json') store.meta = JSON.parse(await f.async('text'))
    else if (p === 'world.json') store.world = JSON.parse(await f.async('text'))
    else if (p === 'manifest.json') store.manifest = JSON.parse(await f.async('text'))
    else if (p.endsWith('.ink')) store.textFiles.set(p, await f.async('text'))
    else if (p.endsWith('.json')) store.jsonFiles.set(p, JSON.parse(await f.async('text')))
    else {
      // бинарный ассет → на диск через dev-эндпоинт
      const b64 = await f.async('base64')
      const res = await fetch(store.saveEndpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${campaignRel}/${p}`, base64: b64 }),
      }).catch(() => null)
      if (!res || !res.ok) warnings.push(`ассет не сохранён: ${p}`)
    }
    if (p.endsWith('.json') || p.endsWith('.ink')) store.dirty.add(p)
  }
  store.notify()
  return warnings
}
