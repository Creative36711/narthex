import { Ico } from '../shared/icons'
import { useState } from 'react'
import { askConfirm } from '../shared/modals'
import { SettingsPanel } from '../shared/SettingsPanel'
import type { GameEngine } from '../core/engine'
import { formatTime, timeOfDay, TIME_OF_DAY_LABEL } from '../core/time'
import { featureOn } from '../shared/types'

interface Props {
  engine: GameEngine
  onOpenMap: () => void
  onOpenInventory: () => void
  onOpenCharacter: () => void
  onOpenLog: () => void
  onOpenHelp: () => void
  onExitToMenu: () => void
}

export function HUD({ engine, onOpenMap, onOpenInventory, onOpenCharacter, onOpenLog, onOpenHelp, onExitToMenu }: Props) {
  const s = engine.state
  const meta = engine.campaign.meta
  const tod = timeOfDay(s.tick, meta)
  const [showSettings, setShowSettings] = useState(false)
  const needsOn = featureOn(meta, 'needs')
  const timeOn = featureOn(meta, 'time')

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-bar hp" data-tip="Здоровье">
          <div className="hud-bar-fill" style={{ width: `${(s.player.hp / s.player.max_hp) * 100}%` }} />
          <span>HP {s.player.hp}/{s.player.max_hp}</span>
        </div>
        {needsOn && meta.needs.map((n) => {
          const val = s.player.needs[n.id] ?? 0
          const critical = val <= n.critical_threshold
          return (
            <div key={n.id} className={`hud-bar need ${critical ? 'critical' : ''}`} data-tip={n.label}>
              <div className="hud-bar-fill" style={{ width: `${(val / n.max) * 100}%` }} />
              <span>
                {n.label} {Math.round(val)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="hud-center">
        {timeOn && (
          <>
            <div className="hud-time">{formatTime(s.tick, meta)}</div>
            <div className={`hud-tod tod-${tod}`}>{TIME_OF_DAY_LABEL[tod]}</div>
          </>
        )}
      </div>
      <div className="hud-right">
        {featureOn(meta, 'map') && (
          <button className="hud-btn" onClick={onOpenMap} data-tip="Карта"><Ico n="map" />  Карта</button>
        )}
        {featureOn(meta, 'inventory') && (
          <button className="hud-btn" onClick={onOpenInventory} data-tip="Инвентарь"><Ico n="bag" />  Вещи</button>
        )}
        <button className="hud-btn" onClick={onOpenCharacter} data-tip="Лист персонажа"><Ico n="user" />  Герой</button>
        <button className="hud-btn" onClick={onOpenLog} data-tip="Журнал"><Ico n="scroll" />  Журнал</button>
        <button className="hud-btn" onClick={onOpenHelp} data-tip="Справка"><Ico n="help" /> </button>
        <button className="hud-btn" onClick={() => setShowSettings(true)} data-tip="Настройки (громкость, озвучка)"><Ico n="settings" /> </button>
        <button
          className="hud-btn"
          data-tip="Выйти в главное меню (прогресс сохранён)"
          onClick={async () => {
            if (await askConfirm('Выйти в главное меню?', 'Выйти')) onExitToMenu()
          }}
        >
          <Ico n="exit" />
        </button>
      </div>
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
