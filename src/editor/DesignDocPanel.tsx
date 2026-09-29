import { useState } from 'react'
import type { EditorStore } from './store'
import { downloadBlob } from './chronicle'
import { showAlert } from './prompt'

/**
 * «Проект → Дизайн-документ» (§R8): мастер читает design_doc из campaign.json
 * прямо в редакторе и правит его без редактора кода — textarea с сохранением
 * по кнопке, копирование/вставка из буфера, скачивание .md.
 *
 * Ctrl+Z в textarea остаётся текстовым undo браузера: глобальный обработчик
 * отката в EditorApp текстовые поля не трогает, а поле коммитится в магазин
 * только кнопкой «Сохранить» — стек отката не ломается.
 */
export function DesignDocPanel({ store }: { store: EditorStore }) {
  const saved = store.meta.design_doc ?? ''
  // null — правок нет; иначе черновик, который ещё не сохранён
  const [draft, setDraft] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const text = draft ?? saved
  const changed = draft !== null && draft !== saved

  const save = () => {
    if (draft === null) return
    store.meta.design_doc = draft
    store.touch('campaign.json')
    setDraft(null)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      void showAlert('Не удалось скопировать', 'Браузер не дал доступ к буферу обмена — выделите текст и скопируйте вручную (Ctrl+C).')
    }
  }

  const paste = async () => {
    try {
      setDraft(await navigator.clipboard.readText())
    } catch {
      void showAlert('Не удалось вставить из буфера', 'Браузер не дал доступ к буферу обмена — вставьте текст вручную (Ctrl+V в поле ниже).')
    }
  }

  const download = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, `${store.meta.id || 'campaign'}-design-doc.md`)
  }

  return (
    <div className="design-doc-panel">
      <div className="design-doc-head">
        <b>Дизайн-документ</b>
        <span className="muted small">
          Ведёт ИИ-агент: сначала документ, потом кампания. Здесь вы читаете его и правите вручную.
        </span>
        <span className="editor-spacer" />
        <button className="btn btn-small" onClick={() => void copy()}>{copied ? 'Скопировано!' : 'Копировать'}</button>
        <button className="btn btn-small" onClick={() => void paste()}>Вставить из буфера</button>
        <button className="btn btn-small" onClick={download} disabled={!text.trim()}>Скачать .md</button>
        <button className="btn btn-small btn-primary" onClick={save} disabled={!changed}>
          {changed ? 'Сохранить' : 'Сохранено'}
        </button>
      </div>
      {!text.trim() && (
        <div className="design-doc-empty">
          Дизайн-документа нет. Попросите агента заполнить <code>design_doc</code> в{' '}
          <code>campaign.json</code> — по нему вы принимаете решения по кампании, не читая код.
        </div>
      )}
      <textarea
        className="design-doc-text"
        value={text}
        spellCheck={false}
        placeholder="Текст дизайн-документа (Markdown): паспорт, завязка, главы, сцены, персонажи, квесты, журнал решений…"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="muted small">
        {changed ? 'Есть несохранённые правки — нажмите «Сохранить».' : 'Изменения попадают в campaign.json после «Сохранить».'}
      </div>
    </div>
  )
}
