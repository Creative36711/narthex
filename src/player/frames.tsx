import { useEffect, useState } from 'react'
import type { ImageValue } from '../shared/types'

/**
 * «Живые» изображения (frame-swap): значение-строка — одна картинка,
 * массив строк — кадры без настроек, объект {frames, fps, loop} — полноценный
 * проигрыватель. Кадры меняются по таймеру прямо на месте отображения.
 * Статичное одиночное значение вообще не создаёт таймера (ноль накладных).
 */

export type FramesInfo = { frames: string[]; fps: number; loop: boolean }

/** нормализация ImageValue в список кадров и настройки; пусто → null.
 *  Пустые кадры СОХРАНЯЮТСЯ (редактор показывает их как «пустой слот») */
export function framesOf(v: ImageValue | null | undefined): FramesInfo | null {
  if (!v) return null
  if (typeof v === 'string') return v ? { frames: [v], fps: 1, loop: true } : null
  if (Array.isArray(v)) {
    return v.length ? { frames: v.slice(), fps: 2, loop: true } : null
  }
  const frames = (v.frames ?? []).slice()
  return frames.length ? { frames, fps: Math.min(30, Math.max(0.25, v.fps ?? 2)), loop: v.loop !== false } : null
}

/** первая ЗАПОЛНЕННАЯ картинка значения (статичные места: превью редактора, откаты) */
export function firstFrame(v: ImageValue | null | undefined): string {
  return framesOf(v)?.frames.find(Boolean) ?? ''
}

/** текущий кадр значения: для статики — просто сама строка, таймер не поднимается;
 *  пустые кадры в проигрывании пропускаются */
export function useCurrentFrame(v: ImageValue | null | undefined, tickKey?: unknown): string {
  const info = framesOf(v)
  const [idx, setIdx] = useState(0)
  const key = info ? info.frames.join('\n') + '|' + info.fps + '|' + info.loop + '|' + String(tickKey ?? '') : ''
  useEffect(() => {
    setIdx(0)
    if (!info) return
    const playableNow = info.frames.filter(Boolean)
    if (playableNow.length < 2) return
    const ms = Math.max(40, Math.round(1000 / info.fps))
    let i = 0
    const t = window.setInterval(() => {
      i += 1
      if (i >= playableNow.length) {
        if (info.loop) i = 0
        else {
          i = playableNow.length - 1
          window.clearInterval(t)
        }
      }
      setIdx(i)
    }, ms)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const playable = info ? info.frames.filter(Boolean) : []
  if (!playable.length) return ''
  return playable[Math.min(idx, playable.length - 1)] ?? ''
}

/** <img>, которое крутит кадры ImageValue; для статики — обычный <img> без таймера */
export function LiveImg({
  value,
  urlOf,
  alt,
  className,
  style,
  draggable = false,
  tickKey,
  onError,
}: {
  value: ImageValue | null | undefined
  urlOf: (frame: string) => string
  alt: string
  className?: string
  style?: React.CSSProperties
  draggable?: boolean
  tickKey?: unknown
  onError?: (frame: string) => void
}) {
  const frame = useCurrentFrame(value, tickKey)
  if (!frame) return null
  return (
    <img
      className={className}
      style={style}
      alt={alt}
      draggable={draggable}
      src={urlOf(frame)}
      onError={onError ? (e) => onError((e.target as HTMLImageElement).currentSrc || frame) : undefined}
    />
  )
}
