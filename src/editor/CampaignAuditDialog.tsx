import { useEffect, useState } from 'react'
import { Ico } from '../shared/icons'
import { auditCounts, formatCampaignAuditReport, validateCampaign, type CampaignAuditReport, type PlaytestRecord } from './campaignAudit'
import type { EditorStore } from './store'

interface Props {
  store: EditorStore
  lastPlaytest?: PlaytestRecord | null
  onClose: () => void
  onPrepareAi: (report: string) => void
  onRunPlaytest: () => void
}

const SECTIONS: Array<{ key: keyof Pick<CampaignAuditReport, 'structure' | 'media' | 'playtest'>; title: string }> = [
  { key: 'structure', title: 'Структура и ссылки' },
  { key: 'media', title: 'Файлы и медиа' },
  { key: 'playtest', title: 'Плейтест' },
]

export function CampaignAuditDialog({ store, lastPlaytest, onClose, onPrepareAi, onRunPlaytest }: Props) {
  const [report, setReport] = useState<CampaignAuditReport | null>(null)
  const [error, setError] = useState('')
  const [copyState, setCopyState] = useState('')

  useEffect(() => {
    let alive = true
    void validateCampaign(store, lastPlaytest).then((result) => {
      if (alive) setReport(result)
    }).catch((reason) => {
      if (alive) setError(String(reason))
    })
    return () => { alive = false }
  }, [store, lastPlaytest])

  const copyReport = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(formatCampaignAuditReport(report))
      setCopyState('Отчёт скопирован')
    } catch {
      setCopyState('Не удалось скопировать отчёт')
    }
    setTimeout(() => setCopyState(''), 2500)
  }

  const counts = report ? auditCounts(report) : null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box campaign-audit-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title"><Ico n="check" /> Проверка кампании</div>
        <div className="modal-body">
          Проверка разделяет структурные ошибки, локальные и внешние медиа, а также статус ручного плейтеста.
          Она не заменяет прохождение игры и не оценивает качество истории.
        </div>
        {error && <p className="audit-error">{error}</p>}
        {!report && !error && <div className="audit-loading">Проверяю кампанию и файлы…</div>}
        {report && (
          <>
            <div className="audit-summary">
              <span className={counts?.errors ? 'audit-count is-error' : 'audit-count'}>Ошибок: {counts?.errors}</span>
              <span className={counts?.warnings ? 'audit-count is-warning' : 'audit-count'}>Предупреждений: {counts?.warnings}</span>
              <span className="audit-count">Информация: {counts?.info}</span>
            </div>
            <div className="audit-sections">
              {SECTIONS.map(({ key, title }) => (
                <section className="audit-section" key={key}>
                  <h3>{title} <span>{report[key].length}</span></h3>
                  {report[key].length === 0 && <div className="audit-finding severity-info"><b>Статус</b><span>Проблем не найдено.</span></div>}
                  {report[key].map((finding, index) => (
                    <div className={`audit-finding severity-${finding.severity}`} key={`${key}-${index}`}>
                      <b>{finding.severity === 'error' ? 'Ошибка' : finding.severity === 'warning' ? 'Предупреждение' : 'Информация'}</b>
                      <span>{finding.message}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
        <div className="modal-buttons audit-actions">
          <span className="copy-status">{copyState}</span>
          <button className="btn" onClick={onClose}>Закрыть</button>
          <button className="btn" onClick={onRunPlaytest} disabled={!report}>Запустить плейтест</button>
          <button className="btn" onClick={() => void copyReport()} disabled={!report}>Скопировать отчёт</button>
          <button
            className="btn btn-primary"
            onClick={() => report && onPrepareAi(formatCampaignAuditReport(report))}
            disabled={!report}
          >
            Задание для ИИ с отчётом
          </button>
        </div>
      </div>
    </div>
  )
}
