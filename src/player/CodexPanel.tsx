import { useState } from 'react'
import { Ico } from '../shared/icons'
import type { GameEngine } from '../core/engine'
import type { NpcDef } from '../shared/types'
import { assetUrl } from '../core/loader'

/**
 * Кодекс/бестиарий (блок 10 ТЗ «Гибкий движок»): разблокированные
 * лор-записи по категориям. Панель появляется в HUD, только когда
 * открыта хотя бы одна запись.
 */
export function CodexPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const entries = engine.unlockedCodexEntries()
  const cats = engine.codexCategories()
  // категории с хотя бы одной записью, в порядке реестра + «прочее» в конце
  const grouped = cats
    .map((c) => ({
      ...c,
      items: entries.filter((e) => (e.category ?? 'chronicles') === c.id),
    }))
    .filter((c) => c.items.length)
  const [catId, setCatId] = useState(grouped[0]?.id ?? '')
  const active = grouped.find((c) => c.id === catId) ?? grouped[0]
  const [selId, setSelId] = useState<string | null>(active?.items[0]?.id ?? null)
  const sel = active?.items.find((e) => e.id === selId) ?? active?.items[0]

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel codex-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2><Ico n="book" />  Кодекс</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        {grouped.length === 0 ? (
          <p className="muted">Пока нет ни одной записи.</p>
        ) : (
          <div className="codex-body">
            <div className="codex-nav">
              {grouped.map((c) => (
                <div key={c.id} className="codex-cat-group">
                  <div className="codex-cat">{c.label}</div>
                  {c.items.map((e) => (
                    <button
                      key={e.id}
                      className={`codex-entry-btn ${active?.id === c.id && sel?.id === e.id ? 'sel' : ''}`}
                      onClick={() => {
                        setCatId(c.id)
                        setSelId(e.id)
                      }}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div key={sel?.id ?? 'empty'} className="codex-view">
              {sel && (
                <>
                  <h3 className="codex-title">{sel.label}</h3>
                  {sel.image && (
                    <img className="codex-image" src={assetUrl(engine.campaign, sel.image)} alt={sel.label} />
                  )}
                  <div className="codex-text">{sel.text}</div>
                  {sel.creature_entity && <CreatureCard engine={engine} entityId={sel.creature_entity} />}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Боевая сводка существа в записи бестиария: статы, броня, оружие, способности, мораль. */
function CreatureCard({ engine, entityId }: { engine: GameEngine; entityId: string }) {
  const def = engine.campaign.entities[entityId] as NpcDef | undefined
  if (!def || def.type !== 'npc') return null
  const STAT_KEYS = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const
  const abs = (def.abilities ?? [])
    .map((id) => engine.campaign.meta.abilities?.find((a) => a.id === id))
    .filter(Boolean) as Array<{ id: string; label: string }>
  return (
    <div className="codex-creature">
      <h4 className="codex-creature-title"><Ico n="skull" /> Боевая сводка</h4>
      <div className="stat-grid codex-creature-stats">
        {STAT_KEYS.map((k) => (
          <div key={k} className="stat-cell">
            <span className="stat-name">{k}</span>
            <span className="stat-val">{def.stats[k]}</span>
          </div>
        ))}
      </div>
      <div className="codex-creature-rows">
        {(def.armor ?? 0) > 0 && <div className="muted small">Броня: −{def.armor} к урону</div>}
        {def.natural_weapon && (
          <div className="muted small">
            Природное оружие: {def.natural_weapon.label ?? 'удар'} — {def.natural_weapon.damage}
            {def.natural_weapon.damage_bonus ? ' + бонус силы' : ''} · навык «{engine.skillLabel(def.natural_weapon.skill)}»
          </div>
        )}
        {abs.length > 0 && (
          <div className="muted small">Способности: {abs.map((a) => a.label || a.id).join(', ')}</div>
        )}
        {def.morale && def.morale.below_hp_pct > 0 && (
          <div className="muted small">Ниже {def.morale.below_hp_pct}% здоровья может бросить бой</div>
        )}
      </div>
    </div>
  )
}
