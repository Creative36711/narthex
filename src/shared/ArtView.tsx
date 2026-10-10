/**
 * Рендер декларативной графики (ArtDoc) — итерация 8, блок D.
 *
 * Один компонент на всех: сцены игрока, предпросмотр в редакторе, слайды
 * катсцен. Чистый SVG без дополнительных библиотек: координаты задаются
 * в системе холста (1280×720) и масштабируются через viewBox.
 */
import { useId, useMemo } from 'react'
import type { ArtDoc } from './types'

export interface ArtViewProps {
  art: ArtDoc | null | undefined
  /** ширина/высота элемента; по умолчанию — 100% контейнера */
  width?: number | string
  height?: number | string
  className?: string
  /** сохранять пропорции холста (по умолчанию — да) */
  preserveAspectRatio?: string
  style?: React.CSSProperties
}

const DEFAULT_CANVAS = { w: 1280, h: 720 }

function fillAttrs(fill: unknown, id: string): { fill: string; defs?: string } {
  if (fill == null) return { fill: '#2a2a2a' }
  if (typeof fill === 'string') return { fill }
  const f = fill as { color?: string; gradient?: { from: string; to: string; angle?: number } }
  if (f.gradient) {
    const angle = f.gradient.angle ?? 0
    const rad = (angle * Math.PI) / 180
    // направление по углу (0° — слева направо, 90° — сверху вниз);
    // градиент идёт от края до края рамки фигуры
    const x1 = (50 - Math.cos(rad) * 50).toFixed(2)
    const y1 = (50 - Math.sin(rad) * 50).toFixed(2)
    const x2 = (50 + Math.cos(rad) * 50).toFixed(2)
    const y2 = (50 + Math.sin(rad) * 50).toFixed(2)
    return {
      fill: `url(#${id})`,
      defs: `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0%" stop-color="${f.gradient.from}"/><stop offset="100%" stop-color="${f.gradient.to}"/></linearGradient>`,
    }
  }
  return { fill: f.color ?? '#2a2a2a' }
}

/** один примитив → SVG-разметка */
function shapeMarkup(shape: Record<string, unknown>, uid: string): string {
  const common = `opacity="${shape.opacity ?? 1}"`
  const rotate = typeof shape.rotate === 'number' && shape.rotate !== 0
  let inner = ''
  let transformOrigin = ''
  switch (shape.type) {
    case 'rect': {
      const { fill, defs } = fillAttrs(shape.fill, `${uid}f`)
      if (defs) inner += defs
      inner += `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${fill}"${
        shape.radius ? ` rx="${shape.radius}"` : ''
      }${shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.stroke_width ?? 1}"` : ''} ${common}/>`
      transformOrigin = `${Number(shape.x) + Number(shape.w) / 2} ${Number(shape.y) + Number(shape.h) / 2}`
      break
    }
    case 'ellipse': {
      const { fill, defs } = fillAttrs(shape.fill, `${uid}f`)
      if (defs) inner += defs
      inner += `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" fill="${fill}"${
        shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.stroke_width ?? 1}"` : ''
      } ${common}/>`
      transformOrigin = `${shape.cx} ${shape.cy}`
      break
    }
    case 'polygon': {
      const pts = Array.isArray(shape.points) ? (shape.points as number[]) : []
      const pairs: string[] = []
      for (let i = 0; i + 1 < pts.length; i += 2) pairs.push(`${pts[i]},${pts[i + 1]}`)
      const { fill, defs } = fillAttrs(shape.fill, `${uid}f`)
      if (defs) inner += defs
      inner += `<polygon points="${pairs.join(' ')}" fill="${fill}"${
        shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.stroke_width ?? 1}"` : ''
      } ${common}/>`
      if (pts.length >= 2) transformOrigin = `${pts[0]} ${pts[1]}`
      break
    }
    case 'line':
      inner += `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${
        shape.color ?? '#000'
      }" stroke-width="${shape.width ?? 2}" stroke-linecap="round" ${common}/>`
      transformOrigin = `${(Number(shape.x1) + Number(shape.x2)) / 2} ${(Number(shape.y1) + Number(shape.y2)) / 2}`
      break
    case 'text':
      inner += `<text x="${shape.x}" y="${shape.y}" fill="${shape.color ?? '#fff'}" font-size="${
        shape.size ?? 24
      }" text-anchor="${shape.align ?? 'start'}" font-family="${shape.font ?? 'inherit'}"${
        shape.bold ? ' font-weight="bold"' : ''
      }${shape.italic ? ' font-style="italic"' : ''} ${common}>${escapeXml(String(shape.text ?? ''))}</text>`
      transformOrigin = `${shape.x} ${shape.y}`
      break
    default:
      return ''
  }
  const wrapRotate =
    rotate && shape.type !== 'line'
      ? `<g transform="rotate(${shape.rotate} ${transformOrigin})">${inner}</g>`
      : inner
  return wrapRotate
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  )
}

/** SVG-разметка всего ArtDoc (используется и в React, и в экспорте/превью) */
export function artToSvg(art: ArtDoc | null | undefined, uid = 'art', preserveAspectRatio = 'xMidYMid meet'): string {
  if (!art || !Array.isArray(art.layers)) return ''
  const canvas = art.canvas ?? DEFAULT_CANVAS
  let body = ''
  art.layers.forEach((layer, i) => {
    if (!layer?.shape) return
    const markup = shapeMarkup(layer.shape as unknown as Record<string, unknown>, `${uid}_${i}`)
    const withOpacity =
      layer.opacity != null && layer.opacity !== 1 ? `<g opacity="${layer.opacity}">${markup}</g>` : markup
    body += withOpacity
  })
  // объявления градиентов поднимаем в <defs>
  const gradientDefs = (body.match(/<linearGradient[\s\S]*?<\/linearGradient>/g) ?? []).join('')
  body = body.replace(/<linearGradient[\s\S]*?<\/linearGradient>/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.w} ${canvas.h}" preserveAspectRatio="${preserveAspectRatio}">${
    art.background ? `<rect width="${canvas.w}" height="${canvas.h}" fill="${art.background}"/>` : ''
  }<defs>${gradientDefs}</defs>${body}</svg>`
}

/**
 * Компонент ArtDoc. Разметка собирается строкой и вставляется через
 * dangerouslySetInnerHTML — так один и тот же рендер работает и в игре,
 * и в редакторе, и в превью катсцен.
 */
export function ArtView({ art, width = '100%', height = '100%', className, preserveAspectRatio = 'xMidYMid meet', style }: ArtViewProps) {
  // id градиентов глобальны в документе: у каждого экземпляра — свой префикс,
  // иначе два рисунка на одной странице (переход слайдов, миниатюры в
  // редакторе) «одалживали» бы друг у друга заливки
  const uid = 'art' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const html = useMemo(() => artToSvg(art, uid, preserveAspectRatio), [art, uid, preserveAspectRatio])
  if (!art || !Array.isArray(art.layers) || art.layers.length === 0) {
    return <div className={`art-view art-empty ${className ?? ''}`} style={{ width, height, ...style }} />
  }
  const canvas = art.canvas ?? DEFAULT_CANVAS
  return (
    <div
      className={`art-view ${className ?? ''}`}
      style={{ width, height, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
      data-canvas={`${canvas.w}x${canvas.h}`}
    />
  )
}

/** data-URL для использования ArtDoc как фона (например, в Konva) */
export function artToDataUrl(art: ArtDoc | null | undefined): string {
  const svg = artToSvg(art)
  if (!svg) return ''
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
