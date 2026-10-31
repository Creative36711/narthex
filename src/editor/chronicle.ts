import JSZip from 'jszip'
import { normalizeChronicleManifest } from './chronicleManifest'
export { normalizeChronicleManifest } from './chronicleManifest'
import type { EditorStore } from './store'
import { collectCampaignMedia } from './campaignAudit'
import { AI_TASK_DIR } from './aiKit'
export { AI_TASK_DIR } from './aiKit'

/**
 * Экспорт/импорт пакета кампании (ТЗ 3.11, 5.4) — zip-архив
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

  // 100% гарантия сохранности ассетов: опрашиваем физический диск кампании,
  // чтобы ни один файл (озвучки, арты, шрифты, видео) не потерялся при экспорте или упаковке задания ИИ
  const diskAssets: string[] = []
  if (store.meta.id && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`/__editor/campaign-files?id=${encodeURIComponent(store.meta.id)}`)
      if (res.ok) {
        const data = (await res.json()) as { files?: string[] }
        if (Array.isArray(data.files)) {
          for (const f of data.files) {
            // Файлы манифеста и JSON уже упакованы из памяти; добавляем все реальные ассеты на диске:
            if (!store.hasFile(f) && !f.startsWith('.') && !f.startsWith('__chronicle_ai__/')) {
              diskAssets.push(f)
            }
          }
        }
      }
    } catch {
      // offline / standalone
    }
  }

  const assets = [...new Set([...collectAssetPaths(store), ...diskAssets])]
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

/**
 * Экспорт легковесного пакета изменений для отправки внешнему ИИ или коллеге:
 * включает только те файлы, которые мастер реально изменил или добавил в редакторе,
 * плюс CHANGES.md и инструкцию для агента в __chronicle_ai__/TASK.md.
 */
export async function exportPatchChronicle(
  store: EditorStore,
): Promise<{ blob: Blob; filename: string; modifiedCount: number }> {
  const mods = store.getModifiedFiles()
  const changedFiles = mods.filter((m) => m.status === 'modified' || m.status === 'added')

  if (changedFiles.length === 0) {
    throw new Error('В кампании нет изменений относительно исходного состояния: нечего экспортировать в патч.')
  }

  const zip = new JSZip()

  // 1. Укладываем только изменённые и добавленные файлы кампании
  for (const m of changedFiles) {
    zip.file(m.path, store.fileText(m.path))
  }

  // 2. Всегда формируем компактный manifest.json патча
  const patchManifest = {
    ...store.manifest,
    patch: true,
    base_campaign_id: store.meta.id,
    patch_timestamp: new Date().toISOString(),
    patch_files: changedFiles.map((m) => m.path),
  }
  zip.file('manifest.json', JSON.stringify(patchManifest, null, 2))

  // 3. Формируем человекочитаемый CHANGES.md
  const changesDoc = store.getChangesSummaryText()
  zip.file('CHANGES.md', changesDoc)

  // 4. Формируем задание для ИИ в __chronicle_ai__/TASK.md
  const aiTaskText = [
    '# Пакет ручных изменений мастера (Narthex Patch)',
    '',
    `Кампания: ${store.meta.title} (ID: ${store.meta.id})`,
    `Дата экспорта: ${new Date().toLocaleString('ru')}`,
    `Количество затронутых файлов: ${changedFiles.length}`,
    '',
    '## Что изменил мастер в визуальном редакторе:',
    ...changedFiles.map((m, i) => `${i + 1}. **${m.title}** (\`${m.path}\`) — ${m.status === 'added' ? 'новый файл' : 'изменён'}${m.diffSummary ? ` (${m.diffSummary})` : ''}`),
    '',
    '## Инструкция для ИИ-агента:',
    '1. Распакуй файлы из этого архива поверх существующего проекта кампании с заменой.',
    '2. Все остальные файлы проекта (картинки, звуки, неизменённые сцены) сохраняются без изменений.',
    '3. Продолжай разработку и генерацию с учётом внесённых мастером правок.',
  ].join('\n')
  zip.file(`${AI_TASK_DIR}TASK.md`, aiTaskText)

  const dateSlug = new Date().toISOString().slice(0, 10)
  const safeName = (store.meta.title || store.meta.id || 'campaign').toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '_').slice(0, 30)
  const filename = `${safeName}-patch-${dateSlug}.narthex`

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, filename, modifiedCount: changedFiles.length }
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
 * Импорт пакета: распаковка в память редактора; ассеты пишутся на диск
 * через dev-эндпоинт (только в vite dev).
 * Поддерживает как полные архивы кампаний, так и легковесные патчи изменений.
 */
export async function importChronicle(store: EditorStore, file: File): Promise<{ warnings: string[]; corrections: string[] }> {
  const zip = await JSZip.loadAsync(file)
  const warnings: string[] = []
  const corrections: string[] = []
  const campaignRel = store.campaignRel()
  const archiveEntries = Object.keys(zip.files).filter((p) => !zip.files[p].dir)

  for (const p of archiveEntries) {
    if (p.startsWith('/') || p.split('/').includes('..')) throw new Error(`Недопустимый путь в архиве: ${p}`)
  }
  const entries = archiveEntries.filter((path) => !path.startsWith(AI_TASK_DIR))

  if (!zip.files['manifest.json'] || zip.files['manifest.json'].dir) {
    throw new Error('В архиве нет обязательного файла manifest.json')
  }

  const rawManifest = JSON.parse(await zip.files['manifest.json'].async('text'))
  const isPatch = Boolean(rawManifest.patch) || (!zip.files['campaign.json'] && !zip.files['world.json'])

  if (!isPatch) {
    for (const required of ['campaign.json', 'world.json']) {
      if (!zip.files[required] || zip.files[required].dir) throw new Error(`В архиве нет обязательного файла ${required}`)
    }
  }

  const jsonFiles = new Map<string, unknown>()
  const textFiles = new Map<string, string>()
  const assets: string[] = []

  let meta = isPatch ? store.meta : undefined
  let world = isPatch ? store.world : undefined

  if (zip.files['campaign.json']) {
    meta = JSON.parse(await zip.files['campaign.json'].async('text'))
  }
  if (zip.files['world.json']) {
    world = JSON.parse(await zip.files['world.json'].async('text'))
  }

  for (const p of entries) {
    if (p === 'campaign.json' || p === 'world.json' || p === 'manifest.json' || p === 'CHANGES.md') continue
    if (p.endsWith('.ink') || p.endsWith('.md')) textFiles.set(p, await zip.files[p].async('text'))
    else if (p.endsWith('.json')) jsonFiles.set(p, JSON.parse(await zip.files[p].async('text')))
    else assets.push(p)
  }

  // Исправляем ссылки манифеста с префиксом каталога и записи диалогов
  const normalized = normalizeChronicleManifest(rawManifest, jsonFiles, textFiles)
  corrections.push(...normalized.notes)
  if (normalized.changed) jsonFiles.set('manifest.json', normalized.manifest)
  for (const p of textFiles.keys()) if (!entries.includes(p)) entries.push(p)

  if (isPatch) {
    // Режим накатывания патча поверх существующей кампании:
    if (meta) store.meta = meta
    if (world) store.world = world

    let appliedCount = 0
    for (const [p, val] of jsonFiles.entries()) {
      store.jsonFiles.set(p, val)
      store.dirty.add(p)
      appliedCount++
    }
    for (const [p, val] of textFiles.entries()) {
      store.textFiles.set(p, val)
      store.dirty.add(p)
      appliedCount++
    }

    // Добавляем новые элементы в списки разделов текущего манифеста
    for (const sec of ['scenes', 'entities', 'rules', 'arenas', 'quests', 'cutscenes', 'recipes', 'codex', 'dialogues'] as const) {
      const patchItems = (normalized.manifest[sec] ?? []) as string[]
      const curItems = new Set<string>((store.manifest[sec] ?? []) as string[])
      let added = false
      for (const it of patchItems) {
        if (!curItems.has(it)) {
          curItems.add(it)
          added = true
        }
      }
      if (added) {
        ;(store.manifest as any)[sec] = Array.from(curItems)
        store.dirty.add('manifest.json')
      }
    }

    corrections.push(`Применён пакет изменений: обновлено файлов: ${appliedCount}`)
  } else {
    // Полный архив — полная замена пакета:
    store.meta = meta!
    store.world = world!
    store.manifest = normalized.manifest
    store.jsonFiles = jsonFiles
    store.textFiles = textFiles
    store.dirty.clear()
    for (const p of store.allPaths()) if (p.endsWith('.json') || p.endsWith('.ink')) store.dirty.add(p)
    if (normalized.changed) store.dirty.add('manifest.json')
    store.captureBaseline()
  }

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
  return { warnings, corrections }
}
