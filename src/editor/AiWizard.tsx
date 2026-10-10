/**
 * Единый помощник мастера и внешнего ИИ:
 * 1. Задание для ИИ (при открытой кампании): формулировка задачи, автоматический учет
 *    всех ручных правок мастера из визуального редактора и выбор состава чемодана (микро-патч или полный архив).
 * 2. Создание новой кампании (бриф с нуля с назначением стабильного UUID).
 */
import { useState, useMemo, useId } from 'react'
import { Ico } from '../shared/icons'
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
import type { EditorStore, ModifiedFileEntry } from './store'

const GENRES = ['Фэнтези', 'Киберпанк', 'Хоррор', 'Постапок', 'Детектив', 'Приключение', 'Своя тема']
const TONES = ['мрачный', 'героический', 'ироничный', 'эпичный', 'спокойный', 'без пафоса']
const SCALES: Array<{ id: string; label: string; hint: string }> = [
  { id: 'small', label: 'Малая', hint: 'около 3 локаций, 3 персонажей, 1 главный квест' },
  { id: 'medium', label: 'Средняя', hint: 'около 6 локаций, 6 персонажей, 1 главный + 2 побочных квеста' },
  { id: 'big', label: 'Большая', hint: '10+ локаций, 10+ персонажей, сеть главных и побочных квестов' },
  { id: 'any', label: 'На усмотрение ИИ', hint: 'мастер доверяет выбору масштаба' },
]

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

  // Список изменённых файлов мастера из EditorStore
  const modifiedFiles = useMemo(() => hasCampaign ? store.getModifiedFiles() : [], [store, hasCampaign])

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
        'Привет! Создай новую кампанию для тактической RPG Chronicle Forge.',
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

              {/* Блок ручных правок мастера (аккордеон/спойлер с защитой от распирания) */}
              <div className="ai-patch-box">
                <details className="ai-patch-spoiler" open={modifiedFiles.length > 0 && modifiedFiles.length <= 8}>
                  <summary className="ai-patch-summary-row">
                    <span className="ai-patch-summary-left">
                      <Ico n="download" />
                      <strong>Ваши правки в редакторе:</strong>{' '}
                      {modifiedFiles.length === 0 ? (
                        <span className="muted">нет отличий от исходной базы</span>
                      ) : (
                        <span className="ai-patch-count-highlight">
                          {modifiedFiles.length} {modifiedFiles.length === 1 ? 'файл' : modifiedFiles.length < 5 ? 'файла' : 'файлов'}
                          {categoryCountsSummary ? ` (${categoryCountsSummary})` : ''}
                        </span>
                      )}
                    </span>
                    <span className="ai-spoiler-caret"><Ico n="chevron" /></span>
                  </summary>

                  {modifiedFiles.length > 0 && (
                    <div className="ai-patch-expanded-body">
                      {/* Поиск при большом количестве файлов */}
                      {modifiedFiles.length > 6 && (
                        <div className="ai-patch-filter-wrap">
                          <input
                            type="text"
                            className="ai-patch-filter-input"
                            placeholder="Фильтр по названию или пути…"
                            value={patchFilter}
                            onChange={(e) => setPatchFilter(e.target.value)}
                          />
                          <span className="muted small">Показано: {filteredMods.length} из {modifiedFiles.length}</span>
                        </div>
                      )}

                      {/* Скроллируемый контейнер с жестким ограничением высоты */}
                      <div className="ai-patch-scroll-container">
                        {filteredMods.map((m: ModifiedFileEntry) => (
                          <div key={m.path} className={`ai-patch-row status-${m.status}`}>
                            <span className={`ai-status-badge badge-${m.status}`}>
                              {m.status === 'added' ? 'новый' : m.status === 'deleted' ? 'удалён' : 'изменён'}
                            </span>
                            <div className="ai-patch-row-details">
                              <span className="ai-patch-row-title">{m.title}</span>
                              <span className="ai-patch-row-path muted small">{m.path}</span>
                              {m.diffSummary && (
                                <span className="ai-patch-row-diff">{m.diffSummary}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="ai-patch-mini-actions">
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => store.captureBaseline()}
                          data-tip="Считать текущее состояние исходной базой (сбросить список изменений)"
                        >
                          Зафиксировать как новую базу
                        </button>
                      </div>
                    </div>
                  )}
                </details>
              </div>

              {/* Выбор объёма чемодана */}
              <div className="fld fld-block" style={{ margin: 0 }}>
                <span style={{ fontWeight: 600 }}>Состав скачиваемого архива:</span>
                <div className="ai-scope-selector">
                  <label className={`ai-scope-card ${bundleScope === 'patch' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="bundleScope"
                      checked={bundleScope === 'patch'}
                      onChange={() => setBundleScope('patch')}
                    />
                    <div className="ai-scope-text">
                      <div className="ai-scope-title">
                        ⚡ Только мои правки + инструменты ИИ <span className="ai-scope-size">(~60–90 КБ)</span>
                      </div>
                  <div className="ai-scope-desc muted small">
                    Идеально для чата. Содержит только изменённые вами файлы, задачу, схемы и гайд движка. Музыка и картинки не дублируются.
                  </div>
                </div>
              </label>

              <label className={`ai-scope-card ${bundleScope === 'full' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="bundleScope"
                  checked={bundleScope === 'full'}
                  onChange={() => setBundleScope('full')}
                />
                <div className="ai-scope-text">
                  <div className="ai-scope-title">
                    📦 Вся кампания целиком с медиа <span className="ai-scope-size">(полный архив, 20+ МБ)</span>
                  </div>
                  <div className="ai-scope-desc muted small">
                    Включает все сцены, звуки, портреты и музыку. Нужен только при передаче проекта новому агенту с нуля.
                  </div>
                </div>
              </label>
            </div>
            <label className="ai-diff-toggle-row muted small" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={aiDiffTracking}
                onChange={toggleAiDiffTracking}
              />
              <span>Отслеживать ручные правки мастера и показывать счётчик изменений в редакторе</span>
            </label>
          </div>

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
            <div className="ai-new-section">
              <div className="fld fld-block">
                <span>Сеттинг / жанр</span>
                <div className="chips">
                  {GENRES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`chip ${newGenre === value ? 'chip-on' : ''}`}
                      onClick={() => setNewGenre(newGenre === value ? '' : value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {newGenre === 'Своя тема' && (
                  <input
                    type="text"
                    value={newGenreText}
                    onChange={(e) => setNewGenreText(e.target.value)}
                    placeholder="Укажите жанр или сеттинг…"
                  />
                )}
              </div>

              <div className="fld fld-block">
                <span>Тональность</span>
                <div className="chips">
                  {TONES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`chip ${newTone === value ? 'chip-on' : ''}`}
                      onClick={() => setNewTone(newTone === value ? '' : value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fld fld-block">
                <span>Масштаб кампании</span>
                <div className="chips">
                  {SCALES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`chip ${newScale === item.id ? 'chip-on' : ''}`}
                      onClick={() => setNewScale(newScale === item.id ? '' : item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fld fld-block">
                <span>Акценты механик</span>
                <div className="chips">
                  {['выживание', 'торговля', 'напарники'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`chip ${newAccents[key] ? 'chip-on' : ''}`}
                      onClick={() => toggleAccent(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fld fld-block">
                <span>Основная задумка / завязка</span>
                <textarea
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  placeholder="О чём история, кто главный герой, с чего начинается приключение…"
                />
              </div>

              <div className="fld fld-block">
                <span>Соотношение диалогов и боёвки (необязательно)</span>
                <label className="settings-row ai-optional-toggle">
                  <input
                    type="checkbox"
                    checked={newBattle !== null}
                    onChange={(event) => setNewBattle(event.target.checked ? 50 : null)}
                  />
                  <span>Задать соотношение</span>
                </label>
                {newBattle !== null && (
                  <label className="settings-row ai-battle-range" style={{ gap: 10 }}>
                    <span className="muted small">диалоги</span>
                    <input
                      aria-label="Соотношение диалогов и боёвки"
                      type="range"
                      min={0}
                      max={100}
                      value={newBattle}
                      onChange={(event) => setNewBattle(Number(event.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span className="muted small">боёвка</span>
                    <b className="muted small">{newBattle}%</b>
                  </label>
                )}
              </div>

              <div className="fld fld-block">
                <span>Обязательно включить (необязательно)</span>
                <input
                  type="text"
                  value={newMust}
                  onChange={(e) => setNewMust(e.target.value)}
                  placeholder="Особые элементы, локации, персонажи или механики…"
                />
              </div>

              <div className="fld fld-block">
                <span>Исключить / запретить (необязательно)</span>
                <input
                  type="text"
                  value={newMustNot}
                  onChange={(e) => setNewMustNot(e.target.value)}
                  placeholder="Чего точно не должно быть в кампании…"
                />
              </div>

              <div className="fld fld-block">
                <span>Назначенный ID кампании: <code>{assignedId}</code></span>
                <span className="muted small">ИИ сохранит этот ID в campaign.json для однозначной привязки.</span>
              </div>

              <div className="ai-main-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadTaskBundle}
                  disabled={busy}
                >
                  <Ico n="download" /> Скачать стартовое задание
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCopyChatPrompt}
                >
                  <Ico n="sparkle" /> Скопировать стартовый промпт
                </button>
              </div>
            </div>
          )}
        </div>

        {copyState && <div className="modal-status copy-status">{copyState}</div>}

        <div className="modal-buttons" style={{ marginTop: 10 }}>
          <span className="muted small">Chronicle Forge • AI Toolkit 0.8.0</span>
          <span className="editor-spacer" />
          <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export const aiFixReport = (findings: string[]): string => [
  'Исправь в кампании Chronicle Forge следующие проблемы, сохранив ID и остальной контент:',
  ...findings.map((finding, index) => `${index + 1}. ${finding}`),
].join('\n')
