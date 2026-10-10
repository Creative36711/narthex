/**
 * Единый помощник мастера и внешнего ИИ:
 * 1. Пакет изменений мастера (Diff Patch) — скачивание микро-архива .chronicle только с изменёнными файлами и инструкцией.
 * 2. Чемодан задачи для ИИ — легковесный набор документов (схемы, инструкции, TASK.md) или полный пакет кампании.
 * 3. Создание новой кампании — генератор брифа с назначением UUID.
 */
import { useState, useMemo } from 'react'
import guideRaw from '../../docs/ai-campaign-guide.md?raw'
import { Ico } from '../shared/icons'
import { showAlert } from '../shared/modals'
import { createAiTaskBundle, buildAiTaskPrompt, buildAiTaskBrief, type AiOutputFormat } from './aiTask'
import { AI_TASK_DIR } from './aiKit'
import { createCampaignUuid } from './ids'
import { downloadBlob, exportPatchChronicle } from './chronicle'
import { formatCampaignAuditReport, validateCampaign, type PlaytestRecord } from './campaignAudit'
import type { EditorStore, ModifiedFileEntry } from './store'

const GENRES = ['Фэнтези', 'Киберпанк', 'Хоррор', 'Постапок', 'Детектив', 'Приключение', 'Своя тема']
const TONES = ['мрачный', 'героический', 'ироничный', 'эпичный', 'спокойный', 'без пафоса']
const SCALES: Array<{ id: string; label: string; hint: string }> = [
  { id: 'small', label: 'Малая', hint: 'около 3 локаций, 3 персонажей, 1 главный квест' },
  { id: 'medium', label: 'Средняя', hint: 'около 6 локаций, 6 персонажей, 1 главный + 2 побочных квеста' },
  { id: 'big', label: 'Большая', hint: '10+ локаций, 10+ персонажей, сеть главных и побочных квестов' },
  { id: 'any', label: 'На усмотрение ИИ', hint: 'мастер доверяет выбору масштаба' },
]

export type AiWizardTab = 'patch' | 'bundle' | 'new'

interface Props {
  store: EditorStore
  hasCampaign: boolean
  lastPlaytest?: PlaytestRecord | null
  initialReport?: string
  initialTab?: AiWizardTab
  onClose: () => void
}

export function AiWizard({ store, hasCampaign, lastPlaytest, initialReport = '', initialTab, onClose }: Props) {
  const modifiedFiles = useMemo(() => hasCampaign ? store.getModifiedFiles() : [], [store, hasCampaign])
  const defaultTab: AiWizardTab = initialTab ?? (hasCampaign && modifiedFiles.length > 0 ? 'patch' : hasCampaign ? 'bundle' : 'new')

  const [activeTab, setActiveTab] = useState<AiWizardTab>(defaultTab)
  const [outputFormat, setOutputFormat] = useState<AiOutputFormat>('chronicle')
  const [genre, setGenre] = useState('')
  const [genreText, setGenreText] = useState('')
  const [tone, setTone] = useState('')
  const [scale, setScale] = useState('')
  const [battle, setBattle] = useState<number | null>(null)
  const [accents, setAccents] = useState<Record<string, boolean>>({})
  const [must, setMust] = useState('')
  const [mustNot, setMustNot] = useState('')
  const [idea, setIdea] = useState('')
  const [assignedId, setAssignedId] = useState(() => createCampaignUuid())
  const [copyState, setCopyState] = useState('')
  const [busy, setBusy] = useState(false)

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

  // --- Вкладка 1: Пакет изменений мастера (Diff Patch) ---
  const handleDownloadPatch = async () => {
    setBusy(true)
    setCopyState('')
    try {
      const { blob, filename, modifiedCount } = await exportPatchChronicle(store)
      downloadBlob(blob, filename)
      setCopyState(`Пакет изменений (${modifiedCount} файлов) успешно скачан. Отправьте файл ${filename} ИИ-агенту.`)
    } catch (e) {
      void showAlert('Экспорт изменений', String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleCopyPatchInstructions = async () => {
    const summary = store.getChangesSummaryText()
    const prompt = [
      'Привет! Я внёс ручные правки в кампанию через визуальный редактор Chronicle Forge.',
      '',
      summary,
      '',
      'Прикрепляю микро-пакет изменений (.chronicle). Пожалуйста, распакуй его файлы поверх проекта и продолжай работу.',
    ].join('\n')
    await copyToClipboard(prompt, 'Инструкция со списком изменений скопирована в буфер обмена')
  }

  const handleCopyRawPatchText = async () => {
    const mods = store.getModifiedFiles().filter((m) => m.status === 'modified' || m.status === 'added')
    if (mods.length === 0) {
      setCopyState('Нет изменённых файлов для копирования')
      return
    }
    const blocks: string[] = [
      `### Ручные изменения мастера (${store.meta.title}, ID: ${store.meta.id})`,
      '',
    ]
    for (const m of mods) {
      blocks.push(`#### Файл: ${m.path} (${m.title})`)
      const ext = m.path.endsWith('.ink') ? 'ink' : 'json'
      blocks.push('```' + ext)
      blocks.push(store.fileText(m.path))
      blocks.push('```')
      blocks.push('')
    }
    await copyToClipboard(blocks.join('\n'), 'Содержимое всех изменённых файлов скопировано в буфер обмена')
  }

  // --- Вкладка 2: Чемодан задачи / Аудит ---
  const taskText = (): string => {
    const genreLine = [genre && genre !== 'Своя тема' ? genre : '', genreText.trim()].filter(Boolean).join(' — ')
    const accentsText = [
      accents['выживание'] && 'выживание: еда, тепло и другие потребности',
      accents['торговля'] && 'торговля и экономика',
      accents['напарники'] && 'напарники и отряд',
    ].filter((value): value is string => !!value)
    return buildAiTaskBrief({
      mode: activeTab === 'new' ? 'new' : 'edit',
      idea,
      genre: genreLine,
      tone,
      scaleHint: SCALES.find((item) => item.id === scale)?.hint,
      battle,
      accents: accentsText,
      must,
      mustNot,
    })
  }

  const taskPrompt = async (): Promise<string> => {
    const mode = activeTab === 'new' ? 'new' : 'edit'
    const report = initialReport || (mode === 'edit'
      ? formatCampaignAuditReport(await validateCampaign(store, lastPlaytest))
      : 'Для новой кампании отчёта проверки пока нет.')
    const campaignId = mode === 'edit' ? store.meta.id : outputFormat === 'chronicle' ? assignedId : ''
    return [
      buildAiTaskPrompt(mode, taskText(), campaignId, report, outputFormat),
      '',
      '=== ТЕХНИЧЕСКОЕ РУКОВОДСТВО ===',
      guideRaw.trim(),
      '',
      `Файлы технического набора лежат в ${AI_TASK_DIR} внутри приложенного архива.`,
    ].join('\n')
  }

  const handleCopyPrompt = async () => {
    try {
      const text = await taskPrompt()
      await copyToClipboard(text, 'Промпт скопирован в буфер обмена — приложите к нему архив задания')
    } catch (error) {
      setCopyState(`Не удалось подготовить промпт: ${String(error)}`)
    }
  }

  const handleDownloadTaskBundle = async () => {
    setBusy(true)
    setCopyState('')
    try {
      const mode = activeTab === 'new' ? 'new' : 'edit'
      const bundle = await createAiTaskBundle(store, {
        mode,
        task: taskText(),
        lastPlaytest,
        assignedCampaignId: assignedId,
        outputFormat,
        previousReport: initialReport,
      })
      downloadBlob(bundle.blob, bundle.filename)
      setCopyState(outputFormat === 'json'
        ? 'Пакет контекста скачан. ИИ вернёт MonolithDoc JSON.'
        : mode === 'edit'
          ? 'Чемодан задания .chronicle скачан. Отправьте его ИИ.'
          : `Чемодан задания скачан (ID: ${bundle.assignedCampaignId}).`)
    } catch (error) {
      void showAlert('Не удалось собрать пакет задания', String(error))
    } finally {
      setBusy(false)
    }
  }

  const toggleAccent = (key: string) => setAccents((current) => ({ ...current, [key]: !current[key] }))

  return (
    <div className="modal-overlay">
      <div className="modal-box ai-wizard" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <Ico n="sparkle" /> Мастер ИИ
          <span className="editor-spacer" />
          <button type="button" className="btn btn-small" onClick={onClose}>✕</button>
        </div>

        {/* Навигация по вкладкам */}
        <div className="ai-wizard-tabs">
          {hasCampaign && (
            <button
              type="button"
              className={`ai-wizard-tab-btn ${activeTab === 'patch' ? 'active' : ''}`}
              onClick={() => setActiveTab('patch')}
            >
              <Ico n="download" /> Пакет изменений мастера
              {modifiedFiles.length > 0 && (
                <span className="ai-tab-badge">{modifiedFiles.length}</span>
              )}
            </button>
          )}
          <button
            type="button"
            className={`ai-wizard-tab-btn ${activeTab === 'bundle' ? 'active' : ''}`}
            onClick={() => setActiveTab('bundle')}
          >
            <Ico n="book" /> Чемодан задачи и аудит
          </button>
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
          {/* ВКЛАДКА 1: ПАКЕТ ИЗМЕНЕНИЙ (DIFF) */}
          {activeTab === 'patch' && hasCampaign && (
            <div className="ai-patch-section">
              <div className="ai-patch-header">
                <h3>Передача правок мастера в ИИ без пересылки всей кампании</h3>
                <p className="muted small">
                  Вы можете внести любые правки в визуальном редакторе и скачать только изменённые файлы в микро-архиве (несколько килобайт вместо десятков мегабайт видео, музыки и картинок). ИИ распакует этот патч поверх своей версии.
                </p>
              </div>

              {modifiedFiles.length === 0 ? (
                <div className="ai-patch-empty">
                  <div className="ai-patch-empty-icon"><Ico n="check" /></div>
                  <div className="ai-patch-empty-text">
                    <strong>Нет несохранённых различий с исходной базой</strong>
                    <p className="muted small">
                      Все сцены, сущности и диалоги соответствуют базовому состоянию. Внесите любые изменения в редакторе (например, поправьте цену предмета или позицию слота), и здесь сразу появится список для экспорта.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="ai-patch-stats-bar">
                    <span>Затронуто файлов: <strong>{modifiedFiles.length}</strong></span>
                    <span className="editor-spacer" />
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => store.captureBaseline()}
                      data-tip="Сбросить базовую линию к текущему состоянию (считать текущее состояние исходным)"
                    >
                      Зафиксировать как базу
                    </button>
                  </div>

                  <div className="ai-patch-list">
                    {modifiedFiles.map((m: ModifiedFileEntry) => (
                      <div key={m.path} className={`ai-patch-item status-${m.status}`}>
                        <span className={`ai-status-badge badge-${m.status}`}>
                          {m.status === 'added' ? 'новый' : m.status === 'deleted' ? 'удалён' : 'изменён'}
                        </span>
                        <div className="ai-patch-info">
                          <strong className="ai-patch-title">{m.title}</strong>
                          <span className="ai-patch-path muted small">{m.path}</span>
                          {m.diffSummary && (
                            <span className="ai-patch-diff-summary">{m.diffSummary}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="ai-patch-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleDownloadPatch}
                      disabled={busy}
                    >
                      <Ico n="download" /> Скачать пакет изменений (.chronicle)
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleCopyPatchInstructions}
                    >
                      <Ico n="sparkle" /> Скопировать инструкцию для ИИ
                    </button>
                    {modifiedFiles.length <= 6 && (
                      <button
                        type="button"
                        className="btn"
                        onClick={handleCopyRawPatchText}
                        data-tip="Скопировать содержимое изменённых файлов в буфер для прямой вставки в чат"
                      >
                        <Ico n="chevronRight" /> Скопировать текст файлов
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ВКЛАДКА 2: ЧЕМОДАН ЗАДАЧИ / РЕДАКТИРОВАНИЕ ТЕКУЩЕЙ */}
          {activeTab === 'bundle' && (
            <div className="ai-bundle-section">
              <div className="fld fld-block">
                <span>Кампания: <strong>{store.meta.title || store.meta.id}</strong> (ID: {store.meta.id})</span>
                <span className="muted small">
                  Сборка полного контекста кампании с отчётом проверки, заметками плейтеста и техническим гайдом для глубокой проработки сценария.
                </span>
              </div>

              <div className="fld fld-block">
                <span>Формат результата</span>
                <div className="chips">
                  <button type="button" className={`chip ${outputFormat === 'chronicle' ? 'chip-on' : ''}`} onClick={() => setOutputFormat('chronicle')}>Полный .chronicle</button>
                  <button type="button" className={`chip ${outputFormat === 'json' ? 'chip-on' : ''}`} onClick={() => setOutputFormat('json')}>MonolithDoc JSON</button>
                </div>
              </div>

              <div className="fld fld-block">
                <span>Задача для ИИ (что нужно сделать / доработать)</span>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Опишите задачу: например, добавить квест с поиском улик в архиве, сбалансировать торговца или написать диалог для нового персонажа…"
                />
              </div>

              <div className="ai-patch-actions">
                <button type="button" className="btn btn-primary" onClick={handleDownloadTaskBundle} disabled={busy}>
                  <Ico n="download" /> Скачать чемодан задания
                </button>
                <button type="button" className="btn" onClick={handleCopyPrompt}>
                  <Ico n="sparkle" /> Скопировать промпт для чата
                </button>
              </div>
            </div>
          )}

          {/* ВКЛАДКА 3: СОЗДАНИЕ НОВОЙ КАМПАНИИ */}
          {activeTab === 'new' && (
            <div className="ai-new-section">
              <div className="fld fld-block">
                <span>Сеттинг / жанр</span>
                <div className="chips">
                  {GENRES.map((value) => (
                    <button key={value} type="button" className={`chip ${genre === value ? 'chip-on' : ''}`} onClick={() => setGenre(genre === value ? '' : value)}>{value}</button>
                  ))}
                </div>
                {genre === 'Своя тема' && (
                  <input
                    type="text"
                    value={genreText}
                    onChange={(e) => setGenreText(e.target.value)}
                    placeholder="Укажите жанр или сеттинг…"
                  />
                )}
              </div>

              <div className="fld fld-block">
                <span>Тональность</span>
                <div className="chips">
                  {TONES.map((value) => (
                    <button key={value} type="button" className={`chip ${tone === value ? 'chip-on' : ''}`} onClick={() => setTone(tone === value ? '' : value)}>{value}</button>
                  ))}
                </div>
              </div>

              <div className="fld fld-block">
                <span>Масштаб кампании</span>
                <div className="chips">
                  {SCALES.map((item) => (
                    <button key={item.id} type="button" className={`chip ${scale === item.id ? 'chip-on' : ''}`} onClick={() => setScale(scale === item.id ? '' : item.id)}>{item.label}</button>
                  ))}
                </div>
              </div>

              <div className="fld fld-block">
                <span>Акценты механик</span>
                <div className="chips">
                  {['выживание', 'торговля', 'напарники'].map((key) => (
                    <button key={key} type="button" className={`chip ${accents[key] ? 'chip-on' : ''}`} onClick={() => toggleAccent(key)}>{key}</button>
                  ))}
                </div>
              </div>

              <div className="fld fld-block">
                <span>Основная задумка / завязка</span>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="О чём история, кто главный герой, с чего начинается приключение…"
                />
              </div>

              <div className="fld fld-block">
                <span>Соотношение диалогов и боёвки (необязательно)</span>
                <label className="settings-row ai-optional-toggle">
                  <input type="checkbox" checked={battle !== null} onChange={(event) => setBattle(event.target.checked ? 50 : null)} />
                  <span>Задать соотношение</span>
                </label>
                {battle === null ? (
                  <div className="muted small">Не задано: ИИ сам решит, учитывать ли этот аспект.</div>
                ) : (
                  <label className="settings-row ai-battle-range" style={{ gap: 10 }}>
                    <span className="muted small">диалоги</span>
                    <input aria-label="Соотношение диалогов и боёвки" type="range" min={0} max={100} value={battle} onChange={(event) => setBattle(Number(event.target.value))} style={{ flex: 1 }} />
                    <span className="muted small">боёвка</span>
                    <b className="muted small">{battle}%</b>
                  </label>
                )}
              </div>

              <div className="fld fld-block">
                <span>Обязательно включить (необязательно)</span>
                <input
                  type="text"
                  value={must}
                  onChange={(e) => setMust(e.target.value)}
                  placeholder="Особые элементы, локации, персонажи или механики…"
                />
              </div>

              <div className="fld fld-block">
                <span>Исключить / запретить (необязательно)</span>
                <input
                  type="text"
                  value={mustNot}
                  onChange={(e) => setMustNot(e.target.value)}
                  placeholder="Чего точно не должно быть в кампании…"
                />
              </div>

              <div className="fld fld-block">
                <span>Назначенный ID кампании: <code>{assignedId}</code></span>
                <span className="muted small">ИИ обязан сохранить этот ID в campaign.json, чтобы проект сразу встал на своё место.</span>
              </div>

              <div className="ai-patch-actions">
                <button type="button" className="btn btn-primary" onClick={handleDownloadTaskBundle} disabled={busy}>
                  <Ico n="download" /> Скачать стартовое задание
                </button>
                <button type="button" className="btn" onClick={handleCopyPrompt}>
                  <Ico n="sparkle" /> Скопировать стартовый промпт
                </button>
              </div>
            </div>
          )}
        </div>

        {copyState && <div className="modal-status copy-status">{copyState}</div>}

        <div className="modal-buttons" style={{ marginTop: 12 }}>
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
