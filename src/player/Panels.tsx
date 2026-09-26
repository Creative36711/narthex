import { useState } from 'react'
import { Ico } from '../shared/icons'
import { askConfirm } from '../shared/modals'
import type { GameEngine } from '../core/engine'
import { featureOn, type Effect, type ItemDef, type RecipeDef } from '../shared/types'
import { damageBonus, movement } from '../core/brp'
import { playInteraction } from '../shared/audio'

/** человекочитаемое описание эффектов on_use (фидбек №7: «сколько HP лечит мазь») */
function useEffectText(engine: GameEngine, effects: Effect[]): string {
  const parts: string[] = []
  for (const e of effects) {
    if (e.type === 'change_hp') parts.push(e.delta > 0 ? `восстанавливает ${e.delta} HP` : `отнимает ${-e.delta} HP`)
    else if (e.type === 'change_need') {
      const need = engine.campaign.meta.needs.find((n) => n.id === e.need || `need_${e.need}` === n.id)
      const label = (need?.label ?? e.need).toLowerCase()
      parts.push(e.delta > 0 ? `+${e.delta} к «${label}»` : `−${-e.delta} к «${label}»`)
    } else if (e.type === 'advance_time') parts.push(`занимает ${e.ticks} ${engine.campaign.meta.tick_label}.`)
  }
  return parts.length ? `При использовании: ${parts.join(',')}.` : ''
}

/** фильтры инвентаря: всё / надетое / не надетое (фидбек 9.1) */
const EQUIP_FILTERS = ['all', 'equipped', 'unequipped'] as const

/** Инвентарь (ТЗ 4.6 — базовая часть Фазы 0: список, вес, использование). */
export function InventoryPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [equipFilter, setEquipFilter] = useState<(typeof EQUIP_FILTERS)[number]>('all')
  const inv = engine.state.player.inventory
  const items = inv
    .map((e) => ({ entry: e, def: engine.campaign.entities[e.item] as ItemDef | undefined }))
    .filter((x) => x.def?.type === 'item')
    .filter((x) => {
      if (q.trim() && !(x.def!.label ?? '').toLowerCase().includes(q.trim().toLowerCase())) return false
      if (equipFilter === 'all') return true
      const on = engine.isEquipped(x.entry.item)
      return equipFilter === 'equipped' ? on : !on
    })
  const totalWeight = items.reduce((sum, x) => sum + (x.def!.weight ?? 0) * x.entry.quantity, 0)

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Инвентарь</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        <div className="panel-tools">
          <input placeholder="Поиск по названию…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {([['all', 'Все'], ['equipped', 'Надето'], ['unequipped', 'Не надето']] as const).map(([k, lbl]) => (
              <button key={k} type="button" className={`chip ${equipFilter === k ? 'chip-on' : ''}`} onClick={() => setEquipFilter(k)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {items.length === 0 && <p className="muted">Пусто.</p>}
        <ul className="inv-list">
          {items.map(({ entry, def }) => (
            <li key={entry.item} className="inv-item">
              <div className="inv-item-main">
                <b>{def!.label}</b>
                {entry.quantity > 1 && <span className="qty">×{entry.quantity}</span>}
                {engine.isEquipped(entry.item) && <span className="equipped-badge"><Ico n="check" />  надето</span>}
                <div className="muted small">{def!.description}</div>
                {def!.on_use && useEffectText(engine, def!.on_use.effects) && (
                  <div className="muted small use-effect">{useEffectText(engine, def!.on_use.effects)}</div>
                )}
                {def!.weapon_data && (
                  <div className="muted small">
                    Оружие: {def!.weapon_data.damage}
                    {def!.weapon_data.damage_bonus ? '+ бонус силы' : ''} · навык «{engine.skillLabel(def!.weapon_data.skill)}»
                  </div>
                )}
                {def!.armor_data && <div className="muted small">Броня: −{def!.armor_data.points} к урону</div>}
              </div>
              <div className="inv-item-side">
                <span className="muted small">{(def!.weight * entry.quantity).toFixed(1)} кг</span>
                {def!.on_use && (
                  <button className="btn btn-small" onClick={() => engine.useItem(entry.item)}>
                    Использовать
                  </button>
                )}
                {(def!.weapon_data || def!.armor_data) &&
                  (engine.isEquipped(entry.item) ? (
                    <button
                      className="btn btn-small"
                      onClick={() => engine.unequipItem(def!.weapon_data ? 'weapon' : 'armor')}
                    >
                      Снять
                    </button>
                  ) : (
                    <button className="btn btn-small" onClick={() => engine.equipItem(entry.item)}>
                      Надеть
                    </button>
                  ))}
                <button
                  className="btn btn-small btn-drop"
                  data-tip="Выбросить 1 шт."
                  onClick={async () => {
                    if (await askConfirm(`Выбросить ${entry.quantity > 1 ? '1 шт. —' : ''}«${def!.label}»?`, 'Выбросить')) {
                      engine.removeItem(entry.item, 1)
                      playInteraction('drop', { entity: def })
                    }
                  }}
                >
                  <Ico n="trash" /> 
                </button>
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
  const meta = engine.campaign.meta
  const def = engine.campaign.entities[p.entity]
  const statNames: Array<keyof typeof p.stats> = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA']
  // скрытые (служебные) фракции игроку не показываем — фидбек №2 седьмого раунда
  const factions = (engine.campaign.meta.factions ?? []).filter((f) => !f.hidden)
  const load = engine.currentLoad()
  const maxLoad = engine.maxLoad()
  const weapon = engine.playerWeapon()
  const armor = engine.playerArmor()
  const inventoryOn = featureOn(meta, 'inventory')
  const skillsOn = featureOn(meta, 'skills')
  const relationshipsOn = featureOn(meta, 'relationships')

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>{def?.label ?? 'Герой'}</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
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
            Груз {load.toFixed(1)}/{maxLoad} кг{load > maxLoad ? '— перегруз!' : ''}
          </span>
        </div>
        <h3>Снаряжение</h3>
        <ul className="skill-list equip-list">
          <li>
            <span><Ico n="sword" />  В руках</span>
            <span className="skill-val">
              {weapon.label}
              {weapon.itemId && ` (${weapon.weapon.damage}${weapon.weapon.damage_bonus ? '+бонус' : ''})`}
            </span>
          </li>
          <li>
            <span><Ico n="shield" /> Броня</span>
            <span className="skill-val">
              {armor.label}
              {armor.itemId && ` (−${armor.points} к урону)`}
            </span>
          </li>
        </ul>
        {inventoryOn && (
          <div className="muted small" style={{ marginBottom: 10 }}>
            Надеть и снять снаряжение можно в инвентаре (<Ico n="bag" /> ).
          </div>
        )}

        {skillsOn && (
          <>
            <h3>Навыки <span className="muted small">(<Ico n="check" />  — готов к росту после сна)</span></h3>
            <ul className="skill-list">
              {Object.entries(p.skills).sort(([a], [b]) => a.localeCompare(b)).map(([id, val]) => (
                <li key={id}>
                  <span>
                    {engine.skillLabel(id)}
                    {p.skill_marks?.[id] && <span className="skill-mark"> <Ico n="check" /> </span>}
                  </span>
                  <span className="skill-val">{val}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {relationshipsOn && factions.length > 0 && (
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

/** Журнал: квесты (стадии, записи) + события (ТЗ 6.1). */
export function LogPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const [qq, setQq] = useState('')
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
          {q.status === 'completed' ? '' : q.status === 'failed' ? '×' : '◆'}
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
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        <h3>Квесты</h3>
        <div className="panel-tools">
          <input placeholder="Поиск по названию…" value={qq} onChange={(e) => setQq(e.target.value)} />
        </div>
        {quests.length === 0 && <p className="muted">Заданий пока нет.</p>}
        {active
          .filter(([id, q]) => !qq.trim() || `${engine.campaign.quests[id]?.label ?? id} ${q.journal.join(' ')}`.toLowerCase().includes(qq.trim().toLowerCase()))
          .map(renderQuest)}
        {done
          .filter(([id, q]) => !qq.trim() || `${engine.campaign.quests[id]?.label ?? id} ${q.journal.join(' ')}`.toLowerCase().includes(qq.trim().toLowerCase()))
          .map(renderQuest)}
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

/** Крафт (блок 4 ТЗ): список рецептов, недостающие компоненты, изготовление. */
export function CraftingPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const recipes = engine.allRecipes()
  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Изготовление</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        {recipes.length === 0 && <p className="muted">Рецептов пока нет.</p>}
        <ul className="craft-list">
          {recipes.map((r) => {
            const missing = engine.recipeMissing(r)
            return <CraftRow key={r.id} engine={engine} recipe={r} missing={missing} />
          })}
        </ul>
      </div>
    </div>
  )
}

function CraftRow({ engine, recipe, missing }: { engine: GameEngine; recipe: RecipeDef; missing: string[] }) {
  const canCraft = missing.length === 0
  const out = engine.campaign.entities[recipe.output.item] as ItemDef | undefined
  return (
    <li className={`craft-row ${canCraft ? '' : 'craft-blocked'}`}>
      <div className="inv-item-main">
        <b>{recipe.label}</b>
        {recipe.description && <div className="muted small">{recipe.description}</div>}
        {recipe.inputs.length > 0 && (
          <div className="muted small">
            Нужно: {recipe.inputs.map((n) => `${engine.campaign.entities[n.item]?.label ?? n.item} ×${n.quantity}`).join(', ')}
          </div>
        )}
        {(recipe.tools ?? []).length > 0 && (
          <div className="muted small">
            Инструменты: {recipe.tools!.map((t) => engine.campaign.entities[t]?.label ?? t).join(', ')} (не расходуются)
          </div>
        )}
        {recipe.skill && (
          <div className="muted small">
            Проверка навыка «{engine.skillLabel(recipe.skill.id)}» против {recipe.skill.difficulty}
          </div>
        )}
        {recipe.time_ticks ? (
          <div className="muted small">Занимает {recipe.time_ticks} {engine.campaign.meta.tick_label}</div>
        ) : null}
        {!canCraft && <div className="craft-missing small"><Ico n="warn" />  Не хватает: {missing.join('; ')}</div>}
      </div>
      <div className="inv-item-side">
        <div className="muted small craft-out">{out?.label ?? recipe.output.item}{recipe.output.quantity > 1 ? ` ×${recipe.output.quantity}` : ''}</div>
        <button className="btn btn-small" disabled={!canCraft} onClick={() => engine.craft(recipe.id)}>
          <Ico n="hammer" />  Изготовить
        </button>
      </div>
    </li>
  )
}
