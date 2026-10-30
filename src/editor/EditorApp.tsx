import { useMemo, useRef, useState } from 'react'
import { EditorStore, type EditorSection } from './store'
import { newArena } from './ArenaEditor'
import { newRule } from './RuleEditor'
import { newQuest } from './QuestEditor'
import { generateInk, newDlgDoc } from './dialogueDoc'
import { newCutscene } from './CutsceneEditor'
import { newRecipe } from './RecipeEditor'
import { newCodexEntry } from './CodexEditor'
import { importChronicle } from './chronicle'
import { fetchCampaignIndex, type CampaignIndexEntry } from './newCampaign'
import { ENGINE_VERSION, checkEngine } from '../shared/versions'
import { canOfferEngineVersionRepair, setCurrentEngineRequirement } from './engineVersionRepair'
import { aiFixReport } from './AiWizard'
import { type PlaytestRecord } from './campaignAudit'
import { makeId, normalizeCampaignId, slugify } from './ids'
import './editor.css'
import { campaignIdFromPath } from './editorMenus'
import { askText, askConfirm, showAlert, showList } from './prompt'
import type { CampaignData } from '../shared/types'
import { GameEngine } from '../core/engine'
import { resolveProjectModesForStudio, resolveProjectPackForStudio } from './packCatalog'
import { createCampaignOps } from './editorAppCampaignOps'
import { createFileOps } from './editorAppFileOps'
import { createJsonImportOps } from './editorAppJsonImport'
import { useEditorLoadEffect, useEditorStoreSubscription, useEditorAmbientEffect, useEditorMenuCloseEffect, useEditorToolbarMenusEffect, useEditorCampaignIndexEffect, useEditorUndoKeysEffect, useEditorAutoSelectEffect } from './editorAppEffects'
import type { EditorUi } from './editorAppTypes'
import { EditorTopbar, EditorOverlays } from './editorAppChrome'
import { EditorWorkspace } from './editorAppWorkspace'
import { editorGuardScreen } from './editorAppGuard'
import { EditorPlaytestScreen } from './editorAppScreens'

/**
 * Narthex — Editor Mode (Фаза 4, ТЗ 5).
 * Работает поверх dev-сервера vite: сохранение пишет файлы кампании на диск.
 */

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
  // Отслеживание изменений для ИИ и бейджи (можно отключить для мастеров, не использующих ИИ)
  const [aiDiffEnabled, setAiDiffEnabled] = useState<boolean>(() => {
    return localStorage.getItem('cf_editor_ai_diff') !== '0'
  })
  const toggleAiDiff = () => {
    setAiDiffEnabled((prev) => {
      const next = !prev
      if (next) localStorage.removeItem('cf_editor_ai_diff')
      else localStorage.setItem('cf_editor_ai_diff', '0')
      return next
    })
  }
  const [testEngine, setTestEngine] = useState<GameEngine | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [bookFile, setBookFile] = useState('README.md')
  const [bookContextual, setBookContextual] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  const store = useMemo(() => new EditorStore(base, resolveProjectPackForStudio, resolveProjectModesForStudio), [base])

  const loaded = readyStore === store

  // счётчик правок нужен и файловым операциям (экспорт патча), и шапке редактора
  const modifiedCount = aiDiffEnabled ? store.getModifiedFiles().length : 0
  const ops = createCampaignOps({
    store,
    base,
    setBase,
    setSection,
    setBusy,
    setCampaigns,
    setAiWizard,
    setAiTaskReport,
    setLastPlaytest,
    setSelected,
    setTestCampaign,
    setTestEngine,
    setDebugOpen,
    lastPlaytest,
    campaigns,
    section,
    selected,
    onExit,
  })
  const fileOps = createFileOps({ store, setBase, setSection, setBusy, setCampaigns }, ops)

  useEditorLoadEffect({ store, base, setError, setSelected, setReadyStore })
  useEditorStoreSubscription(store, force)
  useEditorAmbientEffect(testCampaign)
  useEditorMenuCloseEffect(openMenu, setOpenMenu)
  useEditorToolbarMenusEffect()
  useEditorCampaignIndexEffect({ base, setCampaigns })
  useEditorUndoKeysEffect(store)
  // Автовыбор первой записи при входе в раздел.
  // ХУК — до любых early return (`!base` / error / !loaded / playtest):
  // иначе «Кампаний пока нет» → «Создать» даёт React «Rendered more hooks…».
  useEditorAutoSelectEffect({ loaded, base, error, testCampaign, section, selected, store, setSelected })

  const { doImportJson } = createJsonImportOps({ store, base, setBase, setSection, setBusy, setCampaigns, setSelected, ops })


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


  const doImport = async (file: File) => {
    setBusy('Импорт…')
    try {
      const stableId = campaignIdFromPath(base)
      const { importChroniclePackage } = await import('./newCampaign')
      if (!stableId) {
        const entry = await importChroniclePackage(file, fileOps.resolveChronicleConflict)
        if (entry.cancelled) return
        setCampaigns(await fetchCampaignIndex())
        setSection('scenes')
        setBase(`/campaigns/${entry.id}`)
        if (entry.manifestWarnings?.length || entry.idWarning) {
          const details = [
            entry.idWarning,
            entry.manifestWarnings?.length
              ? `${entry.manifestWarnings.length} ссылок в manifest.json автоматически нормализованы; содержимое файлов сохранено.`
              : '',
          ].filter(Boolean).join('\n\n')
          void showAlert('Кампания импортирована', details)
        }
        return
      }
      const { readChronicleCampaignIdentity } = await import('./chronicleIdentity')
      const identity = await readChronicleCampaignIdentity(file)
      const sameId = !!identity.id && normalizeCampaignId(identity.id) === normalizeCampaignId(stableId)
      if (!sameId) {
        const importSeparately = await askConfirm(
          `.chronicle содержит ID «${identity.id || 'не задан'}» для «${identity.title}», а сейчас открыта кампания «${store.meta.title}» с ID «${stableId}». Импортировать файл как отдельную кампанию? При выборе обновления содержимое заменится, но ID открытой кампании сохранится.`,
          'Импортировать отдельно',
          'Обновить открытую',
        )
        if (importSeparately) {
          const entry = await importChroniclePackage(file, fileOps.resolveChronicleConflict)
          if (entry.cancelled) return
          setCampaigns(await fetchCampaignIndex())
          setSection('scenes')
          const detail = entry.alreadyInstalled
            ? `«${entry.title}» уже установлена; повторная копия не создана.`
            : `«${entry.title}» добавлена в список кампаний — выберите её в списке сверху, чтобы открыть.`
          const importedDetails = [
            detail,
            entry.idWarning,
            entry.manifestWarnings?.length
              ? `${entry.manifestWarnings.length} ссылок в manifest.json автоматически нормализованы; содержимое файлов сохранено.`
              : '',
          ].filter(Boolean).join('\n\n')
          void showAlert(entry.alreadyInstalled ? 'Кампания уже импортирована' : 'Кампания импортирована', importedDetails)
          return
        }
      }

      const { warnings: warns, corrections } = await importChronicle(store, file)
      let engineNotice = ''
      const requiredEngine = store.meta.min_engine ?? store.meta.engine_version
      const engineStatus = checkEngine(requiredEngine)
      if (!engineStatus.ok) {
        const contentIssues = store.validateContent()
        if (canOfferEngineVersionRepair(store.meta, contentIssues)) {
          const correctVersion = await askConfirm(
            `В пакете версия кампании ${store.meta.version} совпадает с min_engine «${requiredEngine}», но Narthex сейчас ${ENGINE_VERSION}. Формат пакета поддерживается, а проверка содержимого не нашла ошибок. Похоже, генератор скопировал версию кампании в поле версии движка. Заменить min_engine и устаревшее engine_version на ${ENGINE_VERSION}? Версия кампании останется ${store.meta.version}.`,
            `Исправить на ${ENGINE_VERSION}`,
            'Оставить требование',
          )
          if (correctVersion) {
            setCurrentEngineRequirement(store.meta)
            store.touch('campaign.json')
            engineNotice = `min_engine и engine_version исправлены на ${ENGINE_VERSION}; версия кампании ${store.meta.version} сохранена.`
          } else {
            warns.push(engineStatus.message)
          }
        } else {
          warns.push(engineStatus.message)
        }
      }

      let idNotice = ''
      if (normalizeCampaignId(store.meta.id) !== normalizeCampaignId(stableId)) {
        const incomingId = store.meta.id
        store.setCampaignId(stableId)
        idNotice = `Редактор сохранил ID открытой кампании «${stableId}» и автоматически привёл к нему ID «${incomingId || 'не задан'}» из архива. Остальное содержимое пакета импортировано.`
      }
      ops.updateCurrentCampaignDisplay()
      const correctionNotice = corrections.length
        ? `${corrections.length} ссылок в manifest.json автоматически нормализованы; содержимое файлов сохранено.`
        : ''
      const summary = ['Нажмите «Сохранить», чтобы записать файлы на диск.', idNotice, correctionNotice, engineNotice].filter(Boolean).join('\n\n')
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


  // нет ни одной кампании (свежая сборка или удалили последнюю): редактор
  // остаётся рабочим — создаём новую кампанию прямо отсюда
  const guard = editorGuardScreen({ base, setBase, error, setError, setReadyStore, loaded, store, campaigns, ops, onExit, aiWizard, setAiWizard, busy, doImport, doImportJson, fileInput })
  if (guard) return guard
  if (testCampaign) return <EditorPlaytestScreen testCampaign={testCampaign} testEngine={testEngine} setTestEngine={setTestEngine} setTestCampaign={setTestCampaign} debugOpen={debugOpen} setDebugOpen={setDebugOpen} lastPlaytest={lastPlaytest} setLastPlaytest={setLastPlaytest} ops={ops} />

  const chapterOf = (p: string): string | undefined => {
    switch (section) {
      case 'scenes': return store.scene(p)?.chapter
      case 'rules': return store.rule(p)?.chapter
      case 'quests': return store.quest(p)?.chapter
      case 'cutscenes': return store.cutscene(p)?.chapter
      default: return undefined
    }
  }

  const itemsAll = ops.listFor(section).sort(
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
  const hasList = !['campaign', 'world', 'combat', 'design', 'packs', 'panels'].includes(section)
  const questsOff = store.capabilityModes?.status === 'ready' && store.capabilityModes.modes.quests === 'off'
  const sel = selected && items.some((i) => i.path === selected) ? selected : null
  // счётчики в заголовках групп — мастер сразу видит, сколько документов в «полочке»
  const groupCounts = new Map<string, number>()
  for (const it of items) if (it.group) groupCounts.set(it.group, (groupCounts.get(it.group) ?? 0) + 1)


  const ui: EditorUi = {
    store,
    base,
    setBase,
    readyStore,
    setReadyStore,
    loaded,
    error,
    setError,
    section,
    setSection,
    openMenu,
    setOpenMenu,
    aiWizard,
    setAiWizard,
    aiTaskReport,
    setAiTaskReport,
    auditOpen,
    setAuditOpen,
    lastPlaytest,
    setLastPlaytest,
    q,
    setQ,
    kindF,
    setKindF,
    chapterF,
    setChapterF,
    selected,
    setSelected,
    busy,
    setBusy,
    campaigns,
    setCampaigns,
    testCampaign,
    testEngine,
    setTestEngine,
    debugOpen,
    setDebugOpen,
    bookOpen,
    setBookOpen,
    bookFile,
    setBookFile,
    bookContextual,
    setBookContextual,
    edTheme,
    changeEdTheme,
    aiDiffEnabled,
    toggleAiDiff,
    fileInput,
    folderInput,
    modifiedCount,
    itemsAll,
    items,
    hasList,
    questsOff,
    sel,
    groupCounts,
    createNew,
    doImport,
    doImportJson,
    ops,
    fileOps,
    onExit,
  }

  return (
    <div className={`editor-root ed-theme-${edTheme}`}>
      <EditorTopbar ui={ui} />
      <EditorWorkspace ui={ui} />
      <EditorOverlays ui={ui} />
    </div>
  )
}
