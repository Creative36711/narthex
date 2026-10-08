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
  const count = Math.max(4, Math.min(1000, doc.count ?? 60))
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
    count: 150,
    size_min: 1.6,
    size_max: 4.2,
    vx_min: -7,
    vx_max: 7,
    vy_min: -6,
    vy_max: 8,
    opacity: 0.78,
    blur: 0.3,
    color_inner: 'rgba(255, 240, 195, 0.95)',
    color_outer: 'rgba(235, 205, 130, 0)',
  },
  steam: {
    id: 'steam',
    label: 'Пар',
    count: 65,
    size_min: 28,
    size_max: 65,
    vx_min: -10,
    vx_max: 12,
    vy_min: -20,
    vy_max: -45,
    opacity: 0.35,
    blur: 7,
    color_inner: 'rgba(220, 234, 250, 0.50)',
    color_outer: 'rgba(180, 198, 220, 0)',
  },
  sparks: {
    id: 'sparks',
    label: 'Искры',
    count: 110,
    size_min: 2.0,
    size_max: 4.8,
    vx_min: -18,
    vx_max: 18,
    vy_min: -35,
    vy_max: -75,
    opacity: 0.95,
    blend: 'screen',
    color_inner: 'rgba(255, 218, 85, 1)',
    color_outer: 'rgba(255, 85, 0, 0)',
  },
  embers: {
    id: 'embers',
    label: 'Угли',
    count: 85,
    size_min: 3.0,
    size_max: 6.8,
    vx_min: -12,
    vx_max: 12,
    vy_min: -18,
    vy_max: -42,
    opacity: 0.90,
    blend: 'screen',
    color_inner: 'rgba(255, 125, 30, 0.95)',
    color_outer: 'rgba(220, 50, 0, 0.2)',
  },
}

/**
 * Кинематографический Canvas-ливень: падающие капли-струи с глубиной резкости,
 * наклоном по направлению ветра и брызгами при касании земли/поверхностей.
 */
interface RainDrop {
  x: number
  y: number
  speed: number
  length: number
  thickness: number
  alpha: number
  groundY: number
}

interface RainSplash {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

interface ScreenDrop {
  x: number
  y: number
  radius: number
  speed: number
  life: number
}

export function RainCanvasLayer({ config }: { config: SceneParticlesConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()

    const density = config.density || 'normal'
    const speedMod = config.speed === 'fast' ? 1.45 : config.speed === 'slow' ? 0.65 : 1.0
    const count = density === 'high' ? 320 : density === 'low' ? 90 : 180

    // Ветер: тангенс угла наклона
    const windAngle = config.wind === 'left' ? -0.32 : config.wind === 'right' ? 0.32 : 0.05
    const windVx = windAngle * 700 * speedMod

    const w = () => canvas.clientWidth
    const h = () => canvas.clientHeight

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const drops: RainDrop[] = []
    const splashes: RainSplash[] = []
    const screenDrops: ScreenDrop[] = []

    const spawnDrop = (d: RainDrop, anywhere = false) => {
      const width = w()
      const height = h()
      // Запас по краям для косого дождя
      const extraMargin = 160
      d.x = -extraMargin + Math.random() * (width + extraMargin * 2)
      d.groundY = height - Math.random() * (height * 0.14)
      d.y = anywhere ? Math.random() * d.groundY : -40 - Math.random() * 80
      // Слои глубины: передний план длиннее и быстрее, дальний — тоньше
      const layer = Math.random()
      if (layer > 0.8) {
        // Близкие крупные капли
        d.speed = (950 + Math.random() * 350) * speedMod
        d.length = 26 + Math.random() * 22
        d.thickness = 1.6
        d.alpha = 0.55 + Math.random() * 0.3
      } else if (layer > 0.35) {
        // Средний план
        d.speed = (750 + Math.random() * 250) * speedMod
        d.length = 16 + Math.random() * 16
        d.thickness = 1.1
        d.alpha = 0.35 + Math.random() * 0.25
      } else {
        // Дальний план
        d.speed = (550 + Math.random() * 200) * speedMod
        d.length = 10 + Math.random() * 12
        d.thickness = 0.75
        d.alpha = 0.2 + Math.random() * 0.18
      }
    }

    for (let i = 0; i < count; i++) {
      const d: RainDrop = { x: 0, y: 0, speed: 0, length: 0, thickness: 1, alpha: 0.5, groundY: 0 }
      spawnDrop(d, true)
      drops.push(d)
    }

    // Инициализация редких капель на экране («стекло / объектив»)
    const maxScreenDrops = density === 'high' ? 8 : density === 'low' ? 3 : 5
    for (let i = 0; i < maxScreenDrops; i++) {
      screenDrops.push({
        x: Math.random() * (w() || 800),
        y: Math.random() * (h() || 600),
        radius: 1.5 + Math.random() * 2.5,
        speed: 12 + Math.random() * 25,
        life: 0.4 + Math.random() * 0.6,
      })
    }

    const rainColor = config.color || 'rgba(195, 220, 255,'

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const width = w()
      const height = h()

      ctx.clearRect(0, 0, width, height)

      // 1. Отрисовка струй дождя
      for (const d of drops) {
        d.y += d.speed * dt
        d.x += windVx * dt

        if (d.y >= d.groundY) {
          // Рождение брызг
          const splashCount = Math.floor(2 + Math.random() * 3)
          for (let s = 0; s < splashCount; s++) {
            splashes.push({
              x: d.x,
              y: d.groundY,
              vx: (Math.random() - 0.5) * 85 + (windAngle * 90),
              vy: -(30 + Math.random() * 65),
              life: 0,
              maxLife: 0.14 + Math.random() * 0.12,
              size: 0.8 + Math.random() * 1.2,
            })
          }
          spawnDrop(d, false)
        }

        // Рисуем наклонный штрих
        const endX = d.x + windAngle * d.length
        const endY = d.y + d.length

        ctx.strokeStyle = rainColor.endsWith(',') ? `${rainColor} ${d.alpha})` : rainColor
        ctx.lineWidth = d.thickness
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }

      // 2. Отрисовка брызг у земли
      for (let i = splashes.length - 1; i >= 0; i--) {
        const sp = splashes[i]
        sp.life += dt
        if (sp.life >= sp.maxLife) {
          splashes.splice(i, 1)
          continue
        }
        sp.x += sp.vx * dt
        sp.y += sp.vy * dt
        sp.vy += 320 * dt // гравитация

        const spAlpha = Math.max(0, (1 - sp.life / sp.maxLife) * 0.7)
        ctx.fillStyle = rainColor.endsWith(',') ? `${rainColor} ${spAlpha})` : rainColor
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // 3. Медленно стекающие капли на стекле
      for (const sd of screenDrops) {
        sd.y += sd.speed * dt
        if (sd.y > height + 20) {
          sd.y = -10
          sd.x = Math.random() * width
          sd.radius = 1.5 + Math.random() * 2.5
        }
        ctx.fillStyle = `rgba(215, 235, 255, ${sd.life * 0.35})`
        ctx.beginPath()
        ctx.arc(sd.x, sd.y, sd.radius, 0, Math.PI * 2)
        ctx.fill()
        // Световой блик
        ctx.fillStyle = `rgba(255, 255, 255, ${sd.life * 0.6})`
        ctx.beginPath()
        ctx.arc(sd.x - sd.radius * 0.3, sd.y - sd.radius * 0.3, sd.radius * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [config])

  return <canvas ref={canvasRef} className="atmosphere-particles atmosphere-rain-canvas" aria-hidden />
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

  // Кинематографичный дождь рендерится через живой Canvas-ливень
  if (type === 'rain') {
    return <RainCanvasLayer config={config} />
  }

  const builtinCss = ['snow', 'fog', 'ash'].includes(type)
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
