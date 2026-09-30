import type { GameEngine } from '../core/engine'
import { dayNumber } from '../core/time'
import { assetUrlOrNull } from '../core/loader'
import { themeBackgroundUrl } from '../shared/theme'
import { Ico } from '../shared/icons'

interface Props {
  engine: GameEngine
  onRestart: () => void
  onExitToMenu: () => void
  /** New Game+ (движок нового забега с наследием) */
  onNewGamePlus?: (next: GameEngine) => void
}

/**
 * Экран финала: если кампания задаёт концовку (meta.endings) и она подошла по
 * исходу и условиям — показывается её заголовок, текст и фон; иначе стандартный
 * экран исхода. Статистика забега — всегда (ТЗ 4.10, 6.1 + фидбек «разные финалы»).
 */
export function EndScreen({ engine, onRestart, onExitToMenu, onNewGamePlus }: Props) {
  const go = engine.state.game_over
  if (!go) return null
  const s = engine.state
  const meta = engine.campaign.meta
  const ending = meta.endings?.find((e) => e.id === go.ending)
  const isDeath = go.type === 'death'
  const tone = ending?.tone ?? (isDeath ? 'death' : 'victory')
  const title = ending?.title ?? (isDeath ? 'Забег окончен' : 'Победа')
  const text = ending?.text
  const endingBg = assetUrlOrNull(engine.campaign, ending?.image)
  const themeBg = themeBackgroundUrl(engine.campaign, 'end')
  const bg = endingBg || themeBg || null

  return (
    <div className={`overlay end-overlay ${tone}`}>
      {bg ? <img className="end-bg" src={bg} alt="" draggable={false} /> : null}
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
        {engine.metaProgressEnabled() && (() => {
          const unlocked = engine.achievementsUnlockedThisRun()
          const st = engine.metaStore()
          const currencies = engine.campaign.meta.metaprogress?.currencies ?? []
          const gained = currencies.filter((c) => (st.currencies[c.id] ?? 0) > 0)
          if (!unlocked.length && !gained.length) return null
          return (
            <div className="end-meta">
              {unlocked.length > 0 && (
                <div className="end-meta-achievements">
                  <h4>Достижения этого забега</h4>
                  <ul>
                    {unlocked.map((a) => (
                      <li key={a.id} data-tip={a.description || undefined}>
                        <Ico n="star" /> <b>{a.label}</b>
                        {a.reward?.currency && a.reward.amount ? (
                          <span className="muted"> +{a.reward.amount} {(currencies.find((c) => c.id === a.reward?.currency)?.label ?? a.reward.currency).toLowerCase()}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {gained.length > 0 && (
                <div className="end-meta-currencies">
                  {gained.map((c) => (
                    <span key={c.id} className="end-meta-cur" data-tip={c.description || undefined}>
                      {c.label}: <b>{st.currencies[c.id]}</b>
                    </span>
                  ))}
                </div>
              )}
              {st.runs > 1 && (
                <p className="muted small">Хроника: забегов {st.runs}, побед {st.victories}, смертей {st.deaths}.</p>
              )}
            </div>
          )
        })()}
        <div className="row-buttons">
          {engine.newGamePlusAvailable() && onNewGamePlus && (
            <button
              className="btn btn-primary"
              data-tip="Герой вернётся в новый забег с наследием — и мир станет суровее"
              onClick={() => {
                const e = engine.newGamePlus()
                if (e) onNewGamePlus(e)
              }}
            >
              {(engine.campaign.meta.new_game_plus?.label ?? 'Новая игра+') + ` (круг ${(engine.state.ng_cycle ?? 0) + 2})`}
            </button>
          )}
          <button className="btn btn-primary" onClick={onRestart}>Начать новый забег</button>
          <button className="btn" onClick={onExitToMenu}>В меню</button>
        </div>
      </div>
    </div>
  )
}
