import { useState } from 'react'
import { Ico } from '../shared/icons'
import { askConfirm } from '../shared/modals'
import type { GameEngine } from '../core/engine'
import type { ItemDef, NpcDef } from '../shared/types'
import { assetUrl } from '../core/loader'
import { itemImageSrc } from './Panels'

/**
 * Отряд (слой «Консоль отряда»): чипы напарников слева и карточка напарника
 * по клику — поговорить, применить предмет (лечение/еда), вторая сумка,
 * отпустить. Набор потребностей и сумка задаётся мастером карточкой NPC
 * (companion_needs / companion_carry) — движок ничего не зашивает.
 */

type CardView = 'main' | 'items' | 'bag'

function portraitOf(engine: GameEngine, def: NpcDef): string | null {
  const rel = def.token ?? def.portrait?.neutral ?? Object.values(def.portrait ?? {})[0]
  return rel ? assetUrl(engine.campaign, rel) : null
}

/** кратко: что предмет даст НАПАРНИКУ (hp + его отслеживаемые потребности) */
function summarizeFor(engine: GameEngine, item: ItemDef, entity: string): string {
  const parts: string[] = []
  for (const e of item.on_use?.effects ?? []) {
    if (e.type === 'change_hp' && e.delta > 0) parts.push(`+${e.delta} HP`)
    else if (e.type === 'change_need') {
      if (engine.companionNeed(entity, e.need) == null) continue
      const def = engine.campaign.entities[entity] as NpcDef | undefined
      if (!def?.companion_needs?.includes(e.need)) continue
      const need = engine.campaign.meta.needs.find((n) => n.id === e.need)
      parts.push(`${e.delta > 0 ? '+' : ''}${e.delta} «${(need?.short_label ?? need?.label ?? e.need).toLowerCase()}»`)
    }
  }
  return parts.join(', ')
}

function NeedBar({ label, value, max, critical }: { label: string; value: number; max: number; critical: boolean }) {
  return (
    <div className={`party-need${critical ? ' critical' : ''}`}>
      <span className="party-need-label">{label}</span>
      <div className="party-need-bar">
        <div className="party-need-fill" style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} />
      </div>
      <span className="party-need-value">{Math.round(value)}</span>
    </div>
  )
}

function CompanionCard({ engine, entity, onClose }: { engine: GameEngine; entity: string; onClose: () => void }) {
  const [view, setView] = useState<CardView>('main')
  const comp = engine.state.party.find((c) => c.entity === entity)
  const def = engine.campaign.entities[entity] as NpcDef | undefined
  const [busy, setBusy] = useState(false)
  if (!comp || !def) return null

  const needDefs = engine.companionNeedDefs(entity)
  const mood = engine.npcMood(entity)
  const moodNote = mood >= 70 ? 'бодр(а) и расположен(а)' : mood <= 25 ? 'измотан(а) и раздражён(а)' : 'держится ровно'
  const canTalk = !!def.dialogue
  const exhausted = needDefs.some((n) => (comp.needs?.[n.id] ?? n.max) <= n.critical_threshold)

  const usable = engine.state.player.inventory
    .map((entry) => ({ entry, def: engine.campaign.entities[entry.item] as ItemDef | undefined }))
    .filter(({ entry, def }) => entry.quantity > 0 && def?.type === 'item' && !!def.on_use)
    .map(({ entry, def }) => ({ entry, def: def!, summary: summarizeFor(engine, def!, entity) }))
    .filter(({ summary }) => summary.length > 0)

  const bagItems = (comp.inventory ?? [])
    .map((entry) => ({ entry, def: engine.campaign.entities[entry.item] as ItemDef | undefined }))
    .filter((x): x is { entry: { item: string; quantity: number }; def: ItemDef } => !!x.def && x.def.type === 'item')

  const playerItems = engine.state.player.inventory
    .map((entry) => ({ entry, def: engine.campaign.entities[entry.item] as ItemDef | undefined }))
    .filter((x): x is { entry: { item: string; quantity: number }; def: ItemDef } => !!x.def && x.def.type === 'item' && x.entry.quantity > 0)

  const load = engine.companionLoad(entity)
  const cap = engine.companionCapacity(entity)

  const dismiss = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (await askConfirm(`Отпустить ${def.label}? Вернётся к своему расписанию.`, 'Отпустить')) {
        engine.leaveParty(entity)
        // диалоговый уход (эффект leave_party) идёт через applyEffects → checkRules;
        // карточный путь — тот же контракт: правила-сторожа кампании тоже отработают
        engine.checkRules()
        engine.messages.push({ text: `${def.label} покидает отряд.` })
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel party-card" onClick={(e) => e.stopPropagation()}>
        <div className="party-card-head">
          <div className="party-portrait">
            {portraitOf(engine, def) ? <img src={portraitOf(engine, def)!} alt={def.label} /> : <Ico n="user" />}
          </div>
          <div style={{ flex: 1 }}>
            <h3>{def.label}</h3>
            <div className="muted small">
              HP {comp.hp}/{comp.max_hp} · {moodNote}
              {exhausted ? ' · истощён(а) (−10% навыков в бою)' : ''}
            </div>
            <div className="party-hp-bar">
              <div className="party-hp-fill" style={{ width: `${Math.max(0, (comp.hp / comp.max_hp) * 100)}%` }} />
            </div>
          </div>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /></button>
        </div>

        {view === 'main' && (
          <>
            {needDefs.length > 0 && (
              <div className="party-needs">
                {needDefs.map((n) => {
                  const v = comp.needs?.[n.id] ?? n.max
                  return (
                    <NeedBar
                      key={n.id}
                      label={n.short_label ?? n.label}
                      value={v}
                      max={n.max}
                      critical={v <= n.critical_threshold}
                    />
                  )
                })}
                <div className="muted small">Ест/пьёт/отдыхает вместе с вами: общий стол делит восстановление.</div>
              </div>
            )}
            <div className="party-actions">
              <button
                className="btn"
                disabled={!canTalk}
                data-tip={canTalk ? 'Начать разговор с напарником' : 'У этого персонажа нет диалога'}
                onClick={() => {
                  onClose()
                  engine.startDialogue(entity)
                }}
              >
                <Ico n="message" /> Поговорить
              </button>
              <button className="btn" onClick={() => setView('items')} data-tip="Бинты, еда, тоники — применить к напарнику">
                <Ico n="heart" /> Применить предмет
              </button>
              {def.companion_carry && (
                <button className="btn" onClick={() => setView('bag')} data-tip={`Сумка напарника: ${load}/${cap} кг`}>
                  <Ico n="bag" /> Сумка
                </button>
              )}
              <button className="btn btn-drop" disabled={busy} onClick={dismiss}>
                <Ico n="exit" /> Отпустить
              </button>
            </div>
          </>
        )}

        {view === 'items' && (
          <div className="party-subview">
            <div className="panel-head">
              <h4>Применить к {def.label}</h4>
              <button className="btn btn-small" onClick={() => setView('main')}>← Назад</button>
            </div>
            {usable.length === 0 && <p className="muted">В сумке героя нет предметов, которые помогут напарнику.</p>}
            <ul className="inv-list">
              {usable.map(({ entry, def: d, summary }) => (
                <li key={entry.item} className="inv-item">
                  <div className="inv-item-thumb-box">{itemImageSrc(engine, d) ? <img src={itemImageSrc(engine, d)!} alt="" /> : <Ico n="bag" />}</div>
                  <div style={{ flex: 1 }}>
                    <b className="small">{d.label}</b> <span className="muted small">×{entry.quantity}</span>
                    <div className="muted small">{summary}</div>
                  </div>
                  <button className="btn btn-small" onClick={() => engine.useItemOnCompanion(entity, entry.item)}>
                    Применить
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === 'bag' && def.companion_carry && (
          <div className="party-subview">
            <div className="panel-head">
              <h4>Сумка: {def.label}</h4>
              <button className="btn btn-small" onClick={() => setView('main')}>← Назад</button>
            </div>
            <div className="party-weight">
              <div className="party-need-bar">
                <div
                  className={`party-need-fill${load > cap ? ' over' : ''}`}
                  style={{ width: `${Math.min(100, (load / Math.max(1, cap)) * 100)}%` }}
                />
              </div>
              <span className="muted small">{load}/{cap} кг</span>
            </div>
            <div className="party-bag-cols">
              <div>
                <h5 className="muted">У героя</h5>
                <ul className="inv-list">
                  {playerItems.map(({ entry, def: d }) => {
                    const quest = !!d.quest_item
                    return (
                      <li key={`p-${entry.item}`} className="inv-item">
                        <span className="small" style={{ flex: 1 }}>
                          {d.label} <span className="muted">×{entry.quantity}</span>
                          {quest && <span className="party-quest-mark" data-tip="Сюжетная вещь">★</span>}
                        </span>
                        <button
                          className="btn btn-small"
                          disabled={quest}
                          data-tip={quest ? 'Сюжетную вещь нельзя отдать — напарник может уйти или погибнуть, а вещь должна остаться у вас' : 'Передать напарнику (1 шт.)'}
                          onClick={() => engine.giveItemToCompanion(entity, entry.item, 1)}
                        >
                          →
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div>
                <h5 className="muted">У напарника</h5>
                {bagItems.length === 0 && <p className="muted small">Пусто.</p>}
                <ul className="inv-list">
                  {bagItems.map(({ entry, def: d }) => {
                    const slot = engine.itemSlot(entry.item)
                    const worn = slot ? comp.equipment?.[slot] === entry.item : false
                    return (
                      <li key={`c-${entry.item}`} className="inv-item">
                        <span className="small" style={{ flex: 1 }}>{d.label} <span className="muted">×{entry.quantity}</span></span>
                        {slot && (
                          <button
                            className={`btn btn-small${worn ? ' active' : ''}`}
                            data-tip={worn ? 'Снять' : `Надеть (слот: ${engine.slotLabel(slot)}) — в бою напарник использует снаряжение`}
                            onClick={() => engine.equipCompanionItem(entity, slot, worn ? null : entry.item)}
                          >
                            {worn ? 'Снять' : 'Надеть'}
                          </button>
                        )}
                        <button className="btn btn-small" data-tip="Забрать себе (1 шт.)" onClick={() => engine.takeItemFromCompanion(entity, entry.item, 1)}>
                          ←
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function PartyPanel({ engine }: { engine: GameEngine }) {
  const [openEntity, setOpenEntity] = useState<string | null>(null)
  const party = engine.state.party
  if (!party.length) return null
  return (
    <>
      <div className="party-panel">
        {party.map((c) => {
          const def = engine.campaign.entities[c.entity] as NpcDef | undefined
          if (!def) return null
          const needDefs = engine.companionNeedDefs(c.entity)
          const hurt = c.hp <= c.max_hp * 0.35
          const exhausted = needDefs.some((n) => (c.needs?.[n.id] ?? n.max) <= n.critical_threshold)
          return (
            <button
              key={c.entity}
              className={`party-chip${hurt || exhausted ? ' warn' : ''}`}
              data-tip={`${def.label}\nHP ${c.hp}/${c.max_hp}${needDefs.length ? `\n${needDefs.map((n) => `${n.short_label ?? n.label}: ${Math.round(c.needs?.[n.id] ?? n.max)}`).join(' · ')}` : ''}\n— карточка напарника`}
              onClick={() => setOpenEntity(c.entity === openEntity ? null : c.entity)}
            >
              <span className="party-chip-face">{portraitOf(engine, def) ? <img src={portraitOf(engine, def)!} alt="" /> : <Ico n="user" />}</span>
              <span className="party-chip-name">{def.label.split(' ')[0]}</span>
              <span className="party-chip-hp">
                <span className="party-chip-hp-fill" style={{ width: `${Math.max(0, (c.hp / c.max_hp) * 100)}%` }} />
              </span>
            </button>
          )
        })}
      </div>
      {openEntity && engine.state.party.some((c) => c.entity === openEntity) && (
        <CompanionCard engine={engine} entity={openEntity} onClose={() => setOpenEntity(null)} />
      )}
    </>
  )
}
