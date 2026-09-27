import { useState } from 'react'
import { Ico } from '../shared/icons'
import { askConfirm } from '../shared/modals'
import type { GameEngine } from '../core/engine'
import { featureOn, type Effect, type ItemDef, type RecipeDef } from '../shared/types'
import { damageBonus, movement } from '../core/brp'
import { playInteraction } from '../shared/audio'

/** человекочитаемое описание эффектов on_use (фидбек №7: «сколько HP лечит мазь») */
function describeUseEffects(engine: GameEngine, effects: Effect[]): string {
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
  const currencies = engine.campaign.meta.currencies

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Инвентарь</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        {currencies.length > 0 && (
          <section className="inventory-currency" aria-label="Валюта персонажа">
            <h3>Валюта</h3>
            <div className="inventory-currency-list">
              {currencies.map((currency) => (
                <div className="inventory-currency-item" key={currency.id}>
                  <span>{currency.label}</span>
                  <b>{engine.currencyAmount(currency.id).toLocaleString('ru-RU')} {currency.symbol || currency.label}</b>
                </div>
              ))}
            </div>
          </section>
        )}
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
        <h3>Экипировка</h3>
        <div className="equip-slots">
          {engine.equipmentSlots().map((slot) => {
            const worn = engine.state.player.equipment[slot.id]
            const wornDef = worn ? (engine.campaign.entities[worn] as ItemDef | undefined) : undefined
            return (
              <div key={slot.id} className="equip-slot">
                <span className="equip-slot-name muted small">{slot.label}</span>
                {wornDef ? (
                  <>
                    <b className="small">{wornDef.label}</b>
                    <button className="btn btn-small" onClick={() => engine.unequipItem(slot.id)}>Снять</button>
                  </>
                ) : (
                  <span className="muted small">пусто</span>
                )}
              </div>
            )
          })}
        </div>
        {items.length === 0 && <p className="muted">Пусто.</p>}
        <ul className="inv-list">
          {items.map(({ entry, def }) => (
            <li key={`${entry.item}:${entry.durability ?? "full"}:${(def!.weight ?? 0)}`} className="inv-item">
              <div className="inv-item-main">
                <b>{def!.label}</b>
                {entry.quantity > 1 && <span className="qty">×{entry.quantity}</span>}
                {engine.isEquipped(entry.item) && <span className="equipped-badge"><Ico n="check" />  надето</span>}
                <div className="muted small">{def!.description}</div>
                {def!.on_use && describeUseEffects(engine, def!.on_use.effects) && (
                  <div className="muted small use-effect">{describeUseEffects(engine, def!.on_use.effects)}</div>
                )}
                {def!.weapon_data && (
                  <div className="muted small">
                    Оружие: {def!.weapon_data.damage}
                    {def!.weapon_data.damage_bonus ? '+ бонус силы' : ''} · навык «{engine.skillLabel(def!.weapon_data.skill)}»
                    {def!.weapon_data.durability !== undefined && (
                      <> · прочность {entry.durability ?? def!.weapon_data.durability}/{def!.weapon_data.durability}
                        {(entry.durability ?? def!.weapon_data.durability) === 0 && <b> (СЛОМАНО)</b>}
                      </>
                    )}
                  </div>
                )}
                {def!.armor_data && def!.armor_data.durability !== undefined && (
                  <div className="muted small">
                    Прочность брони: {entry.durability ?? def!.armor_data.durability}/{def!.armor_data.durability}
                    {(entry.durability ?? def!.armor_data.durability) === 0 && <b> (СЛОМАНО)</b>}
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
                {engine.itemSlot(entry.item) &&
                  (engine.isEquipped(entry.item) ? (
                    <button
                      className="btn btn-small"
                      onClick={() => engine.unequipItem(engine.equippedSlotOf(entry.item))}
                    >
                      Снять
                    </button>
                  ) : (
                    <button
                      className="btn btn-small"
                      data-tip={`Слот: ${engine.slotLabel(engine.itemSlot(entry.item)!)}`}
                      onClick={() => engine.equipItem(entry.item)}
                    >
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
        {(p.statuses ?? []).length > 0 && (
          <>
            <h3>Состояния</h3>
            <ul className="status-list">
              {(p.statuses ?? []).map((s) => {
                const sd = engine.statusDef(s.id)
                if (!sd) return null
                return (
                  <li key={s.id} className="status-item">
                    <b>{sd.label}</b>
                    <span className="muted small"> — ещё {s.left} {meta.tick_label}</span>
                    {sd.description && <div className="muted small">{sd.description}</div>}
                  </li>
                )
              })}
            </ul>
          </>
        )}
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

        {engine.progressionEnabled() && (
          <>
            <h3>Прокачка</h3>
            <div className="derived-row">
              <span>Уровень {engine.level()}</span>
              <span>Опыт {engine.xp()}{engine.xpToNext() != null ? ` / +${engine.xpToNext()} до след.` : ' (потолок)'}</span>
              {engine.pendingFeats() > 0 && <span className="skill-mark">Доступно черт: {engine.pendingFeats()}</span>}
            </div>
            {(p.feats ?? []).length > 0 && (
              <ul className="skill-list">
                {(p.feats ?? []).map((fid) => {
                  const f = engine.campaign.meta.progression?.feats?.find((x) => x.id === fid)
                  return (
                    <li key={fid} data-tip={f?.description || undefined}>
                      <span><Ico n="star" />  {f?.label ?? fid}</span>
                      <span className="skill-val">черта</span>
                    </li>
                  )
                })}
              </ul>
            )}
            {engine.pendingFeats() > 0 && (
              <div className="feat-picks">
                <h4 className="skill-cat">Выберите черту:</h4>
                <ul className="skill-list">
                  {engine.availableFeats().filter((f) => engine.featEligible(f)).map((f) => (
                    <li key={f.id} data-tip={f.description || undefined}>
                      <span>{f.label}</span>
                      <button className="btn btn-small" onClick={() => engine.takeFeat(f.id)}>Взять</button>
                    </li>
                  ))}
                  {engine.availableFeats().filter((f) => !engine.featEligible(f)).map((f) => (
                    <li key={f.id} className="muted" data-tip={`${f.description ?? ''}\n(истинность предпосылок не выполнена)`}>
                      <span>{f.label} — недоступна</span>
                      <span className="skill-val">—</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {(engine.wealthLevels().length > 0 || engine.reputationEnabled() || Object.keys(p.passions ?? {}).length > 0 || Object.keys(p.allegiance ?? {}).length > 0) && (
          <>
            <h3>Мир и характер</h3>
            <ul className="skill-list">
              {engine.wealthLevels().length > 0 && (
                <li data-tip={'Уровень достатка на шкале мастера (meta.wealth_levels).\nМеняется эффектами change_wealth.'}>
                  <span><Ico n="coin" />  Достаток</span>
                  <span className="skill-val">{engine.wealthLevelLabel()}</span>
                </li>
              )}
              {engine.reputationEnabled() && (
                <li data-tip="Репутация героя; меняется деяниями (эффекты change_reputation).">
                  <span><Ico n="star" />  {engine.reputationLabel()}</span>
                  <span className="skill-val">{engine.reputation()}</span>
                </li>
              )}
              {Object.entries(p.passions ?? {}).map(([id, val]) => (
                <li key={`passion-${id}`} data-tip={`Страсть: при значении ≥ порога аугмента даёт +бонус к подходящим проверкам (мастер назначает аугмент в эффектах).`}>
                  <span><Ico n="heart" />  {engine.passionLabel(id)} (страсть)</span>
                  <span className="skill-val">{val}%</span>
                </li>
              ))}
              {Object.entries(p.allegiance ?? {}).map(([id, val]) => (
                <li key={`all-${id}`} data-tip="Причастность силе: поступки в её духе (+1 очко) — эффекты change_allegiance; 100+ — знаки силы.">
                  <span><Ico n="flame" />  {engine.allegianceLabel(id)} (причастность)</span>
                  <span className="skill-val">{val}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {skillsOn && (
          <>
            <h3>Навыки <span className="muted small">(<Ico n="check" />  — готов к росту после сна)</span></h3>
            {(meta.skill_categories?.length ?? 0) > 0 ? (
              (() => {
                const catLabels = new Map((meta.skill_categories ?? []).map((c) => [c.id, c.label]))
                const groups = new Map<string, Array<[string, number]>>()
                for (const [id, val] of Object.entries(p.skills)) {
                  const cat = meta.skills?.find((s) => s.id === id)?.category ?? ''
                  if (!groups.has(cat)) groups.set(cat, [])
                  groups.get(cat)!.push([id, val])
                }
                return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cat, rows]) => (
                  <div key={cat || '__none'}>
                    <h4 className="skill-cat">{cat ? (catLabels.get(cat) ?? cat) : 'Прочее'}</h4>
                    <ul className="skill-list">
                      {rows.sort(([a], [b]) => a.localeCompare(b)).map(([id, val]) => (
                        <li key={id}>
                          <span>
                            {engine.skillLabel(id)}
                            {p.skill_marks?.[id] && <span className="skill-mark"> <Ico n="check" /> </span>}
                          </span>
                          <span className="skill-val">{val}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              })()
            ) : (
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
            )}
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
                  <li key={f.id} data-tip={f.description || undefined}>
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
            if (r.repair && !engine.hasDamaged(r.output.item)) missing.push(`нет изношенного «${engine.campaign.entities[r.output.item]?.label ?? r.output.item}» — чинить нечего`)
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
        {recipe.repair && <span className="equipped-badge" data-tip="Восстанавливает прочность изношенного предмета до максимума">починка</span>}
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
          <Ico n="hammer" />  {recipe.repair ? 'Починить' : 'Изготовить'}
        </button>
      </div>
    </li>
  )
}
