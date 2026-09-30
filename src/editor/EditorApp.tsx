import { Ico } from '../shared/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorStore, type EditorSection, type ManifestDef } from './store'
import { SceneEditor } from './SceneEditor'
import { ArenaEditor, newArena } from './ArenaEditor'
import { RuleEditor, newRule } from './RuleEditor'
import { QuestEditor, newQuest } from './QuestEditor'
import { DialogueHost } from './DialogueHost'
import { EntityEditor } from './EntityEditor'
import { dialogueTitle } from './DialogueBuilder'
import { generateInk, newDlgDoc } from './dialogueDoc'
import { CampaignEditor } from './CampaignEditor'
import { CombatRulesEditor } from './CombatRulesEditor'
import { WorldEditor } from './WorldEditor'
import { CutsceneEditor, newCutscene } from './CutsceneEditor'
import { RecipeEditor, newRecipe } from './RecipeEditor'
import { CodexEditor, newCodexEntry } from './CodexEditor'
import { exportChronicle, downloadBlob, importChronicle } from './chronicle'
import {
  createCampaign,
  fetchCampaignIndex,
  newAvailableCampaignId,
  syncIndexEntry,
  type CampaignIndexEntry,
} from './newCampaign'
import { stopMusic } from '../shared/music'
import { setAmbientAudioEnabled } from '../shared/audio'
import { themeVars } from '../shared/theme'
import { BUILTIN_CODEX_CATEGORIES } from '../shared/types'
import { profileClass, atmosphereOn } from '../shared/profiles'
import { AiWizard, aiFixReport } from './AiWizard'
import { CampaignAuditDialog } from './CampaignAuditDialog'
import { campaignContentHash, type PlaytestRecord } from './campaignAudit'
import { makeId, normalizeCampaignId, slugify } from './ids'
import './editor.css'
import { askText, askConfirm, showAlert, showList, askChecked, askTextArea } from './prompt'
import { collectExternalUrls, embedExternalAssets } from './assets'
import { exportMonolith, importMonolithText } from './monolith'
import { campaignFromMonolith } from './playtest'
import type { CampaignData, ItemDef } from '../shared/types'
import { GameEngine, deleteSave } from '../core/engine'
import { GameView } from '../player/GameView'
import { CharacterCreation } from '../player/CharacterCreation'
import { PlaytestDebugPanel } from './PlaytestDebugPanel'
import type { CharChoice } from '../core/charcreate'
import { EditorBookPanel } from './EditorBookPanel'
import { DesignDocPanel } from './DesignDocPanel'

/**
 * Chronicle Forge — Editor Mode (Фаза 4, ТЗ 5).
 * Работает поверх dev-сервера vite: сохранение пишет файлы кампании на диск.
 */

type SectionItem = { id: EditorSection; label: string }

/** верхнее меню — категории (фидбек 4): плоский список из 9 кнопок захламлял шапку */
const MENUS: Array<{ id: string; label: string; items: SectionItem[] }> = [
  {
    id: 'project',
    label: 'Проект',
    items: [
      { id: 'campaign', label: 'Кампания и реестры' },
      { id: 'design', label: 'Дизайн-документ' },
    ],
  },
  {
    id: 'world',
    label: 'Мир',
    items: [
      { id: 'world', label: 'Регионы и локации' },
      { id: 'scenes', label: 'Сцены' },
      { id: 'arenas', label: 'Арены боя' },
    ],
  },
  {
    id: 'cast',
    label: 'Персонажи',
    items: [
      { id: 'entities', label: 'Сущности (NPC и предметы)' },
      { id: 'dialogues', label: 'Диалоги' },
    ],
  },
  {
    id: 'story',
    label: 'История',
    items: [
      { id: 'quests', label: 'Квесты' },
      { id: 'cutscenes', label: 'Катсцены' },
      { id: 'rules', label: 'Правила мира' },
      { id: 'codex', label: 'Кодекс' },
    ],
  },
  {
    id: 'mechanics',
    label: 'Механики',
    items: [
      { id: 'combat', label: 'Правила боя' },
      { id: 'recipes', label: 'Рецепты крафта' },
    ],
  },
]

function navLabelOf(id: EditorSection): string {
  for (const m of MENUS) for (const it of m.items) if (it.id === id) return it.label
  return id
}

function campaignIdFromPath(path: string): string {
  const pathname = path.startsWith('http') ? new URL(path).pathname : path
  const parts = pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

export function EditorApp({ campaignPath, onExit }: { campaignPath: string; onExit: () => void }) {
  const [base, setBase] = useState(campaignPath)
  // готовность привязана к конкретному стору: при смене кампании первый же
  // рендер видит loaded=false (иначе — краш на пустом манифесте)
  const [readyStore, setReadyStore] = useState<EditorStore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<EditorSection>('scenes')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [aiWizard, setAiWizard] = useState(false)
  const [aiTaskReport, setAiTaskReport] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [lastPlaytest, setLastPlaytest] = useState<PlaytestRecord | null>(null)
  const [q, setQ] = useState('')
  const [kindF, setKindF] = useState<'all' | 'npc' | 'item'>('all')
  const [chapterF, setChapterF] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [, force] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignIndexEntry[]>([])
  const [testCampaign, setTestCampaign] = useState<CampaignData | null>(null)
  // тема рабочего полотна редактора (фидбек 17): выбор мастера, глобально в localStorage
  const [edTheme, setEdTheme] = useState<'paper' | 'dark' | 'anthracite'>(() => {
    const v = localStorage.getItem('cf_editor_theme')
    return v === 'dark' || v === 'anthracite' ? v : 'paper'
  })
  const changeEdTheme = (v: 'paper' | 'dark' | 'anthracite') => {
    setEdTheme(v)
    if (v === 'paper') localStorage.removeItem('cf_editor_theme')
    else localStorage.setItem('cf_editor_theme', v)
  }
  const [testEngine, setTestEngine] = useState<GameEngine | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [bookFile, setBookFile] = useState('README.md')
  const [bookContextual, setBookContextual] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const store = useMemo(() => new EditorStore(base), [base])

  const loaded = readyStore === store

  useEffect(() => {
    setError(null)
    setSelected(null)
    // в редакторе фоновой музыки нет (фидбек 9) и фоновых звуков тоже: иначе
    // щелчок по кнопке и гул локации перебивают предпрослушивание синтеза
    stopMusic(0.2)
    setAmbientAudioEnabled(false)
    // пустой base — на диске нет ни одной кампании: грузить нечего, снизу
    // покажем экран «Кампаний пока нет» с кнопкой создания
    if (!base) {
      setReadyStore(null)
      return
    }
    store
      .load()
      .then(() => setReadyStore(store))
      .catch((e) => setError(String(e)))
  }, [store, base])

  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store])

  // плейтест — это уже игра: возвращаем фоновые звуки движка, в редакторе их нет
  useEffect(() => {
    setAmbientAudioEnabled(!!testCampaign)
  }, [testCampaign])

  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openMenu])

  // Toolbar menus behave as one dismissible menu: outside click closes them,
  // and opening one closes any other toolbar menu.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      const active = target instanceof Element ? target.closest('.editor-toolbar-menu') : null
      document.querySelectorAll<HTMLElement>('.editor-toolbar-menu[open]').forEach((menu) => {
        if (menu !== active) menu.removeAttribute('open')
      })
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // реестр кампаний перечитывается при смене кампании: названия и описания
  // берём из файлов кампаний, поэтому импорт с новым названием сразу виден
  useEffect(() => {
    fetchCampaignIndex().then(setCampaigns)
  }, [base])

  /** обновить строку реестра текущей кампании (после импорта/правки метаданных) */
  const pushIndex = async (patch?: Partial<CampaignIndexEntry>) => {
    await syncIndexEntry({
      id: store.meta.id,
      title: store.meta.title,
      author: store.meta.author,
      description: store.meta.description,
      ...patch,
    })
    setCampaigns(await fetchCampaignIndex())
  }

  const updateCurrentCampaignDisplay = () => {
    const id = campaignIdFromPath(base)
    if (!id) return
    const entry: CampaignIndexEntry = {
      id,
      title: store.meta.title,
      author: store.meta.author,
      description: store.meta.description,
    }
    setCampaigns((list) => {
      const i = list.findIndex((item) => item.id === id)
      if (i < 0) return [...list, entry]
      const next = list.slice()
      next[i] = entry
      return next
    })
  }

  // undo: Ctrl+Z везде в редакторе НАЖИМАЕТ кнопку «Отменить» (фидбек №10:
  // «принцип простой — Ctrl+Z просто нажимает кнопку “Отменить”»). Родной
  // откат браузера в текстовых полях всё равно мёртв: каждое нажатие сразу
  // коммитится в магазин и переписывает DOM, стек браузера ломается.
  // Исключение — текстовые поля: там Ctrl+Z должен отменять правку текста
  // (правка фидбека №18), иначе мастер не может стереть опечатку.
  const textLike = useMemo(
    () => new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']),
    [],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.key на кириллической раскладке даёт «я» — сравниваем физическую
      // клавишу (KeyZ), чтобы Ctrl+Z работал независимо от раскладки
      if (!(e.ctrlKey || e.metaKey) || e.code !== 'KeyZ' || e.shiftKey) return
      const t = e.target as HTMLElement
      if (t.closest('.monaco-editor')) return
      // текстовое поле / textarea: отменяет сам браузер, магазин не трогаем
      if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && textLike.has((t as HTMLInputElement).type))) return
      if (store.canUndo()) {
        e.preventDefault()
        e.stopPropagation()
        store.undo()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [store, textLike])

  // Автовыбор первой записи при входе в раздел.
  // ХУК — до любых early return (`!base` / error / !loaded / playtest):
  // иначе «Кампаний пока нет» → «Создать» даёт React «Rendered more hooks…».
  useEffect(() => {
    if (!loaded || !base || error || testCampaign) return
    if (['campaign', 'world', 'combat', 'design'].includes(section)) return
    if (selected) return
    let first: string | undefined
    try {
      if (section === 'scenes') first = store.scenePaths()[0]
      else if (section === 'entities') first = store.entityPaths()[0]
      else if (section === 'rules') first = store.rulePaths()[0]
      else if (section === 'quests') first = store.questPaths()[0]
      else if (section === 'dialogues') first = store.dialoguePaths()[0]
      else if (section === 'arenas') first = store.arenaPaths()[0]
      else if (section === 'cutscenes') first = store.cutscenePaths()[0]
      else if (section === 'recipes') first = store.recipePaths()[0]
      else if (section === 'codex') first = store.codexPaths()[0]
    } catch {
      return
    }
    if (first) setSelected(first)
  }, [loaded, base, error, testCampaign, section, selected, store])

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

  const deleteCampaign = async () => {
    const cur = campaigns.find((c) => `/campaigns/${c.id}` === base)
    if (!cur) {
      void showAlert('Кампания не найдена в реестре', 'Обновите страницу и попробуйте ещё раз.')
      return
    }
    if (campaigns.length <= 1) {
      void showAlert('Нельзя удалить последнюю кампанию', 'Сначала создайте или импортируйте другую.')
      return
    }
    if (!(await askConfirm(`Удалить кампанию «${cur.title}» безвозвратно? Все её файлы будут стёрты с диска.`, 'Удалить навсегда'))) return
    setBusy('Удаление кампании…')
    try {
      const res = await fetch('/__editor/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: cur.id }),
      })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      const next = campaigns.filter((c) => c.id !== cur.id)
      const saveRes = await fetch('/__editor/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: 'campaigns/index.json', text: JSON.stringify(next, null, 2) }),
      })
      if (!saveRes.ok) throw new Error(`${saveRes.status} ${await saveRes.text()}`)
      setCampaigns(next)
      // удалили последнюю — редактор покажет пустой экран, а не путь в никуда
      setBase(next.length ? `/campaigns/${next[0].id}` : '')
    } catch (e) {
      void showAlert('Не удалось удалить кампанию', `${e}\n(Удаление работает в dev-режиме vite / Tauri.)`)
    } finally {
      setBusy(null)
    }
  }

  const exitEditor = () => onExit()
  const openAiTask = (report = '') => {
    setAiTaskReport(report)
    setAiWizard(true)
  }

  /** Импорт JSON: файл или вставленный текст. В пустом редакторе сразу создаём пакет. */
  const doImportJson = async () => {
    const text = await askTextArea('Импорт кампании из JSON', {
      body: 'Вставьте текст JSON-кампании целиком или выберите файл.\nИмпорт заменит содержимое текущей кампании; ошибки не прерывают импорт — битое отключается, недостающее достраивается заглушками.',
      placeholder: '{ "campaign": { … }, "world": { … }, "scenes": { … } }',
      ok: 'Импортировать',
      fileLabel: 'Выбрать файл JSON…',
    })
    if (text === null) return
    const creatingCampaign = !base
    const previousBasePath = store.basePath
    let campaignIdWarning: string | undefined
    let reservedCampaignId: string | undefined
    setBusy('Импорт JSON…')
    try {
      const warns = importMonolithText(store, text)
      const incomingId = store.meta.id
      if (creatingCampaign) {
        // Новая кампания всегда получает собственную идентичность от редактора;
        // id в AI JSON не является источником уникальности.
        const index = await fetchCampaignIndex()
        const id = await newAvailableCampaignId(index.map((entry) => entry.id))
        reservedCampaignId = id
        store.setCampaignId(id)
        if (incomingId && incomingId !== id) {
          campaignIdWarning = `Для новой кампании редактор выдал ID «${id}». ID «${incomingId}» из импортированного JSON не использован.`
        }
        store.setBasePath(`/campaigns/${id}`)
        await store.saveToDisk()
        await pushIndex()
        setSection('scenes')
        setSelected(null)
        setBase(`/campaigns/${id}`)
        reservedCampaignId = undefined
      } else {
        // Импорт JSON в открытую кампанию обновляет её, а не меняет её личность.
        const stableId = campaignIdFromPath(base)
        if (incomingId !== stableId) {
          store.setCampaignId(stableId)
          campaignIdWarning = `Кампания сохраняет свой ID «${stableId}». ID «${incomingId || 'не задан'}» из JSON не применён.`
        }
      }

      // Показываем актуальное имя сразу и добавляем пакет, даже если его ещё не
      // было в реестре редактора (например, после импорта в пустую кампанию).
      const entry: CampaignIndexEntry = {
        // ID берём от редактора для новой кампании и из текущего каталога
        // для существующей: импортируемый JSON не меняет идентичность.
        id: creatingCampaign ? store.meta.id : campaignIdFromPath(base),
        title: store.meta.title,
        author: store.meta.author,
        description: store.meta.description,
      }
      setCampaigns((list) => {
        const i = list.findIndex((item) => item.id === entry.id)
        if (i < 0) return [...list, entry]
        const next = list.slice()
        next[i] = entry
        return next
      })
      const resultMessage = `${creatingCampaign
        ? 'Кампания сохранена и добавлена в список.'
        : 'Нажмите «Сохранить», чтобы записать файлы кампании на диск.'}${campaignIdWarning ? `\n\n${campaignIdWarning}` : ''}`
      if (warns.length) {
        void showList(`Импортировано с ${warns.length} предупреждениями`, warns, resultMessage, {
          label: 'Скопировать отчёт для ИИ',
          text: aiFixReport(warns),
        })
      } else {
        void showAlert('Импортировано', resultMessage)
      }
    } catch (e) {
      if (reservedCampaignId) {
        await fetch('/__editor/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: reservedCampaignId }),
        }).catch(() => null)
      }
      if (creatingCampaign) store.setBasePath(previousBasePath)
      void showAlert('Ошибка импорта', String(e))
    } finally {
      setBusy(null)
    }
  }

  // нет ни одной кампании (свежая сборка или удалили последнюю): редактор
  // остаётся рабочим — создаём новую кампанию прямо отсюда
  if (!base)
    return (
      <div className="screen-center">
        <div className="panel no-campaign-panel">
          <div className="brand-row">
            <span className="brand">
              <Ico n="forge" /> Редактор Chronicle Forge
            </span>
          </div>
          <h2>Кампаний пока нет</h2>
          <p>
            В <code>public/campaigns</code> пока нет кампаний. Создайте первую вручную, импортируйте JSON или подготовьте задание для внешнего ИИ;
            готовую кампанию можно вернуть одним файлом <code>.chronicle</code>.
          </p>
          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={() => void newCampaign()} disabled={!!busy}>
              {busy ?? 'Создать кампанию'}
            </button>
            <button className="btn" onClick={() => void doImportJson()} disabled={!!busy}>
              Импортировать JSON
            </button>
            <button className="btn" onClick={() => openAiTask()} disabled={!!busy}>
              Подготовить задание для ИИ
            </button>
            <button className="btn" onClick={() => void exitEditor()} disabled={!!busy}>
              В главное меню
            </button>
          </div>
        </div>
        {aiWizard && <AiWizard store={store} hasCampaign={false} onClose={() => setAiWizard(false)} />}
      </div>
    )

  if (error)
    return (
      <div className="screen-center">
        <div className="panel error-panel">
          <h2>Не удалось открыть кампанию</h2>
          <p>{error}</p>
          <div className="fld-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => {
                setError(null)
                store.load().then(() => setReadyStore(store)).catch((e2) => setError(String(e2)))
              }}
            >
              Попробовать снова
            </button>
            {campaigns
              .filter((c) => `/campaigns/${c.id}` !== base)
              .slice(0, 3)
              .map((c) => (
                <button key={c.id} className="btn" onClick={() => setBase(`/campaigns/${c.id}`)}>
                  Открыть «{c.title}»
                </button>
              ))}
            <button className="btn" onClick={() => void exitEditor()}>В главное меню</button>
          </div>
        </div>
      </div>
    )
  if (!loaded) return <div className="screen-center"><div className="loading">Загрузка кампании в редактор…</div></div>

  if (testCampaign) {
    const leaveTest = () => {
      deleteSave(testCampaign.meta.id)
      setLastPlaytest((previous) => previous ? { ...previous, finishedAt: Date.now() } : previous)
      setTestEngine(null)
      setTestCampaign(null)
      setDebugOpen(false)
    }
    const startTest = (choice?: CharChoice) => {
      if (!testCampaign) return
      const e = new GameEngine(testCampaign)
      if (choice) e.applyCharCreation(choice)
      e.start()
      setTestEngine(e)
    }
    // предпросмотр — игровая тема кампании (профиль + шрифты/акцент),
    // оболочка баннера остаётся фирменным стилем редактора
    const playThemeClass = `cf-themed ${profileClass(testCampaign.meta)}${atmosphereOn(testCampaign.meta) ? '' : ' cf-atmos-off'}`
    const playThemeStyle = themeVars(testCampaign, 1)
    return (
      <div className="playtest-shell">
        <div className={playThemeClass} style={playThemeStyle}>
          {testEngine ? <GameView engine={testEngine} onRestart={() => setTestEngine(testEngine.restart())} onExitToMenu={leaveTest} debugPanelOpen={debugOpen} onGamePanelOpen={() => setDebugOpen(false)} /> : (
            <CharacterCreation campaign={testCampaign} onBack={leaveTest} onStart={startTest} />
          )}
        </div>
        <div className="playtest-banner">
          <b>Режим отладки</b>
          <button className="btn btn-small" onClick={() => setDebugOpen((v) => !v)}>{debugOpen ? 'Скрыть панель' : 'Отладка'}</button>
          <button className="btn btn-small" onClick={() => void recordPlaytestResult()}>Записать результат</button>
          <button className="btn btn-small" onClick={leaveTest}>Вернуться в редактор</button>
        </div>
        {debugOpen && testEngine && <PlaytestDebugPanel engine={testEngine} onClose={() => setDebugOpen(false)} />}
      </div>
    )
  }

  const listFor = (s: EditorSection): Array<{ path: string; title: string; group?: string; groupOrder?: string }> => {
    switch (s) {
      case 'scenes':
        // группировка по локациям: мастеру проще искать нужную сцену (ревизия левой панели)
        return store.scenePaths().map((p) => {
          const sc = store.scene(p)
          const loc = sc?.location ? store.labelFor('location', sc.location) : ''
          return {
            path: p,
            title: sc?.label ?? p,
            group: loc || 'Без локации',
            groupOrder: loc ? `0${loc}` : '1',
          }
        })
      case 'entities':
        // группировка: персонажи, затем предметы по категориям (фидбек №8)
        return store.entityPaths().map((p) => {
          const e = store.entity(p)
          if (!e) return { path: p, title: p, type: 'item' as const }
          if (e.type === 'npc') return { path: p, title: e.label || p, type: 'npc' as const, group: 'Персонажи', groupOrder: '0' }
          const cat = store.labelFor('itemCategory', e.category)
          return { path: p, title: e.label || p, type: 'item' as const, group: `${cat}`, groupOrder: `1${cat}` }
        })
      case 'rules':
        return store.rulePaths().map((p) => ({ path: p, title: store.rule(p)?.label ?? p }))
      case 'quests':
        return store.questPaths().map((p) => ({ path: p, title: store.quest(p)?.label ?? p }))
      case 'dialogues':
        return store.dialoguePaths().map((p) => ({ path: p, title: dialogueTitle(store, p) }))
      case 'arenas':
        return store.arenaPaths().map((p) => ({ path: p, title: store.arena(p)?.label ?? p }))
      case 'cutscenes':
        return store.cutscenePaths().map((p) => ({ path: p, title: store.cutscene(p)?.label ?? p }))
      case 'recipes': {
        // группировка: починка отдельно, изготовление — по категории результата
        const out = []
        for (const p of store.recipePaths()) {
          const r = store.recipe(p)
          if (!r) { out.push({ path: p, title: p }); continue }
          if (r.repair) out.push({ path: p, title: r.label || p, group: 'Починка вещей', groupOrder: '1' })
          else {
            const item = (r.output?.item ? store.entity(`entities/${r.output.item}.json`) : undefined) as ItemDef | undefined
            const cat = item?.category ? store.labelFor('itemCategory', item.category) : ''
            out.push({ path: p, title: r.label || p, group: cat || 'Без категории', groupOrder: `0${cat}` })
          }
        }
        return out
      }
      case 'codex':
        // группировка по категориям кодекса (свои из меты, иначе встроенные; ядро — «Хроники»)
        return store.codexPaths().map((p) => {
          const ce = store.codexEntry(p)
          const cats = store.meta.codex_categories ?? BUILTIN_CODEX_CATEGORIES
          const cat = ce?.category ? (cats.find((c) => c.id === ce.category)?.label ?? ce.category) : 'Хроники'
          return { path: p, title: ce?.label ?? p, group: cat, groupOrder: cat }
        })
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
              description: '',
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
    } else if (section === 'cutscenes') {
      const id = makeId('cutscene_', label, store.ids('cutscene'))
      path = store.createFile('cutscenes', `${id}.json`, newCutscene(id, label))
    } else if (section === 'recipes') {
      const id = makeId('recipe_', label, store.ids('recipe'))
      path = store.createFile('recipes', `${id}.json`, newRecipe(id, label))
    } else if (section === 'codex') {
      const id = makeId('codex_', label, store.ids('codex'))
      path = store.createFile('codex', `${id}.json`, newCodexEntry(id, label))
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
      const stableId = campaignIdFromPath(base)
      if (!stableId) throw new Error('Не удалось определить неизменяемый id кампании из её каталога.')
      const rejectedId = store.meta.id !== stableId ? store.meta.id : undefined
      if (rejectedId) store.setCampaignId(stableId)

      await store.saveToDisk()
      await pushIndex()
      setBusy(null)
      if (rejectedId) {
        void showAlert(
          'ID кампании не изменён',
          `Кампания сохраняет свой ID «${stableId}». Значение «${rejectedId}» из импортированного JSON не применено. Чтобы создать отдельную копию, импортируйте пакет как новую кампанию.`,
        )
      }
    } catch (e) {
      setBusy(null)
      void showAlert('Ошибка сохранения', `${e}\n(Сохранение на диск работает в dev-режиме vite / Tauri.)`)
    }
  }

  const recordPlaytestResult = async () => {
    const notes = await askTextArea('Результат плейтеста', {
      body: 'Запишите, что именно вы проверили, что сработало и какие ошибки встретились. Эта заметка попадёт в отчёт проверки и пакет задания для ИИ.',
      placeholder: 'Например: прошёл стартовый квест; переход из сцены в храм не срабатывает…',
      ok: 'Сохранить результат',
    })
    if (notes === null) return
    setLastPlaytest((previous) => previous ? { ...previous, notes: notes.trim() } : previous)
  }

  const playtest = async () => {
    try {
      const { doc, warnings } = exportMonolith(store)
      const problems = [...warnings, ...store.validateContent()]
      const campaign = campaignFromMonolith(doc)
      campaign.basePath = base
      if (!campaign.meta.starting_scene || !campaign.scenes[campaign.meta.starting_scene]) {
        problems.push(`Стартовая сцена «${campaign.meta.starting_scene || 'не выбрана'}» не найдена.`)
      }
      if (problems.length) {
        void showList('Плейтест: проверьте кампанию', problems, 'Исправьте проблемы в редакторе и запустите проверку снова.')
        return
      }
      // Отдельный id гарантирует изоляцию автосохранений от настоящей кампании.
      campaign.meta.id = `${campaign.meta.id}__playtest`
      setLastPlaytest({ startedAt: Date.now(), finishedAt: 0, contentHash: campaignContentHash(store) })
      setTestCampaign(campaign)
      if (!campaign.meta.char_creation) {
        const engine = new GameEngine(campaign)
        engine.start()
        setTestEngine(engine)
      } else setTestEngine(null)
      setDebugOpen(false)
    } catch (e) {
      void showAlert('Не удалось подготовить плейтест', String(e))
    }
  }

  const doExport = async () => {
    const external = collectExternalUrls(store)
    const res = await askChecked(
      external.length
        ? `Экспорт «${store.meta.title}». В кампании ${external.length} внешних ссылок (картинки/звук с чужого сервера).`
        : `Экспорт «${store.meta.title}» одним файлом .chronicle.`,
      'Вшить внешние ссылки в пакет (кампания станет автономной)',
      'Экспорт',
    )
    if (!res.ok) return
    setBusy('Экспорт .chronicle…')
    try {
      const notes: string[] = []
      if (res.checked) {
        setBusy('Скачиваю внешние файлы…')
        notes.push(...(await embedExternalAssets(store)))
      }
      const blob = await exportChronicle(store)
      downloadBlob(blob, `${store.meta.id}.chronicle`)
      if (notes.length) {
        void showList(
          `Пакет собран (${notes.length} внешних файлов)`,
          notes,
          'Файлы скачаны в assets/external/ и ссылки переписаны. Сохраните кампанию, чтобы записать изменения на диск.',
        )
      }
    } catch (e) {
      void showAlert('Не удалось собрать пакет', String(e))
    } finally {
      setBusy(null)
    }
  }

  const doImport = async (file: File) => {
    setBusy('Импорт…')
    try {
      const stableId = campaignIdFromPath(base)
      const [{ importChroniclePackage }, { readChronicleCampaignIdentity }] = await Promise.all([
        import('./newCampaign'),
        import('./chronicleIdentity'),
      ])
      const identity = await readChronicleCampaignIdentity(file)
      const sameId = !!identity.id && normalizeCampaignId(identity.id) === normalizeCampaignId(stableId)
      if (!sameId) {
        const importSeparately = await askConfirm(
          `.chronicle содержит ID «${identity.id || 'не задан'}» для «${identity.title}», а сейчас открыта кампания «${store.meta.title}» с ID «${stableId}». Импортировать файл как отдельную кампанию? При выборе обновления содержимое заменится, но ID открытой кампании сохранится.`,
          'Импортировать отдельно',
          'Обновить открытую',
        )
        if (importSeparately) {
          const entry = await importChroniclePackage(file, async (conflict) => {
            const update = await askConfirm(
              `ID «${conflict.id}» уже занят кампанией «${conflict.existingTitle}», а содержимое пакета отличается. Обновить существующую кампанию?`,
              'Обновить существующую',
            )
            if (update) return 'update'
            const copy = await askConfirm(
              `Импортировать «${conflict.incomingTitle}» как отдельную копию с новым ID?`,
              'Импортировать копию',
            )
            return copy ? 'copy' : 'cancel'
          })
          if (entry.cancelled) return
          setCampaigns(await fetchCampaignIndex())
          setSection('scenes')
          const detail = entry.alreadyInstalled
            ? `«${entry.title}» уже установлена; повторная копия не создана.`
            : `«${entry.title}» добавлена в список кампаний с ID «${entry.id}». Выберите её в списке кампаний сверху, чтобы открыть.`
          void showAlert(entry.alreadyInstalled ? 'Кампания уже импортирована' : 'Кампания импортирована', [detail, entry.idWarning].filter(Boolean).join('\n\n'))
          return
        }
      }

      const warns = await importChronicle(store, file)
      let idNotice = ''
      if (normalizeCampaignId(store.meta.id) !== normalizeCampaignId(stableId)) {
        const incomingId = store.meta.id
        store.setCampaignId(stableId)
        idNotice = `Редактор сохранил ID открытой кампании «${stableId}» и автоматически привёл к нему ID «${incomingId || 'не задан'}» из архива. Остальное содержимое пакета импортировано.`
      }
      updateCurrentCampaignDisplay()
      const summary = ['Нажмите «Сохранить», чтобы записать файлы на диск.', idNotice].filter(Boolean).join('\n\n')
      if (warns.length) {
        void showList('Импортировано с предупреждениями', warns, summary, {
          label: 'Скопировать отчёт для ИИ',
          text: aiFixReport(warns),
        })
      } else {
        void showAlert('Кампания обновлена', summary)
      }
    } catch (e) {
      void showAlert('Ошибка импорта', String(e))
    } finally {
      setBusy(null)
    }
  }

  /** экспорт одним JSON (формат для ИИ-генераторов, блок F) */
  const doExportJson = async () => {
    setBusy('Экспорт JSON…')
    try {
      const { doc, warnings } = exportMonolith(store)
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
      downloadBlob(blob, `${doc.campaign.id || 'campaign'}.json`)
      if (warnings.length) {
        void showList(`JSON собран (${warnings.length} замечаний)`, warnings, 'Файл скачан. Замечания — различия между файлами пакета и JSON-форматом:')
      }
    } catch (e) {
      void showAlert('Не удалось собрать JSON', String(e))
    } finally {
      setBusy(null)
    }
  }

  const chapterOf = (p: string): string | undefined => {
    switch (section) {
      case 'scenes': return store.scene(p)?.chapter
      case 'rules': return store.rule(p)?.chapter
      case 'quests': return store.quest(p)?.chapter
      case 'cutscenes': return store.cutscene(p)?.chapter
      default: return undefined
    }
  }
  const itemsAll = listFor(section).sort(
    (a, b) => (a.groupOrder ?? '').localeCompare(b.groupOrder ?? '', 'ru') || a.title.localeCompare(b.title, 'ru'),
  )
  // живой поиск по названию + фильтр «надевается» (п.1 фидбека 9)
  const items = itemsAll.filter((it) => {
    if (q.trim() && !it.title.toLowerCase().includes(q.trim().toLowerCase())) return false
    if (section === 'entities' && kindF !== 'all') {
      const t = (it as { type?: string }).type
      return kindF === 'npc' ? t === 'npc' : t === 'item'
    }
    if (chapterF) {
      const ch = chapterOf(it.path)
      if (chapterF === '-' ? ch !== undefined : ch !== chapterF) return false
    }
    return true
  })
  const hasList = !['campaign', 'world', 'combat', 'design'].includes(section)
  const sel = selected && items.some((i) => i.path === selected) ? selected : null
  // счётчики в заголовках групп — мастер сразу видит, сколько документов в «полочке»
  const groupCounts = new Map<string, number>()
  for (const it of items) if (it.group) groupCounts.set(it.group, (groupCounts.get(it.group) ?? 0) + 1)

  return (
    <div className={`editor-root ed-theme-${edTheme}`}>
      <header className="editor-topbar">
        <span className="editor-brand">
          <Ico n="forge" /> Chronicle Forge <span className="editor-brand-sub">· редактор</span>
        </span>
        <select
          className="editor-theme-select"
          value={edTheme}
          onChange={(e) => changeEdTheme(e.target.value as 'paper' | 'dark' | 'anthracite')}
          data-tip="Тема оформления редактора (рабочее полотно)"
          aria-label="Тема оформления редактора"
        >
          <option value="paper">Полотно: бумага</option>
          <option value="dark">Полотно: тёмная</option>
          <option value="anthracite">Полотно: графит</option>
        </select>
        {campaigns.length > 0 ? (
          <select
            className="campaign-select"
            value={base}
            onChange={async (e) => {
              const v = e.target.value
              if (store.dirty.size && !(await askConfirm('Есть несохранённые изменения. Сменить кампанию без сохранения?', 'Сменить'))) return
              setBase(v)
            }}
            data-tip="Кампания"
          >
            {campaigns.map((c) => (
              // у открытой кампании показываем живое название из редактора: правка
              // «Кампания → название» видна в списке сразу, без «Сохранить»
              <option key={c.id} value={`/campaigns/${c.id}`}>
                {`/campaigns/${c.id}` === base ? store.meta.title : c.title}
              </option>
            ))}
            {!campaigns.some((c) => `/campaigns/${c.id}` === base) && <option value={base}>{store.meta.title}</option>}
          </select>
        ) : (
          <span className="editor-title">{store.meta.title}</span>
        )}
        <span className="editor-spacer" />
        <button className="btn btn-small" onClick={() => store.undo()} disabled={!store.canUndo()} data-tip="Отменить последнее изменение в кампании">
          <Ico n="undo" /> Отменить
        </button>
        <details className="editor-toolbar-menu">
          <summary className="btn btn-small">Файл <Ico n="chevron" /></summary>
          <div className="editor-toolbar-popup" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) e.currentTarget.closest('details')?.removeAttribute('open') }}>
            <button className="editor-toolbar-item" onClick={newCampaign}><Ico n="plus" /> Новая кампания</button>
            <button className="editor-toolbar-item danger" onClick={deleteCampaign}><Ico n="trash" /> Удалить кампанию</button>
            <div className="editor-toolbar-divider" />
            <button className="editor-toolbar-item" onClick={doExport}><Ico n="download" /> Экспорт .chronicle</button>
            <button className="editor-toolbar-item" onClick={doExportJson}><Ico n="download" /> Экспорт JSON</button>
            <button className="editor-toolbar-item" onClick={() => fileInput.current?.click()}><Ico n="up" /> Импорт .chronicle</button>
            <button className="editor-toolbar-item" onClick={doImportJson}><Ico n="up" /> Импорт из JSON</button>
          </div>
        </details>
        <details className="editor-toolbar-menu">
          <summary className="btn btn-small">Инструменты <Ico n="chevron" /></summary>
          <div className="editor-toolbar-popup" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) e.currentTarget.closest('details')?.removeAttribute('open') }}>
            <button
              className="editor-toolbar-item"
              onClick={() => setAuditOpen(true)}
            ><Ico n="check" /> Проверить кампанию</button>
            <button className="editor-toolbar-item" onClick={() => openAiTask()}><Ico n="sparkle" /> Задание для ИИ</button>
            <button className="editor-toolbar-item" onClick={() => { setBookFile('README.md'); setBookContextual(false); setBookOpen(true) }}><Ico n="book" /> Книга мастера</button>
          </div>
        </details>
        {busy && <span className="muted small">{busy}</span>}
        <span className={`editor-dirty ${store.dirty.size ? 'on' : ''}`}>
          {store.dirty.size ? `несохранено: ${store.dirty.size}` : 'все сохранено'}
        </span>
        <button className="btn btn-small btn-primary" onClick={save} disabled={!store.dirty.size} data-tip="Записать изменения кампании на диск">
          <Ico n="download" /> Сохранить
        </button>
        <button className="btn btn-small editor-playtest-button" onClick={playtest} data-tip="Запустить игру поверх редактора без записи изменений на диск"><Ico n="play" /> Плейтест</button>
        <button className="btn btn-small" onClick={() => void exitEditor()} data-tip="Выйти в главное меню игры"><Ico n="exit" /> Выйти</button>
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
      </header>

      <div className="editor-body">
        <nav className="editor-nav">
          {MENUS.map((menu) => {
            const active = menu.items.some((it) => it.id === section)
            return (
              <div className="editor-nav-menu" key={menu.id} onClick={(e) => e.stopPropagation()}>
                <button
                  className={`editor-nav-btn ${active ? 'on' : ''}`}
                  onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                >
                  {menu.label}
                  <span className="editor-nav-caret"><Ico n="chevron" /></span>
                </button>
                {openMenu === menu.id && (
                  <div className="editor-nav-popup">
                    {menu.items.map((it) => (
                      <button
                        key={it.id}
                        className={`editor-nav-btn ${section === it.id ? 'on' : ''}`}
                        onClick={() => {
                          setSection(it.id)
                          setChapterF('')
                          setSelected(null)
                          setOpenMenu(null)
                        }}
                      >
                        {section === it.id ? <Ico n="chevronRight" /> : ''}{it.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <span className="muted small" style={{ marginLeft: 6 }}>{navLabelOf(section)}</span>
          <button className="editor-help-button" type="button" aria-label="Открыть раздел книги" onClick={() => { setBookFile('02-editor.md'); setBookContextual(true); setBookOpen(true) }}>?</button>
        </nav>

        {hasList && (
          <aside className="editor-list">
            <input
              className="editor-list-search"
              placeholder="Поиск по названию…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {(section === 'scenes' || section === 'rules' || section === 'quests' || section === 'cutscenes') && (store.meta.chapters?.length ?? 0) > 0 && (
              <select
                className="editor-list-chapter"
                value={chapterF}
                data-tip="Фильтр по главе кампании (Проект → Основное → Главы)"
                onChange={(e) => setChapterF(e.target.value)}
              >
                <option value="">все главы</option>
                <option value="-">без главы</option>
                {[...(store.meta.chapters ?? [])]
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
            {section === 'entities' && (
              <div className="chips editor-list-chips">
                {([['all', 'Все'], ['npc', 'Персонажи'], ['item', 'Предметы']] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    className={`chip ${kindF === k ? 'chip-on' : ''}`}
                    data-tip={k === 'npc' ? 'Только персонажи (NPC)' : k === 'item' ? 'Только предметы' : 'Все сущности подряд'}
                    onClick={() => setKindF(k)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            )}
            {items.map((it, i) => (
              <div key={it.path}>
                {it.group && it.group !== items[i - 1]?.group && (
                  <div className="editor-list-group">{it.group} <span className="editor-list-count">{groupCounts.get(it.group)}</span></div>
                )}
                <button
                  className={`editor-list-item ${sel === it.path ? 'on' : ''} ${store.dirty.has(it.path) ? 'dirty' : ''}`}
                  onClick={() => setSelected(it.path)}
                  data-tip={it.path}
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
                <button className="btn btn-small ce-del" onClick={removeSelected}><Ico n="close" /> </button>
              )}
            </div>
          </aside>
        )}

        <main className="editor-main">
          {section === 'campaign' && <CampaignEditor key={`c-${base}`} store={store} />}
          {section === 'design' && <DesignDocPanel key={`d-${base}`} store={store} onEditWithAi={() => openAiTask()} />}
          {section === 'combat' && <CombatRulesEditor key={`cb-${base}`} store={store} />}
          {section === 'world' && <WorldEditor key={`w-${base}`} store={store} />}
          {section === 'scenes' && sel && <SceneEditor key={sel} store={store} path={sel} />}
          {section === 'entities' && sel && <EntityEditor key={sel} store={store} path={sel} />}
          {section === 'rules' && sel && <RuleEditor key={sel} store={store} path={sel} />}
          {section === 'quests' && sel && <QuestEditor key={sel} store={store} path={sel} />}
          {section === 'dialogues' && sel && <DialogueHost key={sel} store={store} path={sel} />}
          {section === 'arenas' && sel && <ArenaEditor key={sel} store={store} path={sel} />}
          {section === 'cutscenes' && sel && <CutsceneEditor key={sel} store={store} path={sel} />}
          {section === 'recipes' && sel && <RecipeEditor key={sel} store={store} path={sel} />}
          {section === 'codex' && sel && <CodexEditor key={sel} store={store} path={sel} />}
          {hasList && !sel && (
            <div className="editor-empty-main">
              <p className="editor-empty-title">
                {items.length === 0 ? 'В этом разделе пока пусто' : 'Ничего не выбрано'}
              </p>
              <p className="muted small">
                {items.length === 0
                  ? 'Создайте первую запись — или импортируйте JSON / чемодан ИИ.'
                  : 'Выберите элемент слева или создайте новый.'}
              </p>
              <div className="editor-empty-actions">
                {section === 'entities' ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={() => createNew('npc')}>
                      + Персонаж
                    </button>
                    <button type="button" className="btn" onClick={() => createNew('item')}>
                      + Предмет
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => createNew()}>
                    + Создать
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      {auditOpen && (
        <CampaignAuditDialog
          store={store}
          lastPlaytest={lastPlaytest}
          onClose={() => setAuditOpen(false)}
          onPrepareAi={(report) => { setAuditOpen(false); openAiTask(report) }}
          onRunPlaytest={() => { setAuditOpen(false); void playtest() }}
        />
      )}
      {aiWizard && <AiWizard
        store={store}
        hasCampaign={!!base}
        lastPlaytest={lastPlaytest}
        initialReport={aiTaskReport}
        onClose={() => { setAiWizard(false); setAiTaskReport('') }}
      />}
      {bookOpen && <EditorBookPanel section={section} sectionLabel={navLabelOf(section)} initialFile={bookFile} contextual={bookContextual} onClose={() => setBookOpen(false)} />}
    </div>
  )
}
