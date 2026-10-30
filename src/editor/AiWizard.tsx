/**
 * Единый помощник мастера и внешнего ИИ:
 * 1. Задание для ИИ (при открытой кампании): формулировка задачи, автоматический учет
 *    всех ручных правок мастера из визуального редактора и выбор состава чемодана (микро-патч или полный архив).
 * 2. Создание новой кампании (бриф с нуля с назначением стабильного UUID).
 */
import { useState, useMemo, useId } from 'react'
import { Ico } from '../shared/icons'
import { AiNewCampaignTab, SCALES } from './AiNewCampaignTab'
import { AiPatchSection } from './AiPatchSection'
export { GENRES, SCALES, TONES } from './AiNewCampaignTab'
import { showAlert } from '../shared/modals'
import {
  createAiTaskBundle,
  buildAiTaskBrief,
  type AiOutputFormat,
  type AiBundleScope,
} from './aiTask'
import { createCampaignUuid } from './ids'
import { downloadBlob } from './chronicle'
import type { PlaytestRecord } from './campaignAudit'
import type { EditorStore } from './store'


export type AiWizardTab = 'task' | 'new'

interface Props {
  store: EditorStore
  hasCampaign: boolean
  lastPlaytest?: PlaytestRecord | null
  initialReport?: string
  initialTab?: AiWizardTab
  onClose: () => void
}

export function AiWizard({ store, hasCampaign, lastPlaytest, initialReport = '', initialTab, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<AiWizardTab>(initialTab ?? (hasCampaign ? 'task' : 'new'))

  // --- Состояние для вкладки «Задание для ИИ» (открытая кампания) ---
  const [task, setTask] = useState('')
  const [bundleScope, setBundleScope] = useState<AiBundleScope>('patch')
  const outputFormat: AiOutputFormat = 'chronicle'
  const [patchFilter, setPatchFilter] = useState('')
  const [auditAttached, setAuditAttached] = useState(false)
  const [aiDiffTracking, setAiDiffTracking] = useState<boolean>(() => {
    return localStorage.getItem('cf_editor_ai_diff') !== '0'
  })
  const toggleAiDiffTracking = () => {
    setAiDiffTracking((prev) => {
      const next = !prev
      if (next) localStorage.removeItem('cf_editor_ai_diff')
      else localStorage.setItem('cf_editor_ai_diff', '0')
      return next
    })
  }
  // счётчик смены точки отсчёта диффа — просто заставляет useMemo пересчитать список
  const [baselineResetAt, setBaselineResetAt] = useState(0)
  const resetDiffBaseline = () => {
    store.captureBaseline()
    setBaselineResetAt(Date.now())
  }
  const acceptChange = (path: string) => {
    store.acceptChangeAsBaseline(path)
    setBaselineResetAt(Date.now())
  }

  // --- Состояние для создания новой кампании ---
  const [newGenre, setNewGenre] = useState('')
  const [newGenreText, setNewGenreText] = useState('')
  const [newTone, setNewTone] = useState('')
  const [newScale, setNewScale] = useState('')
  const [newBattle, setNewBattle] = useState<number | null>(null)
  const [newAccents, setNewAccents] = useState<Record<string, boolean>>({})
  const [newMust, setNewMust] = useState('')
  const [newMustNot, setNewMustNot] = useState('')
  const [newIdea, setNewIdea] = useState('')
  const [assignedId, setAssignedId] = useState(() => createCampaignUuid())

  const [copyState, setCopyState] = useState('')
  const [busy, setBusy] = useState(false)
  const textareaId = useId()

  // Список изменённых файлов мастера из EditorStore.
  // baselineResetAt — тикер: не участвует в расчёте, лишь заставляет memo пересчитаться
  // после кнопки «Начать отсчёт правок заново».
  const modifiedFiles = useMemo(() => {
    void baselineResetAt
    return hasCampaign ? store.getModifiedFiles() : []
  }, [store, hasCampaign, baselineResetAt])

  // Фильтрация списка изменений, если файлов много
  const filteredMods = useMemo(() => {
    if (!patchFilter.trim()) return modifiedFiles
    const q = patchFilter.toLowerCase().trim()
    return modifiedFiles.filter((m) => m.path.toLowerCase().includes(q) || m.title.toLowerCase().includes(q))
  }, [modifiedFiles, patchFilter])

  // Сводка по категориям изменений (например: 2 сцены, 1 предмет)
  const categoryCountsSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of modifiedFiles) {
      const cat = m.category
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    const parts: string[] = []
    const catLabels: Record<string, string> = {
      scene: 'сцен',
      entity: 'сущностей',
      dialogue: 'диалогов',
      quest: 'квестов',
      rule: 'правил',
      recipe: 'рецептов',
      cutscene: 'катсцен',
      codex: 'кодекса',
      meta: 'паспорт',
      world: 'карта мира',
    }
    for (const [cat, count] of counts.entries()) {
      parts.push(`${count} ${catLabels[cat] || cat}`)
    }
    return parts.join(', ')
  }, [modifiedFiles])

  const copyToClipboard = async (text: string, successMsg: string) => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        ok = document.execCommand('copy')
        textarea.remove()
      } catch {
        ok = false
      }
    }
    setCopyState(ok ? successMsg : 'Не удалось скопировать — выделите текст вручную')
    setTimeout(() => setCopyState(''), 4500)
  }

  // Прикрепление замечаний аудита к тексту задачи
  const attachAuditReport = () => {
    if (!initialReport || auditAttached) return
    const addition = `\n\nИсправь следующие замечания из отчёта проверки:\n${initialReport.trim()}`
    setTask((prev) => (prev ? `${prev.trim()}${addition}` : addition.trim()))
    setAuditAttached(true)
  }

  // Генерация сообщения для вставки в чат с ИИ
  const generateChatMessage = (): string => {
    if (activeTab === 'new') {
      const accentsText = [
        newAccents['выживание'] && 'выживание',
        newAccents['торговля'] && 'торговля',
        newAccents['напарники'] && 'напарники',
      ].filter(Boolean)
      const brief = buildAiTaskBrief({
        mode: 'new',
        idea: newIdea,
        genre: [newGenre && newGenre !== 'Своя тема' ? newGenre : '', newGenreText.trim()].filter(Boolean).join(' — '),
        tone: newTone,
        scaleHint: SCALES.find((item) => item.id === newScale)?.hint,
        battle: newBattle,
        accents: accentsText as string[],
        must: newMust,
        mustNot: newMustNot,
      })
      return [
        'Привет! Создай новую кампанию для тактической RPG Narthex.',
        '',
        brief,
        '',
        `Назначенный ID кампании: ${assignedId} (обязательно укажи его в campaign.json).`,
        'Прикрепляю стартовый чемодан задания с инструкцией и схемами полей.',
      ].join('\n')
    }

    // Режим задачи по существующей кампании:
    const lines: string[] = [
      `Привет! Работаем над кампанией «${store.meta.title}» (ID: ${store.meta.id}).`,
      '',
      'Задача:',
      task.trim() || 'Проверь кампанию, исправь ошибки и продолжи развитие сюжета.',
    ]

    if (modifiedFiles.length > 0) {
      lines.push('')
      lines.push(`В визуальном редакторе внесены ручные правки (затронуто файлов: ${modifiedFiles.length}):`)
      if (modifiedFiles.length <= 6) {
        for (const m of modifiedFiles) {
          lines.push(`- ${m.title} (\`${m.path}\`) — ${m.status === 'added' ? 'новый' : 'изменён'}`)
        }
      } else {
        lines.push(`- Затронуто ${modifiedFiles.length} файлов (${categoryCountsSummary}). Полный список находится в файле CHANGES.md прикреплённого архива.`)
      }
      lines.push('Файлы с моими правками упакованы в прикреплённый архив задачи — распакуй их поверх проекта.')
    }

    return lines.join('\n')
  }

  const handleCopyChatPrompt = async () => {
    const text = generateChatMessage()
    await copyToClipboard(text, 'Текст задачи скопирован в буфер обмена — отправьте его в чат с ИИ вместе с архивом')
  }

  const handleDownloadTaskBundle = async () => {
    setBusy(true)
    setCopyState('')
    try {
      const mode = activeTab === 'new' ? 'new' : 'edit'
      const bundle = await createAiTaskBundle(store, {
        mode,
        task: task.trim() || 'Выполни указанную задачу с учётом правок мастера.',
        bundleScope,
        lastPlaytest,
        assignedCampaignId: assignedId,
        outputFormat,
        previousReport: initialReport,
      })
      downloadBlob(bundle.blob, bundle.filename)
      setCopyState(bundleScope === 'patch' && mode === 'edit'
        ? `Легковесный чемодан с вашими правками скачан (${bundle.filename}). Прикрепите его к сообщению в чате нейросети.`
        : `Архив задания скачан (${bundle.filename}). Отправьте его ИИ-агенту.`)
    } catch (error) {
      void showAlert('Не удалось собрать пакет задания', String(error))
    } finally {
      setBusy(false)
    }
  }

  const toggleAccent = (key: string) => setNewAccents((current) => ({ ...current, [key]: !current[key] }))

  return (
    <div className="modal-overlay">
      <div className="modal-box ai-wizard" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <Ico n="sparkle" /> Мастер ИИ
          <span className="editor-spacer" />
          <button type="button" className="btn btn-small" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        {/* Навигация по двум чистым режимам */}
        <div className="ai-wizard-tabs">
          {hasCampaign && (
            <button
              type="button"
              className={`ai-wizard-tab-btn ${activeTab === 'task' ? 'active' : ''}`}
              onClick={() => setActiveTab('task')}
            >
              <Ico n="sparkle" /> Задание для ИИ
              {modifiedFiles.length > 0 && (
                <span className="ai-tab-badge" title="Количество затронутых файлов">{modifiedFiles.length}</span>
              )}
            </button>
          )}
          <button
            type="button"
            className={`ai-wizard-tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('new')
              setAssignedId(createCampaignUuid())
            }}
          >
            <Ico n="plus" /> Создать новую кампанию
          </button>
        </div>

        <div className="ai-wizard-content">
          {/* ════════════════ ВКЛАДКА 1: ЗАДАНИЕ ДЛЯ ИИ (ОТКРЫТАЯ КАМПАНИЯ) ════════════════ */}
          {activeTab === 'task' && hasCampaign && (
            <div className="ai-task-section">
              {/* Поле задачи */}
              <div className="fld fld-block" style={{ margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label htmlFor={textareaId} style={{ fontWeight: 600 }}>Что нужно сделать / задача для ИИ:</label>
                  {initialReport && !auditAttached && (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={attachAuditReport}
                      style={{ fontSize: 11.5, padding: '2px 8px' }}
                    >
                      <Ico n="check" /> Прикрепить замечания проверки
                    </button>
                  )}
                </div>
                <textarea
                  id={textareaId}
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="Опишите задачу: например, добавить квест с допросом смотрителя, сбалансировать торговца Дожа или продолжить главу 2…"
                  style={{ minHeight: 90 }}
                />
              </div>

              <AiPatchSection
                modifiedFiles={modifiedFiles}
                filteredMods={filteredMods}
                categoryCountsSummary={categoryCountsSummary}
                patchFilter={patchFilter}
                bundleScope={bundleScope}
                aiDiffTracking={aiDiffTracking}
                onPatchFilter={setPatchFilter}
                onBundleScope={setBundleScope}
                onToggleAiDiffTracking={toggleAiDiffTracking}
                onResetDiffBaseline={resetDiffBaseline}
                onAcceptChange={acceptChange}
              />

              {/* Главные действия */}
              <div className="ai-main-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadTaskBundle}
                  disabled={busy}
                >
                  <Ico n="download" /> {bundleScope === 'patch' ? 'Скачать чемодан с правками (.chronicle)' : 'Скачать полный чемодан (.chronicle)'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCopyChatPrompt}
                >
                  <Ico n="sparkle" /> Скопировать сообщение для чата с ИИ
                </button>
              </div>
            </div>
          )}

          {/* ════════════════ ВКЛАДКА 2: СОЗДАНИЕ НОВОЙ КАМПАНИИ С НУЛЯ ════════════════ */}
          {activeTab === 'new' && (
            <AiNewCampaignTab
              form={{
                genre: newGenre,
                genreText: newGenreText,
                tone: newTone,
                scale: newScale,
                battle: newBattle,
                accents: newAccents,
                must: newMust,
                mustNot: newMustNot,
                idea: newIdea,
              }}
              assignedId={assignedId}
              busy={busy}
              onGenre={(value) => setNewGenre(value)}
              onGenreText={setNewGenreText}
              onTone={(value) => setNewTone(value)}
              onScale={(value) => setNewScale(value)}
              onBattle={setNewBattle}
              onToggleAccent={toggleAccent}
              onMust={setNewMust}
              onMustNot={setNewMustNot}
              onIdea={setNewIdea}
              onDownload={handleDownloadTaskBundle}
              onCopyPrompt={handleCopyChatPrompt}
            />
          )}
        </div>

        {copyState && <div className="modal-status copy-status">{copyState}</div>}

        <div className="modal-buttons" style={{ marginTop: 10 }}>
          <span className="muted small">Narthex • AI Toolkit 0.8.0</span>
          <span className="editor-spacer" />
          <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export const aiFixReport = (findings: string[]): string => [
  'Исправь в кампании Narthex следующие проблемы, сохранив ID и остальной контент:',
  ...findings.map((finding, index) => `${index + 1}. ${finding}`),
].join('\n')
