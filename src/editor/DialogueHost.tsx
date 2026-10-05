import { useEffect, useState } from 'react'
import type { EditorStore } from './store'
import { inkToDlgDoc } from './inkImport'
import { DialogueBuilder } from './DialogueBuilder'
import { Ico } from '../shared/icons'

/**
 * Хост диалога: если у .ink есть визуальная модель (dlg.json) — конструктор;
 * если нет — автоматически конвертируем ink в модель DlgDoc и открываем
 * в конструкторе и сценарии. Мастер работает в визуальном редакторе и сценарии,
 * не переключаясь в чистый код Ink без необходимости.
 */
export function DialogueHost({ store, path }: { store: EditorStore; path: string }) {
  const dlgPath = path.replace(/\.ink$/, '.dlg.json')
  const [docReady, setDocReady] = useState(false)

  useEffect(() => {
    if (docReady || store.jsonFiles.has(dlgPath)) return
    const ink = store.textFiles.get(path)
    if (ink === undefined) return
    const { doc } = inkToDlgDoc(ink, store.dialogueLabel(path))
    doc.label ??= store.dialogueLabel(path)
    store.jsonFiles.set(dlgPath, doc)
    store.touch(dlgPath)
    setDocReady(true)
  }, [docReady, dlgPath, path, store])

  if (store.jsonFiles.has(dlgPath) || docReady) return <DialogueBuilder key={path} store={store} path={path} />

  return (
    <div className="ink-legacy-note">
      <Ico n="info" /> Разбираю диалог для визуального конструктора…
    </div>
  )
}
