import { useEffect, useRef, useState } from 'react'

/** YouTube-id из ссылки (watch?v=, youtu.be/, /embed/, /shorts/) */
export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([\w-]{6,})/) ??
    url.match(/[?&]v=([\w-]{6,})/) ??
    url.match(/youtube\.com\/(?:embed|shorts)\/([\w-]{6,})/)
  return m ? m[1] : null
}

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
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => reject(new Error('нет доступа к YouTube — проверьте сеть'))
      document.head.appendChild(script)
      setTimeout(() => reject(new Error('YouTube API не ответил')), 7000)
    })
  }
  return ytApiPromise
}

/** Видео-клип YouTube для обычной катсцены; FMV-проект использует локальный webm-режим. */
export function YoutubeSlide({ ytId, onVideoEnd, onFallback }: {
  ytId: string
  onVideoEnd: () => void
  onFallback: () => void
}) {
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
            onStateChange: (event: { data: number }) => {
              if (event.data === 0) endRef.current()
            },
          },
        })
      })
      .catch(() => {
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
        // YouTube may already have disposed its frame.
      }
    }
  }, [ytId])

  if (embedOnly) {
    return (
      <iframe
        className="cs-media cs-video"
        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&cc_load_policy=0&iv_load_policy=3&fs=0&disablekb=1`}
        allow="autoplay; encrypted-media"
        title="Видеофрагмент"
      />
    )
  }
  return <div className="cs-media cs-video cs-yt-host" ref={hostRef} />
}
