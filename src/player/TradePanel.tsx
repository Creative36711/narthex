import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { ItemDef } from '../shared/types'
import { ItemCategoryChips, itemImageSrc } from './Panels'

/** Торговля (ТЗ 4.7): цены зависят от репутации и навыка торговли. */
export function TradePanel({ engine }: { engine: GameEngine }) {
  const npc = engine.trade!
  const trader = npc.trader!
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [catBuy, setCatBuy] = useState<string>('all')
  const [catSell, setCatSell] = useState<string>('all')
  const [inspectItem, setInspectItem] = useState<ItemDef | null>(null)
  const currency = engine.campaign.meta.currencies[0]
  const currencySymbol = currency?.symbol ?? 'SM'
  const currencyItem = engine.currencyItemId()
  const balance = engine.currencyAmount()
  const mod = engine.priceModifier(npc)

  const sellables = engine.state.player.inventory
    .map((e) => ({ e, def: engine.campaign.entities[e.item] as ItemDef | undefined }))
    .filter(
      (x) =>
        x.def?.type === 'item' &&
        x.e.item !== currencyItem &&
        (x.def.value?.[engine.mainCurrency] ?? 0) > 0 &&
        // надетое снаряжение не продаётся (сначала «Снять» в инвентаре)
        !engine.isEquipped(x.e.item),
    )
    .filter((x) => matchCat(x.def!, catSell))
    .sort((a, b) => (a.def!.label ?? '').localeCompare(b.def!.label ?? '', 'ru'))

  /** список продаж торговца, отфильтрованный по категории и по алфавиту */
  const buyables = trader.sells
    .map((s) => ({ s, def: engine.campaign.entities[s.item] as ItemDef | undefined }))
    .filter((x) => x.def && matchCat(x.def, catBuy))
    .sort((a, b) => (a.def!.label ?? '').localeCompare(b.def!.label ?? '', 'ru'))

  return (
    <div className="overlay panel-overlay">
      <div className="panel side-panel trade-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Торговля — {npc.label}</h2>
          <button className="btn btn-small" onClick={() => engine.closeTrade()}><Ico n="close" /> </button>
        </div>
        <div className="trade-info">
          <span>У вас: <b className="gold">{balance} {currencySymbol}</b></span>
          <span className="muted small" data-tip="Зависит от репутации и навыка торговли">
            наценка ×{mod.toFixed(2)}
          </span>
        </div>
        <div className="trade-tabs">
          <button className={`btn btn-small ${tab === 'buy' ? 'btn-primary' : ''}`} onClick={() => setTab('buy')}>
            Купить
          </button>
          {trader.buys && (
            <button className={`btn btn-small ${tab === 'sell' ? 'btn-primary' : ''}`} onClick={() => setTab('sell')}>
              Продать
            </button>
          )}
        </div>

        {tab === 'buy' && (
          <>
            <div className="panel-tools">
              <ItemCategoryChips engine={engine} defs={trader.sells.map((s) => engine.campaign.entities[s.item] as ItemDef | undefined)} cat={catBuy} setCat={setCatBuy} />
            </div>
          <ul className="inv-list">
            {buyables.map(({ s, def }) => {
              if (!def) return null
              const price = engine.buyPrice(npc, s.item, s.price)
              const stock = engine.traderItemStock(npc.id, s.item)
              const inStock = stock === undefined || stock > 0
              const affordable = balance >= price && inStock
              const imgSrc = itemImageSrc(engine, def)
              return (
                <li key={s.item} className={`inv-item${stock === 0 ? ' item-sold-out' : ''}`}>
                  <div
                    className="inv-item-thumb-box"
                    onClick={() => setInspectItem(def)}
                    data-tip="Нажмите, чтобы подробно осмотреть товар"
                  >
                    {imgSrc ? (
                      <img className="inv-thumb" src={imgSrc} alt="" />
                    ) : (
                      <div className="inv-thumb-placeholder">
                        <Ico n="bag" />
                      </div>
                    )}
                  </div>
                  <div className="inv-item-main" onClick={() => setInspectItem(def)} style={{ cursor: 'pointer' }}>
                    <div className="inv-item-header">
                      <b>{def.label}</b>
                      {stock !== undefined && (
                        <span className={`stock-tag ${stock > 0 ? 'stock-avail' : 'stock-none'}`}>
                          {stock > 0 ? `Осталось: ${stock} шт.` : 'Распродано'}
                        </span>
                      )}
                    </div>
                    <div className="muted small">{def.description}</div>
                  </div>
                  <div className="inv-item-side">
                    <span className="gold">{price} {currencySymbol}</span>
                    <button
                      className={`btn btn-small ${stock === 0 ? 'btn-disabled' : ''}`}
                      disabled={!affordable}
                      onClick={() => engine.buyItem(s.item, price)}
                    >
                      {stock === 0 ? 'Распродано' : 'Купить'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          </>
        )}

        {tab === 'sell' && (
          <>
            <div className="panel-tools">
              <ItemCategoryChips engine={engine} defs={sellableDefsAll(engine)} cat={catSell} setCat={setCatSell} />
            </div>
          <ul className="inv-list">
            {sellables.length === 0 && <p className="muted">Нечего продать.</p>}
            {sellables.map(({ e, def }) => {
              const price = engine.sellPrice(npc, e.item)
              const imgSrc = itemImageSrc(engine, def)
              return (
                <li key={e.item} className="inv-item">
                  <div
                    className="inv-item-thumb-box"
                    onClick={() => setInspectItem(def!)}
                    data-tip="Нажмите, чтобы подробно осмотреть предмет"
                  >
                    {imgSrc ? (
                      <img className="inv-thumb" src={imgSrc} alt="" />
                    ) : (
                      <div className="inv-thumb-placeholder">
                        <Ico n="bag" />
                      </div>
                    )}
                  </div>
                  <div className="inv-item-main" onClick={() => setInspectItem(def!)} style={{ cursor: 'pointer' }}>
                    <b>{def!.label}</b>
                    {e.quantity > 1 && <span className="qty">×{e.quantity}</span>}
                    <div className="muted small">{def!.description}</div>
                  </div>
                  <div className="inv-item-side">
                    <span className="gold">{price} {currencySymbol}</span>
                    <button className="btn btn-small" disabled={price <= 0} onClick={() => engine.sellItem(e.item, price)}>
                      Продать
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          </>
        )}
      </div>
      {inspectItem && (
        <div className="overlay item-inspect-overlay" onClick={() => setInspectItem(null)}>
          <div className="panel item-inspect-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h3>{inspectItem.label}</h3>
              <button className="btn btn-small" onClick={() => setInspectItem(null)}>
                <Ico n="close" />
              </button>
            </div>
            <div className="item-inspect-body">
              {itemImageSrc(engine, inspectItem) ? (
                <div className="item-inspect-art-wrap">
                  <img
                    className="item-inspect-art"
                    src={itemImageSrc(engine, inspectItem)!}
                    alt={inspectItem.label}
                  />
                </div>
              ) : null}
              <div className="item-inspect-info">
                {inspectItem.category && (
                  <span className="item-inspect-category">
                    {engine.campaign.meta.item_categories?.find((c) => c.id === inspectItem.category)?.label ?? inspectItem.category}
                  </span>
                )}
                <p className="item-inspect-desc">{inspectItem.description}</p>
                <div className="item-inspect-stats">
                  <div className="inspect-stat-row">
                    <span className="muted small">Вес:</span>
                    <b>{inspectItem.weight} кг</b>
                  </div>
                  {inspectItem.weapon_data && (
                    <div className="inspect-stat-row">
                      <span className="muted small">Урон оружия:</span>
                      <b>{inspectItem.weapon_data.damage} (навык: {engine.skillLabel(inspectItem.weapon_data.skill)})</b>
                    </div>
                  )}
                  {inspectItem.armor_data && (
                    <div className="inspect-stat-row">
                      <span className="muted small">Защита брони:</span>
                      <b>−{inspectItem.armor_data.points} к урону</b>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="item-inspect-actions">
              <button className="btn btn-small" onClick={() => setInspectItem(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** совпадение предмета с выбранной категорией фильтра ('__misc' — без категории) */
function matchCat(def: ItemDef, cat: string): boolean {
  if (cat === 'all') return true
  if (cat === '__misc') return !def.category
  return def.category === cat
}

/** все продаваемые определения предметов (для набора чипов категорий: не скрыт фильтром) */
function sellableDefsAll(engine: GameEngine): Array<ItemDef | undefined> {
  const npc = engine.trade!
  const currencyItem = engine.currencyItemId()
  return engine.state.player.inventory
    .filter(
      (e) => e.item !== currencyItem && !engine.isEquipped(e.item) && (engine.sellPrice(npc, e.item) > 0),
    )
    .map((e) => engine.campaign.entities[e.item] as ItemDef | undefined)
}
