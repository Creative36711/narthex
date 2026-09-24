import type { GameEngine } from '../core/engine'
import { dayNumber } from '../core/time'

interface Props {
  engine: GameEngine
  onRestart: () => void
  onExitToMenu: () => void
}

/** Экран смерти / победы: статистика забега (ТЗ 4.10, 6.1). */
export function EndScreen({ engine, onRestart, onExitToMenu }: Props) {
  const go = engine.state.game_over
  if (!go) return null
  const s = engine.state
  const isDeath = go.type === 'death'

  return (
    <div className={`overlay end-overlay ${isDeath ? 'death' : 'victory'}`}>
      <div className="end-panel">
        <h1>{isDeath ? '☠ Забег окончен' : '🏆 Победа'}</h1>
        <p className="end-reason">{go.reason}</p>
        <div className="end-stats">
          <div><span>Прожито</span><b>{dayNumber(s.tick, engine.campaign.meta)} дн. ({s.stats_run.ticks_survived} {engine.campaign.meta.tick_label}.)</b></div>
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
