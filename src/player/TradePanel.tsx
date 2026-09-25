import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { ItemDef } from '../shared/types'
import { assetUrl } from '../core/loader'

/** Торговля (ТЗ 4.7): цены зависят от репутации и навыка торговли. */
export function TradePanel({ engine }: { engine: GameEngine }) {
  const npc = engine.trade!
  const trader = npc.trader!
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const silver = engine.itemCount('item_silver')
  const mod = engine.priceModifier(npc)

  const sellables = engine.state.player.inventory
    .map((e) => ({ e, def: engine.campaign.entities[e.item] as ItemDef | undefined }))
    .filter(
      (x) =>
        x.def?.type === 'item' &&
        x.e.item !== 'item_silver' &&
        (x.def.value?.silver ?? 0) > 0 &&
        // надетое снаряжение не продаётся (сначала «Снять» в инвентаре)
        !engine.isEquipped(x.e.item),
    )

  return (
    <div className="overlay panel-overlay">
      <div className="panel side-panel trade-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Торговля — {npc.label}</h2>
          <button className="btn btn-small" onClick={() => engine.closeTrade()}>✕</button>
        </div>
        <div className="trade-info">
          <span>Ваше серебро: <b className="gold">{silver} SM</b></span>
          <span className="muted small" title="Зависит от репутации и навыка торговли">
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
          <ul className="inv-list">
            {trader.sells.map((s) => {
              const def = engine.campaign.entities[s.item] as ItemDef | undefined
              if (!def) return null
              const price = engine.buyPrice(npc, s.item, s.price)
              const affordable = silver >= price
              return (
                <li key={s.item} className="inv-item">
                  <div className="inv-item-main">
                    {def.image && <img className="inv-thumb" src={assetUrl(engine.campaign, def.image)} alt="" />}
                    <b>{def.label}</b>
                    <div className="muted small">{def.description}</div>
                  </div>
                  <div className="inv-item-side">
                    <span className="gold">{price} SM</span>
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
        )}

        {tab === 'sell' && (
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
                    <span className="gold">{price} SM</span>
                    <button className="btn btn-small" disabled={price <= 0} onClick={() => engine.sellItem(e.item, price)}>
                      Продать
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
