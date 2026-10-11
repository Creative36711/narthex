/**
 * Кинематографический слой воздуха, погоды и движения камеры:
 *
 * 1. useCameraStyle — мягкий пан-зум фона сцены/слайда (`CameraDoc`);
 * 2. CinematicAtmosphereCanvas — независимый от UI высокодетализированный Canvas-рендер
 *    атмосферных эффектов (дождь, снег, туман/шторм, пылинки, пар, искры, угли, пепел);
 * 3. ParticleLayer — декларативные частицы из спрайта мастера (`ParticleEffectDef`);
 * 4. BannerLayer / PostcardLayer — большие надписи и «открытки» (эффекты правил).
 */

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
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
    const target: CSSProperties = {
      transform: `scale(${z * 1.06}) translate(${-x}%, ${-y}%)`,
      transformOrigin: '50% 50%',
      transition: dur > 0 ? `transform ${dur}s linear` : undefined,
    }
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setStyle(target))
    })
    return () => {
      cancelAnimationFrame(first)
      if (second) cancelAnimationFrame(second)
    }
  }, [key])
  return cam ? style : {}
}

// ────────────────────────── 2. частицы мастера из спрайтов ──────────────────────────

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number
  angle: number; spin: number
}

/** рендер одного эффекта из реестра `meta.atmospherics` (canvas-оверлей со спрайтом) */
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
        p.y = h + 16 + Math.random() * 40
      } else {
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
  }, [doc, count])

  const style: CSSProperties = { filter: doc.blur ? `blur(${doc.blur}px)` : undefined, mixBlendMode: doc.blend === 'screen' ? 'screen' : undefined }
  return <canvas ref={canvasRef} className="atmosphere-particles" aria-hidden style={style} />
}

export const BUILTIN_PARTICLE_DOCS: Record<string, ParticleEffectDef> = {
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

// ────────────────────────── 3. кинематографичный Canvas всех типов частиц ──────────────────────────

/**
 * Единый высокопроизводительный холст частиц, работающий независимо от ререндеров интерфейса.
 * Поддерживает 8 визуально уникальных эффектов:
 * - rain: многослойный ливень со струями, наклоном по ветру, каплями на стекле и физикой брызг;
 * - snow: 3-слойный снегопад с покачиванием хлопьев и ураганной метелью при шторме;
 * - fog: объемные клубящиеся слои тумана, при шторме — стремительная шквальная мгла без стробоскопа;
 * - dust: мерцающая в лучах света золотистая взвесь с броуновским движением;
 * - steam: поднимающиеся и расширяющиеся клубы пара, рассеивающиеся в воздухе;
 * - sparks: раскаленные искры со световым шлейфом (motion streak) и остыванием цвета в screen;
 * - embers: тлеющие угли с пульсацией жара (breathing glow) на восходящих потоках;
 * - ash: парящие чешуйки пепла с 3D-кувырканием (tumble/flutter).
 */
export function CinematicAtmosphereCanvas({ config }: { config: SceneParticlesConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const effectType = config.type || 'none'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()

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

    // Структуры данных для каждого типа частиц
    const rainDrops: any[] = []
    const rainSplashes: any[] = []
    const screenDrops: any[] = []
    const snowFlakes: any[] = []
    const fogPuffs: any[] = []
    const stormStreaks: any[] = []
    const dustParticles: any[] = []
    const steamPuffs: any[] = []
    const sparkParticles: any[] = []
    const emberParticles: any[] = []
    const ashFlakes: any[] = []

    const cur = () => configRef.current
    const densityMul = () => cur().density === 'high' ? 1.75 : cur().density === 'low' ? 0.5 : 1.0
    const speedMul = () => cur().speed === 'fast' ? 1.6 : cur().speed === 'slow' ? 0.55 : 1.0
    const windDirection = () => cur().wind === 'left' ? -1 : cur().wind === 'right' ? 1 : 0

    // Инициализация частиц в зависимости от выбранного типа
    const width = w() || 1000
    const height = h() || 700

    if (effectType === 'rain') {
      const count = Math.round(180 * densityMul())
      for (let i = 0; i < count; i++) {
        const layer = Math.random()
        const speedBase = (layer > 0.8 ? 980 : layer > 0.35 ? 760 : 540) + Math.random() * 200
        rainDrops.push({
          x: -160 + Math.random() * (width + 320),
          y: Math.random() * height,
          speed: speedBase,
          length: (layer > 0.8 ? 28 : layer > 0.35 ? 17 : 11) + Math.random() * 14,
          thickness: layer > 0.8 ? 1.6 : layer > 0.35 ? 1.1 : 0.75,
          alpha: layer > 0.8 ? 0.6 : layer > 0.35 ? 0.35 : 0.2,
          groundY: height - Math.random() * (height * 0.12),
        })
      }
      for (let i = 0; i < 6; i++) {
        screenDrops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1.5 + Math.random() * 2.5,
          speed: 14 + Math.random() * 22,
          life: 0.5 + Math.random() * 0.5,
        })
      }
    } else if (effectType === 'snow') {
      const count = Math.round(140 * densityMul())
      for (let i = 0; i < count; i++) {
        const layer = Math.random()
        snowFlakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: layer > 0.75 ? 3.5 + Math.random() * 2.5 : layer > 0.3 ? 2.0 + Math.random() * 1.5 : 1.0 + Math.random() * 0.8,
          speed: (layer > 0.75 ? 90 : layer > 0.3 ? 60 : 35) + Math.random() * 25,
          alpha: layer > 0.75 ? 0.85 : layer > 0.3 ? 0.65 : 0.4,
          phase: Math.random() * Math.PI * 2,
          wobbleSpeed: 1.5 + Math.random() * 2.5,
          wobbleAmp: 18 + Math.random() * 26,
        })
      }
    } else if (effectType === 'fog') {
      const count = Math.round(14 * densityMul())
      for (let i = 0; i < count; i++) {
        fogPuffs.push({
          x: Math.random() * (width + 400) - 200,
          y: height * 0.15 + Math.random() * (height * 0.85),
          radius: 180 + Math.random() * 220,
          vx: (12 + Math.random() * 18),
          alpha: 0.08 + Math.random() * 0.10,
          phase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.4 + Math.random() * 0.6,
        })
      }
      // Шквальные полосы штормовой мглы (при fast-скорости)
      for (let i = 0; i < 7; i++) {
        stormStreaks.push({
          x: Math.random() * (width + 600) - 300,
          y: Math.random() * height,
          length: 220 + Math.random() * 380,
          height: 35 + Math.random() * 65,
          speed: 480 + Math.random() * 450,
          alpha: 0.06 + Math.random() * 0.09,
        })
      }
    } else if (effectType === 'dust') {
      const count = Math.round(150 * densityMul())
      for (let i = 0; i < count; i++) {
        dustParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 1.4 + Math.random() * 2.8,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 12,
          baseAlpha: 0.4 + Math.random() * 0.5,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 1.8 + Math.random() * 3.2,
        })
      }
    } else if (effectType === 'steam') {
      const count = Math.round(65 * densityMul())
      for (let i = 0; i < count; i++) {
        steamPuffs.push({
          x: Math.random() * width,
          y: Math.random() * height,
          baseRadius: 20 + Math.random() * 18,
          vy: -22 - Math.random() * 35,
          vx: (Math.random() - 0.5) * 16,
          spin: (Math.random() - 0.5) * 0.6,
          angle: Math.random() * Math.PI * 2,
          alpha: 0.28 + Math.random() * 0.22,
        })
      }
    } else if (effectType === 'sparks') {
      const count = Math.round(110 * densityMul())
      for (let i = 0; i < count; i++) {
        sparkParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          prevX: 0,
          prevY: 0,
          vx: (Math.random() - 0.5) * 90,
          vy: -80 - Math.random() * 140,
          life: Math.random(),
          maxLife: 0.8 + Math.random() * 0.9,
          size: 1.5 + Math.random() * 2.5,
        })
      }
    } else if (effectType === 'embers') {
      const count = Math.round(85 * densityMul())
      for (let i = 0; i < count; i++) {
        emberParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 2.8 + Math.random() * 4.2,
          vy: -24 - Math.random() * 38,
          vx: (Math.random() - 0.5) * 20,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseFreq: 2.2 + Math.random() * 3.0,
          alpha: 0.75 + Math.random() * 0.25,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 1.2,
        })
      }
    } else if (effectType === 'ash') {
      const count = Math.round(80 * densityMul())
      for (let i = 0; i < count; i++) {
        ashFlakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          w: 4.0 + Math.random() * 6.0,
          h: 2.5 + Math.random() * 4.0,
          vy: 28 + Math.random() * 42,
          vx: (Math.random() - 0.5) * 24,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 1.8,
          tumblePhase: Math.random() * Math.PI * 2,
          tumbleSpeed: 2.0 + Math.random() * 3.5,
          darkness: 0.35 + Math.random() * 0.45,
          alpha: 0.55 + Math.random() * 0.35,
        })
      }
    }

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const currentWidth = w()
      const currentHeight = h()

      ctx.clearRect(0, 0, currentWidth, currentHeight)

      const sMod = speedMul()
      const wDir = windDirection()
      const cfg = cur()

      // ────────────────── 1. РЕНДЕР: ДОЖДЬ ──────────────────
      if (effectType === 'rain') {
        const windAngle = wDir * 0.32 || 0.05
        const windVx = windAngle * 700 * sMod
        const rainColor = cfg.color || 'rgba(195, 220, 255,'

        for (const d of rainDrops) {
          d.y += d.speed * sMod * dt
          d.x += windVx * dt

          if (d.y >= d.groundY) {
            const splashCount = Math.floor(2 + Math.random() * 3)
            for (let s = 0; s < splashCount; s++) {
              rainSplashes.push({
                x: d.x,
                y: d.groundY,
                vx: (Math.random() - 0.5) * 85 + (windAngle * 90),
                vy: -(30 + Math.random() * 65),
                life: 0,
                maxLife: 0.14 + Math.random() * 0.12,
                size: 0.8 + Math.random() * 1.2,
              })
            }
            d.y = -30 - Math.random() * 60
            d.x = -160 + Math.random() * (currentWidth + 320)
          }

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

        // Брызги
        for (let i = rainSplashes.length - 1; i >= 0; i--) {
          const sp = rainSplashes[i]
          sp.life += dt
          if (sp.life >= sp.maxLife) {
            rainSplashes.splice(i, 1)
            continue
          }
          sp.x += sp.vx * dt
          sp.y += sp.vy * dt
          sp.vy += 320 * dt
          const spAlpha = Math.max(0, (1 - sp.life / sp.maxLife) * 0.7)
          ctx.fillStyle = rainColor.endsWith(',') ? `${rainColor} ${spAlpha})` : rainColor
          ctx.beginPath()
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
          ctx.fill()
        }

        // Капли на стекле
        for (const sd of screenDrops) {
          sd.y += sd.speed * sMod * dt
          if (sd.y > currentHeight + 20) {
            sd.y = -10
            sd.x = Math.random() * currentWidth
          }
          ctx.fillStyle = `rgba(215, 235, 255, ${sd.life * 0.35})`
          ctx.beginPath()
          ctx.arc(sd.x, sd.y, sd.radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgba(255, 255, 255, ${sd.life * 0.6})`
          ctx.beginPath()
          ctx.arc(sd.x - sd.radius * 0.3, sd.y - sd.radius * 0.3, sd.radius * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ────────────────── 2. РЕНДЕР: СНЕГ ──────────────────
      else if (effectType === 'snow') {
        const isBlizzard = cfg.speed === 'fast'
        const windSnowVx = (wDir !== 0 ? wDir * (isBlizzard ? 550 : 160) : (isBlizzard ? 380 : 20)) * sMod

        for (const f of snowFlakes) {
          f.phase += f.wobbleSpeed * dt
          const wobble = Math.sin(f.phase) * f.wobbleAmp
          f.y += f.speed * sMod * dt
          f.x += (windSnowVx + wobble) * dt

          if (f.y > currentHeight + 20) {
            f.y = -15
            f.x = Math.random() * (currentWidth + 200) - 100
          }
          if (f.x > currentWidth + 120) f.x = -80
          if (f.x < -120) f.x = currentWidth + 80

          ctx.save()
          ctx.beginPath()
          ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius)
          grad.addColorStop(0, `rgba(255, 255, 255, ${f.alpha})`)
          grad.addColorStop(0.7, `rgba(240, 246, 255, ${f.alpha * 0.7})`)
          grad.addColorStop(1, 'rgba(230, 240, 255, 0)')
          ctx.fillStyle = grad
          ctx.fill()
          ctx.restore()
        }
      }

      // ────────────────── 3. РЕНДЕР: ТУМАН И ШТОРМОВАЯ МГЛА ──────────────────
      else if (effectType === 'fog') {
        const isStorm = cfg.speed === 'fast'
        const fogBaseSpeed = (isStorm ? 280 : 24) * (wDir !== 0 ? wDir : 1) * sMod
        const fogColor = cfg.color || 'rgba(205, 218, 236,'

        // Объемные мягкие клубы тумана
        for (const p of fogPuffs) {
          p.phase += p.wobbleSpeed * dt
          p.x += (fogBaseSpeed + (isStorm ? 120 : 0)) * dt
          p.y += Math.sin(p.phase) * (isStorm ? 28 : 12) * dt

          const margin = p.radius + 150
          if (p.x > currentWidth + margin) p.x = -margin
          if (p.x < -margin) p.x = currentWidth + margin

          ctx.save()
          const puffGrad = ctx.createRadialGradient(p.x, p.y, p.radius * 0.15, p.x, p.y, p.radius)
          const centerAlpha = isStorm ? p.alpha * 1.35 : p.alpha
          puffGrad.addColorStop(0, fogColor.endsWith(',') ? `${fogColor} ${centerAlpha})` : fogColor)
          puffGrad.addColorStop(0.65, fogColor.endsWith(',') ? `${fogColor} ${centerAlpha * 0.5})` : fogColor)
          puffGrad.addColorStop(1, fogColor.endsWith(',') ? `${fogColor} 0)` : 'rgba(205,218,236,0)')

          ctx.fillStyle = puffGrad
          ctx.beginPath()
          // При шторме эллипсы вытягиваются ветром
          if (isStorm) {
            ctx.ellipse(p.x, p.y, p.radius * 1.5, p.radius * 0.75, 0, 0, Math.PI * 2)
          } else {
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          }
          ctx.fill()
          ctx.restore()
        }

        // При режиме шторма: стремительные шквальные полосы мглы
        if (isStorm) {
          for (const st of stormStreaks) {
            st.x += st.speed * sMod * (wDir !== 0 ? wDir : 1) * dt
            if (st.x > currentWidth + st.length + 50) st.x = -st.length - 100
            if (st.x < -st.length - 100) st.x = currentWidth + 50

            ctx.save()
            const streakGrad = ctx.createLinearGradient(st.x, st.y, st.x + st.length, st.y)
            streakGrad.addColorStop(0, 'rgba(215, 228, 245, 0)')
            streakGrad.addColorStop(0.5, `rgba(220, 232, 248, ${st.alpha * 1.4})`)
            streakGrad.addColorStop(1, 'rgba(215, 228, 245, 0)')
            ctx.fillStyle = streakGrad
            ctx.beginPath()
            ctx.roundRect ? ctx.roundRect(st.x, st.y, st.length, st.height, 20) : ctx.rect(st.x, st.y, st.length, st.height)
            ctx.fill()
            ctx.restore()
          }
        }
      }

      // ────────────────── 4. РЕНДЕР: ПЫЛИНКИ В ВОЗДУХЕ ──────────────────
      else if (effectType === 'dust') {
        const dustColor = cfg.color || 'rgba(255, 238, 185,'
        const windDust = wDir * 20 * sMod

        for (const p of dustParticles) {
          p.twinklePhase += p.twinkleSpeed * dt
          p.x += (p.vx + windDust) * sMod * dt
          p.y += p.vy * sMod * dt

          if (p.x > currentWidth + 20) p.x = -15
          if (p.x < -20) p.x = currentWidth + 15
          if (p.y > currentHeight + 20) p.y = -15
          if (p.y < -20) p.y = currentHeight + 15

          // Мерцание
          const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.twinklePhase))
          const alpha = p.baseAlpha * twinkle

          ctx.save()
          // Ореол
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2)
          g.addColorStop(0, dustColor.endsWith(',') ? `${dustColor} ${alpha})` : dustColor)
          g.addColorStop(0.4, dustColor.endsWith(',') ? `${dustColor} ${alpha * 0.6})` : dustColor)
          g.addColorStop(1, 'rgba(235, 205, 130, 0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2)
          ctx.fill()

          // Яркое ядро
          ctx.fillStyle = `rgba(255, 255, 240, ${alpha * 0.9})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // ────────────────── 5. РЕНДЕР: ПАР И ДЫМ ──────────────────
      else if (effectType === 'steam') {
        const windSteam = wDir * 32 * sMod

        for (const s of steamPuffs) {
          s.y += s.vy * sMod * dt
          s.x += (s.vx + windSteam) * sMod * dt
          s.angle += s.spin * dt

          if (s.y < -90) {
            s.y = currentHeight + 30 + Math.random() * 50
            s.x = Math.random() * currentWidth
          }

          // По мере подъема пар расширяется и растворяется
          const progress = Math.max(0, Math.min(1, 1 - (s.y / currentHeight)))
          const curRadius = s.baseRadius + progress * 55
          const curAlpha = s.alpha * Math.max(0, 1 - progress * 0.85)

          ctx.save()
          ctx.translate(s.x, s.y)
          ctx.rotate(s.angle)
          const grad = ctx.createRadialGradient(0, 0, curRadius * 0.1, 0, 0, curRadius)
          grad.addColorStop(0, `rgba(225, 238, 252, ${curAlpha})`)
          grad.addColorStop(0.55, `rgba(195, 215, 238, ${curAlpha * 0.45})`)
          grad.addColorStop(1, 'rgba(180, 200, 225, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(0, 0, curRadius, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // ────────────────── 6. РЕНДЕР: РАСКАЛЕННЫЕ ИСКРЫ ──────────────────
      else if (effectType === 'sparks') {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        const windSpark = wDir * 40 * sMod

        for (const sp of sparkParticles) {
          sp.life += dt
          if (sp.life >= sp.maxLife || sp.y < -30) {
            sp.life = 0
            sp.x = Math.random() * currentWidth
            sp.y = currentHeight + 10 + Math.random() * 30
            sp.prevX = sp.x
            sp.prevY = sp.y
            sp.vx = (Math.random() - 0.5) * 110
            sp.vy = -90 - Math.random() * 160
          }

          sp.prevX = sp.x
          sp.prevY = sp.y
          sp.vy += 65 * dt // гравитация
          sp.x += (sp.vx + windSpark) * sMod * dt
          sp.y += sp.vy * sMod * dt

          const t = sp.life / sp.maxLife
          const alpha = Math.max(0, 1 - t)

          // Остывание цвета: белый -> золото -> оранжевый -> темно-красный
          let strokeColor = `rgba(255, 245, 180, ${alpha})`
          if (t > 0.65) strokeColor = `rgba(220, 45, 0, ${alpha * 0.8})`
          else if (t > 0.3) strokeColor = `rgba(255, 140, 20, ${alpha})`

          ctx.strokeStyle = strokeColor
          ctx.lineWidth = sp.size
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(sp.prevX, sp.prevY)
          ctx.lineTo(sp.x, sp.y)
          ctx.stroke()
        }
        ctx.restore()
      }

      // ────────────────── 7. РЕНДЕР: ТЛЕЮЩИЕ УГЛИ ──────────────────
      else if (effectType === 'embers') {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        const windEmber = wDir * 28 * sMod

        for (const e of emberParticles) {
          e.pulsePhase += e.pulseFreq * dt
          e.angle += e.spin * dt
          e.y += e.vy * sMod * dt
          e.x += (e.vx + windEmber + Math.sin(e.pulsePhase) * 10) * sMod * dt

          if (e.y < -30) {
            e.y = currentHeight + 20 + Math.random() * 40
            e.x = Math.random() * currentWidth
          }

          const pulse = 0.55 + 0.45 * Math.sin(e.pulsePhase)
          const alpha = e.alpha * pulse

          ctx.save()
          ctx.translate(e.x, e.y)
          ctx.rotate(e.angle)

          // Внешний огненный ореол
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.size * 2.4)
          g.addColorStop(0, `rgba(255, 145, 30, ${alpha})`)
          g.addColorStop(0.5, `rgba(235, 60, 0, ${alpha * 0.55})`)
          g.addColorStop(1, 'rgba(180, 20, 0, 0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(0, 0, e.size * 2.4, 0, Math.PI * 2)
          ctx.fill()

          // Раскаленное ядро
          ctx.fillStyle = `rgba(255, 235, 160, ${alpha * 0.95})`
          ctx.beginPath()
          ctx.ellipse(0, 0, e.size * 0.65, e.size * 0.45, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        ctx.restore()
      }

      // ────────────────── 8. РЕНДЕР: ПАРЯЩИЙ ПЕПЕЛ ──────────────────
      else if (effectType === 'ash') {
        const windAsh = wDir * 35 * sMod

        for (const a of ashFlakes) {
          a.tumblePhase += a.tumbleSpeed * dt
          a.angle += a.spin * dt
          a.y += a.vy * sMod * dt
          a.x += (a.vx + windAsh + Math.sin(a.tumblePhase) * 14) * sMod * dt

          if (a.y > currentHeight + 30) {
            a.y = -20
            a.x = Math.random() * currentWidth
          }
          if (a.x > currentWidth + 50) a.x = -40
          if (a.x < -50) a.x = currentWidth + 40

          const flip = Math.cos(a.tumblePhase)

          ctx.save()
          ctx.translate(a.x, a.y)
          ctx.rotate(a.angle)
          ctx.scale(1, Math.max(0.15, Math.abs(flip)))

          const grayVal = Math.round(90 + a.darkness * 60)
          ctx.fillStyle = `rgba(${grayVal}, ${grayVal - 5}, ${grayVal - 10}, ${a.alpha})`
          ctx.beginPath()
          ctx.ellipse(0, 0, a.w / 2, a.h / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [effectType])

  return <canvas ref={canvasRef} className="atmosphere-particles atmosphere-cinematic-canvas" aria-hidden />
}

/** Совместимость с предыдущим именем для дождя */
export function RainCanvasLayer({ config }: { config: SceneParticlesConfig }) {
  return <CinematicAtmosphereCanvas config={{ ...config, type: 'rain' }} />
}

// ────────────────────────── 4. Слой атмосферы сцены ──────────────────────────

const BUILTIN_CANVAS_TYPES = ['rain', 'snow', 'fog', 'dust', 'steam', 'sparks', 'embers', 'ash']

function AtmosphereLayerComponent({
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

  // Все 8 типов частиц рендерятся через кинематографичный холст
  if (BUILTIN_CANVAS_TYPES.includes(type)) {
    return <CinematicAtmosphereCanvas config={config} />
  }

  // Кастомные частицы мастера со спрайтом из meta.atmospherics
  const baseDoc = BUILTIN_PARTICLE_DOCS[type] ?? (atmospherics ?? []).find((a) => a.id === type)
  if (!baseDoc) {
    return null
  }

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

/**
 * Мемоизированный слой атмосферы: защищён от сброса анимации при кликах,
 * нажатии Tab, покупках у торговца и любых обновлениях интерфейса.
 */
export const AtmosphereLayer = memo(AtmosphereLayerComponent, (prev, next) => {
  const pOver: SceneParticlesConfig = typeof prev.overlay === 'string' ? { type: prev.overlay as any } : (prev.overlay ?? { type: 'none' })
  const nOver: SceneParticlesConfig = typeof next.overlay === 'string' ? { type: next.overlay as any } : (next.overlay ?? { type: 'none' })
  return (
    pOver.type === nOver.type &&
    pOver.density === nOver.density &&
    pOver.speed === nOver.speed &&
    pOver.wind === nOver.wind &&
    pOver.color === nOver.color
  )
})

// ────────────────────────── 5. баннеры ──────────────────────────

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

// ────────────────────────── 6. «открытка» ──────────────────────────

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
