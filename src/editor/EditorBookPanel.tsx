import { useEffect, useState } from 'react'
import type { EditorSection } from './store'
import { MarkdownView } from './MarkdownView'

const files = import.meta.glob('../../docs/book/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>
const targets: Partial<Record<EditorSection, { file: string; heading: string }>> = {
  campaign: { file: '02-editor.md', heading: 'Раздел «Проект»' },
  world: { file: '03-content.md', heading: 'Мир и навигация' },
  scenes: { file: '03-content.md', heading: 'Сцены, состояния и слоты' },
  entities: { file: '03-content.md', heading: 'Персонажи и поведения' },
  dialogues: { file: '03-content.md', heading: 'Диалоги' },
  quests: { file: '03-content.md', heading: 'Квесты и журнал' },
  cutscenes: { file: '02-editor.md', heading: 'Раздел «История»' },
  rules: { file: '03-content.md', heading: 'Правила мира' },
  codex: { file: '02-editor.md', heading: 'Раздел «История»' },
  recipes: { file: '03-content.md', heading: 'Бой, магия, прогрессия' },
  arenas: { file: '03-content.md', heading: 'Бой, магия, прогрессия' },
}
/** оглавление книги — берётся из реально существующих файлов (glob), иначе бы «раздел в работе» при появлении новых глав */
const NAV_ALL = [
  ['README.md', 'О книге'], ['01-quick-start.md', 'Быстрый старт'], ['02-editor.md', 'Редактор'],
  ['03-content.md', 'Контент'], ['04-visual.md', 'Визуал'], ['05-mechanics.md', 'Механики'],
  ['06-technical.md', 'Техника и файлы'], ['07-ai.md', 'Работа с ИИ'], ['08-limits.md', 'Пределы'],
  ['09-license.md', 'Лицензия'],
] as const
const NAV = NAV_ALL.filter(([name]) => !!files[`../../docs/book/${name}`])
const modulePath = (file: string) => `../../docs/book/${file}`

export function EditorBookPanel({ section, sectionLabel, initialFile, contextual, onClose }: {
  section: EditorSection
  sectionLabel: string
  initialFile: string
  contextual: boolean
  onClose: () => void
}) {
  const [file, setFile] = useState(initialFile)
  const [isContextual, setIsContextual] = useState(contextual)
  const [text, setText] = useState('Загружаю раздел…')
  const target = isContextual ? targets[section] : undefined

  useEffect(() => {
    let active = true
    const loader = files[modulePath(file)]
    if (!loader) {
      setText('Раздел книги в работе.')
      return () => { active = false }
    }
    loader().then((content) => {
      if (!active) return
      if (target && target.file === file) {
        const rows = content.split(/\r?\n/)
        const index = rows.findIndex((row) => row.startsWith('## ') && row.toLocaleLowerCase('ru').includes(target.heading.toLocaleLowerCase('ru')))
        if (index >= 0) {
          const end = rows.findIndex((row, i) => i > index && row.startsWith('## '))
          setText(rows.slice(index, end < 0 ? undefined : end).join('\n'))
          return
        }
      }
      setText(content)
    }).catch(() => active && setText('Раздел книги в работе.'))
    return () => { active = false }
  }, [file, target])

  const navigate = (next: string) => {
    const normalized = next.split('/').pop() ?? next
    const match = NAV.find(([name]) => name === normalized)
    if (!match) return
    setIsContextual(false)
    setFile(match[0])
  }

  return <div className="editor-book-backdrop" onClick={onClose}>
    <section className="editor-book-panel" role="dialog" aria-label="Книга мастера" onClick={(e) => e.stopPropagation()}>
      <header><div><b>Книга мастера</b>{isContextual && <span className="book-context-label"> · {sectionLabel}</span>}</div><button className="btn btn-small" onClick={onClose}>Закрыть</button></header>
      <nav className="editor-book-nav" aria-label="Разделы книги">
        {NAV.map(([name, label]) => <button key={name} className={`btn btn-small ${file === name ? 'btn-primary' : ''}`} onClick={() => { setFile(name); setIsContextual(false) }}>{label}</button>)}
      </nav>
      <div className="editor-book-content"><MarkdownView source={text} onNavigate={navigate} /></div>
    </section>
  </div>
}
