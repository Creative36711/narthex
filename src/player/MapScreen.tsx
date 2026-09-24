import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'

interface Props {
  engine: GameEngine
  onClose: () => void
}

/** Карта региона: точки локаций, клик → подтверждение путешествия (ТЗ 4.9, 6.1). */
export function MapScreen({ engine, onClose }: Props) {
  const region = engine.findRegion(engine.state.region)
  const [pending, setPending] = useState<string | null>(null)

  if (!region) return null
  const size = region.map_size ?? { w: 1280, h: 720 }
  const locations = engine.visibleLocations(region)
  const meta = engine.campaign.meta

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const pendingLoc = pending ? locations.find((l) => l.id === pending) : null
  const pendingCost = pending ? engine.travelCost(pending) : null

  return (
    <div className="overlay map-overlay">
      <div className="map-panel">
        <div className="map-header">
          <h2>{region.label}</h2>
          <button className="btn btn-small" onClick={onClose}>✕ Закрыть</button>
        </div>
        <div className="map-stage" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
          <img className="map-bg" src={assetUrl(engine.campaign, region.map_image)} alt={region.label} draggable={false} />
          {locations.map((l) => {
            const here = l.id === engine.state.location
            const cost = engine.travelCost(l.id)
            const reachable = cost !== null && !here
            return (
              <button
                key={l.id}
                className={`map-pin ${here ? 'here' : ''} ${reachable ? 'reachable' : ''}`}
                style={{ left: pct(l.position.x, size.w), top: pct(l.position.y, size.h) }}
                onClick={() => reachable && setPending(l.id)}
                title={l.label}
              >
                <span className="pin-dot" />
                <span className="pin-label">
                  {l.label}
                  {here ? ' (вы здесь)' : reachable ? ` · ${cost} ${meta.tick_label}.` : ''}
                </span>
              </button>
            )
          })}
        </div>

        {pendingLoc && (
          <div className="travel-confirm">
            <p>
              Отправиться в «{pendingLoc.label}»? Дорога займёт{' '}
              <b>{pendingCost} {meta.tick_label}.</b>
            </p>
            <div className="row-buttons">
              <button
                className="btn btn-primary"
                onClick={() => {
                  engine.travelTo(pendingLoc.id)
                  setPending(null)
                  onClose()
                }}
              >
                В путь
              </button>
              <button className="btn" onClick={() => setPending(null)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
