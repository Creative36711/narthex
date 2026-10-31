/**
 * Файловые операции редактора: экспорт кампании и правок, импорт папки проекта.
 *
 * Вынесено из `EditorApp.tsx`: экспорт и импорт папки делят один контекст со
 * страницей. Тело операций перенесено без изменений; операции над кампанией
 * приходят вторым параметром, потому что импорт папки обновляет реестр.
 */

import { clearAiDiffSnapshot } from '../shared/aiBaseline'
import { exportChronicle, exportPatchChronicle, downloadBlob } from './chronicle'
import { askChecked, askConfirm, showAlert, showList } from './prompt'
import { collectExternalUrls, embedExternalAssets } from './assets'
import { exportMonolith } from './monolith'
import { fetchCampaignIndex } from './campaignIndex'
import type { CampaignIndexEntry } from '../shared/types'
import type { ChronicleIdConflict } from './newCampaign'
import type { CampaignOps } from './editorAppCampaignOps'
import type { Dispatch, SetStateAction } from 'react'
import type { EditorStore, EditorSection } from './store'

/** Состояние страницы редактора, нужное файловым операциям. */
export interface FileOpsCtx {
  store: EditorStore
  setBase: Dispatch<SetStateAction<string>>
  setSection: Dispatch<SetStateAction<EditorSection>>
  setBusy: Dispatch<SetStateAction<string | null>>
  setCampaigns: Dispatch<SetStateAction<CampaignIndexEntry[]>>
}

/**
 * Собрать файловые операции поверх текущего состояния страницы.
 * @param ctx стор, базовый путь и сеттеры редактора
 * @param ops операции над кампанией (обновление реестра при импорте папки)
 */
export function createFileOps(ctx: FileOpsCtx, ops: CampaignOps) {
  const { store, setBase, setSection, setBusy, setCampaigns } = ctx

  const doExport = async () => {
    const external = collectExternalUrls(store)
    const res = await askChecked(
      external.length
        ? `Экспорт «${store.meta.title}». В кампании ${external.length} внешних ссылок (картинки/звук с чужого сервера).`
        : `Экспорт «${store.meta.title}» одним файлом .narthex.`,
      'Вшить внешние ссылки в пакет (кампания станет автономной)',
      'Экспорт',
    )
    if (!res.ok) return
    setBusy('Экспорт .narthex…')
    try {
      const notes: string[] = []
      if (res.checked) {
        setBusy('Скачиваю внешние файлы…')
        notes.push(...(await embedExternalAssets(store)))
      }
      const blob = await exportChronicle(store)
      downloadBlob(blob, `${store.meta.id}.narthex`)
      if (notes.length) {
        void showList(
          `Пакет собран (${notes.length} внешних файлов)`,
          notes,
          'Файлы скачаны в assets/external/ и ссылки переписаны. Сохраните кампанию, чтобы записать изменения на диск.',
        )
      }
    } catch (e) {
      void showAlert('Не удалось собрать пакет', String(e))
    } finally {
      setBusy(null)
    }
  }


  const doExportPatch = async () => {
    try {
      const { blob, filename, modifiedCount } = await exportPatchChronicle(store)
      downloadBlob(blob, filename)
      void showAlert('Экспорт изменений для ИИ', `Пакет изменений (${modifiedCount} файлов) успешно сохранён в «${filename}».\nОтправьте этот компактный файл ИИ-агенту — он обновит проект без пересылки всей кампании.`)
    } catch (e) {
      void showAlert('Экспорт изменений', String(e))
    }
  }


  const resolveChronicleConflict = async (conflict: ChronicleIdConflict) => {
    const update = await askConfirm(
      `ID «${conflict.id}» уже занят кампанией «${conflict.existingTitle}», а содержимое пакета отличается. Обновить существующую кампанию?`,
      'Обновить существующую',
    )
    if (update) return 'update' as const
    const copy = await askConfirm(
      `Импортировать «${conflict.incomingTitle}» как отдельную копию с новым ID?`,
      'Импортировать копию',
    )
    return copy ? 'copy' as const : 'cancel' as const
  }


  const doExportJson = async () => {
    setBusy('Экспорт JSON…')
    try {
      const { doc, warnings } = exportMonolith(store)
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
      downloadBlob(blob, `${doc.campaign.id || 'campaign'}.json`)
      if (warnings.length) {
        void showList(`JSON собран (${warnings.length} замечаний)`, warnings, 'Файл скачан. Замечания — различия между файлами пакета и JSON-форматом:')
      }
    } catch (e) {
      void showAlert('Не удалось собрать JSON', String(e))
    } finally {
      setBusy(null)
    }
  }


  const doImportDirectory = async (files: FileList | File[]) => {
    setBusy('Импорт папки…')
    try {
      const { importCampaignFromDirectory } = await import('./newCampaign')
      const entry = await importCampaignFromDirectory(files, resolveChronicleConflict)
      if (entry.cancelled) return
      // импортированная кампания — новая точка отсчёта ручных правок мастера
      clearAiDiffSnapshot(`/campaigns/${entry.id}`)
      setCampaigns(await fetchCampaignIndex())
      setSection('scenes')
      setBase(`/campaigns/${entry.id}`)
      ops.updateCurrentCampaignDisplay()
      if (entry.alreadyInstalled) {
        void showAlert('Кампания открыта', `«${entry.title}» уже установлена в движке.`)
      } else {
        void showAlert('Кампания импортирована', `Кампания «${entry.title}» успешно загружена из папки.`)
      }
    } catch (e) {
      void showAlert('Ошибка импорта папки', String(e))
    } finally {
      setBusy(null)
    }
  }


  return { doExport, doExportPatch, resolveChronicleConflict, doExportJson, doImportDirectory }
}

/** Файловые операции, собранные для страницы редактора. */
export type FileOps = ReturnType<typeof createFileOps>
