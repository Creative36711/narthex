import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { ItemDef } from '../shared/types'
import { assetUrl } from '../core/loader'
import { ItemCategoryChips } from './Panels'

/** Торговля (ТЗ 4.7): цены зависят от репутации и навыка торговли. */
export function TradePanel({ engine }: { engine: GameEngine }) {
  const npc = engine.trade!
  const trader = npc.trader!
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [catBuy, setCatBuy] = useState<string>('all')
  const [catSell, setCatSell] = useState<string>('all')
  const currency = engine.campaign.meta.currencies[0]
  const currencyLabel = currency?.label ?? 'Серебро'
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
          <span>Ваш {currencyLabel.toLowerCase()}: <b className="gold">{balance} {currencySymbol}</b></span>
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
              const affordable = balance >= price
              return (
                <li key={s.item} className="inv-item">
                  <div className="inv-item-main">
                    {def.image && <img className="inv-thumb" src={assetUrl(engine.campaign, def.image)} alt="" />}
                    <b>{def.label}</b>
                    <div className="muted small">{def.description}</div>
                  </div>
                  <div className="inv-item-side">
                    <span className="gold">{price} {currencySymbol}</span>
                    <button
                      className="btn btn-small"
                      disabled={!affordable}
                      onClick={() => engine.buyItem(s.item, price)}
                    >
                      Купить
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
              return (
                <li key={e.item} className="inv-item">
                  <div className="inv-item-main">
                    <b>{def!.label}</b>
                    {e.quantity > 1 && <span className="qty">×{e.quantity}</span>}
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
