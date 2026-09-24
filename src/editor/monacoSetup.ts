import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/language/json/monaco.contribution.js'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import { loader } from '@monaco-editor/react'

/**
 * Monaco (ТЗ 5.2.7) собирается в бандл (без CDN — важно для Tauri/оффлайна).
 */

;(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })

// простая подсветка Ink
monaco.languages.register({ id: 'ink' })
monaco.languages.setMonarchTokensProvider('ink', {
  tokenizer: {
    root: [
      [/^\s*(===?.*===?|==+\s*\w+.*)$/, 'keyword'],
      [/^\s*(EXTERNAL|VAR|CONST|INCLUDE|LIST)\b.*$/, 'type'],
      [/^\s*[*+]\s*(\{[^}]*\})?\s*\[[^\]]*\]/, 'string'],
      [/^\s*[*+]/, 'string'],
      [/->\s*[\w.]+/, 'keyword'],
      [/~\s*.*$/, 'number'],
      [/\{[^}]*\}/, 'variable'],
      [/#.*$/, 'comment'],
      [/\/\/.*$/, 'comment'],
    ],
  },
})

export { monaco }
