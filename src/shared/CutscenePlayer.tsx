/**
 * Проигрыватель слайд-катсцен (итерация 8, блок E) — один компонент для
 * игры и для тест-прогона в редакторе.
 *
 * Слайд: кадр (ArtDoc / изображение / видео) + подпись, которая печатается
 * поверх кадра снизу, + озвучка. Переходы: резкая смена, затемнение, сдвиг,
 * медленный наезд (панзум). Длительность — из слайда, иначе по озвучке
 * или по длине текста. «Пропустить» появляется после первого слайда.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CutsceneDef, CutsceneSlide } from './types'
import { ArtView } from './ArtView'
import { getSettings, musicVolume, useSettings, voiceVolume } from './settings'
import { speak } from './speech'

interface Props {
  cutscene: CutsceneDef
  /** путь ассета → URL (игра: assetUrl, редактор: store.assetSrc) */
  resolve: (path: string) => string
  onEnd: () => void
  /** начать с этого слайда (тест-прогон в редакторе) */
  startAt?: number
  /** режим редактора: «Пропустить» доступно сразу и называется «Закрыть» */
  testMode?: boolean
}

const TYPE_MS = 24 // скорость печати подписи, мс на символ
const TRANSITION_MS = 900

/** YouTube-id из ссылки (watch?v=, youtu.be/, /embed/, /shorts/) */
export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([\w-]{6,})/) ??
    url.match(/[?&]v=([\w-]{6,})/) ??
    url.match(/youtube\.com\/(?:embed|shorts)\/([\w-]{6,})/)
  return m ? m[1] : null
}

/** длительность слайда по умолчанию (мс): время печати + время на чтение */
export function autoDurationMs(slide: CutsceneSlide): number {
  const len = (slide.text ?? '').length
  if (!len) return 4000
  return Math.min(16000, Math.max(3500, len * TYPE_MS + 2600))
}

function SlideMedia({
  slide,
  resolve,
  panzoomMs,
  panzoomOrigin,
  onVideoEnd,
}: {
  slide: CutsceneSlide
  resolve: (p: string) => string
  panzoomMs: number | null
  panzoomOrigin: string
  onVideoEnd: () => void
}) {
  const [videoFailed, setVideoFailed] = useState(false)
  const style: React.CSSProperties = panzoomMs
    ? { animationDuration: `${panzoomMs}ms`, transformOrigin: panzoomOrigin }
    : {}
  const cls = `cs-media ${panzoomMs ? 'cs-panzoom' : ''}`
  if (slide.art) return <ArtView className={cls} art={slide.art} style={style} />
  if (slide.image) return <img className={cls} src={resolve(slide.image)} alt="" draggable={false} style={style} />
  if (slide.video && !videoFailed) {
    const yt = youtubeId(slide.video)
    if (yt) {
      return (
        <iframe
          className="cs-media cs-video"
          src={`https://www.youtube.com/embed/${yt}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media"
          title="видео"
        />
      )
    }
    return (
      <video
        className="cs-media cs-video"
        src={resolve(slide.video)}
        autoPlay
        playsInline
        onEnded={onVideoEnd}
        onError={() => setVideoFailed(true)}
      />
    )
  }
  return <div className="cs-media cs-black" />
}

export function CutscenePlayer({ cutscene, resolve, onEnd, startAt = 0, testMode = false }: Props) {
  const slides = cutscene.slides
  const settings = useSettings()
  const [index, setIndex] = useState(Math.min(Math.max(0, startAt), Math.max(0, slides.length - 1)))
  const [prev, setPrev] = useState<number | null>(null)
  const [typed, setTyped] = useState(0)
  const [waitUser, setWaitUser] = useState(false)
  const endedRef = useRef(false)
  // колбэки родителя держим в ref: иначе новая стрелочная функция на каждом
  // рендере перезапускала бы таймеры слайда и ролик никогда бы не шёл дальше
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const resolveRef = useRef(resolve)
  resolveRef.current = resolve
  const slide = slides[index]
  const text = slide?.text ?? ''

  const finish = useCallback(() => {
    if (endedRef.current) return
    endedRef.current = true
    onEndRef.current()
  }, [])

  const next = useCallback(() => {
    if (endedRef.current) return
    if (index >= slides.length - 1) {
      finish()
      return
    }
    setPrev(index)
    setIndex(index + 1)
  }, [finish, index, slides.length])

  // уборка «уходящего» слайда после перехода
  useEffect(() => {
    if (prev === null) return
    const t = setTimeout(() => setPrev(null), TRANSITION_MS)
    return () => clearTimeout(t)
  }, [prev])

  // печать подписи
  useEffect(() => {
    setTyped(0)
    if (!text) return
    const t = setInterval(() => {
      setTyped((n) => {
        if (n >= text.length) {
          clearInterval(t)
          return n
        }
        return n + 1
      })
    }, TYPE_MS)
    return () => clearInterval(t)
  }, [index, text])

  // музыка на всю катсцену
  const musicRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (!cutscene.music) return
    const a = new Audio(resolveRef.current(cutscene.music))
    a.loop = true
    a.volume = musicVolume(getSettings())
    musicRef.current = a
    void a.play().catch(() => undefined)
    return () => {
      a.pause()
      musicRef.current = null
    }
  }, [cutscene.music])
  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = musicVolume(settings)
  }, [settings])

  // таймер/озвучка слайда: когда переходить к следующему
  const panzoomMs = useMemo(() => {
    if (!slide || slide.transition !== 'panzoom') return null
    return (slide.duration ? slide.duration * 1000 : autoDurationMs(slide)) + TRANSITION_MS
  }, [slide])

  useEffect(() => {
    if (!slide) return
    setWaitUser(false)
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const after = (ms: number) =>
      timers.push(
        setTimeout(() => {
          if (!cancelled) next()
        }, ms),
      )
    let stopVoice: (() => void) | null = null
    const settings = getSettings()
    const resolve = resolveRef.current
    const vol = voiceVolume(settings)
    if (slide.duration && slide.duration > 0) {
      after(slide.duration * 1000)
    } else if (slide.video && !slide.art && !slide.image) {
      // видео: mp4 — по окончании (onVideoEnd), YouTube — ждём игрока
      if (youtubeId(slide.video)) setWaitUser(true)
    } else if (slide.voice && vol > 0) {
      const a = new Audio(resolve(slide.voice))
      a.volume = vol
      a.onended = () => after(700)
      a.onerror = () => after(autoDurationMs(slide))
      void a.play().catch(() => after(autoDurationMs(slide)))
      stopVoice = () => a.pause()
    } else if (settings.tts_enabled && !settings.voice_muted && slide.text) {
      stopVoice = speak(slide.text, {
        voice: settings.tts_voice,
        rate: settings.tts_rate,
        volume: vol,
        onEnd: () => after(600),
      })
      // страховка: синтезатор может молча не заговорить
      after(autoDurationMs(slide) + 8000)
    } else {
      after(autoDurationMs(slide))
    }
    // озвучка при заданной длительности тоже звучит (просто не управляет таймером)
    if (slide.duration && slide.voice && vol > 0) {
      const a = new Audio(resolve(slide.voice))
      a.volume = vol
      void a.play().catch(() => undefined)
      stopVoice = () => a.pause()
    }
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      stopVoice?.()
    }
    // настройки читаются в момент показа слайда (getSettings)
  }, [index, slide, next])

  const canSkip = testMode || index >= 1

  // клавиатура: пробел/Enter/→ — дальше, Esc — пропустить
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (typed < text.length) setTyped(text.length)
        else next()
      } else if (e.key === 'Escape' && canSkip) {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSkip, finish, next, text.length, typed])

  if (!slide) return null

  const origins = ['50% 50%', '35% 45%', '65% 55%', '50% 35%']
  const renderLayer = (i: number, role: 'in' | 'out') => {
    const s = slides[i]
    const tr = slides[role === 'in' ? i : index]?.transition ?? 'cut'
    const cls =
      role === 'in'
        ? prev !== null
          ? tr === 'slide'
            ? 'cs-in-slide'
            : tr === 'fade' || tr === 'panzoom'
              ? 'cs-in-fade'
              : ''
          : i === startAt && tr !== 'cut'
            ? 'cs-in-fade'
            : ''
        : tr === 'slide'
          ? 'cs-out-slide'
          : ''
    return (
      <div key={`${role}-${i}`} className={`cs-layer ${cls}`}>
        <SlideMedia
          slide={s}
          resolve={resolveRef.current}
          panzoomMs={role === 'in' ? panzoomMs : null}
          panzoomOrigin={origins[i % origins.length]}
          onVideoEnd={() => {
            if (role === 'in' && !s.duration) next()
          }}
        />
      </div>
    )
  }

  const showPrev = prev !== null && slide.transition !== 'cut'

  return (
    <div className="cutscene-overlay" role="dialog" aria-label={cutscene.label}>
      <div
        className="cs-stage"
        onClick={() => {
          if (typed < text.length) setTyped(text.length)
          else next()
        }}
      >
        {showPrev && renderLayer(prev!, 'out')}
        {renderLayer(index, 'in')}
        {text && (
          <div className="cs-caption" key={`cap-${index}`}>
            <p>
              {text.slice(0, typed)}
              <span className="cs-caption-rest">{text.slice(typed)}</span>
            </p>
          </div>
        )}
        {slide.video && !slide.art && !slide.image && (
          <div className="cs-online-badge" title="Видео с внешнего сервера">🌐 онлайн-видео</div>
        )}
      </div>
      <div className="cs-controls">
        <span className="cs-counter">
          {index + 1} / {slides.length}
        </span>
        {waitUser && (
          <button className="btn btn-small" onClick={next}>
            Далее ▸
          </button>
        )}
        {canSkip && (
          <button className="btn btn-small" onClick={finish}>
            {testMode ? '✕ Закрыть' : 'Пропустить ⏭'}
          </button>
        )}
      </div>
    </div>
  )
}
