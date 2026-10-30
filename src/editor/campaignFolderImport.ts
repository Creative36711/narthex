/**
 * Импорт кампании из локальной папки (проводник или drag-and-drop).
 *
 * Вынесено из `newCampaign.ts`: у папочного импорта свой цикл по файлам и своя
 * обработка конфликтов ID, а модуль создания кампании должен оставаться в
 * пределах лимита размера.
 */

import { checkEngine, checkPackage } from '../shared/versions'
import { normalizeCampaignId } from './ids'
import type { CampaignIndexEntry } from '../shared/types'
import { campaignFolderExists, fetchCampaignIndex } from './campaignIndex'
import { isAllowedCampaignFile, saveFile, uint8ArrayToBase64 } from './campaignFiles'
import { deleteCampaignFolder, newAvailableCampaignId, reserveCampaignId } from './newCampaign'
import type { ChronicleIdConflict, ChronicleIdConflictAction, ChronicleImportResult } from './newCampaign'

/**
 * Импорт локальной папки кампании напрямую (выбор через проводник или drag-and-drop).
 * Отфильтровывает .git, tools, скрипты и пропускает строго канонический набор игры.
 */
export async function importCampaignFromDirectory(
  fileList: FileList | File[],
  resolveConflict?: (conflict: ChronicleIdConflict) => Promise<ChronicleIdConflictAction>,
): Promise<ChronicleImportResult> {
  const files = Array.from(fileList)
  if (!files.length) throw new Error('Папка пуста или файлы не выбраны')

  // Ищем campaign.json и вычисляем префикс корневой папки
  // Исключаем .git и node_modules при первичном поиске
  const candidateFiles = files.filter((f) => {
    const p = (f.webkitRelativePath || f.name).replaceAll('\\', '/')
    return !p.includes('/.git/') && !p.startsWith('.git/') && !p.includes('/node_modules/')
  })

  // Ищем campaign.json с наименьшей вложенностью (ближайший к корню)
  const metaCandidates = candidateFiles.filter((f) => {
    const p = (f.webkitRelativePath || f.name).replaceAll('\\', '/')
    return p === 'campaign.json' || p.endsWith('/campaign.json')
  }).sort((a, b) => {
    const pa = (a.webkitRelativePath || a.name).replaceAll('\\', '/')
    const pb = (b.webkitRelativePath || b.name).replaceAll('\\', '/')
    return pa.split('/').length - pb.split('/').length
  })

  const metaFile = metaCandidates[0]
  if (!metaFile) {
    throw new Error('В выбранной папке не найден файл campaign.json. Убедитесь, что выбрана папка с кампанией.')
  }

  const fullMetaPath = (metaFile.webkitRelativePath || metaFile.name).replaceAll('\\', '/')
  const rootPrefix = fullMetaPath === 'campaign.json' ? '' : fullMetaPath.slice(0, fullMetaPath.lastIndexOf('campaign.json'))

  const metaText = await metaFile.text()
  const meta = JSON.parse(metaText) as {
    id?: string; title?: string; author?: string; description?: string
    package_format?: number; min_engine?: string; engine_version?: string; version?: string
  }

  const pkg = checkPackage(meta.package_format)
  if (!pkg.ok) throw new Error(pkg.message)
  const engine = checkEngine(meta.min_engine ?? meta.engine_version)
  if (!engine.ok) console.warn(`[chronicle] ${engine.message}`)

  const index = await fetchCampaignIndex()
  const rawId = typeof meta.id === 'string' ? meta.id.trim() : ''
  const safeId = !!rawId && /^[a-z0-9][a-z0-9_-]*$/i.test(rawId)
  let id = safeId ? normalizeCampaignId(rawId) : await newAvailableCampaignId(index.map((entry) => entry.id))
  let idReserved = !safeId
  let idWarning = !safeId
    ? `Папка не содержала безопасного ID; редактор назначил новый UUID «${id}».`
    : rawId !== id
      ? `ID папки нормализован: «${rawId}» → «${id}».`
      : undefined

  const existingEntry = index.find((entry) => entry.id === id)
  let folderExists = idReserved ? false : existingEntry ? true : await campaignFolderExists(id)
  if (safeId && !folderExists) {
    idReserved = await reserveCampaignId(id)
    folderExists = !idReserved
  }

  if (folderExists) {
    let existingTitle = existingEntry?.title ?? id
    const action = resolveConflict
      ? await resolveConflict({ id, existingTitle, incomingTitle: meta.title || id, identicalPackage: false })
      : 'cancel'
    if (action === 'cancel') return { id, title: meta.title || id, cancelled: true }
    if (action === 'copy') {
      id = await newAvailableCampaignId(index.map((entry) => entry.id))
      idReserved = true
      idWarning = `ID «${rawId || 'без ID'}» уже занят; копия импортирована под новым UUID «${id}».`
    } else {
      idReserved = false
      idWarning = `Существующая кампания «${existingTitle}» обновлена из папки; её ID «${id}» сохранён.`
    }
  }

  const importedMeta = { ...meta, id }
  try {
    for (const f of files) {
      const fullRel = (f.webkitRelativePath || f.name).replaceAll('\\', '/')
      let path = rootPrefix && fullRel.startsWith(rootPrefix) ? fullRel.slice(rootPrefix.length) : fullRel
      path = path.replaceAll('\\', '/').replace(/^\/+/, '')
      if (!isAllowedCampaignFile(path)) continue

      if (path.endsWith('.json') || path.endsWith('.ink') || path.endsWith('.md')) {
        const text = path === 'campaign.json' ? JSON.stringify(importedMeta, null, 2) : await f.text()
        await saveFile(`campaigns/${id}/${path}`, text)
      } else {
        const buffer = await f.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const base64 = uint8ArrayToBase64(bytes)
        const response = await fetch('/__editor/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: `campaigns/${id}/${path}`, base64 }),
        })
        if (!response.ok) throw new Error(`${path}: ${response.status}`)
      }
    }

    const result: CampaignIndexEntry = {
      id,
      title: meta.title || id,
      author: meta.author,
      description: meta.description,
    }
    const next = index.filter((entry) => entry.id !== id)
    next.push(result)
    await saveFile('campaigns/index.json', JSON.stringify(next, null, 2))
    return { ...result, idWarning }
  } catch (error) {
    if (idReserved) await deleteCampaignFolder(id).catch(() => undefined)
    throw error
  }
}
