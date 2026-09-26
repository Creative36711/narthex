import type { GameEngine } from '../core/engine'
import { dayNumber } from '../core/time'
import { assetUrl } from '../core/loader'
import { themeBackgroundUrl } from '../shared/theme'

interface Props {
  engine: GameEngine
  onRestart: () => void
  onExitToMenu: () => void
}

/**
 * Экран финала: если кампания задаёт концовку (meta.endings) и она подошла по
 * исходу и условиям — показывается её заголовок, текст и фон; иначе стандартный
 * экран исхода. Статистика забега — всегда (ТЗ 4.10, 6.1 + фидбек «разные финалы»).
 */
export function EndScreen({ engine, onRestart, onExitToMenu }: Props) {
  const go = engine.state.game_over
  if (!go) return null
  const s = engine.state
  const meta = engine.campaign.meta
  const ending = meta.endings?.find((e) => e.id === go.ending)
  const isDeath = go.type === 'death'
  const tone = ending?.tone ?? (isDeath ? 'death' : 'victory')
  const title = ending?.title ?? (isDeath ? 'Забег окончен' : 'Победа')
  const text = ending?.text
  const bg = ending?.image ? assetUrl(engine.campaign, ending.image) : themeBackgroundUrl(engine.campaign, 'end')

  return (
    <div className={`overlay end-overlay ${tone}`}>
      {bg && <img className="end-bg" src={bg} alt="" draggable={false} />}
      <div className="end-panel">
        <h1>{title}</h1>
        <p className="end-reason">{text ?? go.reason}</p>
        <div className="end-stats">
          <div><span>Прожито</span><b>{dayNumber(s.tick, meta)} дн. ({s.stats_run.ticks_survived} {meta.tick_label}.)</b></div>
          <div><span>Переходов</span><b>{s.stats_run.travels}</b></div>
          <div><span>Диалогов</span><b>{s.stats_run.dialogues}</b></div>
          <div><span>Врагов убито</span><b>{s.stats_run.kills ?? 0}</b></div>
        </div>
        {isDeath ? (
          <p className="muted">Погибший герой не возвращается — запись забега стёрта. Следующая попытка начнётся с чистого листа.</p>
        ) : (
          <p className="muted">Забег завершён и вписан в хронику. Новый забег сложится иначе — мир каждый раз собирается заново.</p>
        )}
        <div className="row-buttons">
          <button className="btn btn-primary" onClick={onRestart}>Начать новый забег</button>
          <button className="btn" onClick={onExitToMenu}>В меню</button>
        </div>
      </div>
    </div>
  )
}
