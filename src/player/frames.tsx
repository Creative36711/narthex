import { useEffect, useState } from 'react'
import type { ImageValue } from '../shared/types'

/**
 * «Живые» изображения (frame-swap): значение-строка — одна картинка,
 * массив строк — кадры без настроек, объект {frames, fps, loop} — полноценный
 * проигрыватель. Кадры меняются по таймеру прямо на месте отображения.
 * Статичное одиночное значение вообще не создаёт таймера (ноль накладных).
 */

export type FramesInfo = { frames: string[]; fps: number; loop: boolean; sheet?: { cols: number; rows: number } }

/** нормализация ImageValue в список кадров и настройки; пусто → null.
 *  Для спрайт-листа (SheetDoc) один «кадр» — файл листа + сетка: рендер далее
 *  берёт background-position текущего кадра. Пустые кадры СОХРАНЯЮТСЯ
 *  (редактор показывает их как «пустой слот») */
export function framesOf(v: ImageValue | null | undefined): FramesInfo | null {
  if (!v) return null
  if (typeof v === 'string') return v ? { frames: [v], fps: 1, loop: true } : null
  if (Array.isArray(v)) {
    return v.length ? { frames: v.slice(), fps: 2, loop: true } : null
  }
  if ('sheet' in v && typeof (v as { sheet?: unknown }).sheet === 'string' && (v as { sheet: string }).sheet) {
    const sheet = v as { sheet: string; cols: number; rows: number; fps?: number; loop?: boolean }
      return {
      frames: [sheet.sheet],
      fps: Math.min(30, Math.max(0.25, sheet.fps ?? 8)),
      loop: sheet.loop !== false,
      sheet: { cols: Math.max(1, sheet.cols || 1), rows: Math.max(1, sheet.rows || 1) },
    }
  }
  const frames = ('frames' in v ? (v.frames ?? []) : []).slice()
  return frames.length ? { frames, fps: Math.min(30, Math.max(0.25, v.fps ?? 2)), loop: v.loop !== false } : null
}

/** значение — спрайт-лист? (выбор рендера и фоновой раскладки) */
export function sheetOf(v: ImageValue | null | undefined): { image: string; cols: number; rows: number; total: number } | null {
  const info = framesOf(v)
  if (!info?.sheet || !info.frames[0]) return null
  const { cols, rows } = info.sheet
  return { image: info.frames[0], cols, rows, total: cols * rows }
}

/** первая ЗАПОЛНЕННАЯ картинка значения (статичные места: превью редактора, откаты) */
export function firstFrame(v: ImageValue | null | undefined): string {
  return framesOf(v)?.frames.find(Boolean) ?? ''
}

/** текущий индекс кадра ImageValue (для листа — от нуля до cols*rows-1) */
export function useFrameIndex(v: ImageValue | null | undefined, tickKey?: unknown): number {
  const info = framesOf(v)
  const total = info?.sheet ? info.sheet.cols * info.sheet.rows : info ? info.frames.filter(Boolean).length : 0
  const [idx, setIdx] = useState(0)
  const key = info
    ? info.frames.join('\n') + '|' + info.fps + '|' + info.loop + '|' + String(total) + '|' + String(tickKey ?? '')
    : ''
  useEffect(() => {
    setIdx(0)
    if (!info || total < 2) return
    const ms = Math.max(40, Math.round(1000 / info.fps))
    let i = 0
    const t = window.setInterval(() => {
      i += 1
      if (i >= total) {
        if (info.loop) i = 0
        else {
          i = total - 1
          window.clearInterval(t)
        }
      }
      setIdx(i)
    }, ms)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return idx
}

/** текущий кадр значения: для статики — просто сама строка, таймер не поднимается;
 *  пустые кадры в проигрывании пропускаются */
export function useCurrentFrame(v: ImageValue | null | undefined, tickKey?: unknown): string {
  const info = framesOf(v)
  const idx = useFrameIndex(v, tickKey)
  const playable = info ? info.frames.filter(Boolean) : []
  if (!playable.length) return ''
  return playable[Math.min(idx, playable.length - 1)] ?? ''
}

/** <img>, которое крутит кадры ImageValue; для статики — обычный <img> без таймера.
 *  Спрайт-лист — div с background-position (мастерская анимация одним файлом). */
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
  const sheet = sheetOf(value)
  const idx = useFrameIndex(value, tickKey)
  const frame = useCurrentFrame(value, tickKey)
  if (!frame) return null
  if (sheet) {
    const i = Math.min(idx, sheet.total - 1)
    return (
      <div
        role="img"
        aria-label={alt}
        className={className}
        style={{
          ...style,
          backgroundImage: `url('${urlOf(sheet.image)}')`,
          backgroundSize: `${sheet.cols * 100}% ${sheet.rows * 100}%`,
          backgroundPosition: `${((i % sheet.cols) / Math.max(1, sheet.cols - 1)) * 100}% ${(Math.floor(i / sheet.cols) / Math.max(1, sheet.rows - 1)) * 100}%`,
        }}
      />
    )
  }
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
