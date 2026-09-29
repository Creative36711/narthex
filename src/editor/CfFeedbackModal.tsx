import { useMemo, useState } from 'react'
import { Ico } from '../shared/icons'
import { buildCfFeedbackIssue, parseCfFeedback } from './cfFeedback'

const PLACEHOLDER = `\`\`\`cf-feedback
[
  {
    "id": "missing-effect:set_mood",
    "kind": "missing_effect",
    "detail": "Не хватило эффекта переключения состояния портрета NPC правилом",
    "workaround": "Использовал статус и диалоговый флаг",
    "severity": "mid"
  }
]
\`\`\``

export function CfFeedbackModal({
  campaignTitle,
  onClose,
}: {
  campaignTitle?: string
  onClose: () => void
}) {
  const [raw, setRaw] = useState('')
  const parsed = useMemo(() => parseCfFeedback(raw), [raw])
  const issue = useMemo(
    () => buildCfFeedbackIssue(parsed.items, campaignTitle),
    [parsed.items, campaignTitle],
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box ai-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <Ico n="message" /> Заметки ИИ для разработчиков
        </div>
        <div className="modal-body">
          По протоколу чемодана ИИ-агент в конце ответа приводит блок <code>```cf-feedback</code> со
          списком невыразимых механик, пробелов документации или замечаний к схеме. Вставьте сюда
          этот блок (или весь ответ агента) — редактор соберёт таблицу и откроет предзаполненный
          issue на GitHub. Никакой скрытой телеметрии: отправка происходит только по вашему нажатию.
        </div>

        <label className="fld fld-block">
          <span>Блок cf-feedback или JSON-массив заметок</span>
          <textarea
            className="modal-textarea"
            rows={8}
            value={raw}
            placeholder={PLACEHOLDER}
            onChange={(e) => setRaw(e.target.value)}
          />
        </label>

        {parsed.error && (
          <div className="muted small" style={{ color: 'var(--danger, #d96b6b)', marginTop: 6 }}>
            {parsed.error}
          </div>
        )}

        {parsed.items.length > 0 && (
          <div className="muted small" style={{ marginTop: 6 }}>
            Распознано записей (после склейки дублей по id): <b>{parsed.items.length}</b> (
            {parsed.items.map((x) => x.id).join(', ')})
          </div>
        )}

        <div className="modal-buttons" onClick={(e) => e.stopPropagation()}>
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
          <a
            className={`btn btn-primary ${parsed.items.length === 0 ? 'disabled' : ''}`}
            href={parsed.items.length > 0 ? issue.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (parsed.items.length === 0) e.preventDefault()
            }}
          >
            Открыть issue на GitHub
          </a>
        </div>
      </div>
    </div>
  )
}
