/**
 * Импорт кампании из вставленного JSON: страница редактора отдаёт контекст, а
 * разбор, выдача нового ID и сохранение остаются здесь.
 *
 * Вынесено из `EditorApp.tsx`: у операции длинное тело и один контекст —
 * стор, базовый путь и сеттеры страницы. Код перенесён без изменений.
 */

import type { Dispatch, SetStateAction } from 'react'
import { fetchCampaignIndex } from './campaignIndex'
import { importMonolithText } from './monolith'
import { newAvailableCampaignId } from './newCampaign'
import { askTextArea, showAlert, showList } from './prompt'
import { campaignIdFromPath } from './editorMenus'
import { aiFixReport } from './AiWizard'
import type { CampaignIndexEntry } from '../shared/types'
import type { EditorSection, EditorStore } from './store'
import type { CampaignOps } from './editorAppCampaignOps'

/** Состояние страницы редактора, нужное импорту JSON. */
export interface JsonImportCtx {
  store: EditorStore
  base: string
  setBase: Dispatch<SetStateAction<string>>
  setSection: Dispatch<SetStateAction<EditorSection>>
  setBusy: Dispatch<SetStateAction<string | null>>
  setCampaigns: Dispatch<SetStateAction<CampaignIndexEntry[]>>
  setSelected: Dispatch<SetStateAction<string | null>>
  ops: CampaignOps
}

/**
 * Собрать операцию импорта JSON поверх текущего состояния страницы.
 * @param ctx стор, базовый путь и сеттеры редактора
 */
export function createJsonImportOps(ctx: JsonImportCtx) {
  const { store, base, setBase, setSection, setBusy, setCampaigns, setSelected, ops } = ctx
  const doImportJson = async () => {
    const text = await askTextArea('Импорт кампании из JSON', {
      body: 'Вставьте текст JSON-кампании целиком или выберите файл.\nИмпорт заменит содержимое текущей кампании; ошибки не прерывают импорт — битое отключается, недостающее достраивается заглушками.',
      placeholder: '{ "campaign": { … }, "world": { … }, "scenes": { … } }',
      ok: 'Импортировать',
      fileLabel: 'Выбрать файл JSON…',
    })
    if (text === null) return
    const creatingCampaign = !base
    const previousBasePath = store.basePath
    let campaignIdWarning: string | undefined
    let reservedCampaignId: string | undefined
    setBusy('Импорт JSON…')
    try {
      const warns = importMonolithText(store, text)
      const incomingId = store.meta.id
      if (creatingCampaign) {
        // Новая кампания всегда получает собственную идентичность от редактора;
        // id в AI JSON не является источником уникальности.
        const index = await fetchCampaignIndex()
        const id = await newAvailableCampaignId(index.map((entry) => entry.id))
        reservedCampaignId = id
        store.setCampaignId(id)
        if (incomingId && incomingId !== id) {
          campaignIdWarning = `Для новой кампании редактор выдал ID «${id}». ID «${incomingId}» из импортированного JSON не использован.`
        }
        store.setBasePath(`/campaigns/${id}`)
        await store.saveToDisk()
        await ops.pushIndex()
        setSection('scenes')
        setSelected(null)
        setBase(`/campaigns/${id}`)
        reservedCampaignId = undefined
      } else {
        // Импорт JSON в открытую кампанию обновляет её, а не меняет её личность.
        const stableId = campaignIdFromPath(base)
        if (incomingId !== stableId) {
          store.setCampaignId(stableId)
          campaignIdWarning = `Кампания сохраняет свой ID «${stableId}». ID «${incomingId || 'не задан'}» из JSON не применён.`
        }
      }

      // Показываем актуальное имя сразу и добавляем пакет, даже если его ещё не
      // было в реестре редактора (например, после импорта в пустую кампанию).
      const entry: CampaignIndexEntry = {
        // ID берём от редактора для новой кампании и из текущего каталога
        // для существующей: импортируемый JSON не меняет идентичность.
        id: creatingCampaign ? store.meta.id : campaignIdFromPath(base),
        title: store.meta.title,
        author: store.meta.author,
        description: store.meta.description,
      }
      setCampaigns((list) => {
        const i = list.findIndex((item) => item.id === entry.id)
        if (i < 0) return [...list, entry]
        const next = list.slice()
        next[i] = entry
        return next
      })
      const resultMessage = `${creatingCampaign
        ? 'Кампания сохранена и добавлена в список.'
        : 'Нажмите «Сохранить», чтобы записать файлы кампании на диск.'}${campaignIdWarning ? `\n\n${campaignIdWarning}` : ''}`
      if (warns.length) {
        void showList(`Импортировано с ${warns.length} предупреждениями`, warns, resultMessage, {
          label: 'Скопировать отчёт для ИИ',
          text: aiFixReport(warns),
        })
      } else {
        void showAlert('Импортировано', resultMessage)
      }
    } catch (e) {
      if (reservedCampaignId) {
        await fetch('/__editor/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: reservedCampaignId }),
        }).catch(() => null)
      }
      if (creatingCampaign) store.setBasePath(previousBasePath)
      void showAlert('Ошибка импорта', String(e))
    } finally {
      setBusy(null)
    }
  }

  return { doImportJson }
}

/** Операции импорта JSON, собранные для страницы редактора. */
export type JsonImportOps = ReturnType<typeof createJsonImportOps>
