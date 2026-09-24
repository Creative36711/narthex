import type { GameEngine } from '../core/engine'
import type { ItemDef } from '../shared/types'
import { damageBonus, movement } from '../core/brp'

/** Инвентарь (ТЗ 4.6 — базовая часть Фазы 0: список, вес, использование). */
export function InventoryPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const inv = engine.state.player.inventory
  const items = inv
    .map((e) => ({ entry: e, def: engine.campaign.entities[e.item] as ItemDef | undefined }))
    .filter((x) => x.def?.type === 'item')
  const totalWeight = items.reduce((sum, x) => sum + (x.def!.weight ?? 0) * x.entry.quantity, 0)

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Инвентарь</h2>
          <button className="btn btn-small" onClick={onClose}>✕</button>
        </div>
        {items.length === 0 && <p className="muted">Пусто.</p>}
        <ul className="inv-list">
          {items.map(({ entry, def }) => (
            <li key={entry.item} className="inv-item">
              <div className="inv-item-main">
                <b>{def!.label}</b>
                {entry.quantity > 1 && <span className="qty">×{entry.quantity}</span>}
                <div className="muted small">{def!.description}</div>
              </div>
              <div className="inv-item-side">
                <span className="muted small">{(def!.weight * entry.quantity).toFixed(1)} кг</span>
                {def!.on_use && (
                  <button className="btn btn-small" onClick={() => engine.useItem(entry.item)}>
                    Использовать
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="panel-footer muted">Общий вес: {totalWeight.toFixed(1)} кг</div>
      </div>
    </div>
  )
}

/** Лист персонажа (ТЗ 6.1). */
export function CharacterPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const p = engine.state.player
  const def = engine.campaign.entities[p.entity]
  const statNames: Array<keyof typeof p.stats> = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA']

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>{def?.label ?? 'Герой'}</h2>
          <button className="btn btn-small" onClick={onClose}>✕</button>
        </div>
        <h3>Характеристики</h3>
        <div className="stat-grid">
          {statNames.map((s) => (
            <div key={s} className="stat-cell">
              <span className="stat-name">{s}</span>
              <span className="stat-val">{p.stats[s]}</span>
            </div>
          ))}
        </div>
        <div className="derived-row">
          <span>HP {p.hp}/{p.max_hp}</span>
          <span>MP {p.mp}/{p.max_mp}</span>
          <span>Бонус урона {damageBonus(p.stats)}</span>
          <span>MOV {movement(p.stats)}</span>
        </div>
        <h3>Навыки</h3>
        <ul className="skill-list">
          {Object.entries(p.skills).sort(([a], [b]) => a.localeCompare(b)).map(([id, val]) => (
            <li key={id}>
              <span>{SKILL_LABELS[id] ?? id}</span>
              <span className="skill-val">{val}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const SKILL_LABELS: Record<string, string> = {
  sword: 'Меч',
  shield: 'Щит',
  dodge: 'Уклонение',
  spot: 'Наблюдательность',
  first_aid: 'Первая помощь',
  persuade: 'Убеждение',
  bargain: 'Торговля',
  lockpicking: 'Взлом замков',
  stealth: 'Скрытность',
}

/** Журнал событий забега. */
export function LogPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const log = engine.state.log
  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Журнал</h2>
          <button className="btn btn-small" onClick={onClose}>✕</button>
        </div>
        {log.length === 0 && <p className="muted">Записей пока нет.</p>}
        <ul className="log-list">
          {[...log].reverse().map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
