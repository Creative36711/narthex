import { useEffect, useState } from 'react'
import type { EditorStore } from './store'
import { inkToDlgDoc } from './inkImport'
import { DialogueBuilder } from './DialogueBuilder'
import { InkEditor } from './MonacoEditors'
import { Ico } from '../shared/icons'

/**
 * Хост диалога: если у .ink есть визуальная модель (dlg.json) — конструктор;
 * если нет — разово пробуем конвертировать рукописный ink автоматически:
 * чистый разбор → тихое создание модели (правило проекта: ремонт молча,
 * отчёт только при неполной конвертации); иначе показываем код с баннером,
 * где мастер решает — импортировать с предупреждениями или править как код.
 */
export function DialogueHost({ store, path }: { store: EditorStore; path: string }) {
  const dlgPath = path.replace(/\.ink$/, '.dlg.json')
  const [docReady, setDocReady] = useState(false)
  const [warnings, setWarnings] = useState<string[] | null>(null)

  useEffect(() => {
    if (docReady || store.jsonFiles.has(dlgPath)) return
    const ink = store.textFiles.get(path)
    if (ink === undefined) return
    const { doc, warnings } = inkToDlgDoc(ink)
    if (!warnings.length) {
      doc.label ??= store.dialogueLabel(path)
      store.jsonFiles.set(dlgPath, doc)
      store.touch(dlgPath)
      setDocReady(true)
    } else {
      setWarnings(warnings)
    }
  }, [docReady, dlgPath, path, store])

  const applyWithWarnings = () => {
    const ink = store.textFiles.get(path) ?? ''
    const { doc } = inkToDlgDoc(ink)
    doc.label ??= store.dialogueLabel(path)
    store.jsonFiles.set(dlgPath, doc)
    store.touch(dlgPath)
    setDocReady(true)
  }

  if (store.jsonFiles.has(dlgPath) || docReady) return <DialogueBuilder key={path} store={store} path={path} />

  return (
    <>
      {warnings === null ? (
        <div className="ink-legacy-note">
          <Ico n="info" /> Разбираю диалог для визуального конструктора…
        </div>
      ) : (
        <div className="ink-legacy-note">
          <Ico n="info" /> Авторазбор не смог вынести диалог в конструктор целиком:
          <ul style={{ margin: '6px 0 6px 18px' }}>
            {warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}
            {warnings.length > 6 && <li>… и ещё {warnings.length - 6}</li>}
          </ul>
          Можно открыть в конструкторе как есть (отмеченные строки доделать руками)
          или продолжать править кодом Ink.
          <button className="btn btn-small" style={{ marginLeft: 8 }} onClick={applyWithWarnings}>
            <Ico n="message" /> Открыть в конструкторе
          </button>
        </div>
      )}
      <InkEditor key={path} store={store} path={path} />
    </>
  )
}
