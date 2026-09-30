import { useState } from 'react'
import type { EditorStore } from './store'
import { downloadBlob } from './chronicle'
import { MarkdownView } from './MarkdownView'
import { showAlert } from './prompt'

/** Информационный просмотр design_doc; содержимое ведётся через задачу внешнему ИИ. */
export function DesignDocPanel({ store, onEditWithAi }: { store: EditorStore; onEditWithAi: () => void }) {
  const text = store.meta.design_doc ?? ''
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
      void showAlert('Не удалось скопировать', 'Браузер не дал доступ к буферу обмена. Выделите текст документа и скопируйте вручную.')
    }
  }

  const download = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, `${store.meta.id || 'campaign'}-design-doc.md`)
  }

  return (
    <div className="design-doc-panel">
      <div className="design-doc-head">
        <div className="design-doc-heading">
          <b>Дизайн-документ</b>
          <span className="muted small">Информационная основа кампании. Документ обновляется вместе с кампанией через задание для внешнего ИИ.</span>
        </div>
        <span className="editor-spacer" />
        <button className="btn btn-small btn-primary" onClick={onEditWithAi}>Изменить с ИИ</button>
        <button className="btn btn-small" onClick={() => void copy()} disabled={!text.trim()}>{copied ? 'Скопировано!' : 'Копировать'}</button>
        <button className="btn btn-small" onClick={download} disabled={!text.trim()}>Скачать .md</button>
      </div>
      {text.trim() ? (
        <div className="design-doc-render">
          <MarkdownView source={text} onNavigate={() => {}} />
        </div>
      ) : (
        <div className="design-doc-empty">
          <p>У этой кампании пока нет дизайн-документа. Создайте задание для ИИ: опишите замысел или попросите агента зафиксировать уже существующие решения.</p>
          <button className="btn btn-primary" onClick={onEditWithAi}>Подготовить задание для ИИ</button>
        </div>
      )}
    </div>
  )
}
