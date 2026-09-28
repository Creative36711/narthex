import type { SaveReport, SaveVerdict } from '../core/savemigrate'
import { Ico } from '../shared/icons'

interface Props {
  report: SaveReport
  verdict: SaveVerdict
  /** версия кампании, которая сейчас установлена */
  campaignVersion: string
  onContinue: () => void
  onNewRun: () => void
  onExport?: () => void
  onClose: () => void
}

const KIND_LABEL: Record<string, string> = {
  migrated: 'Перенос формата',
  repaired: 'Починка',
  warning: 'Внимание',
}

/**
 * Отчёт о сохранении (`docs/compatibility.md`, фаза A): что движок сделал с
 * сейвом после обновления движка или кампании, и можно ли продолжить забег.
 *
 * Правило: сохранение никогда не исчезает молча. Если сейв не поддержится —
 * игрок видит причину и может начать новый забег, не потеряв старый файл.
 */
export function SaveReportModal({ report, verdict, campaignVersion, onContinue, onNewRun, onExport, onClose }: Props) {
  const usable = verdict.kind === 'ok'
  const title = !usable
    ? 'Сохранение не поддерживается'
    : report.notes.length === 0
      ? 'Сохранение готово'
      : report.repaired
        ? 'Сохранение перенесено и почищено'
        : 'Сохранение перенесено'

  const reason = usable ? '' : 'reason' in verdict ? verdict.reason : ''

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box">
        <div className="modal-title">{title}</div>
        <div className="modal-body">
          {usable
            ? report.notes.length === 0
              ? `Сохранение соответствует версии кампании ${campaignVersion} — можно продолжать.`
              : `Сохранение сделано в версии кампании ${report.campaign_version ?? 'не указана'}, сейчас установлена ${campaignVersion}. Вот что изменилось:`
            : `${reason}\n\nСтарое сохранение не удалено: оно останется на диске и откроется, если вернуться к прежней версии кампании.`}
        </div>
        {report.notes.length > 0 && (
          <ul className="modal-list">
            {report.notes.map((n, i) => (
              <li key={i}>
                <b>{KIND_LABEL[n.kind] ?? n.kind}:</b> {n.text}
              </li>
            ))}
          </ul>
        )}
        <div className="modal-buttons">
          {usable ? (
            <button className="btn btn-primary" onClick={onContinue}>
              <Ico n="play" /> Продолжить забег
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onNewRun}>
              Начать новый забег
            </button>
          )}
          {onExport && (
            <button className="btn" onClick={onExport}>
              <Ico n="doc" /> Сохранить файл сейва
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
