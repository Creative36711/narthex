import { useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import './monacoSetup'
import type { EditorStore } from './store'

/**
 * Monaco-редакторы (ТЗ 5.2.7): JSON-документы кампании и Ink-диалоги
 * с компиляцией и показом ошибок.
 */

const MONACO_OPTS = {
  minimap: { enabled: false },
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on' as const,
}

/** JSON-документ: campaign.json / world.json / сущности. Применение — по кнопке. */
export function JsonDocEditor({
  title,
  getValue,
  apply,
}: {
  title: string
  getValue: () => string
  apply: (parsed: unknown) => void
}) {
  const [text, setText] = useState(getValue)
  const [err, setErr] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const initial = useRef(text)

  const dirty = text !== initial.current

  return (
    <div className="mono-editor">
      <div className="mono-toolbar">
        <b>{title}</b>
        <span className={`mono-status ${err ? 'fld-err' : ''}`}>
          {err ? err : dirty ? 'изменено (не применено)' : savedFlash ? 'применено' : ''}
        </span>
        <button
          className="btn btn-small btn-primary"
          disabled={!dirty}
          onClick={() => {
            try {
              const parsed = JSON.parse(text)
              apply(parsed)
              initial.current = text
              setErr(null)
              setSavedFlash(true)
              setTimeout(() => setSavedFlash(false), 1500)
            } catch (e) {
              setErr(`JSON: ${String((e as Error).message)}`)
            }
          }}
        >
          Применить
        </button>
      </div>
      <div className="mono-body">
        <Editor
          language="json"
          theme="vs-dark"
          value={text}
          onChange={(v) => setText(v ?? '')}
          options={MONACO_OPTS}
        />
      </div>
    </div>
  )
}

/** Ink-диалог с проверкой компиляции (inkjs). */
export function InkEditor({ store, path }: { store: EditorStore; path: string }) {
  const [text, setText] = useState(() => store.textFiles.get(path) ?? '')
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  const check = async (): Promise<boolean> => {
    try {
      const { Compiler } = await import('inkjs/full')
      const compiler = new Compiler(text)
      compiler.Compile()
      const errors = (compiler as unknown as { errors?: string[] }).errors ?? []
      const warnings = (compiler as unknown as { warnings?: string[] }).warnings ?? []
      if (errors.length) {
        setStatus({ ok: false, msg: errors.join('\n') })
        return false
      }
      setStatus({ ok: true, msg: `Компиляция OK${warnings.length ? `; предупреждения:\n${warnings.join('\n')}` : ''}` })
      return true
    } catch (e) {
      setStatus({ ok: false, msg: String(e) })
      return false
    }
  }

  const dirty = text !== (store.textFiles.get(path) ?? '')

  return (
    <div className="mono-editor">
      <div className="mono-toolbar">
        <b>{path}</b>
        <button className="btn btn-small" onClick={check}>
          Проверить (ink)
        </button>
        <button
          className="btn btn-small btn-primary"
          disabled={!dirty}
          onClick={async () => {
            if (await check()) {
              store.setText(path, text)
            }
          }}
        >
          Применить
        </button>
      </div>
      {status && (
        <pre className={`ink-status ${status.ok ? 'ink-ok' : 'ink-bad'}`}>{status.msg}</pre>
      )}
      <div className="mono-body">
        <Editor
          language="ink"
          theme="vs-dark"
          value={text}
          onChange={(v) => setText(v ?? '')}
          options={MONACO_OPTS}
        />
      </div>
    </div>
  )
}
