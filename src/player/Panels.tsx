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

/** Лист персонажа (ТЗ 6.1): характеристики, навыки с «галочками», фракции, партия. */
export function CharacterPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const p = engine.state.player
  const def = engine.campaign.entities[p.entity]
  const statNames: Array<keyof typeof p.stats> = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA']
  const factions = engine.campaign.meta.factions ?? []
  const load = engine.currentLoad()
  const maxLoad = engine.maxLoad()

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
        <div className="derived-row">
          <span className={load > maxLoad ? 'overload' : ''}>
            Груз {load.toFixed(1)}/{maxLoad} кг{load > maxLoad ? ' — перегруз!' : ''}
          </span>
        </div>
        <h3>Навыки <span className="muted small">(✓ — готов к росту после сна)</span></h3>
        <ul className="skill-list">
          {Object.entries(p.skills).sort(([a], [b]) => a.localeCompare(b)).map(([id, val]) => (
            <li key={id}>
              <span>
                {SKILL_LABELS[id] ?? id}
                {p.skill_marks?.[id] && <span className="skill-mark"> ✓</span>}
              </span>
              <span className="skill-val">{val}%</span>
            </li>
          ))}
        </ul>
        {factions.length > 0 && (
          <>
            <h3>Отношения</h3>
            <ul className="skill-list">
              {factions.map((f) => {
                const v = engine.state.dispositions[f.id] ?? 0
                const label = v >= 50 ? 'дружелюбно' : v >= 0 ? 'нейтрально' : v > -50 ? 'настороженно' : 'враждебно'
                return (
                  <li key={f.id}>
                    <span>{f.label}</span>
                    <span className={`disp ${v >= 0 ? 'disp-pos' : 'disp-neg'}`}>{v} · {label}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {engine.state.party.length > 0 && (
          <>
            <h3>Отряд</h3>
            <ul className="skill-list">
              {engine.state.party.map((c) => (
                <li key={c.entity}>
                  <span>{engine.campaign.entities[c.entity]?.label ?? c.entity}</span>
                  <span className="skill-val">HP {c.hp}/{c.max_hp}</span>
                </li>
              ))}
            </ul>
          </>
        )}
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

/** Журнал: квесты (стадии, записи) + события (ТЗ 6.1). */
export function LogPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const log = engine.state.log
  const quests = Object.entries(engine.state.quests)
  const active = quests.filter(([, q]) => q.status === 'active')
  const done = quests.filter(([, q]) => q.status !== 'active')

  const renderQuest = ([id, q]: (typeof quests)[number]) => {
    const def = engine.campaign.quests[id]
    if (!def) return null
    return (
      <div key={id} className={`quest-card quest-${q.status}`}>
        <div className="quest-title">
          {q.status === 'completed' ? '✔ ' : q.status === 'failed' ? '✖ ' : '◆ '}
          {def.label}
        </div>
        <div className="muted small">{def.description}</div>
        <ul className="quest-journal">
          {q.journal.map((j, i) => (
            <li key={i} className={i === q.journal.length - 1 ? '' : 'muted'}>{j}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Журнал</h2>
          <button className="btn btn-small" onClick={onClose}>✕</button>
        </div>
        <h3>Квесты</h3>
        {quests.length === 0 && <p className="muted">Заданий пока нет.</p>}
        {active.map(renderQuest)}
        {done.map(renderQuest)}
        <h3>События</h3>
        {log.length === 0 && <p className="muted">Записей пока нет.</p>}
        <ul className="log-list">
          {[...log].reverse().slice(0, 60).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
