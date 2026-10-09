/**
 * Помощник подготовки задачи для внешнего ИИ (ChatGPT, Claude, DeepSeek, Cursor).
 * Позволяет быстро сформулировать задачу, прикрепить ошибки аудита и выгрузить
 * либо легковесный чемодан для Git-репозитория, либо полный .chronicle для чата.
 */
import { useState, useId } from 'react'
import { Ico } from '../shared/icons'
import { showAlert } from '../shared/modals'
import { createAiTaskBundle, createAiTaskRepoKit, type AiTaskMode } from './aiTask'
import { createCampaignUuid } from './ids'
import { downloadBlob } from './chronicle'
import type { PlaytestRecord } from './campaignAudit'
import { clearPlaytestNotes, shouldAutoClearNotes } from './playtestNotes'
import type { EditorStore } from './store'

interface Props {
  store: EditorStore
  hasCampaign: boolean
  lastPlaytest?: PlaytestRecord | null
  initialReport?: string
  onClose: () => void
}

type TargetEnv = 'git' | 'chat'

export function AiWizard({ store, hasCampaign, lastPlaytest, initialReport = '', onClose }: Props) {
  const [mode, setMode] = useState<AiTaskMode>(hasCampaign ? 'edit' : 'new')
  const [targetEnv, setTargetEnv] = useState<TargetEnv>('git')
  const [task, setTask] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newGenre, setNewGenre] = useState('')
  const [assignedId, setAssignedId] = useState(() => createCampaignUuid())
  const [copyState, setCopyState] = useState('')
  const [busy, setBusy] = useState(false)
  const [auditAttached, setAuditAttached] = useState(false)
  const textareaId = useId()

  const hasAuditReport = Boolean(initialReport && initialReport.trim())

  const attachAuditReport = () => {
    if (!initialReport || auditAttached) return
    const addition = `\n\nИсправь следующие замечания из отчёта проверки:\n${initialReport.trim()}`
    setTask((prev) => (prev ? `${prev.trim()}${addition}` : addition.trim()))
    setAuditAttached(true)
  }

  const effectiveTaskText = (): string => {
    if (mode === 'new') {
      const parts = [
        newTitle.trim() && `Название: ${newTitle.trim()}`,
        newGenre.trim() && `Сеттинг / жанр: ${newGenre.trim()}`,
        task.trim() || 'Создай интересную законченную кампанию со стартовой сценой, несколькими персонажами, диалогами и квестом.',
      ].filter(Boolean)
      return parts.join('\n\n')
    }
    return task.trim() || 'Проведи аккуратную проверку кампании, исправь ошибки связей и предложи улучшения без изменения основного сюжета.'
  }

  const generateChatMessage = (): string => {
    const userTask = effectiveTaskText()
    if (targetEnv === 'git') {
      return [
        'Привет! Мы работаем над кампанией для движка тактических новелл Chronicle Forge в репозитории на диске.',
        '',
        'Задача:',
        userTask,
        '',
        'Вся документация движка, схема полей и техническое задание лежат в папке __chronicle_ai__/ репозитория (файл TASK.md).',
        'Внеси изменения в соответствующие файлы кампании (scenes/, entities/, dialogues/, quests/ и др.), сохраняя каноническую структуру репозитория.',
      ].join('\n')
    }
    return [
      'Привет! Я прикрепил архив кампании для движка тактических новелл Chronicle Forge.',
      '',
      'Задача:',
      userTask,
      '',
      'Вся техническая документация, JSON-схема и отчёт проверки уже упакованы внутри архива в папке __chronicle_ai__/.',
      'Пожалуйста, сохрани структуру файлов, ID кампании и верни готовый обновлённый архив кампании (.chronicle или zip с файлами манифеста).',
    ].join('\n')
  }

  const copyChatMessage = async () => {
    try {
      const text = generateChatMessage()
      let ok = false
      try {
        await navigator.clipboard.writeText(text)
        ok = true
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        ok = document.execCommand('copy')
        textarea.remove()
      }
      setCopyState(ok ? 'Сообщение для чата скопировано в буфер обмена!' : 'Не удалось скопировать — скопируйте вручную')
    } catch (error) {
      setCopyState(`Ошибка копирования: ${String(error)}`)
    }
    setTimeout(() => setCopyState(''), 5000)
  }

  const downloadTask = async () => {
    setBusy(true)
    setCopyState('')
    try {
      const taskBrief = effectiveTaskText()
      if (targetEnv === 'git') {
        const bundle = await createAiTaskRepoKit(store, {
          task: taskBrief,
          lastPlaytest,
          previousReport: initialReport,
        })
        downloadBlob(bundle.blob, bundle.filename)
        if (shouldAutoClearNotes()) {
          clearPlaytestNotes(store.meta.id)
        }
        setCopyState('Чемодан для Git скачан (~70–120 КБ). Распакуйте папку __chronicle_ai__ в корень репозитория кампании.')
      } else {
        const bundle = await createAiTaskBundle(store, {
          mode,
          task: taskBrief,
          lastPlaytest,
          assignedCampaignId: assignedId,
          outputFormat: 'chronicle',
          previousReport: initialReport,
        })
        downloadBlob(bundle.blob, bundle.filename)
        if (shouldAutoClearNotes()) {
          clearPlaytestNotes(store.meta.id)
        }
        setCopyState('Архив кампании .chronicle скачан. Прикрепите его к сообщению в чате с ИИ.')
      }
    } catch (error) {
      void showAlert('Не удалось собрать пакет задания', String(error))
    } finally {
      setBusy(false)
    }
  }

  const selectMode = (next: AiTaskMode) => {
    setMode(next)
    if (next === 'new') setAssignedId(createCampaignUuid())
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box ai-wizard" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <Ico n="sparkle" /> Мастер ИИ: задание и чемодан кампании
        </div>
        <div className="modal-body" style={{ marginBottom: 12 }}>
          Сформулируйте задачу для нейросети (ChatGPT, Claude, DeepSeek или Cursor). Вы можете прикрепить архив кампании к чату или выгрузить компактный чемоданчик для работы через GitHub Desktop.
        </div>

        <div className="ai-wizard-content">
          {/* Шаг 1. Режим: текущая или новая */}
          <div className="fld fld-block">
            <span style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>1. Что делаем?</span>
            <div className="chips">
              <button
                type="button"
                className={`chip ${mode === 'edit' ? 'chip-on' : ''}`}
                onClick={() => selectMode('edit')}
                disabled={!hasCampaign}
              >
                Изменить текущую кампанию {store.meta.title ? `(«${store.meta.title}»)` : ''}
              </button>
              <button
                type="button"
                className={`chip ${mode === 'new' ? 'chip-on' : ''}`}
                onClick={() => selectMode('new')}
              >
                Создать новую кампанию с нуля
              </button>
            </div>
          </div>

          {/* Дополнительные поля для новой кампании */}
          {mode === 'new' && (
            <div className="fld-row" style={{ marginTop: 6 }}>
              <label className="fld" style={{ flex: 1 }}>
                <span>Рабочее название кампании</span>
                <input
                  value={newTitle}
                  placeholder="например: Мёртвый пар или Шепот шестерен"
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>
              <label className="fld" style={{ flex: 1 }}>
                <span>Сеттинг / жанр</span>
                <input
                  value={newGenre}
                  placeholder="например: дизельпанк, детектив, мрачное фэнтези"
                  onChange={(e) => setNewGenre(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* Шаг 2. Текст задачи */}
          <div className="fld fld-block" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label htmlFor={textareaId} style={{ fontWeight: 600, color: '#e2e8f0', cursor: 'pointer' }}>
                2. Задача для ИИ (что нужно сделать?)
              </label>
              {hasAuditReport && !auditAttached && (
                <button
                  type="button"
                  className="btn btn-small"
                  style={{ fontSize: 12, padding: '2px 8px', color: '#f59e0b', borderColor: '#f59e0b44' }}
                  onClick={attachAuditReport}
                >
                  <Ico n="warn" /> Добавить замечания аудита в задачу
                </button>
              )}
            </div>
            <textarea
              id={textareaId}
              className="modal-textarea"
              rows={6}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder={
                mode === 'new'
                  ? 'Опишите идею новой кампании: кто главный герой, где начинается сюжет, с кем предстоит поговорить и какие тайны раскрыть...'
                  : 'Опишите своими словами, что нужно сделать (например: «Добавь квест у торговца Вольта, пропиши диалоги стражникам и исправь ссылки из проверки»)...'
              }
            />
          </div>

          {/* Шаг 3. Выбор сценария передачи */}
          <div className="fld fld-block" style={{ marginTop: 12 }}>
            <span style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>3. Как вы работаете с ИИ?</span>
            <div className="ai-env-cards">
              <div
                className={`ai-env-card ${targetEnv === 'git' ? 'active' : ''}`}
                onClick={() => setTargetEnv('git')}
              >
                <div className="ai-env-card-head">
                  <span><Ico n="folder" /> В репозитории (GitHub Desktop / Cursor)</span>
                  <span className="ai-env-badge">~70–120 КБ</span>
                </div>
                <div className="ai-env-card-desc">
                  Скачивает только папку <code>__chronicle_ai__/</code> (задание <code>TASK.md</code>, руководство и схему) без дублирования тяжелых медиафайлов. Вы распаковываете её в корень своего репозитория и коммитите через GitHub Desktop.
                </div>
              </div>

              <div
                className={`ai-env-card ${targetEnv === 'chat' ? 'active' : ''}`}
                onClick={() => setTargetEnv('chat')}
              >
                <div className="ai-env-card-head">
                  <span><Ico n="message" /> В веб-чате (ChatGPT / Claude / DeepSeek)</span>
                  <span className="ai-env-badge">Полный .chronicle</span>
                </div>
                <div className="ai-env-card-desc">
                  Упаковывает кампанию целиком в готовый архив <code>.chronicle</code> для загрузки в диалог. Нейросеть получит все модули, тексты и медиа прямо в чате.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Футер модалки */}
        <div className="modal-buttons" onClick={(event) => event.stopPropagation()} style={{ marginTop: 14 }}>
          {copyState && <span className="copy-status" style={{ color: '#8fd6e4', fontSize: 13 }}>{copyState}</span>}
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="btn"
            onClick={() => void copyChatMessage()}
            data-tip="Скопировать короткое и понятное сообщение для вставки в чат с ИИ"
          >
            <Ico n="doc" /> Скопировать сообщение для чата
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void downloadTask()}
            disabled={busy}
          >
            {busy ? 'Сборка…' : targetEnv === 'git' ? 'Скачать чемодан для Git (~70 КБ)' : 'Скачать полный .chronicle'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Вспомогательная функция сборки отчёта для ИИ (сохранена для обратной совместимости вызовов). */
export const aiFixReport = (findings: string[]): string => [
  'Исправь в кампании Chronicle Forge следующие проблемы, сохранив ID и остальной контент:',
  ...findings.map((finding, index) => `${index + 1}. ${finding}`),
].join('\n')
