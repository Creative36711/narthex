import { Ico } from '../shared/icons'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { LocationDef } from '../shared/types'
import { assetUrl } from '../core/loader'
import { ArtView } from '../shared/ArtView'
import { firstFrame } from './frames'

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

/** Человекочитаемое форматирование времени в пути с правильными склонениями */
function formatTicks(count: number, label: string): string {
  const norm = (label || '').trim().toLowerCase()
  if (norm === 'час' || norm === 'ч') {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod100 >= 11 && mod100 <= 19) return `${count} часов`
    if (mod10 === 1) return `${count} час`
    if (mod10 >= 2 && mod10 <= 4) return `${count} часа`
    return `${count} часов`
  }
  if (norm === 'день' || norm === 'д') {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod100 >= 11 && mod100 <= 19) return `${count} дней`
    if (mod10 === 1) return `${count} день`
    if (mod10 >= 2 && mod10 <= 4) return `${count} дня`
    return `${count} дней`
  }
  return `${count} ${label}.`
}

/**
 * Карта региона (ТЗ 4.9, 6.1; итерация 8, А4):
 * во весь игровой экран, с зумом и паном, названия локаций скрыты по
 * умолчанию (подсказка — при наведении) и включаются кнопкой «Названия».
 * Выбор пункта назначения отображает кинематографичную открытку и
 * запускает плавный атмосферный переход между локациями.
 */
export function MapScreen({ engine, onClose }: Props) {
  const region = engine.findRegion(engine.state.region)
  const [pending, setPending] = useState<string | null>(null)
  const [traveling, setTraveling] = useState<{ loc: LocationDef; cost: number } | null>(null)
  const [labels, setLabels] = useState(readLabels)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fit, setFit] = useState(1)
  const [box, setBox] = useState({ w: 800, h: 500 })
  const [dragging, setDragging] = useState(false)
  const [mapMotion, setMapMotion] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null)

  const size = region?.map_size ?? region?.map_art?.canvas ?? { w: 1280, h: 720 }

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

  const focusLocation = (position: { x: number; y: number }) => {
    const targetZoom = Math.max(zoom, 1.15)
    const targetScale = fit * targetZoom
    const maxX = Math.max(0, (size.w * targetScale - box.w) / 2)
    const maxY = Math.max(0, (size.h * targetScale - box.h) / 2)
    const x = -(position.x - size.w / 2) * targetScale
    const y = -(position.y - size.h / 2) * targetScale
    setZoom(targetZoom)
    setPan({ x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) })
    setMapMotion(true)
    window.setTimeout(() => setMapMotion(false), 450)
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

  const finishTravel = useCallback(() => {
    if (!traveling) return
    const targetLoc = traveling.loc
    engine.travelTo(targetLoc.id)
    setTraveling(null)
    setPending(null)
    onClose()
  }, [traveling, engine, onClose])

  // Автоматическое завершение анимации путешествия через 750 мс
  useEffect(() => {
    if (!traveling) return
    const timer = window.setTimeout(finishTravel, 750)
    return () => window.clearTimeout(timer)
  }, [traveling, finishTravel])

  // Горячие клавиши: Escape для отмены предпросмотра / закрытия карты, пробел/Enter для пропуска пути
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (traveling) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          finishTravel()
        }
        return
      }
      if (e.key === 'Escape') {
        if (pending) {
          e.preventDefault()
          setPending(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [traveling, pending, finishTravel, onClose])

  if (!region) return null
  const locations = engine.visibleLocations(region)
  const meta = engine.campaign.meta
  const isOverloadBlocked = engine.isTravelBlockedByOverload()
  const pendingLoc = pending ? locations.find((l) => l.id === pending) : null
  const pendingBaseCost = pending ? engine.travelBaseCost(pending) : null
  const pendingCost = pending ? engine.travelCost(pending) : null
  const scale = fit * zoom

  const handleStartTravel = (targetLoc: LocationDef, cost: number) => {
    if (isOverloadBlocked) return
    setTraveling({ loc: targetLoc, cost })
  }

  return (
    <div className="overlay map-overlay">
      <div className="map-screen">
        <div className="map-header">
          <h2><Ico n="map" /> {region.label}</h2>
          <div className="map-tools">
            <button
              type="button"
              className={`btn btn-small map-labels-toggle ${labels ? 'map-labels-on' : ''}`}
              data-tip="Показывать подписи у всех локаций"
              onClick={toggleLabels}
            >
              Названия
            </button>
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
          className={`map-viewport ${dragging ? 'is-dragging' : ''}`}
          onWheel={(e) => {
            e.preventDefault()
            zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
          }}
          onPointerDown={(e) => {
            const el = e.target as HTMLElement
            if (el.closest('.map-pin') || el.closest('.travel-confirm') || el.closest('.travel-journey-overlay')) return
            setDragging(true)
            drag.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y, moved: false }
            el.setPointerCapture?.(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            const dist = Math.hypot(e.clientX - d.px, e.clientY - d.py)
            if (dist > 4) d.moved = true
            setPan(clampPan({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }))
          }}
          onPointerUp={() => {
            if (drag.current && !drag.current.moved) {
              // клик в пустое место карты сбрасывает выбор локации
              setPending(null)
            }
            drag.current = null
            setDragging(false)
          }}
          onPointerLeave={() => { drag.current = null; setDragging(false) }}
        >
          <div
            className={`map-stage ${labels ? 'show-labels' : ''} ${mapMotion ? 'map-stage-motion' : ''}`}
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
              const isSelected = pending === l.id
              const baseCost = engine.travelBaseCost(l.id)
              const hasRoute = baseCost !== null && !here
              const cost = engine.travelCost(l.id)
              const reachable = cost !== null && !here
              const blockedByWeight = hasRoute && isOverloadBlocked
              return (
                <button
                  key={l.id}
                  className={`map-pin ${here ? 'here' : ''} ${reachable ? 'reachable' : ''} ${blockedByWeight ? 'blocked-weight' : ''} ${isSelected ? 'is-selected' : ''} ${l.position.y / size.h > 0.72 ? 'label-up' : ''}`}
                  style={{ left: `${(l.position.x / size.w) * 100}%`, top: `${(l.position.y / size.h) * 100}%` }}
                  onClick={() => {
                    if (reachable || blockedByWeight) {
                      setPending(l.id)
                      focusLocation(l.position)
                    }
                  }}
                >
                  <span className="pin-dot" />
                  <span className="pin-label">
                    {l.label}
                    {here ? ' (вы здесь)' : blockedByWeight ? ' · ⛔ перегруз' : reachable ? ` · ${cost} ${meta.tick_label}.` : ''}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="map-hint muted small">
            Колесо — зум · перетаскивание — пан · клик по маркеру — детали перехода
          </div>
        </div>

        {pendingLoc && !traveling && (
          <div className="travel-confirm" role="dialog" aria-label={`Переход в «${pendingLoc.label}»`}>
            {(() => {
              const locScene = pendingLoc.scenes[0] ? engine.campaign.scenes[pendingLoc.scenes[0]] : null
              const locImage = locScene?.states[0]?.image ? assetUrl(engine.campaign, firstFrame(locScene.states[0].image)) : null
              return locImage ? (
                <div className="travel-postcard">
                  <img className="travel-postcard-img" src={locImage} alt={pendingLoc.label} />
                  <div className="travel-postcard-overlay">
                    <div className="travel-postcard-top">
                      <span className="travel-postcard-badge">Пункт назначения</span>
                      <button
                        type="button"
                        className="travel-postcard-close"
                        onClick={() => setPending(null)}
                        title="Закрыть"
                        aria-label="Закрыть"
                      >
                        <Ico n="close" />
                      </button>
                    </div>
                    <h3 className="travel-postcard-title">{pendingLoc.label}</h3>
                  </div>
                </div>
              ) : (
                <div className="travel-header-simple">
                  <div className="travel-header-top">
                    <span className="travel-postcard-badge">Пункт назначения</span>
                    <button
                      type="button"
                      className="travel-postcard-close"
                      onClick={() => setPending(null)}
                      title="Закрыть"
                      aria-label="Закрыть"
                    >
                      <Ico n="close" />
                    </button>
                  </div>
                  <h3 className="travel-postcard-title">{pendingLoc.label}</h3>
                </div>
              )
            })()}

            <div className="travel-confirm-body">
              {isOverloadBlocked ? (
                <div className="travel-danger-box">
                  <div className="travel-danger-title">
                    <Ico n="lock" /> Движение заблокировано
                  </div>
                  <p className="travel-danger-text">
                    Критический перегруз: вес поклажи ({engine.currentLoad().toFixed(1)} кг) превышает лимит ({engine.maxLoad().toFixed(1)} кг) более чем вдвое. Сбросьте лишний вес или оставьте вещи в тайнике.
                  </p>
                </div>
              ) : (
                <div className="travel-route-info">
                  <div className="travel-route-time">
                    <Ico n="clock" />
                    <span>Время в пути: <b>{formatTicks(pendingCost ?? 1, meta.tick_label)}</b></span>
                  </div>
                  {pendingBaseCost !== null && pendingCost !== null && pendingCost > pendingBaseCost && (
                    <div className="travel-warning-chip">
                      <Ico n="warn" />
                      <span>
                        Замедление из-за перегруза: <b>+{pendingCost - pendingBaseCost} {meta.tick_label}</b> (базовое: {pendingBaseCost})
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="travel-confirm-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-travel-go"
                  disabled={isOverloadBlocked}
                  onClick={() => {
                    if (isOverloadBlocked || !pendingLoc) return
                    handleStartTravel(pendingLoc, pendingCost ?? 1)
                  }}
                >
                  <Ico n="compass" /> В путь
                </button>
                <button
                  type="button"
                  className="btn btn-travel-cancel"
                  onClick={() => setPending(null)}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {traveling && (
          <div
            className="travel-journey-overlay"
            onClick={finishTravel}
            role="dialog"
            aria-label="Переход между локациями"
          >
            <div className="travel-journey-card">
              <div className="travel-journey-compass">
                <Ico n="compass" className="travel-journey-compass-ico" />
              </div>
              <span className="travel-journey-badge">В пути</span>
              <h2 className="travel-journey-dest">{traveling.loc.label}</h2>
              <p className="travel-journey-time">
                <Ico n="clock" /> Время в дороге: <b>{formatTicks(traveling.cost, meta.tick_label)}</b>
              </p>

              <div className="travel-journey-progress-wrap">
                <div className="travel-journey-progress-bar" />
              </div>

              <div className="travel-journey-hint muted small">
                Шаги отдаются эхом в переходах... · нажмите, чтобы пропустить
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
