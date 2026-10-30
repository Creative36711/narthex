/**
 * YouTube-слайд катсцены: IFrame Player API знает, когда ролик кончился.
 *
 * Вынесено из `CutscenePlayer.tsx`, чтобы общий проигрыватель не упирался в
 * лимит размера модуля: здесь только интеграция с внешним API и фолбэк на
 * обычный embed, всё остальное — кадр, подпись и звук — в проигрывателе.
 */

import { useEffect, useRef, useState } from 'react'

// ── YouTube: IFrame Player API — слайд знает, когда видео кончилось ──
let ytApiPromise: Promise<any> | null = null
function loadYtApi(): Promise<any> {
  const g = window as any
  if (g.YT?.Player) return Promise.resolve(g.YT)
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = g.onYouTubeIframeAPIReady
      g.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev()
        resolve(g.YT)
      }
      const sc = document.createElement('script')
      sc.src = 'https://www.youtube.com/iframe_api'
      sc.async = true
      sc.onerror = () => reject(new Error('нет доступа к YouTube — проверьте сеть'))
      document.head.appendChild(sc)
      setTimeout(() => reject(new Error('YouTube API не ответил')), 7000)
    })
  }
  return ytApiPromise
}

/** слайд с роликом YouTube: авто-переход в конце; если API недоступен — ждём «Далее» */
export function YoutubeSlide({ ytId, onVideoEnd, onFallback }: { ytId: string; onVideoEnd: () => void; onFallback: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef(onVideoEnd)
  endRef.current = onVideoEnd
  const [embedOnly, setEmbedOnly] = useState(false)
  useEffect(() => {
    let player: any = null
    let cancelled = false
    loadYtApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        player = new YT.Player(hostRef.current, {
          videoId: ytId,
          playerVars: {
            autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1,
            cc_load_policy: 0, iv_load_policy: 3, fs: 0, disablekb: 1,
            origin: window.location.origin,
          },
          events: {
            onStateChange: (e: { data: number }) => {
              if (e.data === 0) endRef.current() // ENDED
            },
          },
        })
      })
      .catch(() => {
        // API недоступен (нет сети у зрителя или у YouTube) — старая схема:
        // обычный embed, конец видео не слышим, ждём кнопку «Далее»
        if (!cancelled) {
          setEmbedOnly(true)
          onFallback()
        }
      })
    return () => {
      cancelled = true
      try {
        player?.destroy?.()
      } catch {
        /* уже убит */
      }
    }
  }, [ytId])
  if (embedOnly) {
    return (
      <iframe
        className="cs-media cs-video"
        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&cc_load_policy=0&iv_load_policy=3&fs=0&disablekb=1`}
        allow="autoplay; encrypted-media"
      />
    )
  }
  return <div className="cs-media cs-video cs-yt-host" ref={hostRef} />
}

