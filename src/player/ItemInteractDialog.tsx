import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrlOrNull } from '../core/loader'
import type { ItemDef } from '../shared/types'

export function ItemInteractDialog({ engine, item, onClose }: { engine: GameEngine; item: ItemDef; onClose: () => void }) {
  const [emotion, setEmotion] = useState('neutral')
  const options = engine.itemInteractOptions(item)
  const portraitSrc = assetUrlOrNull(
    engine.campaign,
    item.portrait?.[emotion] ?? item.portrait?.['neutral'],
  )
  return (
    <div className="overlay message-overlay itemdlg-overlay" onClick={onClose}>
      <div className="itemdlg-box" onClick={(e) => e.stopPropagation()}>
        {portraitSrc && (
          <div className="itemdlg-portrait">
            <img src={portraitSrc} alt={item.label} draggable={false} />
          </div>
        )}
        <div className="itemdlg-content">
          <h3 className="itemdlg-title">{item.label}</h3>
          <p className="itemdlg-desc">{engine.descOf(item.id) || item.description || ''}</p>
          <div className="usewith-options">
            {options.map((o, i) => {
              const autoHint = (() => {
                if (o.hint) return o.hint
                const hints: string[] = []
                const timeEf = o.effects?.find((ef) => ef.type === 'advance_time') as { ticks: number } | undefined
                if (timeEf?.ticks) {
                  const label = engine.campaign.meta.tick_label || 'ч'
                  hints.push(`⏱ ${timeEf.ticks} ${label}`)
                }
                if (o.consume) {
                  hints.push('предмет будет израсходован')
                }
                return hints.length ? hints.join(' · ') : null
              })()
              return (
                <button
                  key={i}
                  className="btn btn-primary itemdlg-option"
                  onMouseEnter={() => o.emotion && setEmotion(o.emotion)}
                  onMouseLeave={() => setEmotion('neutral')}
                  onClick={() => {
                    engine.runItemInteract(item, o)
                    onClose()
                  }}
                >
                  <span>{o.label}</span>
                  {autoHint && <small className="itemdlg-hint">{autoHint}</small>}
                </button>
              )
            })}
          </div>
          <button className="btn btn-small" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}
