import { useEffect, useRef, useState } from 'react'

export interface FmvCutsceneChoice {
  index: number
  text: string
  ready: boolean
}

const promptStyle = {
  position: 'absolute' as const,
  zIndex: 4,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'grid',
  gap: 12,
  width: 'min(90%, 620px)',
  padding: '20px 24px',
  border: '1px solid #d5b87d',
  borderRadius: 12,
  color: '#f6ecd8',
  background: 'rgba(10, 12, 14, .9)',
  textAlign: 'center' as const,
  boxShadow: '0 16px 48px rgba(0, 0, 0, .65)',
}

const choicesStyle = {
  position: 'absolute' as const,
  zIndex: 5,
  left: '50%',
  bottom: '5%',
  transform: 'translateX(-50%)',
  display: 'grid',
  gap: 10,
  width: 'min(92%, 680px)',
  padding: 18,
  border: '1px solid #d5b87d',
  borderRadius: 12,
  background: 'rgba(10, 12, 14, .92)',
  textAlign: 'center' as const,
}

export interface FmvCutsceneView {
  scene: string
  fragment: string
  presentation: number
  posterUrl: string
  videoUrl: string | null
  phase: 'loading' | 'playing' | 'choice' | 'buffering' | 'ended' | 'error'
  subtitle: string | null
  choices: FmvCutsceneChoice[]
  error: string | null
  onVideoEnded: () => void
  onVideoError: () => void
  onPosition: (positionMs: number) => void
  onChoice: (index: number) => void
  onRetry: () => void
  onContinue: () => void
}

/** Visual fmv mode shared by the player cutscene host. Poster remains mounted at every seam. */
export function FmvCutsceneMode({ view }: { view: FmvCutsceneView }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [started, setStarted] = useState<number | null>(null)
  const [playBlocked, setPlayBlocked] = useState(false)
  const hasStarted = started === view.presentation
  const isTerminal = view.phase === 'ended' || view.phase === 'choice' || view.phase === 'error'

  useEffect(() => {
    if (started !== null && started !== view.presentation) setStarted(null)
    setPlayBlocked(false)
  }, [view.presentation, started])

  const begin = () => {
    setStarted(view.presentation)
    setPlayBlocked(false)
    const video = videoRef.current
    if (video) void video.play().catch(() => setPlayBlocked(true))
  }

  return (
    <div className="cutscene-overlay fmv-cutscene" role="dialog" aria-label="Ветвящееся видео" data-fmv-mode data-fmv-scene={view.scene} data-fmv-phase={view.phase}>
      <div className="cs-stage fmv-stage" data-fmv-fragment={view.fragment} data-fmv-presentation={view.presentation}>
        <img className="cs-media fmv-poster" src={view.posterUrl} alt="Постер видеофрагмента" data-fmv-poster style={{ zIndex: 0 }} />
        {view.videoUrl && (
          <video
            ref={videoRef}
            className={`cs-media cs-video fmv-video${hasStarted ? ' is-visible' : ''}`}
            style={{ opacity: hasStarted ? 1 : 0, zIndex: 1, transition: 'opacity 180ms ease', pointerEvents: hasStarted ? 'auto' : 'none' }}
            src={view.videoUrl}
            poster={view.posterUrl}
            preload="auto"
            playsInline
            controls={hasStarted}
            onEnded={view.onVideoEnded}
            onError={view.onVideoError}
            onTimeUpdate={(event) => {
              setPlayBlocked(false)
              view.onPosition(event.currentTarget.currentTime * 1000)
            }}
            aria-label={`Фрагмент ${view.fragment}`}
            data-fmv-video
          />
        )}
        {view.subtitle && view.phase === 'playing' && (
          <div className="cs-caption fmv-subtitle" data-fmv-subtitle style={{ zIndex: 2 }}>
            <p>{view.subtitle}</p>
          </div>
        )}
        {!hasStarted && view.phase === 'playing' && (
          <div className="fmv-poster-prompt" style={promptStyle}>
            <p>Фрагмент готов к просмотру</p>
            <button type="button" className="btn btn-primary" onClick={begin} data-fmv-play>
              ▶ Смотреть фрагмент
            </button>
          </div>
        )}
        {playBlocked && (
          <div className="fmv-poster-prompt" role="status" style={promptStyle}>
            <p>Браузер остановил автоматическое воспроизведение.</p>
            <button type="button" className="btn btn-primary" onClick={begin}>▶ Продолжить</button>
          </div>
        )}
        {(view.phase === 'loading' || view.phase === 'buffering') && (
          <div className="fmv-poster-prompt" role="status" data-fmv-buffering style={promptStyle}>
            <p>{view.phase === 'loading' ? 'Загружаем видеофрагмент…' : 'Подготавливаем следующий фрагмент…'}</p>
          </div>
        )}
        {view.phase === 'error' && (
          <div className="fmv-poster-prompt" role="alert" data-fmv-error style={promptStyle}>
            <p>{view.error || 'Не удалось загрузить видеофрагмент.'}</p>
            <button type="button" className="btn btn-primary" onClick={view.onRetry}>Повторить загрузку</button>
          </div>
        )}
        {view.phase === 'ended' && (
          <div className="fmv-poster-prompt fmv-ending" role="status" data-fmv-ending style={promptStyle}>
            <h2>Финал</h2>
            <p>Фрагмент завершён. Путь открыт — можно продолжить.</p>
            <button type="button" className="btn btn-primary" onClick={view.onContinue} data-fmv-continue>
              Продолжить
            </button>
          </div>
        )}
        {isTerminal && view.phase === 'choice' && (
          <div className="fmv-choices" role="group" aria-label="Выбор следующего фрагмента" data-fmv-choices style={choicesStyle}>
            <h2>Что делать дальше?</h2>
            {view.choices.map((choice) => (
              <button
                type="button"
                className="btn btn-primary fmv-choice"
                key={choice.index}
                disabled={!choice.ready}
                onClick={() => view.onChoice(choice.index)}
                data-fmv-choice={choice.index}
              >
                {choice.text}{choice.ready ? '' : ' · загружается'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="cs-controls fmv-controls" style={{ top: 16, right: 18, bottom: 'auto', padding: '4px 8px', borderRadius: 4, background: 'rgba(0, 0, 0, .55)' }}>
        <span className="cs-counter">Фрагмент {view.presentation}</span>
        {view.phase === 'buffering' && <span role="status">Следующий фрагмент загружается</span>}
      </div>
    </div>
  )
}
