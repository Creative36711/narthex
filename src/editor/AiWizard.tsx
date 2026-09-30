/**
 * Единый помощник подготовки задачи для внешнего ИИ: новый проект или
 * редактирование текущего. Он сохраняет старую анкету-бриф, но теперь также
 * собирает полный пакет для агента с медиа и отчётом проверки.
 */
import { useState } from 'react'
import guideRaw from '../../docs/ai-campaign-guide.md?raw'
import { Ico } from '../shared/icons'
import { showAlert } from '../shared/modals'
import { createAiTaskBundle, buildAiTaskPrompt, type AiOutputFormat, type AiTaskMode } from './aiTask'
import { AI_TASK_DIR } from './aiKit'
import { createCampaignUuid } from './ids'
import { downloadBlob } from './chronicle'
import { formatCampaignAuditReport, validateCampaign, type PlaytestRecord } from './campaignAudit'
import type { EditorStore } from './store'

const GENRES = ['Фэнтези', 'Киберпанк', 'Хоррор', 'Постапок', 'Детектив', 'Приключение', 'Своя тема']
const TONES = ['мрачный', 'героический', 'ироничный', 'эпичный', 'спокойный', 'без пафоса']
const SCALES: Array<{ id: string; label: string; hint: string }> = [
  { id: 'small', label: 'Малая', hint: 'около 3 локаций, 3 персонажей, 1 главный квест' },
  { id: 'medium', label: 'Средняя', hint: 'около 6 локаций, 6 персонажей, 1 главный + 2 побочных квеста' },
  { id: 'big', label: 'Большая', hint: '10+ локаций, 10+ персонажей, сеть главных и побочных квестов' },
  { id: 'any', label: 'На усмотрение ИИ', hint: 'мастер доверяет выбору масштаба' },
]

interface Props {
  store: EditorStore
  hasCampaign: boolean
  lastPlaytest?: PlaytestRecord | null
  initialReport?: string
  onClose: () => void
}

export function AiWizard({ store, hasCampaign, lastPlaytest, initialReport = '', onClose }: Props) {
  const [mode, setMode] = useState<AiTaskMode>(hasCampaign ? 'edit' : 'new')
  const [outputFormat, setOutputFormat] = useState<AiOutputFormat>('chronicle')
  const [genre, setGenre] = useState('')
  const [genreText, setGenreText] = useState('')
  const [tone, setTone] = useState('')
  const [scale, setScale] = useState('medium')
  const [battle, setBattle] = useState(50)
  const [accents, setAccents] = useState<Record<string, boolean>>({})
  const [must, setMust] = useState('')
  const [mustNot, setMustNot] = useState('')
  const [idea, setIdea] = useState('')
  const [assignedId, setAssignedId] = useState(() => createCampaignUuid())
  const [copyState, setCopyState] = useState('')
  const [busy, setBusy] = useState(false)

  const taskText = (): string => {
    const accentsText: string[] = []
    if (battle <= 20) accentsText.push('акцент на диалоги и историю, боёвки мало или нет')
    else if (battle >= 80) accentsText.push('акцент на боёвку и тактику, диалогов минимум')
    else accentsText.push('баланс боёвки и диалогов')
    if (accents['выживание']) accentsText.push('выживание: еда, тепло и другие потребности')
    if (accents['торговля']) accentsText.push('торговля и экономика')
    if (accents['напарники']) accentsText.push('напарники и отряд')

    if (mode === 'edit') {
      return [
        idea.trim() || 'Проведи аккуратную проверку текущей кампании и предложи небольшие улучшения.',
        must.trim() && `Обязательно: ${must.trim()}`,
        mustNot.trim() && `Не добавлять: ${mustNot.trim()}`,
      ].filter(Boolean).join('\n')
    }
    const genreLine = [genre && genre !== 'Своя тема' ? genre : '', genreText.trim()].filter(Boolean).join(' — ')
    const scaleHint = SCALES.find((item) => item.id === scale)?.hint ?? ''
    return [
      idea.trim() || 'Создай интересную законченную кампанию и заполни все необходимые разделы.',
      genreLine && `Жанр/сеттинг: ${genreLine}`,
      tone && `Тон: ${tone}`,
      scaleHint && `Масштаб: ${scaleHint}`,
      `Акценты: ${accentsText.join('; ')}`,
      must.trim() && `Обязательно: ${must.trim()}`,
      mustNot.trim() && `Не добавлять: ${mustNot.trim()}`,
    ].filter(Boolean).join('\n')
  }

  const taskPrompt = async (): Promise<string> => {
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

  const copy = async () => {
    try {
      const text = await taskPrompt()
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
      setCopyState(ok ? 'Промпт скопирован в буфер обмена — приложите к нему архив задания' : 'Не удалось скопировать — выделите текст и скопируйте вручную')
    } catch (error) {
      setCopyState(`Не удалось подготовить промпт: ${String(error)}`)
    }
    setTimeout(() => setCopyState(''), 5000)
  }

  const downloadTask = async () => {
    setBusy(true)
    setCopyState('')
    try {
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
        ? 'Пакет контекста скачан. ИИ вернёт MonolithDoc JSON; для новой кампании редактор назначит ID при импорте.'
        : mode === 'edit'
          ? 'Пакет задания .chronicle скачан. Отправьте его ИИ и попросите вернуть готовый .chronicle.'
          : `Пакет задания скачан. ИИ получит окончательный ID ${bundle.assignedCampaignId}; попросите вернуть его без изменений в campaign.json. При импорте в редактор выберите «Импортировать отдельно», если это новая кампания.`)
    } catch (error) {
      void showAlert('Не удалось собрать пакет задания', String(error))
    } finally {
      setBusy(false)
    }
  }

  const toggleAccent = (key: string) => setAccents((current) => ({ ...current, [key]: !current[key] }))
  const selectMode = (next: AiTaskMode) => {
    setMode(next)
    setOutputFormat('chronicle')
    if (next === 'new') setAssignedId(createCampaignUuid())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box ai-wizard" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title"><Ico n="sparkle" /> Задание для ИИ</div>
        <div className="modal-body">
          Соберите контекст и задачу для внешнего ИИ. Режим редактирования приложит кампанию целиком, включая найденные медиа; режим создания выдаст новый ID от редактора. ИИ работает во внешнем чате — приложение не отправляет кампанию в сеть.
        </div>

        <div className="ai-wizard-content">
        <div className="fld fld-block">
          <span>Что делаем?</span>
          <div className="chips">
            <button type="button" className={`chip ${mode === 'new' ? 'chip-on' : ''}`} onClick={() => selectMode('new')}>Создать новую</button>
            <button type="button" className={`chip ${mode === 'edit' ? 'chip-on' : ''}`} onClick={() => selectMode('edit')} disabled={!hasCampaign}>Изменить текущую</button>
          </div>
          {mode === 'edit' && <span className="muted small">Кампания «{store.meta.title || store.meta.id}», ID {store.meta.id} будет приложена к задаче.</span>}
          {mode === 'new' && outputFormat === 'chronicle' && <span className="muted small">Редактор заранее назначит ID {assignedId}; ИИ должен сохранить его в готовом пакете.</span>}
          {mode === 'new' && outputFormat === 'json' && <span className="muted small">При импорте JSON редактор сам выдаст новой кампании ID.</span>}
        </div>

        <div className="fld fld-block">
          <span>Формат результата</span>
          <div className="chips">
            <button type="button" className={`chip ${outputFormat === 'chronicle' ? 'chip-on' : ''}`} onClick={() => setOutputFormat('chronicle')}>Полный .chronicle</button>
            <button type="button" className={`chip ${outputFormat === 'json' ? 'chip-on' : ''}`} onClick={() => setOutputFormat('json')}>MonolithDoc JSON</button>
          </div>
          <span className="muted small">.chronicle переносит модули и медиа. JSON удобен для текстовых/структурных правок, но не содержит бинарные медиа.</span>
        </div>

        {mode === 'new' && (
          <>
            <div className="fld fld-block">
              <span>Сеттинг / жанр</span>
              <div className="chips">
                {GENRES.map((value) => (
                  <button key={value} type="button" className={`chip ${genre === value ? 'chip-on' : ''}`} onClick={() => setGenre(genre === value ? '' : value)}>{value}</button>
                ))}
              </div>
              <input style={{ marginTop: 6 }} value={genreText} placeholder="например: нуарный киберпанк в тропическом мегаполисе" onChange={(event) => setGenreText(event.target.value)} />
            </div>
            <div className="fld-row">
              <label className="fld"><span>Тон</span><select value={tone} onChange={(event) => setTone(event.target.value)}><option value="">— любой —</option>{TONES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="fld"><span>Масштаб</span><select value={scale} onChange={(event) => setScale(event.target.value)}>{SCALES.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.hint}</option>)}</select></label>
            </div>
            <div className="fld fld-block">
              <span>Соотношение диалогов и боёвки</span>
              <label className="settings-row" style={{ gap: 10 }}><span className="muted small">диалоги</span><input type="range" min={0} max={100} value={battle} onChange={(event) => setBattle(Number(event.target.value))} style={{ flex: 1 }} /><span className="muted small">боёвка</span></label>
              <div className="chips">{['выживание', 'торговля', 'напарники'].map((key) => <button key={key} type="button" className={`chip ${accents[key] ? 'chip-on' : ''}`} onClick={() => toggleAccent(key)}>{key}</button>)}</div>
            </div>
          </>
        )}

        <div className="fld-row">
          <label className="fld"><span>Обязательно должно быть</span><input value={must} placeholder="например, финал с моральным выбором" onChange={(event) => setMust(event.target.value)} /></label>
          <label className="fld"><span>Чего быть не должно</span><input value={mustNot} placeholder="например, никакой магии" onChange={(event) => setMustNot(event.target.value)} /></label>
        </div>
        <label className="fld fld-block">
          <span>{mode === 'new' ? 'Опишите идею кампании' : 'Что изменить в текущей кампании?'}</span>
          <textarea className="modal-textarea" rows={6} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder={mode === 'new' ? 'О чём кампания, кто герой и чем может закончиться история…' : 'Например: исправь ссылки из отчёта, сохрани стиль и не переписывай остальные квесты…'} />
        </label>
        {initialReport && <div className="ai-report-note">К пакету будет приложен отчёт проверки, из которого вы открыли это окно.</div>}
        </div>
        <div className="modal-buttons" onClick={(event) => event.stopPropagation()}>
          <span className="copy-status">{copyState}</span>
          <button className="btn" onClick={onClose}>Закрыть</button>
          <button className="btn" onClick={() => void copy()} disabled={busy}>Скопировать промпт</button>
          <button className="btn btn-primary" onClick={() => void downloadTask()} disabled={busy}>{busy ? 'Собираю пакет…' : 'Скачать пакет задания'}</button>
        </div>
      </div>
    </div>
  )
}

/** Старое имя оставлено как alias для интеграций внешнего кода. */
export const aiFixReport = (findings: string[]): string => [
  'Исправь в кампании Chronicle Forge следующие проблемы, сохранив ID и остальной контент:',
  ...findings.map((finding, index) => `${index + 1}. ${finding}`),
].join('\n')
