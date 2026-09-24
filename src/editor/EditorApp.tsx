import { useEffect, useRef, useState } from 'react'
import type { CampaignMeta, WorldDef } from '../shared/types'
import { EditorStore, type EditorSection, type ManifestDef } from './store'
import { SceneEditor } from './SceneEditor'
import { ArenaEditor, newArena } from './ArenaEditor'
import { RuleEditor, newRule } from './RuleEditor'
import { QuestEditor, newQuest } from './QuestEditor'
import { JsonDocEditor, InkEditor } from './MonacoEditors'
import { exportChronicle, downloadBlob, importChronicle } from './chronicle'
import './editor.css'

/**
 * Chronicle Forge — Editor Mode (Фаза 4, ТЗ 5).
 * Работает поверх dev-сервера vite: сохранение пишет файлы кампании на диск.
 */

const SECTIONS: Array<{ id: EditorSection; label: string }> = [
  { id: 'campaign', label: '⚙ Кампания' },
  { id: 'world', label: '🗺 Мир' },
  { id: 'scenes', label: '🖼 Сцены' },
  { id: 'entities', label: '👤 Сущности' },
  { id: 'rules', label: '⚡ Правила' },
  { id: 'quests', label: '📜 Квесты' },
  { id: 'dialogues', label: '💬 Диалоги' },
  { id: 'arenas', label: '⚔ Арены' },
]

export function EditorApp({ campaignPath, onExit }: { campaignPath: string; onExit: () => void }) {
  const storeRef = useRef<EditorStore | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<EditorSection>('scenes')
  const [selected, setSelected] = useState<string | null>(null)
  const [, force] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!storeRef.current) storeRef.current = new EditorStore(campaignPath)
  const store = storeRef.current

  useEffect(() => {
    store
      .load()
      .then(() => setLoaded(true))
      .catch((e) => setError(String(e)))
  }, [store])

  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store])

  if (error) return <div className="screen-center"><div className="panel error-panel">{error}</div></div>
  if (!loaded) return <div className="screen-center"><div className="loading">Загрузка кампании в редактор…</div></div>

  const listFor = (s: EditorSection): Array<{ path: string; title: string }> => {
    switch (s) {
      case 'scenes':
        return store.scenePaths().map((p) => ({ path: p, title: store.scene(p)?.label ?? p }))
      case 'entities':
        return store.entityPaths().map((p) => ({ path: p, title: store.entity(p)?.id ?? p }))
      case 'rules':
        return store.rulePaths().map((p) => ({ path: p, title: store.rule(p)?.label ?? p }))
      case 'quests':
        return store.questPaths().map((p) => ({ path: p, title: store.quest(p)?.label ?? p }))
      case 'dialogues':
        return store.dialoguePaths().map((p) => ({ path: p, title: p.replace('dialogues/', '') }))
      case 'arenas':
        return store.arenaPaths().map((p) => ({ path: p, title: store.arena(p)?.label ?? p }))
      default:
        return []
    }
  }

  const createNew = () => {
    const name = prompt('Имя файла (без расширения), напр. rule_my_event:')
    if (!name) return
    const fn = name.replace(/[^\w-]/g, '_')
    let path = ''
    if (section === 'scenes')
      path = store.createFile('scenes', `${fn}.json`, {
        id: fn,
        label: 'Новая сцена',
        location: '',
        canvas: { w: 1280, h: 720 },
        states: [{ id: 'state_default', label: 'Обычное', image: '', condition: null }],
        slots: [],
        navigation: [],
      })
    else if (section === 'entities')
      path = store.createFile('entities', `${fn}.json`, {
        id: fn,
        type: 'item',
        category: 'misc',
        label: 'Новый предмет',
        description: '',
        weight: 0.1,
        stackable: true,
      })
    else if (section === 'rules') path = store.createFile('rules', `${fn}.json`, newRule(fn))
    else if (section === 'quests') path = store.createFile('quests', `${fn}.json`, newQuest(fn))
    else if (section === 'arenas') path = store.createFile('arenas', `${fn}.json`, newArena(fn))
    else if (section === 'dialogues')
      path = store.createFile(
        'dialogues',
        `${fn}.ink`,
        `EXTERNAL get_flag(f)\nEXTERNAL set_flag(f)\n\n=== main ===\nПривет, путник.\n+ [Уйти] -> END\n`,
      )
    if (path) setSelected(path)
  }

  const removeSelected = () => {
    if (!selected) return
    if (!confirm(`Удалить ${selected} из манифеста? (файл на диске останется)`)) return
    const fn = selected.split('/').pop()!
    const sectionKey = (section === 'dialogues' ? 'dialogues' : section) as keyof ManifestDef
    store.deleteFile(sectionKey, fn)
    setSelected(null)
  }

  const save = async () => {
    setBusy('Сохранение…')
    try {
      await store.saveToDisk()
      setBusy(null)
    } catch (e) {
      setBusy(null)
      alert(`Ошибка сохранения: ${e}\n(Сохранение на диск работает в dev-режиме vite / Tauri.)`)
    }
  }

  const playtest = async () => {
    await save()
    window.open('/', '_blank')
  }

  const doExport = async () => {
    setBusy('Экспорт .chronicle…')
    try {
      const blob = await exportChronicle(store)
      downloadBlob(blob, `${store.meta.id}.chronicle`)
    } finally {
      setBusy(null)
    }
  }

  const doImport = async (file: File) => {
    setBusy('Импорт…')
    try {
      const warns = await importChronicle(store, file)
      alert(`Импортировано. ${warns.length ? `Предупреждения:\n${warns.join('\n')}` : 'Нажмите «Сохранить», чтобы записать файлы на диск.'}`)
    } catch (e) {
      alert(`Ошибка импорта: ${e}`)
    } finally {
      setBusy(null)
    }
  }

  const items = listFor(section)
  const hasList = !['campaign', 'world'].includes(section)
  const sel = selected && items.some((i) => i.path === selected) ? selected : null

  return (
    <div className="editor-root">
      <header className="editor-topbar">
        <span className="editor-brand">CHRONICLE FORGE · РЕДАКТОР</span>
        <span className="editor-title">{store.meta.title}</span>
        <span className="editor-spacer" />
        {busy && <span className="muted small">{busy}</span>}
        <span className={`editor-dirty ${store.dirty.size ? 'on' : ''}`}>
          {store.dirty.size ? `несохранено: ${store.dirty.size}` : 'все сохранено'}
        </span>
        <button className="btn btn-small btn-primary" onClick={save} disabled={!store.dirty.size}>
          💾 Сохранить
        </button>
        <button className="btn btn-small" onClick={playtest}>▶ Плейтест</button>
        <button className="btn btn-small" onClick={doExport}>⬇ .chronicle</button>
        <button className="btn btn-small" onClick={() => fileInput.current?.click()}>⬆ Импорт</button>
        <input
          ref={fileInput}
          type="file"
          accept=".chronicle,.zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) doImport(f)
            e.target.value = ''
          }}
        />
        <button className="btn btn-small" onClick={onExit}>✕ Выйти</button>
      </header>

      <div className="editor-body">
        <nav className="editor-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`editor-nav-btn ${section === s.id ? 'on' : ''}`}
              onClick={() => {
                setSection(s.id)
                setSelected(null)
              }}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {hasList && (
          <aside className="editor-list">
            {items.map((it) => (
              <button
                key={it.path}
                className={`editor-list-item ${sel === it.path ? 'on' : ''} ${store.dirty.has(it.path) ? 'dirty' : ''}`}
                onClick={() => setSelected(it.path)}
                title={it.path}
              >
                {it.title}
              </button>
            ))}
            <div className="editor-list-tools">
              <button className="btn btn-small" onClick={createNew}>+ создать</button>
              {sel && (
                <button className="btn btn-small ce-del" onClick={removeSelected}>✕</button>
              )}
            </div>
          </aside>
        )}

        <main className="editor-main">
          {section === 'campaign' && (
            <JsonDocEditor
              key="campaign"
              title="campaign.json — мета кампании"
              getValue={() => JSON.stringify(store.meta, null, 2)}
              apply={(v) => store.setMeta(v as CampaignMeta)}
            />
          )}
          {section === 'world' && (
            <JsonDocEditor
              key="world"
              title="world.json — регионы и локации"
              getValue={() => JSON.stringify(store.world, null, 2)}
              apply={(v) => store.setWorld(v as WorldDef)}
            />
          )}
          {section === 'scenes' && sel && <SceneEditor key={sel} store={store} path={sel} />}
          {section === 'entities' && sel && (
            <JsonDocEditor
              key={sel}
              title={sel}
              getValue={() => JSON.stringify(store.jsonFiles.get(sel), null, 2)}
              apply={(v) => store.setJson(sel, v)}
            />
          )}
          {section === 'rules' && sel && <RuleEditor key={sel} store={store} path={sel} />}
          {section === 'quests' && sel && <QuestEditor key={sel} store={store} path={sel} />}
          {section === 'dialogues' && sel && <InkEditor key={sel} store={store} path={sel} />}
          {section === 'arenas' && sel && <ArenaEditor key={sel} store={store} path={sel} />}
          {hasList && !sel && (
            <div className="screen-center muted">Выберите элемент слева или создайте новый.</div>
          )}
        </main>
      </div>
    </div>
  )
}
