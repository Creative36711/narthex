import { Ico } from '../shared/icons'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'
import { ArtView } from '../shared/ArtView'

interface Props {
  engine: GameEngine
  onClose: () => void
}

/** ключ localStorage: показывать ли названия локаций на карте */
const LABELS_KEY = 'chronicle-forge:map-labels'

function readLabels(): boolean {
  try {
    return localStorage.getItem(LABELS_KEY) === '1'
  } catch {
    return false
  }
}

function writeLabels(v: boolean): void {
  try {
    localStorage.setItem(LABELS_KEY, v ? '1' : '0')
  } catch {
    /* приватный режим */
  }
}

/**
 * Карта региона (ТЗ 4.9, 6.1; итерация 8, А4):
 * во весь игровой экран, с зумом и паном, названия локаций скрыты по
 * умолчанию (подсказка — при наведении) и включаются галочкой «Названия».
 */
export function MapScreen({ engine, onClose }: Props) {
  const region = engine.findRegion(engine.state.region)
  const [pending, setPending] = useState<string | null>(null)
  const [labels, setLabels] = useState(readLabels)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fit, setFit] = useState(1)
  const [box, setBox] = useState({ w: 800, h: 500 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const size = region?.map_size ?? { w: 1280, h: 720 }

  // вписываем карту в экран целиком (базовый масштаб), затем применяем зум
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ w: r.width, h: r.height })
      setFit(Math.min(r.width / size.w, r.height / size.h))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [size.w, size.h])

  const clampPan = useCallback(
    (p: { x: number; y: number }) => {
      const w = size.w * fit * zoom
      const h = size.h * fit * zoom
      // карта всегда перекрывает экран (или вписана в него — тогда без пана)
      const maxX = Math.max(0, (w - box.w) / 2)
      const maxY = Math.max(0, (h - box.h) / 2)
      return {
        x: Math.max(-maxX, Math.min(maxX, p.x)),
        y: Math.max(-maxY, Math.min(maxY, p.y)),
      }
    },
    [box.h, box.w, fit, size.h, size.w, zoom],
  )

  useEffect(() => setPan((p) => clampPan(p)), [clampPan])

  const toggleLabels = () => {
    const v = !labels
    setLabels(v)
    writeLabels(v)
  }

  const zoomBy = (mul: number, cx?: number, cy?: number) => {
    setZoom((z) => {
      const next = Math.max(1, Math.min(2.5, z * mul))
      if (cx != null && cy != null) {
        // держим точку под курсором на месте
        const k = next / z
        setPan((p) => clampPan({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }))
      }
      return next
    })
  }

  if (!region) return null
  const locations = engine.visibleLocations(region)
  const meta = engine.campaign.meta
  const pendingLoc = pending ? locations.find((l) => l.id === pending) : null
  const pendingCost = pending ? engine.travelCost(pending) : null
  const scale = fit * zoom

  return (
    <div className="overlay map-overlay">
      <div className="map-screen">
        <div className="map-header">
          <h2><Ico n="map" /> {region.label}</h2>
          <div className="map-tools">
            <label className="fld-check small map-labels-toggle" data-tip="Показывать подписи у всех локаций">
              <input type="checkbox" checked={labels} onChange={toggleLabels} />
              <span>Названия</span>
            </label>
            <button className="btn btn-small" onClick={() => zoomBy(1 / 1.25)} data-tip="Уменьшить">−</button>
            <button className="btn btn-small" onClick={() => zoomBy(1.25)} data-tip="Увеличить"><Ico n="plus" /> </button>
            <button
              className="btn btn-small"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
              data-tip="Вписать карту в экран"
            >
              Сброс
            </button>
            <button className="btn btn-small" onClick={onClose}><Ico n="close" />  Закрыть</button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="map-viewport"
          onWheel={(e) => {
            e.preventDefault()
            zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
          }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('.map-pin')) return
            drag.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y }
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            setPan(clampPan({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }))
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          <div
            className={`map-stage ${labels ? 'show-labels' : ''}`}
            style={{
              width: size.w * scale,
              height: size.h * scale,
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            {region.map_art ? (
              <ArtView className="map-bg" art={region.map_art} />
            ) : (
              <img className="map-bg" src={assetUrl(engine.campaign, region.map_image)} alt={region.label} draggable={false} />
            )}
            {locations.map((l) => {
              const here = l.id === engine.state.location
              const cost = engine.travelCost(l.id)
              const reachable = cost !== null && !here
              return (
                <button
                  key={l.id}
                  className={`map-pin ${here ? 'here' : ''} ${reachable ? 'reachable' : ''} ${l.position.y / size.h > 0.72 ? 'label-up' : ''}`}
                  style={{ left: `${(l.position.x / size.w) * 100}%`, top: `${(l.position.y / size.h) * 100}%` }}
                  onClick={() => reachable && setPending(l.id)}
                >
                  <span className="pin-dot" />
                  <span className="pin-label">
                    {l.label}
                    {here ? '(вы здесь)' : reachable ? ` · ${cost} ${meta.tick_label}.` : ''}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="map-hint muted small">
            Колесо — зум · перетаскивание — пан · наведите на маркер, чтобы увидеть название
          </div>
        </div>

        {pendingLoc && (
          <div className="travel-confirm">
            <p>
              Отправиться в «{pendingLoc.label}»? Дорога займёт{''}
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
