import { useEffect, useState } from 'react'
import type { EditorSection } from './store'

const files = import.meta.glob('../../docs/book/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>
const targets: Partial<Record<EditorSection, { file: string; heading: string }>> = {
  campaign: { file: '../../docs/book/02-editor.md', heading: 'Проект' },
  world: { file: '../../docs/book/02-editor.md', heading: 'Мир' },
  scenes: { file: '../../docs/book/02-editor.md', heading: 'Сцены' },
  entities: { file: '../../docs/book/02-editor.md', heading: 'Персонажи и предметы' },
  dialogues: { file: '../../docs/book/02-editor.md', heading: 'Диалоги' },
  quests: { file: '../../docs/book/02-editor.md', heading: 'История' },
  cutscenes: { file: '../../docs/book/02-editor.md', heading: 'История' },
  rules: { file: '../../docs/book/02-editor.md', heading: 'История' },
  codex: { file: '../../docs/book/02-editor.md', heading: 'История' },
  recipes: { file: '../../docs/book/02-editor.md', heading: 'Механики' },
  arenas: { file: '../../docs/book/02-editor.md', heading: 'Арены боя' },
}

export function EditorBookPanel({ section, sectionLabel, onClose }: { section: EditorSection; sectionLabel: string; onClose: () => void }) {
  const [text, setText] = useState('Загружаю раздел…')
  const target = targets[section]
  useEffect(() => {
    let active = true
    if (!target || !files[target.file]) {
      setText('Раздел книги в работе.')
      return () => { active = false }
    }
    files[target.file]().then((moduleText) => {
      if (!active) return
      const rows = moduleText.split(/\r?\n/)
      const index = rows.findIndex((row) => row.startsWith('## ') && row.toLocaleLowerCase('ru').includes(target.heading.toLocaleLowerCase('ru')))
      if (index < 0) { setText('Раздел книги в работе.'); return }
      const end = rows.findIndex((row, i) => i > index && row.startsWith('## '))
      setText(rows.slice(index, end < 0 ? undefined : end).join('\n'))
    }).catch(() => active && setText('Раздел книги в работе.'))
    return () => { active = false }
  }, [target])
  return <div className="editor-book-backdrop" onClick={onClose}>
    <section className="editor-book-panel" role="dialog" aria-label="Книга мастера" onClick={(e) => e.stopPropagation()}>
      <header><b>Книга мастера · {sectionLabel}</b><button className="btn btn-small" onClick={onClose}>Закрыть</button></header>
      <pre>{text}</pre>
    </section>
  </div>
}
