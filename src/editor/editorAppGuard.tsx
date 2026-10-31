/**
 * Ранние экраны страницы редактора: «нет кампании», ошибка загрузки, ожидание
 * загрузки и отсутствующий пак.
 *
 * Вынесено из `EditorApp.tsx`: каждый экран — ранний выход страницы, поэтому
 * они собраны в одну функцию-страж. Файл без компонентов: разметку экранов
 * собирает страница.
 */

import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import { Ico } from '../shared/icons'
import { AiWizard } from './AiWizard'
import { PackMissingNotice } from './PackMissingNotice'
import type { CampaignIndexEntry } from '../shared/types'
import type { EditorStore } from './store'
import type { CampaignOps } from './editorAppCampaignOps'

/** Всё, что нужно ранним экранам страницы редактора. */
export interface EditorGuardProps {
  base: string
  setBase: Dispatch<SetStateAction<string>>
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  setReadyStore: Dispatch<SetStateAction<EditorStore | null>>
  loaded: boolean
  store: EditorStore
  campaigns: CampaignIndexEntry[]
  ops: CampaignOps
  onExit: () => void
  aiWizard: boolean
  setAiWizard: Dispatch<SetStateAction<boolean>>
  busy: string | null
  doImport: (file: File) => Promise<void>
  doImportJson: () => Promise<void>
  fileInput: RefObject<HTMLInputElement | null>
}

/**
 * Ранние экраны страницы: нет кампании, ошибка загрузки, загрузка, нет пака.
 * @param props состояние страницы, нужное заглушкам
 * @returns разметку экрана или null, если страница может рисоваться дальше
 */
export function editorGuardScreen(props: EditorGuardProps): ReactNode {
  const { base, setBase, error, setError, setReadyStore, loaded, store, campaigns, ops, onExit, aiWizard, setAiWizard, busy, doImport, doImportJson, fileInput } = props
  // нет ни одной кампании (свежая сборка или удалили последнюю): редактор
  // остаётся рабочим — создаём новую кампанию прямо отсюда
  if (!base)
    return (
      <div className="screen-center">
        <div className="panel no-campaign-panel">
          <div className="brand-row">
            <span className="brand">
              <Ico n="forge" /> Редактор Narthex
            </span>
          </div>
          <h2>Кампаний пока нет</h2>
          <p>
            В <code>public/campaigns</code> пока нет кампаний. Создайте первую вручную, импортируйте JSON или подготовьте задание для внешнего ИИ;
            готовую кампанию можно вернуть одним файлом <code>.narthex</code>.
          </p>
          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={() => void ops.newCampaign()} disabled={!!busy}>
              {busy ?? 'Создать кампанию'}
            </button>
            <button className="btn" onClick={() => void doImportJson()} disabled={!!busy}>
              Импортировать JSON
            </button>
            <button className="btn" onClick={() => fileInput.current?.click()} disabled={!!busy}>
              Импортировать .narthex
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".narthex,.chronicle,application/zip"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void doImport(file)
              }}
            />
            <button className="btn" onClick={() => ops.openAiTask()} disabled={!!busy}>
              Подготовить задание для ИИ
            </button>
            <button className="btn" onClick={() => void ops.exitEditor()} disabled={!!busy}>
              В главное меню
            </button>
          </div>
        </div>
        {aiWizard && <AiWizard store={store} hasCampaign={false} onClose={() => setAiWizard(false)} />}
      </div>
    )

  if (error)
    return (
      <div className="screen-center">
        <div className="panel error-panel">
          <h2>Не удалось открыть кампанию</h2>
          <p>{error}</p>
          <div className="fld-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => {
                setError(null)
                store.load().then(() => setReadyStore(store)).catch((e2) => setError(String(e2)))
              }}
            >
              Попробовать снова
            </button>
            {campaigns
              .filter((c) => `/campaigns/${c.id}` !== base)
              .slice(0, 3)
              .map((c) => (
                <button key={c.id} className="btn" onClick={() => setBase(`/campaigns/${c.id}`)}>
                  Открыть «{c.title}»
                </button>
              ))}
            <button className="btn" onClick={() => void ops.exitEditor()}>В главное меню</button>
          </div>
        </div>
      </div>
    )
  if (!loaded) return <div className="screen-center"><div className="loading">Загрузка кампании в редактор…</div></div>
  if (store.packResolution?.status === 'missing') {
    return <PackMissingNotice diagnostic={store.packResolution.diagnostic} onExit={onExit} />
  }
  return null
}
