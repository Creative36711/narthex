/**
 * Кинематографический слой воздуха и движения камеры:
 *
 * 1. useCameraStyle — мягкий пан-зум фона сцены/слайда (`CameraDoc`);
 * 2. ParticleLayer — декларативные частицы из спрайта мастера (`ParticleEffectDef`);
 *    дождь/снег/пыль/искры/листопад собираются без кода;
 * 3. BannerLayer / PostcardLayer — большие надписи и «открытки» (эффекты правил).
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ArtDoc, CameraDoc, ParticleEffectDef, SceneParticles, SceneParticlesConfig } from '../shared/types'
import { ArtView } from '../shared/ArtView'

// ────────────────────────── 1. камера ──────────────────────────

/** стиль трансформации фона под CameraDoc: плавный пан-зум от текущего к целевому */
export function useCameraStyle(cam: CameraDoc | null | undefined): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({})
  const key = JSON.stringify(cam ?? null)
  useEffect(() => {
    if (!cam) {
      setStyle({})
      return
    }
    const dur = cam.duration ?? 8
    const z = Math.max(0.2, Math.min(4, cam.zoom ?? 1))
    const x = Math.max(-50, Math.min(50, cam.pan_x ?? 0))
    const y = Math.max(-50, Math.min(50, cam.pan_y ?? 0))
    // небольшой запас, чтобы при зуме/пане края кадра не оголялись
    const target: CSSProperties = {
      transform: `scale(${z * 1.06}) translate(${-x}%, ${-y}%)`,
      transformOrigin: '50% 50%',
      transition: dur > 0 ? `transform ${dur}s linear` : undefined,
    }
    // двойной RAF: браузер сначала отрисует «старое» состояние, затем целевое —
    // иначе transition не сработает на новом элементе.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setStyle(target))
    })
    return () => {
      cancelAnimationFrame(first)
      if (second) cancelAnimationFrame(second)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return cam ? style : {}
}

// ────────────────────────── 2. частицы ──────────────────────────

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number
  angle: number; spin: number
}

/** рендер одного эффекта из реестра `meta.atmospherics` (canvas-оверлей поверх сцены) */
export function ParticleLayer({ doc, srcOf }: { doc: ParticleEffectDef; srcOf: (path: string) => string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const srcOfRef = useRef(srcOf)
  srcOfRef.current = srcOf
  const count = Math.max(4, Math.min(400, doc.count ?? 60))
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()

    const src = doc.sprite ? srcOfRef.current(doc.sprite) : ''
    let img: HTMLImageElement | null = null
    if (src) {
      img = new Image()
      img.src = src
    }

    const parts: Particle[] = []
    const spawn = (p: Particle, w: number, h: number, anywhere = false) => {
      p.x = Math.random() * w
      p.size = (doc.size_min ?? 3) + Math.random() * Math.max(0, (doc.size_max ?? 6) - (doc.size_min ?? 3))
      p.vx = (doc.vx_min ?? -5) + Math.random() * Math.max(0.5, (doc.vx_max ?? 5) - (doc.vx_min ?? -5))
      p.vy = (doc.vy_min ?? 40) + Math.random() * Math.max(0.5, (doc.vy_max ?? 80) - (doc.vy_min ?? 40))
      p.angle = Math.random() * Math.PI * 2
      p.spin = (doc.spin ?? 0) * (Math.PI / 180)
      if (anywhere) {
        p.y = Math.random() * h
      } else if (p.vy < 0) {
        // Частицы поднимаются вверх (пар, дым, искры, угли): спавним снизу
        p.y = h + 16 + Math.random() * 40
      } else {
        // Частицы падают вниз (дождь, снег, пыль): спавним сверху
        p.y = -16 - Math.random() * 40
      }
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const w = () => canvas.clientWidth
    const h = () => canvas.clientHeight
    for (let i = 0; i < count; i++) {
      const p: Particle = { x: 0, y: 0, vx: 0, vy: 0, size: 3, angle: 0, spin: 0 }
      spawn(p, w(), h(), true)
      parts.push(p)
    }

    const step = (now: number) => {
      // размытие тумана даёт css-фильтр на контейнере, здесь — только движение
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, w(), h())
      ctx.globalAlpha = Math.max(0, Math.min(1, doc.opacity ?? 0.8))
      for (const p of parts) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        const outBottom = p.vy >= 0 && p.y - p.size > h() + 20
        const outTop = p.vy < 0 && p.y + p.size < -20
        const outSides = p.x < -32 || p.x - p.size > w() + 32
        if (doc.loop !== false && (outBottom || outTop || outSides)) {
          spawn(p, w(), h(), false)
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        if (img && img.complete && img.naturalWidth > 0) {
          const size = p.size
          ctx.drawImage(img, -size / 2, -size / 2, size, size)
        } else {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size / 2)
          g.addColorStop(0, doc.color_inner || 'rgba(255,255,255,0.95)')
          g.addColorStop(1, doc.color_outer || 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, count])

  const style: CSSProperties = { filter: doc.blur ? `blur(${doc.blur}px)` : undefined, mixBlendMode: doc.blend === 'screen' ? 'screen' : undefined }
  return <canvas ref={canvasRef} className="atmosphere-particles" aria-hidden style={style} />
}

const BUILTIN_PARTICLE_DOCS: Record<string, ParticleEffectDef> = {
  dust: {
    id: 'dust',
    label: 'Пылинки',
    count: 52,
    size_min: 2,
    size_max: 4.5,
    vx_min: -6,
    vx_max: 6,
    vy_min: -5,
    vy_max: 7,
    opacity: 0.72,
    blur: 0.3,
    color_inner: 'rgba(255, 238, 185, 0.92)',
    color_outer: 'rgba(235, 205, 130, 0)',
  },
  steam: {
    id: 'steam',
    label: 'Пар',
    count: 24,
    size_min: 20,
    size_max: 42,
    vx_min: -8,
    vx_max: 10,
    vy_min: -18,
    vy_max: -38,
    opacity: 0.38,
    blur: 5,
    color_inner: 'rgba(215, 228, 245, 0.55)',
    color_outer: 'rgba(180, 195, 215, 0)',
  },
  sparks: {
    id: 'sparks',
    label: 'Искры',
    count: 36,
    size_min: 2.5,
    size_max: 5,
    vx_min: -16,
    vx_max: 16,
    vy_min: -30,
    vy_max: -65,
    opacity: 0.95,
    blend: 'screen',
    color_inner: 'rgba(255, 210, 75, 1)',
    color_outer: 'rgba(255, 80, 0, 0)',
  },
  embers: {
    id: 'embers',
    label: 'Угли',
    count: 30,
    size_min: 3,
    size_max: 6,
    vx_min: -10,
    vx_max: 10,
    vy_min: -16,
    vy_max: -38,
    opacity: 0.85,
    blend: 'screen',
    color_inner: 'rgba(255, 115, 25, 0.95)',
    color_outer: 'rgba(220, 50, 0, 0.2)',
  },
}

/** Слой атмосферы по ключу WeatherDef.overlay или SceneDef.particles (строка или объект настроек) */
export function AtmosphereLayer({
  overlay,
  atmospherics,
  srcOf,
}: {
  overlay?: SceneParticles | string | null
  atmospherics?: ParticleEffectDef[]
  srcOf?: (path: string) => string
}) {
  if (!overlay || overlay === 'none') return null

  const config: SceneParticlesConfig = typeof overlay === 'string'
    ? { type: overlay as any }
    : overlay

  const type = config.type
  if (!type || type === 'none') return null

  const builtinCss = ['rain', 'snow', 'fog', 'ash'].includes(type)
  if (builtinCss) {
    const windClass = config.wind === 'left' ? ' wind-left' : config.wind === 'right' ? ' wind-right' : ''
    const speedClass = config.speed === 'fast' ? ' speed-fast' : config.speed === 'slow' ? ' speed-slow' : ''
    const densityClass = config.density === 'high' ? ' density-high' : config.density === 'low' ? ' density-low' : ''
    return <div className={`weather-overlay weather-${type}${windClass}${speedClass}${densityClass}`} aria-hidden="true" />
  }

  const baseDoc = BUILTIN_PARTICLE_DOCS[type] ?? (atmospherics ?? []).find((a) => a.id === type)
  if (!baseDoc) {
    return <div className={`weather-overlay weather-${type}`} aria-hidden="true" />
  }

  // Применяем настройки скорости, плотности, ветра и цвета
  const countMultiplier = config.density === 'high' ? 1.8 : config.density === 'low' ? 0.55 : 1
  const speedMultiplier = config.speed === 'fast' ? 1.7 : config.speed === 'slow' ? 0.55 : 1
  const windOffset = config.wind === 'left' ? -25 : config.wind === 'right' ? 25 : 0

  const tunedDoc: ParticleEffectDef = {
    ...baseDoc,
    count: Math.round((baseDoc.count ?? 60) * countMultiplier),
    vx_min: ((baseDoc.vx_min ?? -5) + windOffset) * speedMultiplier,
    vx_max: ((baseDoc.vx_max ?? 5) + windOffset) * speedMultiplier,
    vy_min: (baseDoc.vy_min ?? 40) * speedMultiplier,
    vy_max: (baseDoc.vy_max ?? 80) * speedMultiplier,
    color_inner: config.color || baseDoc.color_inner,
  }

  return <ParticleLayer doc={tunedDoc} srcOf={srcOf ?? ((p) => p)} />
}

// ────────────────────────── 3. баннеры ──────────────────────────

export interface BannerInstance {
  serial: number
  text: string
  preset?: string
  enter?: string
  seconds?: number
  position?: string
  accent?: string
}

/** набор активных баннеров: мастерские надписи поверх мира (эффект правил 'banner') */
export function BannerLayer({ banners }: { banners: BannerInstance[] }) {
  if (!banners.length) return null
  return (
    <>
      {banners.map((b) => {
        const preset = b.preset && ['глава', 'шёпот', 'заголовок', 'проклятье', 'записочный'].includes(b.preset) ? b.preset : 'глава'
        const enter = b.enter && ['всплеск', 'тянуть', 'сбоку', 'молниеносно'].includes(b.enter) ? b.enter : 'всплеск'
        const pos = b.position === 'верх' ? 'верх' : 'центр'
        const style = (b.accent ? { '--banner-accent': b.accent } : {}) as CSSProperties
        return (
          <div key={b.serial} className={`cf-banner cf-banner-${pos} cf-banner-p-${preset} cf-banner-e-${enter}`} style={style}>
            <span className="cf-banner-text">{b.text}</span>
          </div>
        )
      })}
    </>
  )
}

// ────────────────────────── 4. «открытка» ──────────────────────────

export interface PostcardInstance {
  image?: string
  art?: ArtDoc
  text?: string
  preset?: string
  seconds?: number
  camera?: CameraDoc
}

/** «открытка» — иллюстрация на весь экран с подписью; закрывается тапом или по таймеру движка */
export function PostcardLayer({ postcard, srcOf, onTap }: { postcard: PostcardInstance; srcOf: (path: string) => string; onTap: () => void }) {
  const camStyle = useCameraStyle(postcard.camera ?? null)
  const preset = postcard.preset && ['глава', 'шёпот', 'заголовок', 'проклятье', 'записочный'].includes(postcard.preset) ? postcard.preset : 'глава'
  return (
    <div className="cf-postcard" role="dialog" aria-label={postcard.text ?? 'открытка'} onClick={onTap}>
      <div className="cf-postcard-frame">
        {postcard.art ? (
          <ArtView className="cf-postcard-img" art={postcard.art} />
        ) : postcard.image ? (
          <div className="cf-postcard-zoom" style={camStyle}>
            <img className="cf-postcard-img" src={srcOf(postcard.image)} alt="" draggable={false} />
          </div>
        ) : (
          <div className="cf-postcard-img cf-postcard-fallback" />
        )}
        {postcard.text && (
          <div className={`cf-postcard-text cf-banner-p-${preset}`}>
            <span className="cf-banner-text">{postcard.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
