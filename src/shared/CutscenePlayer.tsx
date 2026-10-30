/**
 * Проигрыватель слайд-катсцен (итерация 8, блок E) — один компонент для
 * игры и для тест-прогона в редакторе.
 *
 * Слайд: кадр (ArtDoc / изображение / видео) + подпись, которая печатается
 * поверх кадра снизу, + озвучка. Переходы: резкая смена, затемнение, сдвиг,
 * медленный наезд (панзум). Длительность — из слайда, иначе по озвучке
 * или по длине текста. «Пропустить» появляется после первого слайда.
 */

import { Ico } from './icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CutsceneDef, CutsceneSlide, MusicTrackDef, MusicSource } from './types'
import { ArtView } from './ArtView'
import { useCameraStyle } from '../player/Atmosphere'
import { getSettings, musicVolume, useSettings, voiceVolume } from './settings'
import { cutsceneTtsEligible } from './cutsceneTts'
import { speak } from './speech'
import { startTrackSource, type TrackHandle } from './music'

interface Props {
  cutscene: CutsceneDef
  /** путь ассета → URL (игра: assetUrl, редактор: store.assetSrc) */
  resolve: (path: string) => string
  /** резолвер трека кампании по id (музыка катсцены: файл/ссылка/MusicDoc) */
  resolveTrack?: (id: string) => MusicTrackDef | null
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

import { YoutubeSlide } from './cutsceneYoutube'

function SlideMedia({
  slide,
  resolve,
  panzoomMs,
  panzoomOrigin,
  onVideoEnd,
  onNeedUser,
}: {
  slide: CutsceneSlide
  resolve: (p: string) => string
  panzoomMs: number | null
  panzoomOrigin: string
  onVideoEnd: () => void
  /** фолбэк YouTube-слайда (API недоступен): показать кнопку «Далее» */
  onNeedUser: () => void
}) {
  const [videoFailed, setVideoFailed] = useState(false)
  const yt = slide.video ? youtubeId(slide.video) : null
  const camStyle = useCameraStyle(slide.camera ?? null)
  if (slide.video && !videoFailed && yt) {
    return <YoutubeSlide key={yt} ytId={yt} onVideoEnd={onVideoEnd} onFallback={onNeedUser} />
  }
  const style: React.CSSProperties = panzoomMs
    ? { animationDuration: `${panzoomMs}ms`, transformOrigin: panzoomOrigin }
    : {}
  const cls = `cs-media ${panzoomMs ? 'cs-panzoom' : ''}`
  // кинематографическая камера слайда (пан-зум по заданной точке и зуму мастера)
  if (slide.camera) {
    let media: React.ReactNode = null
    if (slide.art) media = <ArtView className="cs-media" art={slide.art} />
    else if (slide.image) media = <img className="cs-media" src={resolve(slide.image)} alt="" draggable={false} />
    if (media) {
      return (
        <div className="cs-cam-window">
          <div className="cs-cam-strip" style={camStyle}>{media}</div>
        </div>
      )
    }
  }
  if (slide.art) return <ArtView className={cls} art={slide.art} style={style} />
  if (slide.image) return <img className={cls} src={resolve(slide.image)} alt="" draggable={false} style={style} />
  if (slide.video && !videoFailed) {
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

export function CutscenePlayer({ cutscene, resolve, resolveTrack, onEnd, startAt = 0, testMode = false }: Props) {
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

  // музыка на всю катсцену (блок H: id трека — файл/ссылка/MusicDoc из реестра)
  const musicRef = useRef<TrackHandle | null>(null)
  const resolveTrackRef = useRef(resolveTrack)
  resolveTrackRef.current = resolveTrack
  useEffect(() => {
    const m = cutscene.music
    if (!m) return
    const track = resolveTrackRef.current?.(m)
    const src: MusicSource = track
      ? typeof track.src === 'string' ? resolveRef.current(track.src) : track.src
      : resolveRef.current(m)
    const vol = musicVolume(getSettings()) * (track?.volume ?? 1)
    const h = startTrackSource(src, vol, true)
    musicRef.current = h
    return () => {
      h.stop(0.4)
      musicRef.current = null
    }
  }, [cutscene.music])
  useEffect(() => {
    musicRef.current?.setVolume(musicVolume(settings))
  }, [settings])

  // таймер/озвучка слайда: когда переходить к следующему
  const panzoomMs = useMemo(() => {
    if (!slide || slide.transition !== 'panzoom') return null
    return (slide.duration ? slide.duration * 1000 : autoDurationMs(slide)) + TRANSITION_MS
  }, [slide])

  useEffect(() => {
    if (!slide) return
    // хронометраж слайдов — только при тесте из редактора (фидбек 9.13)
    if (testMode) {
      console.count(`slide-${index}`)
      console.time(`slide-${index}`)
    }
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
    const hasFixedDuration = !!slide.duration && slide.duration > 0
    const videoOnly = !!slide.video && !slide.art && !slide.image
    let minimumElapsed = !hasFixedDuration
    let voiceComplete = true
    let advanceScheduled = false
    const scheduleNext = (delay = 0) => {
      if (cancelled || !minimumElapsed || !voiceComplete || advanceScheduled) return
      advanceScheduled = true
      after(delay)
    }
    const finishVoice = (delay = 0) => {
      voiceComplete = true
      scheduleNext(delay)
    }

    if (hasFixedDuration) {
      timers.push(setTimeout(() => {
        minimumElapsed = true
        scheduleNext()
      }, slide.duration! * 1000))
    }

    const speakWithTts = () => {
      if (!cutsceneTtsEligible(slide, settings, vol)) {
        if (!hasFixedDuration && !videoOnly) after(autoDurationMs(slide))
        return
      }
      voiceComplete = false
      stopVoice = speak(slide.text!, {
        voice: settings.tts_voice,
        rate: settings.tts_rate,
        volume: vol,
        onEnd: () => finishVoice(600),
      })
    }

    if (slide.voice && vol > 0) {
      const a = new Audio(resolve(slide.voice))
      a.volume = vol
      let settled = false
      const finishAudio = (delay = 0) => {
        if (settled) return
        settled = true
        finishVoice(delay)
      }
      const failed = () => {
        a.pause()
        if (hasFixedDuration) finishAudio()
        else finishAudio(autoDurationMs(slide))
      }
      voiceComplete = false
      a.onended = () => finishAudio(700)
      a.onerror = failed
      void a.play().catch(failed)
      stopVoice = () => a.pause()
    } else if (cutsceneTtsEligible(slide, settings, vol)) {
      speakWithTts()
    } else if (!hasFixedDuration && !videoOnly) {
      after(autoDurationMs(slide))
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
      if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowRight') {
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
          onNeedUser={() => {
            if (role === 'in') setWaitUser(true)
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
        {slide.video && !slide.art && !slide.image && testMode && (
          <div className="cs-online-badge"><Ico n="globe" />  онлайн-видео</div>
        )}
      </div>
      <div className="cs-controls">
        {testMode && (
          <span className="cs-counter">
            {index + 1} / {slides.length}
          </span>
        )}
        {waitUser && (
          <button className="btn btn-small" onClick={next}>
            Далее ▸
          </button>
        )}
        {canSkip && (
          <button className="btn btn-small" onClick={finish}>
            {testMode ? 'Закрыть' : 'Пропустить'}
          </button>
        )}
      </div>
    </div>
  )
}
