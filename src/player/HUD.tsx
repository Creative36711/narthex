import type { GameEngine } from '../core/engine'
import { formatTime, timeOfDay, TIME_OF_DAY_LABEL } from '../core/time'

interface Props {
  engine: GameEngine
  onOpenMap: () => void
  onOpenInventory: () => void
  onOpenCharacter: () => void
  onOpenLog: () => void
  onOpenHelp: () => void
}

export function HUD({ engine, onOpenMap, onOpenInventory, onOpenCharacter, onOpenLog, onOpenHelp }: Props) {
  const s = engine.state
  const meta = engine.campaign.meta
  const tod = timeOfDay(s.tick, meta)

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-bar hp" title="Здоровье">
          <div className="hud-bar-fill" style={{ width: `${(s.player.hp / s.player.max_hp) * 100}%` }} />
          <span>HP {s.player.hp}/{s.player.max_hp}</span>
        </div>
        {meta.needs.map((n) => {
          const val = s.player.needs[n.id] ?? 0
          const critical = val <= n.critical_threshold
          return (
            <div key={n.id} className={`hud-bar need ${critical ? 'critical' : ''}`} title={n.label}>
              <div className="hud-bar-fill" style={{ width: `${(val / n.max) * 100}%` }} />
              <span>
                {n.label} {Math.round(val)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="hud-center">
        <div className="hud-time">{formatTime(s.tick, meta)}</div>
        <div className={`hud-tod tod-${tod}`}>{TIME_OF_DAY_LABEL[tod]}</div>
      </div>
      <div className="hud-right">
        <button className="hud-btn" onClick={onOpenMap} title="Карта">🗺 Карта</button>
        <button className="hud-btn" onClick={onOpenInventory} title="Инвентарь">🎒 Вещи</button>
        <button className="hud-btn" onClick={onOpenCharacter} title="Лист персонажа">👤 Герой</button>
        <button className="hud-btn" onClick={onOpenLog} title="Журнал">📜 Журнал</button>
        <button className="hud-btn" onClick={onOpenHelp} title="Справка">❓</button>
      </div>
    </div>
  )
}
