import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorStore, type EditorSection, type ManifestDef } from './store'
import { SceneEditor } from './SceneEditor'
import { ArenaEditor, newArena } from './ArenaEditor'
import { RuleEditor, newRule } from './RuleEditor'
import { QuestEditor, newQuest } from './QuestEditor'
import { InkEditor } from './MonacoEditors'
import { EntityEditor } from './EntityEditor'
import { DialogueBuilder, hasDlgDoc, dialogueTitle } from './DialogueBuilder'
import { generateInk, newDlgDoc } from './dialogueDoc'
import { CampaignEditor } from './CampaignEditor'
import { WorldEditor } from './WorldEditor'
import { exportChronicle, downloadBlob, importChronicle } from './chronicle'
import { createCampaign, fetchCampaignIndex, type CampaignIndexEntry } from './newCampaign'
import { makeId, slugify } from './ids'
import './editor.css'
import { askText, askConfirm, showAlert } from './prompt'

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
  const [base, setBase] = useState(campaignPath)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<EditorSection>('scenes')
  const [selected, setSelected] = useState<string | null>(null)
  const [, force] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignIndexEntry[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const store = useMemo(() => new EditorStore(base), [base])

  useEffect(() => {
    setLoaded(false)
    setError(null)
    setSelected(null)
    store
      .load()
      .then(() => setLoaded(true))
      .catch((e) => setError(String(e)))
  }, [store])

  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store])

  useEffect(() => {
    fetchCampaignIndex().then(setCampaigns)
  }, [base])

  // undo: Ctrl+Z вне текстовых полей (в полях работает свой откат браузера/Monaco)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (t.closest('.monaco-editor')) return
      if (store.canUndo()) {
        e.preventDefault()
        store.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])

  const newCampaign = async () => {
    const title = await askText('Название новой кампании', 'например «Тени Северного тракта»')
    if (!title) return
    setBusy('Создание кампании…')
    try {
      const id = await createCampaign(title)
      // подождать, пока dev-сервер начнёт отдавать новые файлы (иначе пустой экран)
      for (let i = 0; i < 10; i++) {
        const ok = await fetch(`/campaigns/${id}/campaign.json?t=${Date.now()}`).then((r) => r.ok).catch(() => false)
        if (ok) break
        await new Promise((r) => setTimeout(r, 250))
      }
      setSection('campaign')
      setSelected(null)
      setBase(`/campaigns/${id}`)
    } catch (e) {
      void showAlert('Не удалось создать кампанию', `${e}\n(Создание работает в dev-режиме vite / Tauri.)`)
    } finally {
      setBusy(null)
    }
  }

  if (error) return <div className="screen-center"><div className="panel error-panel">{error}</div></div>
  if (!loaded) return <div className="screen-center"><div className="loading">Загрузка кампании в редактор…</div></div>

  const listFor = (s: EditorSection): Array<{ path: string; title: string; group?: string; groupOrder?: string }> => {
    switch (s) {
      case 'scenes':
        return store.scenePaths().map((p) => ({ path: p, title: store.scene(p)?.label ?? p }))
      case 'entities':
        // группировка: персонажи, затем предметы по категориям (фидбек №8)
        return store.entityPaths().map((p) => {
          const e = store.entity(p)
          if (!e) return { path: p, title: p }
          if (e.type === 'npc') return { path: p, title: e.label || p, group: '👤 Персонажи', groupOrder: '0' }
          const cat = store.labelFor('itemCategory', e.category)
          return { path: p, title: e.label || p, group: `🎒 ${cat}`, groupOrder: `1${cat}` }
        })
      case 'rules':
        return store.rulePaths().map((p) => ({ path: p, title: store.rule(p)?.label ?? p }))
      case 'quests':
        return store.questPaths().map((p) => ({ path: p, title: store.quest(p)?.label ?? p }))
      case 'dialogues':
        return store.dialoguePaths().map((p) => ({ path: p, title: dialogueTitle(store, p) }))
      case 'arenas':
        return store.arenaPaths().map((p) => ({ path: p, title: store.arena(p)?.label ?? p }))
      default:
        return []
    }
  }

  /** создать элемент: мастер вводит название, id и имя файла генерируются сами */
  const createNew = async (entityType?: 'item' | 'npc') => {
    const label = await askText('Название нового элемента', 'внутреннее имя создастся автоматически')
    if (!label) return
    let path = ''
    if (section === 'scenes') {
      const id = makeId('scene_', label, store.ids('scene'))
      path = store.createFile('scenes', `${id}.json`, {
        id,
        label,
        location: store.ids('location')[0] ?? '',
        canvas: { w: 1280, h: 720 },
        states: [{ id: 'state_default', label: 'Обычное', image: '', condition: null }],
        slots: [],
        navigation: [],
      })
    } else if (section === 'entities') {
      const id = makeId(entityType === 'npc' ? 'npc_' : 'item_', label, store.ids('entity'))
      path = store.createFile(
        'entities',
        `${id}.json`,
        entityType === 'npc'
          ? {
              id,
              type: 'npc',
              label,
              portrait: {},
              stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
              skills: { dodge: 30, spot: 30 },
            }
          : { id, type: 'item', category: 'misc', label, description: '', weight: 0.1, stackable: true },
      )
    } else if (section === 'rules') {
      const id = makeId('rule_', label, store.ids('rule'))
      path = store.createFile('rules', `${id}.json`, { ...newRule(id), label })
    } else if (section === 'quests') {
      const id = makeId('quest_', label, store.ids('quest'))
      path = store.createFile('quests', `${id}.json`, { ...newQuest(id), label })
    } else if (section === 'arenas') {
      const id = makeId('arena_', label, store.ids('arena'))
      path = store.createFile('arenas', `${id}.json`, { ...newArena(id), label })
    } else if (section === 'dialogues') {
      const fn = slugify(label)
      const doc = newDlgDoc(label)
      path = store.createFile('dialogues', `${fn}.ink`, generateInk(doc))
      store.jsonFiles.set(`dialogues/${fn}.dlg.json`, doc)
      store.touch(`dialogues/${fn}.dlg.json`)
    }
    if (path) setSelected(path)
  }

  const removeSelected = async () => {
    if (!selected) return
    const title = listFor(section).find((i) => i.path === selected)?.title ?? selected
    if (!(await askConfirm(`Удалить «${title}»? (файл на диске останется)`, 'Удалить'))) return
    const fn = selected.split('/').pop()!
    const sectionKey = (section === 'dialogues' ? 'dialogues' : section) as keyof ManifestDef
    store.deleteFile(sectionKey, fn)
    if (section === 'dialogues') {
      // вместе с .ink убираем визуальный исходник конструктора
      const dlg = `dialogues/${fn.replace(/\.ink$/, '.dlg.json')}`
      store.jsonFiles.delete(dlg)
      store.dirty.delete(dlg)
    }
    setSelected(null)
  }

  const save = async () => {
    setBusy('Сохранение…')
    try {
      await store.saveToDisk()
      setBusy(null)
    } catch (e) {
      setBusy(null)
      void showAlert('Ошибка сохранения', `${e}\n(Сохранение на диск работает в dev-режиме vite / Tauri.)`)
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
      void showAlert('Импортировано', warns.length ? `Предупреждения:\n${warns.join('\n')}` : 'Нажмите «Сохранить», чтобы записать файлы на диск.')
    } catch (e) {
      void showAlert('Ошибка импорта', String(e))
    } finally {
      setBusy(null)
    }
  }

  const items = listFor(section).sort(
    (a, b) => (a.groupOrder ?? '').localeCompare(b.groupOrder ?? '', 'ru') || a.title.localeCompare(b.title, 'ru'),
  )
  const hasList = !['campaign', 'world'].includes(section)
  const sel = selected && items.some((i) => i.path === selected) ? selected : null

  return (
    <div className="editor-root">
      <header className="editor-topbar">
        <span className="editor-brand">CHRONICLE FORGE · РЕДАКТОР</span>
        {campaigns.length > 0 ? (
          <select
            className="campaign-select"
            value={base}
            onChange={async (e) => {
              const v = e.target.value
              if (store.dirty.size && !(await askConfirm('Есть несохранённые изменения. Сменить кампанию без сохранения?', 'Сменить'))) return
              setBase(v)
            }}
            title="Кампания"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={`/campaigns/${c.id}`}>{c.title}</option>
            ))}
            {!campaigns.some((c) => `/campaigns/${c.id}` === base) && <option value={base}>{store.meta.title}</option>}
          </select>
        ) : (
          <span className="editor-title">{store.meta.title}</span>
        )}
        <button className="btn btn-small" onClick={newCampaign} title="Создать новую кампанию">＋ Кампания</button>
        <span className="editor-spacer" />
        <button
          className="btn btn-small"
          onClick={() => store.undo()}
          disabled={!store.canUndo()}
          title="Откатить последнее изменение (Ctrl+Z)"
        >
          ↩ Откат
        </button>
        {busy && <span className="muted small">{busy}</span>}
        <span className={`editor-dirty ${store.dirty.size ? 'on' : ''}`}>
          {store.dirty.size ? `несохранено: ${store.dirty.size}` : 'все сохранено'}
        </span>
        <button className="btn btn-small btn-primary" onClick={save} disabled={!store.dirty.size}>
          💾 Сохранить
        </button>
        <button className="btn btn-small" onClick={playtest}>▶ Плейтест</button>
        <button className="btn btn-small" onClick={doExport} title="Скачать кампанию одним файлом .chronicle">⬇ Экспорт</button>
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
            {items.map((it, i) => (
              <div key={it.path}>
                {it.group && it.group !== items[i - 1]?.group && <div className="editor-list-group">{it.group}</div>}
                <button
                  className={`editor-list-item ${sel === it.path ? 'on' : ''} ${store.dirty.has(it.path) ? 'dirty' : ''}`}
                  onClick={() => setSelected(it.path)}
                  title={it.path}
                >
                  {it.title}
                </button>
              </div>
            ))}
            <div className="editor-list-tools">
              {section === 'entities' ? (
                <>
                  <button className="btn btn-small" onClick={() => createNew('item')}>+ предмет</button>
                  <button className="btn btn-small" onClick={() => createNew('npc')}>+ NPC</button>
                </>
              ) : (
                <button className="btn btn-small" onClick={() => createNew()}>+ создать</button>
              )}
              {sel && (
                <button className="btn btn-small ce-del" onClick={removeSelected}>✕</button>
              )}
            </div>
          </aside>
        )}

        <main className="editor-main">
          {section === 'campaign' && <CampaignEditor key={`c-${base}`} store={store} />}
          {section === 'world' && <WorldEditor key={`w-${base}`} store={store} />}
          {section === 'scenes' && sel && <SceneEditor key={sel} store={store} path={sel} />}
          {section === 'entities' && sel && <EntityEditor key={sel} store={store} path={sel} />}
          {section === 'rules' && sel && <RuleEditor key={sel} store={store} path={sel} />}
          {section === 'quests' && sel && <QuestEditor key={sel} store={store} path={sel} />}
          {section === 'dialogues' && sel && (hasDlgDoc(store, sel)
            ? <DialogueBuilder key={sel} store={store} path={sel} />
            : (
              <>
                <div className="ink-legacy-note">
                  ℹ️ Этот диалог написан вручную на языке Ink, поэтому открыт как код.
                  Новые диалоги (кнопка «+ создать») открываются в визуальном конструкторе —
                  без кода: узлы, реплики и ответы собираются формами.
                </div>
                <InkEditor key={sel} store={store} path={sel} />
              </>
            ))}
          {section === 'arenas' && sel && <ArenaEditor key={sel} store={store} path={sel} />}
          {hasList && !sel && (
            <div className="screen-center muted">Выберите элемент слева или создайте новый.</div>
          )}
        </main>
      </div>
    </div>
  )
}
